/**
 * POST /api/gatherings/[id]/withdraw — withdraw pending / approved RSVP
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../lib/server-auth.js';
import { databaseNowIso } from '../../../../lib/hong-kong-time.js';

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
  const { data: attendance } = await admin
    .from('gathering_attendees')
    .select('*')
    .eq('gathering_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!attendance) return res.status(404).json({ error: '找不到申請記錄。' });
  if (attendance.status !== 'pending' && attendance.status !== 'approved') {
    return res.status(409).json({ error: '目前狀態無法撤回。' });
  }

  const { error } = await admin
    .from('gathering_attendees')
    .update({ status: 'withdrawn', updated_at: databaseNowIso() })
    .eq('id', attendance.id);

  if (error) {
    console.error('[gatherings/withdraw] failed:', error.message);
    return res.status(500).json({ error: '撤回失敗。' });
  }

  return res.status(200).json({ success: true, status: 'withdrawn' });
}
