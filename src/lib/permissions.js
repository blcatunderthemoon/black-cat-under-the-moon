/**
 * src/lib/permissions.js
 * Server-side permission helpers.
 * All checks run on the server — never trust client-submitted role claims.
 */

import { getAdminClient, getSubscriptionTier } from './server-auth.js';
import { getChannelState } from './inbox-channel.js';
import {
  databaseNowIso,
  getHongKongDayEnd,
  getHongKongDayStart,
  getHongKongMonthEnd,
  getHongKongMonthStart,
} from './hong-kong-time.js';
import { getPublicProfile } from './mirror-personality.js';

// ── Mirror Card visibility ─────────────────────────────────────────────────

/**
 * Determine the highest mirror card visibility level that viewerId can see
 * for the card owned by ownerId.
 *
 * Returns: 'detailed' | 'basic' | 'public' | 'none'
 */
export async function getMirrorCardVisibility(viewerId, ownerId) {
  // Owner sees everything
  if (viewerId && viewerId === ownerId) return 'detailed';

  if (!viewerId) return 'public';

  // tier, block and match status are independent — resolve concurrently.
  const [tier, blocked, matched] = await Promise.all([
    getSubscriptionTier(viewerId),
    isBlocked(viewerId, ownerId),
    areMatched(viewerId, ownerId),
  ]);

  if (blocked) return 'public';

  // Premium viewers can see detailed cards of anyone (unless blocked)
  if (tier === 'premium') return 'detailed';

  // Matched users get the basic view
  if (matched) return 'basic';

  return 'public';
}

/**
 * Returns true if userA and userB have a mutual match (both received each
 * other's match card in inbox). Uses profiles.id via responses.user_id.
 */
async function areMatched(userIdA, userIdB) {
  const admin = getAdminClient();

  // Look for an inbox thread of type 'match' between the two users
  const { data } = await admin
    .from('inbox_threads')
    .select('id')
    .eq('source_type', 'match')
    .or(
      `and(participant_a.eq.${userIdA},participant_b.eq.${userIdB}),and(participant_a.eq.${userIdB},participant_b.eq.${userIdA})`
    )
    .limit(1)
    .maybeSingle();

  return !!data;
}

/**
 * Shape a mirror_cards row down to only the fields allowed for the given
 * visibility level. Returns a safe object for the API response.
 *
 * visibility: 'detailed' | 'basic' | 'public'
 */
export function shapeMirrorCard(card, visibility) {
  if (!card) return null;

  // Fields always safe to show
  const base = {
    public_slug: card.public_slug,
    mirror_type: card.mirror_type,
  };

  if (visibility === 'public' || visibility === 'basic') {
    return {
      ...base,
      public_profile: getPublicProfile(card.basic_answers),
    };
  }

  if (visibility === 'detailed') {
    return {
      ...base,
      id: card.id,
      user_id: card.user_id,
      shadow_type: card.shadow_type,
      mirror_scores: card.mirror_scores,
      trait_scores: card.trait_scores,
      scoring_version: card.scoring_version,
      tension_narratives: card.tension_narratives,
      basic_answers: card.basic_answers,
      matching_summary: card.matching_summary,
      visibility_settings: card.visibility_settings,
      card_image_url: card.card_image_url,
      created_at: card.created_at,
      updated_at: card.updated_at,
    };
  }

  return null;
}

// ── Block checks ───────────────────────────────────────────────────────────

/**
 * Returns true if blockerId has blocked blockedId, OR if blockedId has
 * blocked blockerId (mutual check for safety).
 */
export async function isBlocked(userIdA, userIdB) {
  const admin = getAdminClient();
  const { data } = await admin
    .from('user_blocks')
    .select('id')
    .or(
      `and(blocker_id.eq.${userIdA},blocked_id.eq.${userIdB}),and(blocker_id.eq.${userIdB},blocked_id.eq.${userIdA})`
    )
    .limit(1)
    .maybeSingle();

  return !!data;
}

