/**
 * POST /api/gatherings/[id]/attendees/[userId]/approve
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../../../lib/server-auth.js';
import { databaseNowIso } from '../../../../../../lib/hong-kong-time.js';
import { ensureGatheringDecisionNotified } from '../../../../../../lib/gathering-notify.js';
import { maybeMarkCompleted, syncGatheringApprovedCount } from '../../../../../../lib/gatherings.js';

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
  let row = (await admin.from('gatherings').select('*').eq('id', id).maybeSingle()).data;
  if (!row) return res.status(404).json({ error: '找不到此聚會。' });
  if (row.host_id !== user.id) return res.status(403).json({ error: '只有主辦人可以批准。' });
  row = await maybeMarkCompleted(admin, row);

  if (row.status !== 'open' && row.status !== 'full') {
    return res.status(409).json({ error: '此聚會無法再批准參加者。' });
  }
  if ((row.approved_count || 0) >= row.max_participants) {
    return res.status(409).json({ error: '聚會已滿額。', code: 'full' });
  }

  const { data: attendance } = await admin
    .from('gathering_attendees')
    .select('*')
    .eq('gathering_id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!attendance) return res.status(404).json({ error: '找不到申請。' });
  if (attendance.status === 'approved') {
    const synced = await syncGatheringApprovedCount(admin, id);
    const notified = await ensureGatheringDecisionNotified({
      applicantId: userId,
      gatheringId: id,
      gatheringTitle: row.title,
      approved: true,
    });
    return res.status(200).json({
      success: true,
      already: true,
      approved_count: synced?.approved_count ?? row.approved_count,
      gathering_status: synced?.status ?? row.status,
      notified,
    });
  }
  if (attendance.status !== 'pending') {
    return res.status(409).json({ error: '只能批准審核中的申請。' });
  }

  const { error } = await admin
    .from('gathering_attendees')
    .update({
      status: 'approved',
      reviewed_at: databaseNowIso(),
      reviewed_by: user.id,
      updated_at: databaseNowIso(),
    })
    .eq('id', attendance.id);

  if (error) {
    console.error('[gatherings/approve] failed:', error.message);
    return res.status(500).json({ error: '批准失敗。' });
  }

  const synced = await syncGatheringApprovedCount(admin, id);

  let notified = false;
  try {
    notified = await ensureGatheringDecisionNotified({
      applicantId: userId,
      gatheringId: id,
      gatheringTitle: row.title,
      approved: true,
    });
  } catch (err) {
    console.error('[gatherings/approve] notify failed:', err?.message || err);
  }

  return res.status(200).json({
    success: true,
    status: 'approved',
    approved_count: synced?.approved_count ?? (row.approved_count || 0) + 1,
    gathering_status: synced?.status ?? row.status,
    notified,
  });
}
