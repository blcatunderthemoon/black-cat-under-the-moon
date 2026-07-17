/**
 * POST /api/gatherings/[id]/report
 * Report a gathering, a board comment, or an attendee/host.
 * Body: { target_type: 'gathering' | 'comment' | 'attendee', target_id: string, reason?: string }
 *
 * Mirrors the forum report flow: dedupe -> bump count -> auto-hide at threshold
 * -> notify moderators at threshold.
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../lib/server-auth.js';
import { shouldAutoHide, shouldNotifyModerators } from '../../../../lib/moderation.js';
import { notifyGatheringModerators } from '../../../../lib/gathering-moderation-notify.js';
import {
  createRateLimiter,
  rateLimitOrPass,
  rateLimitResponse,
} from '../../../../lib/rate-limit.js';

const reportLimiter = createRateLimiter('gathering-report', 10, '1 h');

const TARGET_TYPES = ['gathering', 'comment', 'attendee'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: '缺少聚會 id' });

  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  const limited = await rateLimitOrPass(reportLimiter, `gathering-report:${user.id}`);
  if (!limited.ok) return rateLimitResponse(res, limited.reason);

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const targetType = body.target_type;
  const targetId = body.target_id;
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : null;

  if (!TARGET_TYPES.includes(targetType)) {
    return res.status(400).json({ error: 'target_type 不正確。' });
  }
  if (!targetId || typeof targetId !== 'string') {
    return res.status(400).json({ error: '缺少 target_id。' });
  }

  const admin = getAdminClient();

  const { data: gathering } = await admin
    .from('gatherings')
    .select('id, host_id, title')
    .eq('id', id)
    .maybeSingle();
  if (!gathering) return res.status(404).json({ error: '找不到此聚會。' });

  // Authorization + target validation per type.
  if (targetType === 'gathering') {
    if (targetId !== gathering.id) {
      return res.status(400).json({ error: 'target_id 與聚會不符。' });
    }
    if (gathering.host_id === user.id) {
      return res.status(400).json({ error: '不能舉報自己的聚會。' });
    }
  } else if (targetType === 'comment') {
    const { data: comment } = await admin
      .from('gathering_comments')
      .select('id, gathering_id, user_id')
      .eq('id', targetId)
      .maybeSingle();
    if (!comment || comment.gathering_id !== gathering.id) {
      return res.status(404).json({ error: '找不到此留言。' });
    }
    if (comment.user_id === user.id) {
      return res.status(400).json({ error: '不能舉報自己的留言。' });
    }
  } else if (targetType === 'attendee') {
    if (targetId === user.id) {
      return res.status(400).json({ error: '不能舉報自己。' });
    }
    // The reported person must be the host or an attendee of this gathering.
    let related = targetId === gathering.host_id;
    if (!related) {
      const { data: att } = await admin
        .from('gathering_attendees')
        .select('id')
        .eq('gathering_id', gathering.id)
        .eq('user_id', targetId)
        .maybeSingle();
      related = !!att;
    }
    if (!related) return res.status(404).json({ error: '找不到此參加者。' });
  }

  // Dedupe insert.
  const { error: insErr } = await admin.from('gathering_reports').insert({
    reporter_id: user.id,
    gathering_id: gathering.id,
    target_type: targetType,
    target_id: targetId,
    reason,
  });

  if (insErr) {
    if (insErr.code === '23505') {
      return res.status(200).json({ success: true, already_reported: true });
    }
    if (insErr.code === '42P01') {
      return res.status(503).json({
        error: '舉報功能尚未就緒，請先執行 gathering_reports migration。',
        code: 'migration_required',
      });
    }
    console.error('[gatherings/report] insert failed:', insErr.message);
    return res.status(500).json({ error: '舉報失敗，請稍後再試。' });
  }

  // Determine new report count + auto-hide.
  let newCount;
  let autoHidden = false;

  if (targetType === 'gathering' || targetType === 'comment') {
    const table = targetType === 'gathering' ? 'gatherings' : 'gathering_comments';
    const { data: target } = await admin
      .from(table)
      .select('report_count, is_hidden')
      .eq('id', targetId)
      .maybeSingle();
    newCount = (target?.report_count || 0) + 1;
    const patch = { report_count: newCount };
    if (shouldAutoHide(newCount) && !target?.is_hidden) {
      patch.is_hidden = true;
      autoHidden = true;
    }
    await admin.from(table).update(patch).eq('id', targetId);
  } else {
    // attendee: no column to bump; derive count from the reports table.
    const { count } = await admin
      .from('gathering_reports')
      .select('id', { count: 'exact', head: true })
      .eq('target_type', 'attendee')
      .eq('target_id', targetId);
    newCount = count || 1;
  }

  let moderatorNotified = false;
  if (shouldNotifyModerators(newCount)) {
    try {
      moderatorNotified = await notifyGatheringModerators({
        targetType,
        targetId,
        gatheringId: gathering.id,
        reportCount: newCount,
        title: gathering.title,
      });
    } catch (err) {
      console.error('[gatherings/report] moderator notify failed:', err?.message || err);
    }
  }

  return res.status(200).json({
    success: true,
    report_count: newCount,
    auto_hidden: autoHidden,
    moderator_notified: moderatorNotified,
  });
}