// ── Active letter (inbox send) permissions ─────────────────────────────────

/**
 * Load subscription tiers for a set of user IDs.
 */
async function loadParticipantTiers(userIds) {
  const tiers = {};
  await Promise.all(
    userIds.map(async (id) => {
      tiers[id] = await getSubscriptionTier(id);
    }),
  );
  return tiers;
}

/**
 * Returns true if senderId is allowed to send an active letter to recipientId.
 *
 * Rules (mystic channel model):
 * - Must be logged in, not blocked, not self
 * - Open channel: Premium from Mirror Card only (consumes monthly quota)
 * - Open channel: up to 10 back-and-forth messages per session, then closes
 * - Both participants may send while channel is open
 */
export async function canSendActiveLetter(senderId, recipientId, existingThreadId = null, sourceType = null) {
  if (!senderId || !recipientId) return { allowed: false, reason: 'not_logged_in' };
  if (senderId === recipientId) return { allowed: false, reason: 'self_send' };

  const blocked = await isBlocked(senderId, recipientId);
  if (blocked) return { allowed: false, reason: 'blocked' };

  const tier = await getSubscriptionTier(senderId);
  const admin = getAdminClient();

  let threadId = existingThreadId;
  if (!threadId) {
    const { data: existing } = await admin
      .from('inbox_threads')
      .select('id, participant_a, participant_b')
      .eq('source_type', 'direct')
      .or(
        `and(participant_a.eq.${senderId},participant_b.eq.${recipientId}),and(participant_a.eq.${recipientId},participant_b.eq.${senderId})`,
      )
      .limit(1)
      .maybeSingle();
    if (existing) threadId = existing.id;
  }

  if (!threadId) {
    if (tier !== 'premium') return { allowed: false, reason: 'premium_required' };
    if (sourceType !== 'mirror_card' && sourceType !== 'inbox_search') {
      return { allowed: false, reason: 'open_from_mirror_only' };
    }
    const quotaOk = await checkQuota(senderId, 'active_letter_monthly');
    if (!quotaOk) return { allowed: false, reason: 'quota_exhausted' };
    return { allowed: true, action: 'open' };
  }

  const { data: thread } = await admin
    .from('inbox_threads')
    .select('id, participant_a, participant_b, source_type')
    .eq('id', threadId)
    .or(`participant_a.eq.${senderId},participant_b.eq.${senderId}`)
    .maybeSingle();

  if (!thread) return { allowed: false, reason: 'no_existing_thread' };

  if (thread.source_type === 'photo_exchange') {
    return { allowed: false, reason: 'photo_exchange_thread' };
  }

  const { data: messages } = await admin
    .from('inbox_messages')
    .select('id, sender_id, message_type, created_at')
    .eq('thread_id', threadId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true });

  const participantIds = [thread.participant_a, thread.participant_b];
  const participantTiers = await loadParticipantTiers(participantIds);

  const channel = getChannelState({
    viewerId: senderId,
    viewerTier: tier,
    messages: messages || [],
    participantTiers,
    context: sourceType === 'mirror_card' ? 'mirror' : 'thread',
  });

  if (channel.can_compose || channel.can_reply) {
    return { allowed: true, action: 'reply' };
  }

  if (channel.can_open) {
    if (sourceType !== 'mirror_card' && sourceType !== 'inbox_search') {
      return { allowed: false, reason: 'open_from_mirror_only' };
    }
    const quotaOk = await checkQuota(senderId, 'active_letter_monthly');
    if (!quotaOk) return { allowed: false, reason: 'quota_exhausted' };
    return { allowed: true, action: 'open' };
  }

  if (channel.status === 'closed') {
    return { allowed: false, reason: 'channel_closed' };
  }

  return { allowed: false, reason: 'channel_closed' };
}

/**
 * Messaging options when viewing another user's mirror card.
 * Returns null for owners or unauthenticated viewers.
 */
