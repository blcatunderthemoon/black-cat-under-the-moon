/**
 * src/lib/inbox.js
 * Server-side helpers for Inbox threads and messages.
 * All IDs are profiles.id (UUID). No WebSocket, no real-time.
 */

import { databaseNowIso } from './hong-kong-time.js';
import { getAdminClient, getSubscriptionTier, getSubscriptionTiers, ensureProfile } from './server-auth.js';
import { filterContent } from './content-filter.js';
import { isBlocked, canSendActiveLetter, assertAndConsumeQuota, getQuotaUsage } from './permissions.js';
import { notifyMatchCard, notifyNewLetter, notifyPhotoExchangeRequest } from './notify.js';
import { INBOX_MESSAGE_MAX_LENGTH } from './inbox-limits.js';
import { enrichThreadWithChannel, enrichPhotoExchangeThread } from './inbox-channel.js';
import { getPhotoExchangesByIds } from './photo-exchange.js';
import { normalizeLetterPrefs, validateLetterStyle } from './letter-gameplay.js';
import {
  enrichMatchThreadListItem,
  indexMatchCardsByThread,
} from './inbox-match-thread.js';
import {
  ensureSoloMatchAnchorUserId,
  findSoloMatchThread,
  isLegacySoloMatchThread,
  isSoloMatchPayload,
  orderedParticipants,
} from './inbox-solo-anchor.js';
import {
  linkResponseToAuthUser,
  parseSoloMatchSourceId,
  resolveResponseAuthUserId,
  soloMatchSourceId,
} from './match-response-auth.js';

async function ensureAuthProfileForInbox(admin, authUserId) {
  if (!authUserId) return null;
  const { data: existing } = await admin.from('profiles').select('id').eq('id', authUserId).maybeSingle();
  if (existing?.id) return authUserId;

  try {
    const { data: { user } } = await admin.auth.admin.getUserById(authUserId);
    if (!user?.id) return null;
    await ensureProfile(user);
    return authUserId;
  } catch {
    return null;
  }
}

async function loadMirrorSlugsByUserIds(admin, userIds) {
  if (!userIds.length) return {};
  const { data: cards } = await admin
    .from('mirror_cards')
    .select('user_id, public_slug, is_published')
    .in('user_id', userIds);
  const slugByUser = {};
  (cards || []).forEach((card) => {
    if (card.is_published !== false && card.public_slug) {
      slugByUser[card.user_id] = card.public_slug;
    }
  });
  return slugByUser;
}

async function loadThreadMessages(admin, threadId) {
  const { data } = await admin
    .from('inbox_messages')
    .select('id, sender_id, recipient_id, message_type, created_at')
    .eq('thread_id', threadId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true });
  return data || [];
}

async function findPhotoExchangeInboxMessage(admin, exchangeId) {
  const { data } = await admin
    .from('inbox_messages')
    .select('id, thread_id')
    .eq('message_type', 'photo_exchange_request')
    .filter('payload->>exchange_id', 'eq', exchangeId)
    .limit(1)
    .maybeSingle();
  return data || null;
}

// ── Thread helpers ─────────────────────────────────────────────────────────

async function loadParticipantTiers(userIds) {
  return getSubscriptionTiers(userIds);
}

/** Recent channel messages per thread (bounded) for list enrichment. */
const LIST_CHANNEL_MESSAGE_LIMIT = 50;

async function loadRecentChannelMessages(admin, threadIds) {
  if (!threadIds.length) return [];
  const batches = await Promise.all(
    threadIds.map(async (threadId) => {
      const { data } = await admin
        .from('inbox_messages')
        .select('id, thread_id, sender_id, recipient_id, message_type, created_at, content')
        .eq('thread_id', threadId)
        .eq('is_hidden', false)
        .in('message_type', ['user_letter', 'photo_exchange_request'])
        .order('created_at', { ascending: false })
        .limit(LIST_CHANNEL_MESSAGE_LIMIT);
      return (data || []).reverse();
    }),
  );
  return batches.flat();
}

async function loadMatchCardsByThread(admin, threadIds) {
  if (!threadIds.length) return [];
  const { data } = await admin
    .from('inbox_messages')
    .select('id, thread_id, recipient_id, content, payload, created_at, read_at')
    .in('thread_id', threadIds)
    .eq('message_type', 'match_card')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false });
  return data || [];
}

