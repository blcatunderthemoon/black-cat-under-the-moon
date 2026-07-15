/**
 * POST /api/gatherings/[id]/cancel — host cancels gathering
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../../lib/server-auth.js';
import { databaseNowIso } from '../../../../../lib/hong-kong-time.js';
import { notifyGatheringCancelled } from '../../../../../lib/gathering-notify.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: '缺少聚會 id' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const admin = getAdminClient();
  const { data: row } = await admin.from('gatherings').select('*').eq('id', id).maybeSingle();
  if (!row) return res.status(404).json({ error: '找不到此聚會。' });
  if (row.host_id !== user.id) return res.status(403).json({ error: '只有主辦人可以取消。' });
  if (row.status === 'cancelled') return res.status(200).json({ success: true, already: true });
  if (row.status === 'completed') return res.status(409).json({ error: '已結束的聚會無法取消。' });

  const startsMs = new Date(row.starts_at).getTime();
  if (startsMs - Date.now() < 60 * 60 * 1000 && startsMs > Date.now()) {
    return res.status(409).json({ error: '開始前 1 小時內無法取消聚會。', code: 'too_late' });
  }

  const reason = req.body?.reason ? String(req.body.reason).trim().slice(0, 200) : null;

  const { error } = await admin
    .from('gatherings')
    .update({
      status: 'cancelled',
      cancelled_at: databaseNowIso(),
      cancel_reason: reason,
      updated_at: databaseNowIso(),
    })
    .eq('id', id);

  if (error) {
    console.error('[gatherings/cancel] failed:', error.message);
    return res.status(500).json({ error: '取消失敗。' });
  }

  const { data: approved } = await admin
    .from('gathering_attendees')
    .select('user_id')
    .eq('gathering_id', id)
    .eq('status', 'approved');

  notifyGatheringCancelled({
    userIds: (approved || []).map((a) => a.user_id),
    gatheringId: id,
    gatheringTitle: row.title,
    reason,
  }).catch((err) => console.error('[gatherings/cancel] notify failed:', err?.message || err));

  return res.status(200).json({ success: true });
}