export async function getMirrorCardMessaging(viewerId, ownerId) {
  if (!viewerId || !ownerId || viewerId === ownerId) return null;

  const blocked = await isBlocked(viewerId, ownerId);
  if (blocked) {
    return { can_send: false, can_start: false, reason: 'blocked' };
  }

  const admin = getAdminClient();
  const viewerTier = await getSubscriptionTier(viewerId);

  const { data: existingThread } = await admin
    .from('inbox_threads')
    .select('id, participant_a, participant_b')
    .eq('source_type', 'direct')
    .or(
      `and(participant_a.eq.${viewerId},participant_b.eq.${ownerId}),and(participant_a.eq.${ownerId},participant_b.eq.${viewerId})`,
    )
    .limit(1)
    .maybeSingle();

  if (existingThread) {
    const { data: messages } = await admin
      .from('inbox_messages')
      .select('id, sender_id, message_type, created_at')
      .eq('thread_id', existingThread.id)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true });

    const participantTiers = await loadParticipantTiers([
      existingThread.participant_a,
      existingThread.participant_b,
    ]);

    const channel = getChannelState({
      viewerId,
      viewerTier,
      messages: messages || [],
      participantTiers,
      context: 'mirror',
    });

    if (channel.channel_open) {
      return {
        recipient_id: ownerId,
        existing_thread_id: existingThread.id,
        can_send: false,
        can_start: false,
        channel_state: channel.status,
        compose_mode: null,
        compose_title: null,
        compose_hint: null,
        reason: 'channel_active',
      };
    }

    if (channel.can_open) {
      const quotaOk = await checkQuota(viewerId, 'active_letter_monthly');
      return {
        recipient_id: ownerId,
        existing_thread_id: existingThread.id,
        can_send: quotaOk,
        can_start: false,
        channel_state: channel.status,
        compose_mode: channel.compose_mode,
        compose_title: channel.compose_title,
        compose_hint: channel.compose_hint,
        reason: quotaOk ? null : 'quota_exhausted',
      };
    }

    return {
      recipient_id: ownerId,
      existing_thread_id: existingThread.id,
      can_send: false,
      can_start: false,
      channel_state: channel.status,
      compose_mode: null,
      compose_title: null,
      compose_hint: null,
      reason: 'channel_closed',
    };
  }

  if (viewerTier !== 'premium') {
    return { can_send: false, can_start: false, reason: 'premium_required' };
  }

  const quotaOk = await checkQuota(viewerId, 'active_letter_monthly');
  return {
    recipient_id: ownerId,
    existing_thread_id: null,
    can_send: quotaOk,
    can_start: true,
    compose_mode: 'open',
    compose_title: '寄出新信',
    compose_hint: null,
    reason: quotaOk ? null : 'quota_exhausted',
  };
}

// ── Quota management ───────────────────────────────────────────────────────

const QUOTA_LIMITS = {
  forum_post_daily: { free: 3, premium: Infinity },
  active_letter_monthly: { free: 0, premium: 3 },
  match_monthly: { free: 3, premium: 999 },
  photo_exchange_monthly: { free: 0, premium: 3 },
};

function resolveQuotaLimit(quotaType, tier) {
  const raw = QUOTA_LIMITS[quotaType]?.[tier] ?? 0;
  if (raw === Infinity) return Infinity;
  return Number(raw) || 0;
}

function isUnlimitedQuota(quotaType, tier) {
  return resolveQuotaLimit(quotaType, tier) === Infinity;
}

/**
 * Returns true if the user has remaining quota for quotaType this period.
 */
