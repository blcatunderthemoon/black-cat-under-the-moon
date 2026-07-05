/**
 * Premium inbox — search users by display_name and resolve contact actions.
 */

import { getAdminClient, getSubscriptionTier, getSubscriptionTiers } from './server-auth.js';
import { checkQuota } from './permissions.js';
import { getChannelState } from './inbox-channel.js';

const OPEN_LETTER_SOURCES = new Set(['mirror_card', 'inbox_search']);

export { OPEN_LETTER_SOURCES };

function sanitizeSearchQuery(q) {
  return String(q || '').trim().replace(/[%_]/g, '').slice(0, 24);
}

function otherParticipant(thread, viewerId) {
  return thread.participant_a === viewerId ? thread.participant_b : thread.participant_a;
}

function pairOrFilter(userIdA, userIdB) {
  return `and(requester_id.eq.${userIdA},recipient_id.eq.${userIdB}),and(requester_id.eq.${userIdB},recipient_id.eq.${userIdA})`;
}

function buildBlockOrFilter(viewerId, targetIds) {
  return targetIds
    .flatMap((targetId) => [
      `and(blocker_id.eq.${viewerId},blocked_id.eq.${targetId})`,
      `and(blocker_id.eq.${targetId},blocked_id.eq.${viewerId})`,
    ])
    .join(',');
}

function buildExchangeOrFilter(viewerId, targetIds) {
  return targetIds.map((targetId) => pairOrFilter(viewerId, targetId)).join(',');
}

function resolveLetterOptions(viewerId, targetId, thread, ctx) {
  const existingThreadId = thread?.id || null;

  if (ctx.blockedTargets.has(targetId)) {
    return {
      can_send: false,
      action: null,
      existing_thread_id: existingThreadId,
      reason: 'blocked',
      quota_remaining: ctx.letterQuotaOk ? null : 0,
    };
  }

  if (!thread) {
    if (ctx.viewerTier !== 'premium') {
      return {
        can_send: false,
        action: null,
        existing_thread_id: null,
        reason: 'premium_required',
        quota_remaining: null,
      };
    }
    if (!ctx.letterQuotaOk) {
      return {
        can_send: false,
        action: null,
        existing_thread_id: null,
        reason: 'quota_exhausted',
        quota_remaining: 0,
      };
    }
    return {
      can_send: true,
      action: 'open',
      existing_thread_id: null,
      reason: null,
      quota_remaining: null,
    };
  }

  if (thread.source_type === 'photo_exchange') {
    return {
      can_send: false,
      action: null,
      existing_thread_id: existingThreadId,
      reason: 'channel_closed',
      quota_remaining: ctx.letterQuotaOk ? null : 0,
    };
  }

  const messages = ctx.messagesByThreadId.get(thread.id) || [];
  const channel = getChannelState({
    viewerId,
    viewerTier: ctx.viewerTier,
    messages,
    participantTiers: ctx.participantTiers,
    context: 'thread',
  });

  if (channel.can_compose || channel.can_reply) {
    return {
      can_send: true,
      action: 'reply',
      existing_thread_id: existingThreadId,
      reason: null,
      quota_remaining: null,
    };
  }

  if (channel.can_open) {
    if (!ctx.letterQuotaOk) {
      return {
        can_send: false,
        action: null,
        existing_thread_id: existingThreadId,
        reason: 'quota_exhausted',
        quota_remaining: 0,
      };
    }
    return {
      can_send: true,
      action: 'open',
      existing_thread_id: existingThreadId,
      reason: null,
      quota_remaining: null,
    };
  }

  if (channel.status === 'closed' && existingThreadId) {
    return {
      can_send: false,
      action: 'goto_thread',
      existing_thread_id: existingThreadId,
      reason: 'channel_closed',
      quota_remaining: ctx.letterQuotaOk ? null : 0,
    };
  }

  return {
    can_send: false,
    action: null,
    existing_thread_id: existingThreadId,
    reason: 'channel_closed',
    quota_remaining: ctx.letterQuotaOk ? null : 0,
  };
}

