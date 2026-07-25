/**
 * GET  /api/wishes — list wishes
 * POST /api/wishes — create wish (auth)
 */

import { requireUser, sendAuthError, getAdminClient, ensureProfile, getOptionalUser } from '../../../lib/server-auth.js';
import {
  WISH_ACTIVE_LIMIT,
  WISH_CATEGORIES,
  WISH_LIST_DEFAULT_LIMIT,
  WISH_LIST_MAX_LIMIT,
  validateWishInput,
  countActiveWishes,
  hasSimilarActiveTitle,
  maybeExpireWish,
  enrichWishOwners,
  toPublicWish,
  canViewerSeeWish,
} from '../../../lib/wishes.js';
import { awardWishFirstCreateShards } from '../../../lib/my-cat-awards.js';

async function handleGet(req, res) {
  const user = await getOptionalUser(req);
  const admin = getAdminClient();

  const {
    status = 'active',
    category,
    sort = 'newest',
    limit: limitRaw,
    mine,
  } = req.query;

  const limit = Math.min(
    Math.max(Number(limitRaw) || WISH_LIST_DEFAULT_LIMIT, 1),
    WISH_LIST_MAX_LIMIT,
  );

  if (mine === '1' || mine === 'me') {
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { data, error } = await admin
      .from('wishes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('[wishes] mine list failed:', error.message);
      if (error.message?.includes('wishes')) {
        return res.status(503).json({ error: '月光心願尚未啟用，請先執行 migration。' });
      }
      return res.status(500).json({ error: '無法載入心願。' });
    }
    const rows = [];
    for (const row of data || []) {
      rows.push(await maybeExpireWish(admin, row));
    }
    const ownerMap = await enrichWishOwners(admin, rows);
    return res.status(200).json({
      wishes: rows.map((row) => toPublicWish(row, { owner: ownerMap.get(row.user_id) })),
      total: rows.length,
    });
  }

  const allowedListStatuses = ['active', 'completed', 'expired'];
  const statusFilter = status === 'all'
    ? allowedListStatuses
    : allowedListStatuses.includes(String(status))
      ? [String(status)]
      : ['active'];

  let query = admin
    .from('wishes')
    .select('*')
    .in('status', statusFilter)
    .neq('status', 'hidden')
    .limit(limit);

  if (sort === 'cheers') {
    query = query.order('cheer_count', { ascending: false }).order('created_at', { ascending: false });
  } else if (sort === 'ending') {
    query = query.order('target_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  if (category && WISH_CATEGORIES.includes(String(category))) {
    query = query.eq('category', String(category));
  }

  if (!user) {
    query = query.eq('visibility', 'public');
  }

  const { data, error } = await query;
  if (error) {
    console.error('[wishes] list failed:', error.message);
    if (error.message?.includes('wishes') || error.code === '42P01') {
      return res.status(503).json({ error: '月光心願尚未啟用，請先執行 migration。' });
    }
    return res.status(500).json({ error: '無法載入心願牆。' });
  }

  const rows = [];
  for (const row of data || []) {
    const expired = await maybeExpireWish(admin, row);
    if (!canViewerSeeWish(expired, user?.id)) continue;
    if (expired.status === 'hidden' || expired.status === 'abandoned') continue;
    if (statusFilter.includes(expired.status)) rows.push(expired);
  }

  const ownerMap = await enrichWishOwners(admin, rows);
  let cheeredSet = new Set();
  if (user && rows.length) {
    const { data: cheers } = await admin
      .from('wish_cheers')
      .select('wish_id')
      .eq('user_id', user.id)
      .in('wish_id', rows.map((r) => r.id));
    cheeredSet = new Set((cheers || []).map((c) => c.wish_id));
  }

  return res.status(200).json({
    wishes: rows.map((row) => toPublicWish(row, {
      owner: ownerMap.get(row.user_id),
      cheered: user ? cheeredSet.has(row.id) : false,
    })),
    total: rows.length,
  });
}

async function handlePost(req, res) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  await ensureProfile(user);
  const admin = getAdminClient();
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const validated = validateWishInput(body);
  if (!validated.ok) {
    return res.status(400).json({ error: validated.errors[0], errors: validated.errors });
  }

  try {
    const active = await countActiveWishes(admin, user.id);
    if (active >= WISH_ACTIVE_LIMIT) {
      return res.status(400).json({
        error: `同時進行中的心願最多 ${WISH_ACTIVE_LIMIT} 個。`,
        code: 'active_limit',
      });
    }
    if (await hasSimilarActiveTitle(admin, user.id, validated.value.title)) {
      return res.status(400).json({
        error: '你已有一個非常相似的進行中心願。',
        code: 'duplicate_title',
      });
    }
  } catch (err) {
    console.error('[wishes] create precheck failed:', err?.message || err);
    if (String(err?.message || '').includes('wishes') || err?.code === '42P01') {
      return res.status(503).json({ error: '月光心願尚未啟用，請先執行 migration。' });
    }
    return res.status(500).json({ error: '無法建立心願。' });
  }

  const insert = {
    user_id: user.id,
    title: validated.value.title,
    body: validated.value.body ?? null,
    category: validated.value.category || '其他',
    visibility: validated.value.visibility || 'public',
    progress: validated.value.progress ?? 0,
    target_at: validated.value.target_at ?? null,
    status: 'active',
  };

  const { data, error } = await admin
    .from('wishes')
    .insert(insert)
    .select('*')
    .single();

  if (error) {
    console.error('[wishes] create failed:', error.message);
    return res.status(500).json({ error: '無法建立心願。' });
  }

  let firstCreateAward = null;
  if (data.visibility === 'public') {
    try {
      firstCreateAward = await awardWishFirstCreateShards(admin, user.id);
    } catch (err) {
      console.error('[wishes] first-create award failed:', err?.message || err);
    }
  }

  const ownerMap = await enrichWishOwners(admin, [data]);
  return res.status(201).json({
    wish: toPublicWish(data, { owner: ownerMap.get(data.user_id) }),
    shards_gained: firstCreateAward?.shards_gained || 0,
  });
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return await handleGet(req, res);
    if (req.method === 'POST') return await handlePost(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[wishes] failed:', err?.message || err);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}