function groupMessagesByThread(messages) {
  const byThread = {};
  for (const msg of messages || []) {
    if (!byThread[msg.thread_id]) byThread[msg.thread_id] = [];
    byThread[msg.thread_id].push(msg);
  }
  return byThread;
}

function countUnreadByThread(messages) {
  const counts = {};
  for (const msg of messages || []) {
    counts[msg.thread_id] = (counts[msg.thread_id] || 0) + 1;
  }
  return counts;
}

async function loadSoloMatchPartnerNames(admin, viewerId, threads, matchCardByThread) {
  const names = {};
  const responseIds = new Set();

  for (const thread of threads || []) {
    if (thread.source_type !== 'match') continue;
    const card = matchCardByThread[thread.id];
    if (isSoloMatchPayload(card?.payload) || isLegacySoloMatchThread(thread)) {
      const solo = parseSoloMatchSourceId(card?.payload?.solo_match_key || thread.source_id);
      if (!solo) {
        const rA = Number(card?.payload?.response_a_id);
        const rB = Number(card?.payload?.response_b_id);
        if (rA) responseIds.add(rA);
        if (rB) responseIds.add(rB);
        continue;
      }
      responseIds.add(solo.responseAId);
      responseIds.add(solo.responseBId);
    }
  }

  if (!responseIds.size) return names;

  const [{ data: myResponses }, { data: pairResponses }] = await Promise.all([
    admin.from('responses').select('id').eq('user_id', viewerId),
    admin.from('responses').select('id, name').in('id', [...responseIds]),
  ]);

  const myIds = new Set((myResponses || []).map((r) => Number(r.id)));
  const responseById = Object.fromEntries((pairResponses || []).map((r) => [Number(r.id), r]));

  for (const thread of threads || []) {
    if (thread.source_type !== 'match') continue;
    const card = matchCardByThread[thread.id];
    if (!isSoloMatchPayload(card?.payload) && !isLegacySoloMatchThread(thread)) continue;

    const solo = parseSoloMatchSourceId(card?.payload?.solo_match_key || thread.source_id);
    const rA = Number(card?.payload?.response_a_id ?? solo?.responseAId);
    const rB = Number(card?.payload?.response_b_id ?? solo?.responseBId);
    const partnerId = myIds.has(rA) ? rB : myIds.has(rB) ? rA : (rA === rB ? rB : rA);
    const partner = responseById[partnerId];
    if (partner?.name) {
      names[thread.id] = { name: partner.name, responseId: partnerId };
    }
  }

  return names;
}

async function loadSoloMatchPartnerForThread(admin, viewerId, thread, messages) {
  const card = (messages || []).find((m) => m.message_type === 'match_card');
  const solo = parseSoloMatchSourceId(card?.payload?.solo_match_key || thread.source_id);
  if (!isSoloMatchPayload(card?.payload) && !isLegacySoloMatchThread(thread)) return null;

  const rA = Number(card?.payload?.response_a_id ?? solo?.responseAId);
  const rB = Number(card?.payload?.response_b_id ?? solo?.responseBId);

  const [{ data: myResponses }, { data: pairResponses }] = await Promise.all([
    admin.from('responses').select('id').eq('user_id', viewerId),
    admin.from('responses').select('id, name').in('id', [rA, rB]),
  ]);

  const myIds = new Set((myResponses || []).map((r) => Number(r.id)));
  const partnerId = myIds.has(rA) ? rB : myIds.has(rB) ? rA : rB;
  const partner = (pairResponses || []).find((r) => Number(r.id) === Number(partnerId));
  if (!partner?.name) return null;
  return { name: partner.name, responseId: partner.id };
}

/**
 * List inbox threads for a user, ordered by latest message.
 * Returns thread metadata and unread count per thread.
 */