function resolveExchangeOptions(viewerId, targetId, ctx) {
  if (ctx.viewerTier !== 'premium') {
    return { can_request: false, reason: 'premium_required', inbox_thread_id: null };
  }
  if (ctx.blockedTargets.has(targetId)) {
    return { can_request: false, reason: 'blocked', inbox_thread_id: null };
  }
  if (!ctx.exchangeQuotaOk) {
    return { can_request: false, reason: 'quota_exhausted', inbox_thread_id: null };
  }
  if (!ctx.viewerHasExchangePhoto) {
    return { can_request: false, reason: 'no_exchange_photo', inbox_thread_id: null };
  }

  const exchange = ctx.exchangeByTargetId.get(targetId);
  const inboxThreadId = ctx.photoExchangeThreadByTargetId.get(targetId) || null;

  if (exchange?.status === 'pending') {
    if (exchange.requester_id === viewerId) {
      return {
        can_request: false,
        reason: 'pending_outgoing',
        inbox_thread_id: inboxThreadId,
      };
    }
    return {
      can_request: false,
      reason: 'pending_incoming',
      inbox_thread_id: inboxThreadId,
    };
  }

  if (
    exchange?.status === 'completed'
    && exchange.expires_at
    && new Date(exchange.expires_at).getTime() > Date.now()
  ) {
    return { can_request: false, reason: 'active_completed', inbox_thread_id: inboxThreadId };
  }

  return { can_request: true, reason: null, inbox_thread_id: null };
}

async function loadInboxSearchContext(viewerId, targetIds, { viewerTier: preloadedTier } = {}) {
  const uniqueTargetIds = [...new Set((targetIds || []).filter((id) => id && id !== viewerId))];
  const admin = getAdminClient();

  if (!uniqueTargetIds.length) {
    const viewerTier = preloadedTier ?? await getSubscriptionTier(viewerId);
    const [letterQuotaOk, exchangeQuotaOk] = await Promise.all([
      checkQuota(viewerId, 'active_letter_monthly'),
      checkQuota(viewerId, 'photo_exchange_monthly'),
    ]);
    return {
      viewerTier,
      letterQuotaOk,
      exchangeQuotaOk,
      viewerHasExchangePhoto: false,
      blockedTargets: new Set(),
      mirrorCardByUserId: new Map(),
      directThreadByTargetId: new Map(),
      messagesByThreadId: new Map(),
      participantTiers: { [viewerId]: viewerTier },
      exchangeByTargetId: new Map(),
      photoExchangeThreadByTargetId: new Map(),
    };
  }

  const targetSet = new Set(uniqueTargetIds);

  const [
    viewerTier,
    letterQuotaOk,
    exchangeQuotaOk,
    viewerProfileRes,
    blocksRes,
    mirrorCardsRes,
    directThreadsRes,
    photoExchangesRes,
    photoExchangeThreadsRes,
  ] = await Promise.all([
    preloadedTier ? Promise.resolve(preloadedTier) : getSubscriptionTier(viewerId),
    checkQuota(viewerId, 'active_letter_monthly'),
    checkQuota(viewerId, 'photo_exchange_monthly'),
    admin.from('profiles').select('exchange_photo_url').eq('id', viewerId).maybeSingle(),
    admin
      .from('user_blocks')
      .select('blocker_id, blocked_id')
      .or(buildBlockOrFilter(viewerId, uniqueTargetIds)),
    admin
      .from('mirror_cards')
      .select('user_id, public_slug, is_published')
      .in('user_id', uniqueTargetIds),
    admin
      .from('inbox_threads')
      .select('id, participant_a, participant_b, source_type')
      .eq('source_type', 'direct')
      .or(`participant_a.eq.${viewerId},participant_b.eq.${viewerId}`),
    admin
      .from('photo_exchanges')
      .select('id, status, requester_id, recipient_id, expires_at')
      .or(buildExchangeOrFilter(viewerId, uniqueTargetIds))
      .in('status', ['pending', 'completed']),
    admin
      .from('inbox_threads')
      .select('id, participant_a, participant_b')
      .eq('source_type', 'photo_exchange')
      .or(`participant_a.eq.${viewerId},participant_b.eq.${viewerId}`),
  ]);

  const blockedTargets = new Set();
  for (const row of blocksRes.data || []) {
    const other = row.blocker_id === viewerId ? row.blocked_id : row.blocker_id;
    if (targetSet.has(other)) blockedTargets.add(other);
  }

  const mirrorCardByUserId = new Map();
  for (const card of mirrorCardsRes.data || []) {
    if (!card?.user_id) continue;
    mirrorCardByUserId.set(card.user_id, card);
  }

  const directThreadByTargetId = new Map();
  const participantIds = new Set([viewerId]);
  for (const thread of directThreadsRes.data || []) {
    const other = otherParticipant(thread, viewerId);
    if (!targetSet.has(other)) continue;
    directThreadByTargetId.set(other, thread);
    participantIds.add(thread.participant_a);
    participantIds.add(thread.participant_b);
  }

  const exchangeByTargetId = new Map();
  for (const row of photoExchangesRes.data || []) {
    const other = row.requester_id === viewerId ? row.recipient_id : row.requester_id;
    if (!targetSet.has(other)) continue;
    const existing = exchangeByTargetId.get(other);
    if (!existing || row.status === 'pending') {
      exchangeByTargetId.set(other, row);
    }
  }

  const photoExchangeThreadByTargetId = new Map();
  for (const thread of photoExchangeThreadsRes.data || []) {
    const other = otherParticipant(thread, viewerId);
    if (targetSet.has(other)) {
      photoExchangeThreadByTargetId.set(other, thread.id);
    }
  }

  const threadIds = [...directThreadByTargetId.values()].map((t) => t.id);
  const messagesByThreadId = new Map();
  let participantTiers = { [viewerId]: viewerTier };

  if (threadIds.length) {
    const [messagesRes, tiers] = await Promise.all([
      admin
        .from('inbox_messages')
        .select('id, thread_id, sender_id, message_type, created_at')
        .in('thread_id', threadIds)
        .eq('is_hidden', false)
        .order('created_at', { ascending: true }),
      getSubscriptionTiers([...participantIds]),
    ]);
    participantTiers = tiers;

    for (const msg of messagesRes.data || []) {
      if (!msg?.thread_id) continue;
      const list = messagesByThreadId.get(msg.thread_id);
      if (list) list.push(msg);
      else messagesByThreadId.set(msg.thread_id, [msg]);
    }
  }

  return {
    viewerTier,
    letterQuotaOk,
    exchangeQuotaOk,
    viewerHasExchangePhoto: !!viewerProfileRes.data?.exchange_photo_url,
    blockedTargets,
    mirrorCardByUserId,
    directThreadByTargetId,
    messagesByThreadId,
    participantTiers,
    exchangeByTargetId,
    photoExchangeThreadByTargetId,
  };
}

