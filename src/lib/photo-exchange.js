/**
 * Premium photo exchange — request / respond / view state.
 */

import { getAdminClient, getSubscriptionTier } from './server-auth.js';
import {
  assertAndConsumeQuota,
  checkQuota,
  getQuotaUsage,
  isBlocked,
} from './permissions.js';
import { deliverPhotoExchangeRequest } from './inbox.js';
import { cloudinaryBlurredUrl, isAllowedProfilePhotoUrl } from './cloudinary-profile-upload.js';

const EXCHANGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function pairFilter(userIdA, userIdB) {
  return `and(requester_id.eq.${userIdA},recipient_id.eq.${userIdB}),and(requester_id.eq.${userIdB},recipient_id.eq.${userIdA})`;
}

async function expireStaleExchanges(admin, userIdA, userIdB) {
  const now = new Date().toISOString();
  await admin
    .from('photo_exchanges')
    .update({ status: 'expired', updated_at: now })
    .or(pairFilter(userIdA, userIdB))
    .eq('status', 'completed')
    .lt('expires_at', now);
}

function ownerPhotoFromExchange(exchange, ownerId) {
  if (!exchange) return null;
  if (exchange.requester_id === ownerId) return exchange.requester_photo_url;
  if (exchange.recipient_id === ownerId) return exchange.recipient_photo_url;
  return null;
}

function buildOwnerPhotoView(exchange, viewerId, ownerId) {
  if (!exchange) return null;

  const now = Date.now();
  const ownerPhoto = ownerPhotoFromExchange(exchange, ownerId);
  if (!ownerPhoto) return null;

  if (exchange.status === 'completed' && exchange.expires_at) {
    if (new Date(exchange.expires_at).getTime() <= now) return null;
    return {
      mode: 'clear',
      clear_url: ownerPhoto,
      expires_at: exchange.expires_at,
    };
  }

  if (
    exchange.status === 'pending'
    && exchange.recipient_id === viewerId
    && exchange.requester_id === ownerId
  ) {
    return {
      mode: 'blurred',
      blurred_url: cloudinaryBlurredUrl(ownerPhoto),
    };
  }

  return null;
}