export async function listThreads(userId, { limit = 20, offset = 0 } = {}) {
  const admin = getAdminClient();

  const { data: threads, error } = await admin
    .from('inbox_threads')
    .select(`
      id,
      participant_a,
      participant_b,
      source_type,
      source_id,
      last_message_at,
      created_at
    `)
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
    .order('last_message_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw Object.assign(new Error('Failed to load threads'), { status: 500 });
  if (!threads?.length) return [];

  const threadIds = threads.map((t) => t.id);
  const matchThreadIds = threads.filter((t) => t.source_type === 'match').map((t) => t.id);
  const otherIds = [...new Set(
    threads.map((thread) => (
      thread.participant_a === userId ? thread.participant_b : thread.participant_a
    )),
  )];
  const participantIds = [...new Set(
    threads.flatMap((t) => [t.participant_a, t.participant_b]),
  )];

  const [
    slugByUser,
    profilesResult,
    participantTiers,
    channelMessages,
    unreadMessagesResult,
    matchCardMessages,
  ] = await Promise.all([
    loadMirrorSlugsByUserIds(admin, otherIds),
    otherIds.length
      ? admin.from('profiles').select('id, display_name, avatar_style').in('id', otherIds)
      : Promise.resolve({ data: [] }),
    loadParticipantTiers(participantIds),
    loadRecentChannelMessages(admin, threadIds),
    admin
      .from('inbox_messages')
      .select('thread_id')
      .in('thread_id', threadIds)
      .eq('recipient_id', userId)
      .is('read_at', null)
      .eq('is_hidden', false),
    loadMatchCardsByThread(admin, matchThreadIds),
  ]);

  const viewerTier = participantTiers[userId] || 'free';

  const profileById = Object.fromEntries((profilesResult.data || []).map((p) => [p.id, p]));
  const messagesByThread = groupMessagesByThread(channelMessages);
  const unreadByThread = countUnreadByThread(unreadMessagesResult.data);
  const matchCardByThread = indexMatchCardsByThread(userId, matchCardMessages);

  const soloPartnerNames = await loadSoloMatchPartnerNames(admin, userId, threads, matchCardByThread);

  return threads.map((thread) => {
    const otherId = thread.participant_a === userId ? thread.participant_b : thread.participant_a;
    const soloPartner = soloPartnerNames[thread.id];
    const threadMessages = messagesByThread[thread.id] || [];
    const latestMessage = threadMessages[threadMessages.length - 1] || null;
    const unreadCount = unreadByThread[thread.id] || 0;

    const channelMeta = thread.source_type === 'photo_exchange'
      ? enrichPhotoExchangeThread({
        viewerId: userId,
        messages: threadMessages,
        latestMessage,
        viewerTier,
      })
      : thread.source_type === 'match'
        ? enrichMatchThreadListItem({
          unreadCount,
          matchMessage: matchCardByThread[thread.id] || null,
        })
        : enrichThreadWithChannel({
          threadId: thread.id,
          viewerId: userId,
          viewerTier,
          messages: threadMessages,
          participantTiers,
        });

    const otherProfile = soloPartner ? null : profileById[otherId];
    const matchCard = matchCardByThread[thread.id] || null;

    return {
      ...thread,
      other_participant: {
        id: soloPartner ? null : otherId,
        display_name: soloPartner?.name || otherProfile?.display_name || '神秘貓咪',
        avatar_style: otherProfile?.avatar_style || null,
        mirror_card_slug: soloPartner ? null : (slugByUser[otherId] || null),
        partner_response_id: soloPartner?.responseId || null,
      },
      unread_count: unreadCount,
      latest_message: matchCard
        ? {
            content: matchCard.content?.slice(0, 80) || '',
            message_type: 'match_card',
            created_at: matchCard.created_at,
          }
        : latestMessage
          ? {
              content: latestMessage.content?.slice(0, 80) || '',
              message_type: latestMessage.message_type,
              created_at: latestMessage.created_at,
            }
          : null,
      ...channelMeta,
    };
  });
}

/**
 * Get messages in a thread. Verifies the requesting user is a participant.
 * Marks unread messages as read.
 */
export async function getThread(threadId, userId) {
  const admin = getAdminClient();
  const viewerTier = await getSubscriptionTier(userId);

  // Verify participant
  const { data: thread, error: threadError } = await admin
    .from('inbox_threads')
    .select('*')
    .eq('id', threadId)
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
    .maybeSingle();

  if (threadError || !thread) {
    throw Object.assign(new Error('Thread not found or access denied'), { status: 404 });
  }

  // Load messages
  const { data: messages, error: msgError } = await admin
    .from('inbox_messages')
    .select('id, sender_id, recipient_id, message_type, content, payload, read_at, created_at')
    .eq('thread_id', threadId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true });

  if (msgError) throw Object.assign(new Error('Failed to load messages'), { status: 500 });

  // Mark unread messages for this user as read
  const unreadIds = (messages || [])
    .filter((m) => m.recipient_id === userId && !m.read_at)
    .map((m) => m.id);

  const markedReadCount = unreadIds.length;
  if (markedReadCount > 0) {
    const readAt = databaseNowIso();
    await admin
      .from('inbox_messages')
      .update({ read_at: readAt })
      .in('id', unreadIds);
    for (const msg of messages || []) {
      if (unreadIds.includes(msg.id)) msg.read_at = readAt;
    }
  }

  const otherId = thread.participant_a === userId ? thread.participant_b : thread.participant_a;
  const isPhotoExchangeThread = thread.source_type === 'photo_exchange';
  const isSoloMatchThread = thread.source_type === 'match' && (
    isLegacySoloMatchThread(thread)
    || (messages || []).some((m) => m.message_type === 'match_card' && isSoloMatchPayload(m.payload))
  );

  if (isPhotoExchangeThread) {
    const exchangeIds = [...new Set(
      (messages || [])
        .filter((m) => m.message_type === 'photo_exchange_request' && m.payload?.exchange_id)
        .map((m) => String(m.payload.exchange_id)),
    )];

    const senderIds = [...new Set((messages || []).filter((m) => m.sender_id).map((m) => m.sender_id))];

    const [
      viewerTier,
      otherProfileResult,
      slugByUser,
      viewerProfileResult,
      photoExchangeById,
      senderProfilesResult,
    ] = await Promise.all([
      getSubscriptionTier(userId),
      admin
        .from('profiles')
        .select('display_name, avatar_style')
        .eq('id', otherId)
        .maybeSingle(),
      loadMirrorSlugsByUserIds(admin, [otherId]),
      admin
        .from('profiles')
        .select('display_name, exchange_photo_url')
        .eq('id', userId)
        .maybeSingle(),
      getPhotoExchangesByIds(userId, exchangeIds),
      senderIds.length > 0
        ? admin.from('profiles').select('id, display_name, avatar_style').in('id', senderIds)
        : Promise.resolve({ data: [] }),
    ]);

    const viewerProfile = viewerProfileResult.data;
    const photoExchangeByIdResolved = { ...photoExchangeById };
    const viewerPhoto = viewerProfile?.exchange_photo_url || null;
    if (viewerPhoto) {
      for (const id of Object.keys(photoExchangeByIdResolved)) {
        if (!photoExchangeByIdResolved[id].viewer_photo_url) {
          photoExchangeByIdResolved[id] = {
            ...photoExchangeByIdResolved[id],
            viewer_photo_url: viewerPhoto,
          };
        }
      }
    }

    const senderProfiles = {};
    (senderProfilesResult.data || []).forEach((p) => { senderProfiles[p.id] = p; });
    const otherProfile = otherProfileResult.data;

    const messagesWithSenders = (messages || []).map((m) => ({
      ...m,
      sender: m.sender_id
        ? {
            display_name: senderProfiles[m.sender_id]?.display_name || '神秘貓咪',
            avatar_style: senderProfiles[m.sender_id]?.avatar_style || null,
            is_premium: false,
          }
        : null,
      is_mine: m.sender_id === userId,
      letter_align: m.message_type === 'photo_exchange_request' ? 'center' : 'right',
    }));

    const channelMeta = enrichPhotoExchangeThread({
      viewerId: userId,
      messages: messages || [],
      latestMessage: (messages || []).slice(-1)[0] || null,
      viewerTier,
    });

    return {
      thread,
      messages: messagesWithSenders,
      other_participant: {
        id: otherId,
        display_name: otherProfile?.display_name || '神秘貓咪',
        avatar_style: otherProfile?.avatar_style || null,
        mirror_card_slug: slugByUser[otherId] || null,
        is_premium: false,
      },
      viewer_name: viewerProfile?.display_name || '你',
      viewer_exchange_photo_url: viewerProfile?.exchange_photo_url || null,
      photo_exchange_by_id: photoExchangeByIdResolved,
      active_letter_quota: null,
      ...channelMeta,
    };
  }

  // Attach sender display names (never email)
  const senderIds = [...new Set((messages || []).filter((m) => m.sender_id).map((m) => m.sender_id))];
  const senderProfiles = {};
  if (senderIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, display_name, avatar_style')
      .in('id', senderIds);
    (profiles || []).forEach((p) => { senderProfiles[p.id] = p; });
  }

  const [otherProfileResult, slugByUser, viewerProfileResult, soloPartnerResult] = await Promise.all([
    isSoloMatchThread
      ? Promise.resolve({ data: null })
      : admin
        .from('profiles')
        .select('display_name, avatar_style, letter_prefs')
        .eq('id', otherId)
        .maybeSingle(),
    isSoloMatchThread ? Promise.resolve({}) : loadMirrorSlugsByUserIds(admin, [otherId]),
    admin
      .from('profiles')
      .select('letter_prefs')
      .eq('id', userId)
      .maybeSingle(),
    isSoloMatchThread
      ? loadSoloMatchPartnerForThread(admin, userId, thread, messages || [])
      : Promise.resolve(null),
  ]);
  const otherProfile = otherProfileResult.data;
  const soloPartner = soloPartnerResult;

  const participantTiers = await loadParticipantTiers([
    thread.participant_a,
    thread.participant_b,
  ]);

  const messagesWithSenders = (messages || []).map((m) => {
    const senderTier = m.sender_id ? participantTiers[m.sender_id] : null;
    let letterAlign = 'right';
    if (m.message_type === 'match_card' || m.message_type === 'photo_exchange_request') {
      letterAlign = 'center';
    } else if (senderTier === 'premium') {
      letterAlign = 'left';
    }
    return {
      ...m,
      sender: m.sender_id
        ? {
            display_name: senderProfiles[m.sender_id]?.display_name || '神秘貓咪',
            avatar_style: senderProfiles[m.sender_id]?.avatar_style || null,
            is_premium: senderTier === 'premium',
          }
        : null,
      is_mine: m.sender_id === userId,
      letter_align: letterAlign,
    };
  });

  const channelMeta = thread.source_type === 'photo_exchange'
    ? enrichPhotoExchangeThread({
      viewerId: userId,
      messages: messages || [],
      latestMessage: (messages || []).slice(-1)[0] || null,
      viewerTier,
    })
    : thread.source_type === 'match'
      ? enrichMatchThreadListItem({
        unreadCount: unreadIds.length,
        matchMessage: (messages || []).find((m) => m.message_type === 'match_card' && m.recipient_id === userId)
          || (messages || []).find((m) => m.message_type === 'match_card')
          || null,
      })
      : enrichThreadWithChannel({
        threadId,
        viewerId: userId,
        viewerTier,
        messages: messages || [],
        participantTiers,
      });

  const activeLetterQuota = viewerTier === 'premium'
    ? await getQuotaUsage(userId, 'active_letter_monthly')
    : null;

  return {
    thread,
    messages: messagesWithSenders,
    marked_read_count: markedReadCount,
    other_participant: {
      id: soloPartner ? null : otherId,
      display_name: soloPartner?.name || otherProfile?.display_name || '神秘貓咪',
      avatar_style: otherProfile?.avatar_style || null,
      mirror_card_slug: soloPartner ? null : (slugByUser[otherId] || null),
      is_premium: soloPartner ? false : participantTiers[otherId] === 'premium',
      partner_response_id: soloPartner?.responseId || null,
    },
    viewer_letter_prefs: normalizeLetterPrefs(viewerProfileResult.data?.letter_prefs, viewerTier),
    active_letter_quota: activeLetterQuota,
    ...channelMeta,
  };
}

