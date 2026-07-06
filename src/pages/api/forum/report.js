/**
 * POST /api/forum/report
 * Report a forum post or comment.
 * Body: { target_type: 'post' | 'comment', target_id: string }
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../lib/server-auth.js';
import { shouldAutoHide, shouldNotifyModerators } from '../../../lib/moderation.js';
import {
  buildReportNotifyContext,
  notifyForumModerators,
} from '../../../lib/forum-moderation-notify.js';
import {
  createRateLimiter,
  rateLimitOrPass,
  rateLimitResponse,
} from '../../../lib/rate-limit.js';

const reportLimiter = createRateLimiter('forum-report', 10, '1 h');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  const limited = await rateLimitOrPass(reportLimiter, `forum-report:${user.id}`);
  if (!limited.ok) return rateLimitResponse(res, limited.reason);

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { target_type, target_id } = body;

  if (!['post', 'comment'].includes(target_type)) {
    return res.status(400).json({ error: 'target_type must be "post" or "comment"' });
  }
  if (!target_id || typeof target_id !== 'string') {
    return res.status(400).json({ error: 'target_id is required' });
  }

  const admin = getAdminClient();
  const table = target_type === 'post' ? 'forum_posts' : 'forum_comments';

  const { error: dupErr } = await admin.from('forum_reports').insert({
    reporter_id: user.id,
    target_type,
    target_id,
  });

  if (dupErr) {
    if (dupErr.code === '23505') {
      return res.status(200).json({ success: true, already_reported: true });
    }
    if (dupErr.code !== '42P01') {
      console.error('[forum/report] dedupe insert failed:', dupErr.message);
    }
  }

  const { data: target } = await admin
    .from(table)
    .select('id, report_count')
    .eq('id', target_id)
    .maybeSingle();

  if (!target) return res.status(404).json({ error: 'Target not found' });

  const newCount = (target.report_count || 0) + 1;
  const patch = { report_count: newCount };

  if (shouldAutoHide(newCount)) {
    if (target_type === 'post') {
      patch.visibility = 'hidden';
    } else {
      patch.is_hidden = true;
    }
  }

  await admin.from(table).update(patch).eq('id', target_id);

  let moderatorNotified = false;
  if (shouldNotifyModerators(newCount)) {
    const ctx = await buildReportNotifyContext(admin, target_type, target_id);
    moderatorNotified = await notifyForumModerators({
      targetType: target_type,
      targetId: target_id,
      reportCount: newCount,
      ...ctx,
    });
  }

  return res.status(200).json({
    success: true,
    report_count: newCount,
    auto_hidden: shouldAutoHide(newCount),
    moderator_notified: moderatorNotified,
  });
}