function mapRowToSearchUser(viewerId, row, ctx) {
  const card = ctx.mirrorCardByUserId.get(row.id);
  const thread = ctx.directThreadByTargetId.get(row.id) || null;

  return {
    id: row.id,
    display_name: row.display_name || '神秘貓咪',
    mirror_card_slug: card?.is_published !== false && card?.public_slug ? card.public_slug : null,
    letter: resolveLetterOptions(viewerId, row.id, thread, ctx),
    exchange: resolveExchangeOptions(viewerId, row.id, ctx),
  };
}

export async function getInboxUserContactOptions(viewerId, targetUserId) {
  if (!viewerId || !targetUserId) {
    return { ok: false, status: 400, error: 'invalid_user' };
  }
  if (viewerId === targetUserId) {
    return { ok: false, status: 400, error: 'self' };
  }

  const tier = await getSubscriptionTier(viewerId);
  if (tier !== 'premium') {
    return { ok: false, status: 403, error: 'premium_required' };
  }

  const admin = getAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, display_name, status')
    .eq('id', targetUserId)
    .maybeSingle();

  if (!profile || profile.status === 'suspended' || profile.status === 'deleted') {
    return { ok: false, status: 404, error: 'not_found' };
  }

  const ctx = await loadInboxSearchContext(viewerId, [targetUserId]);
  const mapped = mapRowToSearchUser(viewerId, profile, ctx);

  return {
    ok: true,
    user: {
      id: mapped.id,
      display_name: mapped.display_name,
      mirror_card_slug: mapped.mirror_card_slug,
    },
    letter: mapped.letter,
    exchange: mapped.exchange,
  };
}

export async function searchInboxUsers(viewerId, rawQuery) {
  const tier = await getSubscriptionTier(viewerId);
  if (tier !== 'premium') {
    return { ok: false, status: 403, error: 'premium_required' };
  }

  const q = sanitizeSearchQuery(rawQuery);
  if (q.length < 1) {
    return { ok: true, users: [] };
  }

  const admin = getAdminClient();
  const { data: rows, error } = await admin
    .from('profiles')
    .select('id, display_name, status')
    .ilike('display_name', `%${q}%`)
    .neq('id', viewerId)
    .neq('status', 'suspended')
    .neq('status', 'deleted')
    .order('display_name', { ascending: true })
    .limit(8);

  if (error) {
    return { ok: false, status: 500, error: 'search_failed' };
  }

  const validRows = (rows || []).filter(
    (row) => row?.id && row.status !== 'suspended' && row.status !== 'deleted',
  );

  if (!validRows.length) {
    return { ok: true, users: [] };
  }

  const ctx = await loadInboxSearchContext(viewerId, validRows.map((row) => row.id), { viewerTier: tier });
  const users = validRows.map((row) => mapRowToSearchUser(viewerId, row, ctx));

  return { ok: true, users };
}