// ── Send helpers ───────────────────────────────────────────────────────────

/**
 * Send a user letter.
 * Handles both:
 *   - New thread (active letter, Premium required if no existing relation)
 *   - Reply in existing thread (Free allowed)
 *
 * Returns { thread_id, message_id }
 */
export async function sendLetter({
  senderId,
  recipientId,
  content,
  existingThreadId = null,
  sourceType = null,
  letterStyle = null,
}) {
  const trimmed = content?.trim() || '';
  if (!trimmed) {
    throw Object.assign(new Error('Message content is required'), { status: 400 });
  }
  if (trimmed.length > INBOX_MESSAGE_MAX_LENGTH) {
    throw Object.assign(new Error(`訊息最多 ${INBOX_MESSAGE_MAX_LENGTH} 字。`), { status: 400 });
  }

  // Content moderation
  const { blocked, crisis } = filterContent(trimmed);
  if (blocked) {
    const err = Object.assign(new Error(crisis ? 'crisis' : 'blocked_content'), { status: 422 });
    err.crisis = crisis;
    throw err;
  }

  // Permission check
  const { allowed, reason, action } = await canSendActiveLetter(
    senderId,
    recipientId,
    existingThreadId,
    sourceType,
  );
  if (!allowed) {
    throw Object.assign(new Error(reason || 'Not allowed to send'), { status: 403, reason });
  }

  const admin = getAdminClient();

  // Find or create thread
  let threadId = existingThreadId;
  if (!threadId) {
    const { data: existing } = await admin
      .from('inbox_threads')
      .select('id')
      .eq('source_type', 'direct')
      .or(
        `and(participant_a.eq.${senderId},participant_b.eq.${recipientId}),and(participant_a.eq.${recipientId},participant_b.eq.${senderId})`,
      )
      .limit(1)
      .maybeSingle();

    if (existing) {
      threadId = existing.id;
    } else {
      const { data: newThread, error: threadError } = await admin
        .from('inbox_threads')
        .insert({
          participant_a: senderId,
          participant_b: recipientId,
          source_type: 'direct',
          last_message_at: databaseNowIso(),
        })
        .select('id')
        .single();

      if (threadError) throw Object.assign(new Error('Failed to create thread'), { status: 500 });
      threadId = newThread.id;
    }
  }

  if (action === 'open') {
    await assertAndConsumeQuota(senderId, 'active_letter_monthly');
  }

  const senderTier = await getSubscriptionTier(senderId);
  const validatedStyle = validateLetterStyle(letterStyle, senderTier);
  const messagePayload = {
    letter_style: validatedStyle,
  };

  // Insert message
  const { data: message, error: msgError } = await admin
    .from('inbox_messages')
    .insert({
      thread_id: threadId,
      sender_id: senderId,
      recipient_id: recipientId,
      message_type: 'user_letter',
      content: trimmed.slice(0, INBOX_MESSAGE_MAX_LENGTH),
      payload: messagePayload,
    })
    .select('id')
    .single();

  if (msgError) throw Object.assign(new Error('Failed to send message'), { status: 500 });

  // Update thread's last_message_at
  await admin
    .from('inbox_threads')
    .update({ last_message_at: databaseNowIso() })
    .eq('id', threadId);

  // Notify recipient silently
  const { data: senderProfile } = await getAdminClient()
    .from('profiles')
    .select('display_name')
    .eq('id', senderId)
    .maybeSingle();
  notifyNewLetter(recipientId, senderProfile?.display_name).catch(() => {});

  return { thread_id: threadId, message_id: message.id };
}

