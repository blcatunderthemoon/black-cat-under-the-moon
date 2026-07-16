/**
 * POST /api/gatherings/[id]/attendees/[userId]/reject
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../../../lib/server-auth.js';
import { databaseNowIso } from '../../../../../../lib/hong-kong-time.js';
import { ensureGatheringDecisionNotified } from '../../../../../../lib/gathering-notify.js';
import { syncGatheringApprovedCount } from '../../../../../../lib/gatherings.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, userId } = req.query;
  if (!id || !userId) return res.status(400).json({ error: '缺少參數' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const admin = getAdminClient();
  const { data: row } = await admin.from('gatherings').select('*').eq('id', id).maybeSingle();
  if (!row) return res.status(404).json({ error: '找不到此聚會。' });
  if (row.host_id !== user.id) return res.status(403).json({ error: '只有主辦人可以婉拒。' });

  const { data: attendance } = await admin
    .from('gathering_attendees')
    .select('*')
    .eq('gathering_id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!attendance) return res.status(404).json({ error: '找不到申請。' });
  if (attendance.status === 'rejected') {
    const synced = await syncGatheringApprovedCount(admin, id);
    const notified = await ensureGatheringDecisionNotified({
      applicantId: userId,
      gatheringId: id,
      gatheringTitle: row.title,
      approved: false,
    });
    return res.status(200).json({
      success: true,
      already: true,
      approved_count: synced?.approved_count ?? row.approved_count,
      notified,
    });
  }
  if (attendance.status !== 'pending') {
    return res.status(409).json({ error: '只能婉拒審核中的申請。' });
  }

  const { error } = await admin
    .from('gathering_attendees')
    .update({
      status: 'rejected',
      reviewed_at: databaseNowIso(),
      reviewed_by: user.id,
      updated_at: databaseNowIso(),
    })
    .eq('id', attendance.id);

  if (error) {
    console.error('[gatherings/reject] failed:', error.message);
    return res.status(500).json({ error: '婉拒失敗。' });
  }

  const synced = await syncGatheringApprovedCount(admin, id);

  let notified = false;
  try {
    notified = await ensureGatheringDecisionNotified({
      applicantId: userId,
      gatheringId: id,
      gatheringTitle: row.title,
      approved: false,
    });
  } catch (err) {
    console.error('[gatherings/reject] notify failed:', err?.message || err);
  }

  return res.status(200).json({
    success: true,
    status: 'rejected',
    approved_count: synced?.approved_count ?? row.approved_count,
    notified,
  });
}