function daysRemaining(expiresAt) {
  if (!expiresAt) return 0;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

async function loadRequesterMirrorSlug(admin, requesterId) {
  const { data } = await admin
    .from('mirror_cards')
    .select('public_slug')
    .eq('user_id', requesterId)
    .maybeSingle();
  return data?.public_slug || null;
}

async function syncPhotoExchangeInbox(admin, { requesterId, recipientId, exchangeId }) {
  const requesterSlug = await loadRequesterMirrorSlug(admin, requesterId);
  return deliverPhotoExchangeRequest({
    requesterId,
    recipientId,
    exchangeId,
    requesterSlug,
  });
}

/**
 * Messaging-style state for mirror card photo exchange UI.
 */
export async function getMirrorCardPhotoExchange(viewerId, ownerId) {
  if (!viewerId || !ownerId) return null;

  const admin = getAdminClient();

  if (viewerId === ownerId) {
    const { data: profile } = await admin
      .from('profiles')
      .select('exchange_photo_url, exchange_photo_updated_at')
      .eq('id', viewerId)
      .maybeSingle();

    return {
      is_owner: true,
      has_exchange_photo: !!profile?.exchange_photo_url,
      exchange_photo_url: profile?.exchange_photo_url || null,
      exchange_photo_updated_at: profile?.exchange_photo_updated_at || null,
    };
  }

  // Block check, viewer tier, viewer profile and exchange rows are all
  // independent — resolve them concurrently instead of in series.
  const [blocked, viewerTier, { data: viewerProfile }, { data: exchanges }] = await Promise.all([
    isBlocked(viewerId, ownerId),
    getSubscriptionTier(viewerId),
    admin
      .from('profiles')
      .select('exchange_photo_url')
      .eq('id', viewerId)
      .maybeSingle(),
    admin
      .from('photo_exchanges')
      .select('*')
      .or(pairFilter(viewerId, ownerId))
      .in('status', ['pending', 'completed'])
      .order('created_at', { ascending: false }),
  ]);

  if (blocked) {
    return { can_request: false, can_respond: false, reason: 'blocked' };
  }

  // DB hygiene only — the display logic below already treats expired rows as
  // inactive, so this cleanup doesn't need to block the response.
  expireStaleExchanges(admin, viewerId, ownerId).catch((err) => {
    console.error('[photo-exchange] expire stale failed:', err?.message || err);
  });

  const active = (exchanges || []).find((row) => {
    if (row.status === 'pending') return true;
    if (row.status === 'completed' && row.expires_at) {
      return new Date(row.expires_at).getTime() > Date.now();
    }
    return false;
  }) || null;

  const quota = viewerTier === 'premium'
    ? await getQuotaUsage(viewerId, 'photo_exchange_monthly')
    : { used: 0, limit: 0, remaining: 0 };

  const ownerPhoto = buildOwnerPhotoView(active, viewerId, ownerId);

  const pendingOutgoing = active?.status === 'pending' && active.requester_id === viewerId;
  const pendingIncoming = active?.status === 'pending' && active.recipient_id === viewerId;
  const completedActive = active?.status === 'completed'
    && active.expires_at
    && new Date(active.expires_at).getTime() > Date.now();

  if (pendingOutgoing && active?.id) {
    syncPhotoExchangeInbox(admin, {
      requesterId: viewerId,
      recipientId: ownerId,
      exchangeId: active.id,
    }).catch((err) => {
      console.error('[photo-exchange] inbox backfill failed:', err?.message || err);
    });
  }

  let can_request = false;
  let can_respond = false;
  let reason = null;

  if (pendingIncoming) {
    can_respond = true;
    if (!viewerProfile?.exchange_photo_url) {
      reason = 'photo_required';
    }
  } else if (pendingOutgoing) {
    reason = 'pending_outgoing';
  } else if (completedActive) {
    reason = 'exchange_active';
  } else if (viewerTier !== 'premium') {
    reason = 'premium_required';
  } else if (!viewerProfile?.exchange_photo_url) {
    reason = 'photo_required';
  } else if (quota.remaining <= 0) {
    reason = 'quota_exhausted';
  } else {
    can_request = true;
  }

  return {
    is_owner: false,
    recipient_id: ownerId,
    exchange_id: active?.id || null,
    status: active?.status || null,
    role: pendingOutgoing ? 'requester' : pendingIncoming ? 'recipient' : null,
    can_request,
    can_respond,
    can_cancel: pendingOutgoing,
    owner_photo: ownerPhoto,
    days_remaining: completedActive ? daysRemaining(active.expires_at) : 0,
    expires_at: completedActive ? active.expires_at : null,
    has_exchange_photo: !!viewerProfile?.exchange_photo_url,
    viewer_exchange_photo_url: viewerProfile?.exchange_photo_url || null,
    quota_remaining: quota.remaining,
    quota_limit: quota.limit,
    reason,
  };
}

export async function saveExchangePhotoUrl(userId, photoUrl) {
  if (!isAllowedProfilePhotoUrl(photoUrl)) {
    return { ok: false, error: '無效的圖片網址。' };
  }

  const admin = getAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from('profiles')
    .update({
      exchange_photo_url: photoUrl.trim(),
      exchange_photo_updated_at: now,
      updated_at: now,
    })
    .eq('id', userId);

  if (error) return { ok: false, error: '儲存相片失敗。' };
  return { ok: true, photo_url: photoUrl.trim() };
}

async function findPhotoExchangeThreadId(admin, userIdA, userIdB) {
  const { data } = await admin
    .from('inbox_threads')
    .select('id')
    .eq('source_type', 'photo_exchange')
    .or(
      `and(participant_a.eq.${userIdA},participant_b.eq.${userIdB}),and(participant_a.eq.${userIdB},participant_b.eq.${userIdA})`,
    )
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

export async function getPhotoExchangeRequestAvailability(requesterId, recipientId) {
  const admin = getAdminClient();
  const tier = await getSubscriptionTier(requesterId);

  if (tier !== 'premium') {
    return { can_request: false, reason: 'premium_required' };
  }
  if (!recipientId || recipientId === requesterId) {
    return { can_request: false, reason: 'self' };
  }
  if (await isBlocked(requesterId, recipientId)) {
    return { can_request: false, reason: 'blocked' };
  }

  const quotaOk = await checkQuota(requesterId, 'photo_exchange_monthly');
  if (!quotaOk) {
    return { can_request: false, reason: 'quota_exhausted' };
  }

  const { data: requesterProfile } = await admin
    .from('profiles')
    .select('exchange_photo_url')
    .eq('id', requesterId)
    .maybeSingle();

  if (!requesterProfile?.exchange_photo_url) {
    return { can_request: false, reason: 'no_exchange_photo' };
  }

  await expireStaleExchanges(admin, requesterId, recipientId);

  const { data: existingPending } = await admin
    .from('photo_exchanges')
    .select('id, status, requester_id, recipient_id')
    .or(pairFilter(requesterId, recipientId))
    .eq('status', 'pending')
    .maybeSingle();

  if (existingPending) {
    const threadId = await findPhotoExchangeThreadId(admin, requesterId, recipientId);
    if (existingPending.requester_id === requesterId) {
      return {
        can_request: false,
        reason: 'pending_outgoing',
        inbox_thread_id: threadId,
        exchange_id: existingPending.id,
      };
    }
    return {
      can_request: false,
      reason: 'pending_incoming',
      inbox_thread_id: threadId,
      exchange_id: existingPending.id,
    };
  }

  const { data: activeCompleted } = await admin
    .from('photo_exchanges')
    .select('id')
    .or(pairFilter(requesterId, recipientId))
    .eq('status', 'completed')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (activeCompleted) {
    return { can_request: false, reason: 'active_completed' };
  }

  return { can_request: true, reason: null };
}

export async function requestPhotoExchange(requesterId, { recipientSlug, recipientId: recipientIdInput } = {}) {
  const admin = getAdminClient();
  const tier = await getSubscriptionTier(requesterId);
  if (tier !== 'premium') {
    return { ok: false, status: 403, error: 'premium_required' };
  }

  let recipientId = recipientIdInput || null;
  if (!recipientId && recipientSlug) {
    const { data: card } = await admin
      .from('mirror_cards')
      .select('user_id, public_slug')
      .eq('public_slug', recipientSlug)
      .maybeSingle();
    if (!card?.user_id) {
      return { ok: false, status: 404, error: '找不到此 Mirror Card。' };
    }
    recipientId = card.user_id;
  }

  if (!recipientId) {
    return { ok: false, status: 400, error: '請提供對方用戶。' };
  }

  if (recipientId === requesterId) {
    return { ok: false, status: 400, error: '不能向自己發起交換。' };
  }

  const availability = await getPhotoExchangeRequestAvailability(requesterId, recipientId);
  if (!availability.can_request) {
    const reasonMap = {
      premium_required: { status: 403, error: 'premium_required' },
      blocked: { status: 403, error: 'blocked' },
      quota_exhausted: { status: 429, error: 'quota_exhausted' },
      no_exchange_photo: { status: 400, error: '請先上傳你的交換用相片。' },
      pending_incoming: { status: 409, error: '對方已向你發起交換邀請，請先回應。' },
      active_completed: { status: 409, error: '你們的相片交換仍在有效期內。' },
    };
    if (availability.reason === 'pending_outgoing') {
      return {
        ok: true,
        exchange_id: availability.exchange_id,
        status: 'pending',
        inbox_thread_id: availability.inbox_thread_id || null,
        inbox_delivered: !!availability.inbox_thread_id,
      };
    }
    const mapped = reasonMap[availability.reason] || { status: 400, error: availability.reason };
    return { ok: false, status: mapped.status, error: mapped.error };
  }

  const { data: requesterProfile } = await admin
    .from('profiles')
    .select('exchange_photo_url')
    .eq('id', requesterId)
    .maybeSingle();

  const now = new Date().toISOString();
  const { data: inserted, error } = await admin
    .from('photo_exchanges')
    .insert({
      requester_id: requesterId,
      recipient_id: recipientId,
      requester_photo_url: requesterProfile.exchange_photo_url,
      status: 'pending',
      created_at: now,
      updated_at: now,
    })
    .select('id, status')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { ok: false, status: 409, error: '已有進行中的交換邀請。' };
    }
    return { ok: false, status: 500, error: '發起交換失敗。' };
  }

  const inbox = await syncPhotoExchangeInbox(admin, {
    requesterId,
    recipientId,
    exchangeId: inserted.id,
  });

  if (!inbox.ok) {
    console.error('[photo-exchange] inbox notification failed:', inbox.error);
  }

  return {
    ok: true,
    exchange_id: inserted.id,
    status: inserted.status,
    inbox_thread_id: inbox.ok ? inbox.thread_id : null,
    inbox_delivered: !!inbox.ok,
  };
}