/**
 * Deliver a match card to registered participant(s).
 * Both sides receive Inbox cards when claimed; if only one has an account,
 * the registered user still gets a solo match thread.
 */
export async function deliverMatchCard({
  responseAId,
  responseBId,
  matchScore,
  matchSummary = {},
  skipEmailNotify = false,
}) {
  const admin = getAdminClient();

  const { data: rows, error } = await admin
    .from('responses')
    .select('id, user_id, name, email')
    .in('id', [responseAId, responseBId]);

  if (error || !rows?.length) {
    return { delivered: false, reason: 'responses_not_found' };
  }

  const rowA = rows.find((r) => Number(r.id) === Number(responseAId));
  const rowB = rows.find((r) => Number(r.id) === Number(responseBId));
  if (!rowA || !rowB) return { delivered: false, reason: 'response_missing' };

  let authA = await resolveResponseAuthUserId(admin, rowA);
  let authB = await resolveResponseAuthUserId(admin, rowB);
  if (authA && !rowA.user_id) authA = await linkResponseToAuthUser(admin, rowA, authA);
  if (authB && !rowB.user_id) authB = await linkResponseToAuthUser(admin, rowB, authB);
  if (authA) authA = await ensureAuthProfileForInbox(admin, authA);
  if (authB) authB = await ensureAuthProfileForInbox(admin, authB);

  if (!authA && !authB) {
    return {
      delivered: false,
      reason: 'unclaimed_partner',
      details: { a_claimed: false, b_claimed: false },
    };
  }

  const now = databaseNowIso();
  const sameAuthUser = !!(authA && authB && authA === authB);
  const isSolo = !authA || !authB || sameAuthUser;
  const userAId = authA || authB;
  const userBId = authB || authA;
  const soloKey = isSolo ? soloMatchSourceId(responseAId, responseBId) : null;

  let threadId;
  if (isSolo) {
    const registeredId = authA || authB;
    const anchorId = await ensureSoloMatchAnchorUserId(admin);
    threadId = await findSoloMatchThread(admin, registeredId, anchorId, soloKey);

    if (!threadId) {
      const [participantA, participantB] = orderedParticipants(registeredId, anchorId);
      const { data: newThread, error: threadError } = await admin
        .from('inbox_threads')
        .insert({
          participant_a: participantA,
          participant_b: participantB,
          source_type: 'match',
          source_id: null,
          last_message_at: now,
        })
        .select('id')
        .single();

      if (threadError) {
        return {
          delivered: false,
          reason: 'thread_create_failed',
          error: threadError.message,
        };
      }
      threadId = newThread.id;
    }
  } else {
    const { data: existingThread } = await admin
      .from('inbox_threads')
      .select('id')
      .eq('source_type', 'match')
      .or(
        `and(participant_a.eq.${userAId},participant_b.eq.${userBId}),and(participant_a.eq.${userBId},participant_b.eq.${userAId})`,
      )
      .limit(1)
      .maybeSingle();

    if (existingThread) {
      threadId = existingThread.id;
    } else {
      const { data: newThread, error: threadError } = await admin
        .from('inbox_threads')
        .insert({
          participant_a: userAId,
          participant_b: userBId,
          source_type: 'match',
          source_id: null,
          last_message_at: now,
        })
        .select('id')
        .single();

      if (threadError) {
        return {
          delivered: false,
          reason: 'thread_create_failed',
          error: threadError.message,
        };
      }
      threadId = newThread.id;
    }
  }

  const aKey = String(responseAId);
  const bKey = String(responseBId);
  const { data: existingCards } = await admin
    .from('inbox_messages')
    .select('id, recipient_id')
    .eq('thread_id', threadId)
    .eq('message_type', 'match_card')
    .or(
      `and(payload->>response_a_id.eq.${aKey},payload->>response_b_id.eq.${bKey}),and(payload->>response_a_id.eq.${bKey},payload->>response_b_id.eq.${aKey})`,
    );

  const cardPayload = {
    match_score: matchScore,
    match_summary: matchSummary,
    response_a_id: responseAId,
    response_b_id: responseBId,
    solo_partner: isSolo,
    solo_match_key: soloKey,
  };

  const recipients = [...new Set([authA, authB].filter(Boolean))];
  const existingRecipientIds = new Set((existingCards || []).map((m) => m.recipient_id));

  if (existingCards?.length && recipients.every((id) => existingRecipientIds.has(id))) {
    await admin.from('inbox_threads').update({ last_message_at: now }).eq('id', threadId);
    return {
      delivered: true,
      thread_id: threadId,
      message_ids: existingCards.map((m) => m.id),
      already_exists: true,
      solo: isSolo,
    };
  }

  const insertedIds = (existingCards || []).map((m) => m.id);
  for (const recipientId of recipients) {
    if (existingRecipientIds.has(recipientId)) continue;
    const { data: inserted } = await admin
      .from('inbox_messages')
      .insert({
        thread_id: threadId,
        sender_id: null,
        recipient_id: recipientId,
        message_type: 'match_card',
        content: `你同對方連線成功！同步率：${matchScore}/100`,
        payload: cardPayload,
      })
      .select('id')
      .single();
    if (inserted) insertedIds.push(inserted.id);
  }

  await admin.from('inbox_threads').update({ last_message_at: now }).eq('id', threadId);

  if (!skipEmailNotify) {
    for (const recipientId of recipients) {
      notifyMatchCard(recipientId, { matchScore }).catch(() => {});
    }
  }

  return {
    delivered: true,
    thread_id: threadId,
    message_ids: insertedIds,
    solo: isSolo,
    recipients,
  };
}

