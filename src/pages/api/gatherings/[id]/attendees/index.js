/**
 * GET /api/gatherings/[id]/attendees — host queue
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../../lib/server-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: '缺少聚會 id' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const admin = getAdminClient();
  const { data: row } = await admin.from('gatherings').select('id, host_id').eq('id', id).maybeSingle();
  if (!row) return res.status(404).json({ error: '找不到此聚會。' });
  if (row.host_id !== user.id) return res.status(403).json({ error: '只有主辦人可以查看申請列表。' });

  const statusFilter = req.query.status ? String(req.query.status) : null;

  let query = admin
    .from('gathering_attendees')
    .select('id, user_id, status, knock_message, created_at, reviewed_at')
    .eq('gathering_id', id)
    .order('created_at', { ascending: true });

  if (statusFilter) query = query.eq('status', statusFilter);

  const { data: attendees, error } = await query;
  if (error) {
    console.error('[gatherings/attendees] failed:', error.message);
    return res.status(500).json({ error: '無法載入申請列表。' });
  }

  const userIds = (attendees || []).map((a) => a.user_id);
  let profileMap = new Map();
  let mirrorMap = new Map();
  if (userIds.length) {
    const [{ data: profiles }, { data: mirrors }] = await Promise.all([
      admin.from('profiles').select('id, display_name').in('id', userIds),
      admin.from('mirror_cards').select('user_id, mirror_type').in('user_id', userIds),
    ]);
    profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    mirrorMap = new Map((mirrors || []).map((m) => [m.user_id, m.mirror_type]));
  }

  return res.status(200).json({
    attendees: (attendees || []).map((a) => ({
      id: a.id,
      user_id: a.user_id,
      status: a.status,
      knock_message: a.knock_message,
      created_at: a.created_at,
      reviewed_at: a.reviewed_at,
      display_name: profileMap.get(a.user_id)?.display_name || '匿名貓咪',
      mirror_type: mirrorMap.get(a.user_id) || null,
      mirror_card_url: mirrorMap.get(a.user_id) ? `/mirror-card/me` : null,
    })),
  });
}