export async function respondPhotoExchange(recipientId, exchangeId, photoUrlOptional) {
  const admin = getAdminClient();

  const { data: exchange } = await admin
    .from('photo_exchanges')
    .select('*')
    .eq('id', exchangeId)
    .maybeSingle();

  if (!exchange || exchange.status !== 'pending') {
    return { ok: false, status: 404, error: '找不到有效的交換邀請。' };
  }

  if (exchange.recipient_id !== recipientId) {
    return { ok: false, status: 403, error: '無權回應此邀請。' };
  }

  if (await isBlocked(exchange.requester_id, recipientId)) {
    return { ok: false, status: 403, error: 'blocked' };
  }

  let recipientPhoto = photoUrlOptional?.trim() || null;

  const { data: profile } = await admin
    .from('profiles')
    .select('exchange_photo_url')
    .eq('id', recipientId)
    .maybeSingle();

  if (!recipientPhoto) {
    recipientPhoto = profile?.exchange_photo_url || null;
  }

  if (!recipientPhoto || !isAllowedProfilePhotoUrl(recipientPhoto)) {
    return { ok: false, status: 400, error: '請先上傳你的交換用相片。' };
  }

  if (recipientPhoto !== profile?.exchange_photo_url) {
    await saveExchangePhotoUrl(recipientId, recipientPhoto);
  }

  try {
    await assertAndConsumeQuota(exchange.requester_id, 'photo_exchange_monthly');
  } catch (err) {
    return { ok: false, status: 429, error: '對方本月交換配額已用完，無法完成交換。' };
  }

  const completedAt = new Date();
  const expiresAt = new Date(completedAt.getTime() + EXCHANGE_TTL_MS);

  const { data: updated, error } = await admin
    .from('photo_exchanges')
    .update({
      recipient_photo_url: recipientPhoto,
      status: 'completed',
      completed_at: completedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      updated_at: completedAt.toISOString(),
    })
    .eq('id', exchangeId)
    .eq('status', 'pending')
    .select('id, status, expires_at')
    .single();

  if (error || !updated) {
    return { ok: false, status: 500, error: '完成交換失敗。' };
  }

  return {
    ok: true,
    exchange_id: updated.id,
    status: updated.status,
    expires_at: updated.expires_at,
    days_remaining: daysRemaining(updated.expires_at),
    viewer_photo_url: recipientPhoto,
    other_party_photo_url: exchange.requester_photo_url || null,
  };
}

