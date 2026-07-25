/**
 * GET   /api/wishes/[id] — detail + recent cheers
 * PATCH /api/wishes/[id] — owner update progress / copy / visibility
 */

import { requireUser, sendAuthError, getAdminClient, getOptionalUser } from '../../../../lib/server-auth.js';
import {
  validateWishInput,
  maybeExpireWish,
  enrichWishOwners,
  toPublicWish,
  canViewerSeeWish,
  buildWishCheckinDays,
  listWishCheckinDays,
} from '../../../../lib/wishes.js';

async function loadWish(admin, id) {
  const { data, error } = await admin.from('wishes').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return maybeExpireWish(admin, data);
}

async function handleGet(req, res, id) {
  const user = await getOptionalUser(req);
  const admin = getAdminClient();
  const wish = await loadWish(admin, id);
  if (!wish) return res.status(404).json({ error: '找不到此心願。' });
  if (!canViewerSeeWish(wish, user?.id)) {
    return res.status(404).json({ error: '找不到此心願。' });
  }

  const ownerMap = await enrichWishOwners(admin, [wish]);
  let cheered = false;
  if (user) {
    const { data: cheer } = await admin
      .from('wish_cheers')
      .select('id')
      .eq('wish_id', wish.id)
      .eq('user_id', user.id)
      .maybeSingle();
    cheered = !!cheer;
  }

  const { data: cheerRows } = await admin
    .from('wish_cheers')
    .select('id, user_id, note, created_at')
    .eq('wish_id', wish.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const cheererIds = [...new Set((cheerRows || []).map((c) => c.user_id))];
  let cheererMap = new Map();
  if (cheererIds.length) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, display_name')
      .in('id', cheererIds);
    cheererMap = new Map((profiles || []).map((p) => [p.id, p.display_name || '匿名貓咪']));
  }

  const cheers = (cheerRows || []).map((c) => ({
    id: c.id,
    note: c.note,
    created_at: c.created_at,
    user: { id: c.user_id, display_name: cheererMap.get(c.user_id) || '匿名貓咪' },
  }));

  let stampedDays = [];
  let checkinMeta = buildWishCheckinDays(wish);
  try {
    stampedDays = await listWishCheckinDays(admin, wish.id);
  } catch (err) {
    console.error('[wishes/id] checkins load failed:', err?.message || err);
  }

  return res.status(200).json({
    wish: toPublicWish(wish, {
      owner: ownerMap.get(wish.user_id),
      cheered,
    }),
    cheers,
    is_owner: !!(user && user.id === wish.user_id),
    checkins: {
      days: checkinMeta.days,
      today: checkinMeta.today,
      total: checkinMeta.total,
      stamped: stampedDays,
    },
  });
}

async function handlePatch(req, res, id) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const admin = getAdminClient();
  const wish = await loadWish(admin, id);
  if (!wish) return res.status(404).json({ error: '找不到此心願。' });
  if (wish.user_id !== user.id) {
    return res.status(403).json({ error: '只有主人可以編輯心願。' });
  }
  if (!['active', 'expired'].includes(wish.status)) {
    return res.status(400).json({ error: '此心願狀態無法再編輯。' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const validated = validateWishInput(body, { partial: true });
  if (!validated.ok) {
    return res.status(400).json({ error: validated.errors[0], errors: validated.errors });
  }

  const patch = { ...validated.value };
  if (body.status === 'active' && wish.status === 'expired') {
    // Allow revive from expired without changing other rules
    patch.status = 'active';
  }

  // completion_note only via complete endpoint; ignore if present
  delete patch.completion_note;

  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: '沒有可更新的欄位。' });
  }

  // Soft progress note (Phase 1.5 style) — optional short update stored in body append? Skip; progress only.

  const { data, error } = await admin
    .from('wishes')
    .update(patch)
    .eq('id', wish.id)
    .select('*')
    .single();

  if (error) {
    console.error('[wishes] patch failed:', error.message);
    return res.status(500).json({ error: '更新失敗。' });
  }

  const ownerMap = await enrichWishOwners(admin, [data]);
  return res.status(200).json({
    wish: toPublicWish(data, { owner: ownerMap.get(data.user_id) }),
  });
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: '缺少心願 id' });
  }

  try {
    if (req.method === 'GET') return await handleGet(req, res, id);
    if (req.method === 'PATCH') return await handlePatch(req, res, id);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[wishes/id] failed:', err?.message || err);
    if (String(err?.message || '').includes('wishes') || err?.code === '42P01') {
      return res.status(503).json({ error: '月光心願尚未啟用，請先執行 migration。' });
    }
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}