async function findOrCreateDirectThread(admin, userIdA, userIdB) {
  const { data: existing } = await admin
    .from('inbox_threads')
    .select('id')
    .eq('source_type', 'direct')
    .or(
      `and(participant_a.eq.${userIdA},participant_b.eq.${userIdB}),and(participant_a.eq.${userIdB},participant_b.eq.${userIdA})`,
    )
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: newThread, error } = await admin
    .from('inbox_threads')
    .insert({
      participant_a: userIdA,
      participant_b: userIdB,
      source_type: 'direct',
      last_message_at: databaseNowIso(),
    })
    .select('id')
    .single();

  if (error) throw error;
  return newThread.id;
}

async function findOrCreatePhotoExchangeThread(admin, userIdA, userIdB) {
  const { data: existing } = await admin
    .from('inbox_threads')
    .select('id')
    .eq('source_type', 'photo_exchange')
    .or(
      `and(participant_a.eq.${userIdA},participant_b.eq.${userIdB}),and(participant_a.eq.${userIdB},participant_b.eq.${userIdA})`,
    )
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: newThread, error } = await admin
    .from('inbox_threads')
    .insert({
      participant_a: userIdA,
      participant_b: userIdB,
      source_type: 'photo_exchange',
      last_message_at: databaseNowIso(),
    })
    .select('id')
    .single();

  if (error) throw error;
  return newThread.id;
}