export async function checkQuota(userId, quotaType) {
  const admin = getAdminClient();
  const tier = await getSubscriptionTier(userId);
  if (isUnlimitedQuota(quotaType, tier)) return true;

  const now = new Date();

  const { data } = await admin
    .from('usage_quotas')
    .select('used_count, limit_count')
    .eq('user_id', userId)
    .eq('quota_type', quotaType)
    .lte('period_start', now.toISOString())
    .gte('period_end', now.toISOString())
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return true; // No quota row yet means haven't used any
  const policyLimit = resolveQuotaLimit(quotaType, tier);
  return data.used_count < policyLimit;
}

/**
 * Consume one unit of quota for the user in the current period.
 * Creates the quota row if it doesn't exist.
 * Returns { ok: boolean, used: number, limit: number }
 */
export async function consumeQuota(userId, quotaType) {
  const admin = getAdminClient();
  const tier = await getSubscriptionTier(userId);
  const limit = resolveQuotaLimit(quotaType, tier);
  if (isUnlimitedQuota(quotaType, tier)) {
    return { ok: true, used: 0, limit: Infinity, unlimited: true };
  }

  const now = new Date();

  // Determine period boundaries (Hong Kong calendar)
  let periodStart;
  let periodEnd;
  if (quotaType === 'forum_post_daily') {
    periodStart = getHongKongDayStart(now);
    periodEnd = getHongKongDayEnd(now);
  } else {
    periodStart = getHongKongMonthStart(now);
    periodEnd = getHongKongMonthEnd(now);
  }

  // Upsert quota row
  const { data: existing } = await admin
    .from('usage_quotas')
    .select('id, used_count, limit_count')
    .eq('user_id', userId)
    .eq('quota_type', quotaType)
    .eq('period_start', periodStart.toISOString())
    .maybeSingle();

  if (existing) {
    if (existing.used_count >= limit) {
      return { ok: false, used: existing.used_count, limit };
    }
    const { data: updated } = await admin
      .from('usage_quotas')
      .update({
        used_count: existing.used_count + 1,
        limit_count: limit,
        updated_at: databaseNowIso(),
      })
      .eq('id', existing.id)
      .select('used_count, limit_count')
      .single();
    return { ok: true, used: updated.used_count, limit };
  }

  // Insert new quota row
  if (limit <= 0) return { ok: false, used: 0, limit };

  const { data: inserted } = await admin
    .from('usage_quotas')
    .insert({
      user_id: userId,
      quota_type: quotaType,
      used_count: 1,
      limit_count: limit,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
    })
    .select('used_count, limit_count')
    .single();

  return { ok: true, used: inserted?.used_count ?? 1, limit };
}

/**
 * Read current quota usage without consuming.
 * Returns { used, limit, remaining }.
 */
export async function getQuotaUsage(userId, quotaType) {
  const admin = getAdminClient();
  const tier = await getSubscriptionTier(userId);
  const limit = resolveQuotaLimit(quotaType, tier);
  if (isUnlimitedQuota(quotaType, tier)) {
    return { used: 0, limit: null, remaining: null, unlimited: true };
  }
  if (limit <= 0) return { used: 0, limit: 0, remaining: 0 };

  const now = new Date();
  let periodStart;
  let periodEnd;
  if (quotaType === 'forum_post_daily') {
    periodStart = getHongKongDayStart(now);
    periodEnd = getHongKongDayEnd(now);
  } else {
    periodStart = getHongKongMonthStart(now);
    periodEnd = getHongKongMonthEnd(now);
  }

  const { data } = await admin
    .from('usage_quotas')
    .select('used_count, limit_count')
    .eq('user_id', userId)
    .eq('quota_type', quotaType)
    .eq('period_start', periodStart.toISOString())
    .maybeSingle();

  const used = data?.used_count ?? 0;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/**
 * Assert quota is available and consume it. Throws on failure.
 */
export async function assertAndConsumeQuota(userId, quotaType) {
  const result = await consumeQuota(userId, quotaType);
  if (!result.ok) {
    const err = new Error(`Quota exhausted for ${quotaType}`);
    err.status = 429;
    err.quotaType = quotaType;
    throw err;
  }
  return result;
}