export async function cancelPhotoExchange(requesterId, exchangeId) {
  const admin = getAdminClient();

  const { data: exchange } = await admin
    .from('photo_exchanges')
    .select('id, requester_id, status')
    .eq('id', exchangeId)
    .maybeSingle();

  if (!exchange || exchange.status !== 'pending') {
    return { ok: false, status: 404, error: '找不到有效的交換邀請。' };
  }

  if (exchange.requester_id !== requesterId) {
    return { ok: false, status: 403, error: '無權取消此邀請。' };
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from('photo_exchanges')
    .update({ status: 'cancelled', updated_at: now })
    .eq('id', exchangeId);

  if (error) return { ok: false, status: 500, error: '取消失敗。' };
  return { ok: true };
}

function otherPartyPhotoFromExchange(exchange, userId) {
  if (!exchange || exchange.status !== 'completed' || !exchange.expires_at) return null;
  if (new Date(exchange.expires_at).getTime() <= Date.now()) return null;
  if (exchange.requester_id === userId) return exchange.recipient_photo_url || null;
  if (exchange.recipient_id === userId) return exchange.requester_photo_url || null;
  return null;
}

function shapePhotoExchangeForViewer(exchange, userId, { otherName, otherSlug, viewerPhotoFallback }) {
  const role = exchange.requester_id === userId ? 'requester' : 'recipient';
  const isPending = exchange.status === 'pending';
  const isCompleted = exchange.status === 'completed'
    && exchange.expires_at
    && new Date(exchange.expires_at).getTime() > Date.now();
  const otherPhoto = otherPartyPhotoFromExchange(exchange, userId);
  const viewerPhoto = ownerPhotoFromExchange(exchange, userId) || viewerPhotoFallback || null;

  return {
    ok: true,
    exchange_id: exchange.id,
    status: exchange.status,
    role,
    can_respond: isPending && role === 'recipient',
    viewer_photo_url: viewerPhoto,
    other_party_name: otherName || '對方',
    other_party_photo_url: otherPhoto,
    other_party_slug: otherSlug || null,
    days_remaining: isCompleted ? daysRemaining(exchange.expires_at) : 0,
    expires_at: isCompleted ? exchange.expires_at : null,
    blurred_preview_url: isPending && role === 'recipient' && exchange.requester_photo_url
      ? cloudinaryBlurredUrl(exchange.requester_photo_url)
      : null,
  };
}

/**
 * Batch-load exchange state for inbox thread (one DB round-trip per table).
 */
export async function getPhotoExchangesByIds(userId, exchangeIds, { viewerPhotoFallback = null } = {}) {
  const uniqueIds = [...new Set((exchangeIds || []).map(String).filter(Boolean))];
  if (!uniqueIds.length) return {};

  const admin = getAdminClient();
  const { data: rows } = await admin
    .from('photo_exchanges')
    .select('*')
    .in('id', uniqueIds);

  if (!rows?.length) return {};

  const otherIds = new Set();
  for (const exchange of rows) {
    if (exchange.requester_id !== userId && exchange.recipient_id !== userId) continue;
    const otherId = exchange.requester_id === userId
      ? exchange.recipient_id
      : exchange.requester_id;
    otherIds.add(otherId);
  }

  const otherIdList = [...otherIds];
  const [{ data: others }, { data: cards }] = otherIdList.length
    ? await Promise.all([
      admin.from('profiles').select('id, display_name').in('id', otherIdList),
      admin.from('mirror_cards').select('user_id, public_slug').in('user_id', otherIdList),
    ])
    : [{ data: [] }, { data: [] }];

  const nameById = Object.fromEntries((others || []).map((p) => [p.id, p.display_name]));
  const slugByUser = Object.fromEntries((cards || []).map((c) => [c.user_id, c.public_slug]));

  const byId = {};
  for (const exchange of rows) {
    if (exchange.requester_id !== userId && exchange.recipient_id !== userId) continue;
    const otherId = exchange.requester_id === userId
      ? exchange.recipient_id
      : exchange.requester_id;
    byId[String(exchange.id)] = shapePhotoExchangeForViewer(exchange, userId, {
      otherName: nameById[otherId],
      otherSlug: slugByUser[otherId],
      viewerPhotoFallback,
    });
  }
  return byId;
}

/**
 * Load exchange state for a participant (inbox / exchange-photo page).
 */
export async function getPhotoExchangeById(userId, exchangeId) {
  const admin = getAdminClient();

  const { data: exchange } = await admin
    .from('photo_exchanges')
    .select('*')
    .eq('id', exchangeId)
    .maybeSingle();

  if (!exchange) {
    return { ok: false, status: 404, error: '找不到交換紀錄。' };
  }

  if (exchange.requester_id !== userId && exchange.recipient_id !== userId) {
    return { ok: false, status: 403, error: '無權查看此交換。' };
  }

  const role = exchange.requester_id === userId ? 'requester' : 'recipient';
  const otherId = role === 'requester' ? exchange.recipient_id : exchange.requester_id;

  const [{ data: viewerProfile }, { data: otherProfile }, { data: otherCard }] = await Promise.all([
    admin.from('profiles').select('display_name, exchange_photo_url').eq('id', userId).maybeSingle(),
    admin.from('profiles').select('display_name').eq('id', otherId).maybeSingle(),
    admin.from('mirror_cards').select('public_slug').eq('user_id', otherId).maybeSingle(),
  ]);

  const shaped = shapePhotoExchangeForViewer(exchange, userId, {
    otherName: otherProfile?.display_name,
    otherSlug: otherCard?.public_slug,
    viewerPhotoFallback: viewerProfile?.exchange_photo_url || null,
  });

  return {
    ...shaped,
    viewer_name: viewerProfile?.display_name || '你',
  };
}