/**
 * Inbox + email notification when a Premium user requests photo exchange.
 * Idempotent per exchange_id — safe to call again if a prior delivery failed.
 */
export async function deliverPhotoExchangeRequest({
  requesterId,
  recipientId,
  exchangeId,
  requesterSlug,
}) {
  const admin = getAdminClient();
  const now = databaseNowIso();

  const existing = await findPhotoExchangeInboxMessage(admin, exchangeId);
  if (existing) {
    await admin
      .from('inbox_threads')
      .update({ last_message_at: now })
      .eq('id', existing.thread_id);
    return { ok: true, thread_id: existing.thread_id, already_delivered: true };
  }

  const { data: requesterProfile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', requesterId)
    .maybeSingle();

  const safeName = requesterProfile?.display_name || '某位貓咪';
  const content = `${safeName} 想與你交換真人相片。上傳你的相片即可完成交換。`;

  let threadId;
  try {
    threadId = await findOrCreatePhotoExchangeThread(admin, requesterId, recipientId);
  } catch (err) {
    console.error('[inbox] deliverPhotoExchangeRequest thread failed:', err?.message);
    return { ok: false, error: err?.message || 'thread_failed' };
  }

  const { error: msgError } = await admin
    .from('inbox_messages')
    .insert({
      thread_id: threadId,
      sender_id: requesterId,
      recipient_id: recipientId,
      message_type: 'photo_exchange_request',
      content,
      payload: {
        exchange_id: exchangeId,
        requester_slug: requesterSlug || null,
      },
    });

  if (msgError) {
    console.error('[inbox] deliverPhotoExchangeRequest message failed:', msgError.message);
    return { ok: false, error: msgError.message };
  }

  await admin
    .from('inbox_threads')
    .update({ last_message_at: now })
    .eq('id', threadId);

  notifyPhotoExchangeRequest(recipientId, {
    senderName: safeName,
    requesterSlug: requesterSlug || null,
  }).catch(() => {});

  return { ok: true, thread_id: threadId };
}

// ── Report / Block ─────────────────────────────────────────────────────────

export async function reportMessage(messageId, reporterId) {
  const admin = getAdminClient();

  // Verify reporter is recipient of the message
  const { data: msg } = await admin
    .from('inbox_messages')
    .select('id, recipient_id, report_count')
    .eq('id', messageId)
    .eq('recipient_id', reporterId)
    .maybeSingle();

  if (!msg) throw Object.assign(new Error('Message not found'), { status: 404 });

  await admin
    .from('inbox_messages')
    .update({ report_count: (msg.report_count || 0) + 1 })
    .eq('id', messageId);

  return { success: true };
}

export async function blockUser(blockerId, blockedId) {
  const admin = getAdminClient();

  if (blockerId === blockedId) {
    throw Object.assign(new Error('Cannot block yourself'), { status: 400 });
  }

  const { error } = await admin
    .from('user_blocks')
    .upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' });

  if (error) throw Object.assign(new Error('Failed to block user'), { status: 500 });
  return { success: true };
}
