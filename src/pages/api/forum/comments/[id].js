/**
 * POST /api/forum/comments/[id]?action=like — like a comment (one per user)
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../lib/server-auth.js';
import { isOptionalFeatureError } from '../../../../lib/forum-stats.js';
import { awardMoonJourneyExp, MOON_JOURNEY_EXP } from '../../../../lib/moon-journey.js';

async function fetchCommentForLike(admin, commentId) {
  const withCount = await admin
    .from('forum_comments')
    .select('id, author_id, like_count, is_hidden')
    .eq('id', commentId)
    .maybeSingle();

  if (!withCount.error) return withCount.data;

  if (!isOptionalFeatureError(withCount.error)) {
    console.error('[forum/comment-like] lookup failed:', withCount.error.message);
    return null;
  }

  const fallback = await admin
    .from('forum_comments')
    .select('id, author_id, is_hidden')
    .eq('id', commentId)
    .maybeSingle();

  if (fallback.error) {
    console.error('[forum/comment-like] lookup failed:', fallback.error.message);
    return null;
  }

  return fallback.data ? { ...fallback.data, like_count: 0 } : null;
}

export default async function handler(req, res) {
  const { id: commentId, action } = req.query;
  if (!commentId || typeof commentId !== 'string') {
    return res.status(400).json({ error: 'Comment ID required' });
  }

  if (req.method === 'PATCH' || req.method === 'DELETE') {
    return res.status(403).json({
      error: '留言發出後無法修改或刪除。',
      code: 'author_cannot_modify_comment',
    });
  }

  if (req.method !== 'POST' || action !== 'like') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  const admin = getAdminClient();

  const comment = await fetchCommentForLike(admin, commentId);

  if (!comment || comment.is_hidden) {
    return res.status(404).json({ error: 'Comment not found' });
  }
  if (comment.author_id === user.id) {
    return res.status(400).json({ error: 'Cannot like your own comment' });
  }

  const { error: insertErr } = await admin
    .from('forum_comment_likes')
    .insert({ comment_id: commentId, user_id: user.id });

  if (insertErr) {
    if (insertErr.code === '23505') {
      return res.status(409).json({ error: 'already_liked', liked: true });
    }
    if (isOptionalFeatureError(insertErr)) {
      return res.status(503).json({ error: 'Like feature not configured yet.' });
    }
    console.error('[forum/comment-like] insert failed:', insertErr.message);
    return res.status(500).json({ error: 'Like failed' });
  }

  const nextCount = (comment.like_count || 0) + 1;
  await admin.from('forum_comments').update({ like_count: nextCount }).eq('id', commentId);

  awardMoonJourneyExp(admin, {
    userId: comment.author_id,
    actionType: 'comment_liked',
    sourceId: `${commentId}:${user.id}`,
    amount: MOON_JOURNEY_EXP.comment_liked,
    skipDailyCommentLimit: true,
  }).catch(() => {});

  return res.status(200).json({ success: true, like_count: nextCount, liked: true });
}
