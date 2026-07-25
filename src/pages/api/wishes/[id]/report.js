/**
 * POST /api/wishes/[id]/report — report a wish
 * Body: { reason?: string }
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../lib/server-auth.js';
import { shouldAutoHide, shouldNotifyModerators } from '../../../../lib/moderation.js';
import { notifyForumModerators } from '../../../../lib/forum-moderation-notify.js';
import {
  createRateLimiter,
  rateLimitOrPass,
  rateLimitResponse,
} from '../../../../lib/rate-limit.js';

const reportLimiter = createRateLimiter('wish-report', 10, '1 h');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: '缺少心願 id' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const limited = await rateLimitOrPass(reportLimiter, `wish-report:${user.id}`);
  if (!limited.ok) return rateLimitResponse(res, limited.reason);

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : null;

  const admin = getAdminClient();
  const { data: wish } = await admin
    .from('wishes')
    .select('id, user_id, title, report_count, status')
    .eq('id', id)
    .maybeSingle();

  if (!wish) return res.status(404).json({ error: '找不到此心願。' });
  if (wish.user_id === user.id) {
    return res.status(400).json({ error: '不能舉報自己的心願。' });
  }

  const { error: insErr } = await admin.from('wish_reports').insert({
    reporter_id: user.id,
    wish_id: wish.id,
    reason,
  });

  if (insErr) {
    if (insErr.code === '23505') {
      return res.status(200).json({ success: true, already_reported: true });
    }
    if (insErr.code === '42P01') {
      return res.status(503).json({
        error: '舉報功能尚未就緒，請先執行 wish_reports migration。',
        code: 'migration_required',
      });
    }
    console.error('[wishes/report] insert failed:', insErr.message);
    return res.status(500).json({ error: '舉報失敗，請稍後再試。' });
  }

  const newCount = (wish.report_count || 0) + 1;
  const patch = { report_count: newCount };
  let autoHidden = false;
  if (shouldAutoHide(newCount) && wish.status !== 'hidden') {
    patch.status = 'hidden';
    autoHidden = true;
  }
  await admin.from('wishes').update(patch).eq('id', wish.id);

  if (shouldNotifyModerators(newCount)) {
    try {
      await notifyForumModerators({
        targetType: 'wish',
        targetId: wish.id,
        reportCount: newCount,
        postTitle: wish.title,
        preview: autoHidden ? '已自動隱藏' : null,
        forumUrl: `/wishes/${wish.id}`,
      });
    } catch (err) {
      console.error('[wishes/report] notify failed:', err?.message || err);
    }
  }

  return res.status(200).json({
    success: true,
    report_count: newCount,
    auto_hidden: autoHidden,
  });
}
