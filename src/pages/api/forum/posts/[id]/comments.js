/**
 * POST /api/forum/posts/[id]/comments — add a comment to a post
 */

import { requireUser, ensureProfile, sendAuthError, getAdminClient } from '../../../../../lib/server-auth.js';
import { filterContent } from '../../../../../lib/content-filter.js';
import { dispatchForumMentions } from '../../../../../lib/forum-mention-notify.js';
import { awardMoonJourneyExp, MOON_JOURNEY_EXP } from '../../../../../lib/moon-journey.js';

async function incrementPostCommentCount(admin, postId) {
  const { data: post } = await admin
    .from('forum_posts')
    .select('comment_count')
    .eq('id', postId)
    .maybeSingle();

  if (!post) return;

  await admin
    .from('forum_posts')
    .update({ comment_count: (post.comment_count || 0) + 1 })
    .eq('id', postId);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id: postId } = req.query;
  if (!postId || typeof postId !== 'string') return res.status(400).json({ error: 'Post ID required' });

  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  let profile;
  try {
    profile = await ensureProfile(user);
  } catch (err) {
    console.error('[forum/comments] ensureProfile failed:', err?.message || err);
    return res.status(500).json({ error: '無法載入帳號資料。' });
  }

  if (profile.status === 'limited' || profile.status === 'suspended') {
    return res.status(403).json({ error: '你的帳號目前受到限制，無法留言。' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { content, parent_comment_id } = body;

  if (!content?.trim() || content.trim().length < 2) {
    return res.status(400).json({ error: '留言最少需要 2 個字。' });
  }
  if (content.length > 500) {
    return res.status(400).json({ error: '留言最多 500 字。' });
  }

  const { blocked, crisis } = filterContent(content);
  if (blocked) {
    if (crisis) return res.status(451).json({ error: 'crisis', crisis: true });
    return res.status(422).json({ error: '內容包含不允許的詞語。' });
  }

  const admin = getAdminClient();

  const { data: post } = await admin
    .from('forum_posts')
    .select('id, visibility, author_id')
    .eq('id', postId)
    .maybeSingle();

  if (!post || post.visibility === 'hidden') {
    return res.status(404).json({ error: 'Post not found' });
  }
  if (post.visibility === 'members_only' && !user) {
    return res.status(403).json({ error: '請登入後才能留言。', code: 'members_only' });
  }

  if (parent_comment_id) {
    const { data: parent } = await admin
      .from('forum_comments')
      .select('id, post_id, parent_comment_id')
      .eq('id', parent_comment_id)
      .maybeSingle();

    if (!parent || parent.post_id !== postId) {
      return res.status(400).json({ error: '無效的回覆目標。', code: 'invalid_parent' });
    }
    if (parent.parent_comment_id) {
      return res.status(400).json({
        error: '僅可回覆頂層留言（樓中樓深度鎖定 1 層）。',
        code: 'max_thread_depth',
      });
    }
  }

  const { data: comment, error } = await admin
    .from('forum_comments')
    .insert({
      post_id: postId,
      author_id: user.id,
      parent_comment_id: parent_comment_id || null,
      content: content.trim(),
      is_hidden: false,
      report_count: 0,
    })
    .select('id, content, created_at')
    .single();

  if (error) {
    console.error('[forum/comments] insert failed:', error.message, error.code, error.details);
    const missingTable = error.code === '42P01' || /forum_comments/.test(error.message || '');
    return res.status(500).json({
      error: missingTable
        ? '留言功能尚未設定完成，請聯絡管理員。'
        : '留言失敗，請稍後再試。',
    });
  }

  let commentCount = 0;
  try {
    await incrementPostCommentCount(admin, postId);
    const { count } = await admin
      .from('forum_comments')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId)
      .eq('is_hidden', false);
    commentCount = count ?? 0;
  } catch (countErr) {
    console.error('[forum/comments] count update failed:', countErr?.message || countErr);
  }

  dispatchForumMentions({
    content: content.trim(),
    actorId: user.id,
    postId,
    commentId: comment.id,
  }).catch(() => {});

  if (user.id !== post.author_id) {
    awardMoonJourneyExp(admin, {
      userId: user.id,
      actionType: 'comment_created',
      sourceId: comment.id,
      amount: MOON_JOURNEY_EXP.comment_created,
    }).catch(() => {});
  }

  return res.status(201).json({
    comment: {
      ...comment,
      like_count: 0,
      viewer_liked: false,
      author: { display_name: profile.display_name },
      is_mine: true,
      is_op: user.id === post.author_id,
    },
    comment_count: commentCount,
  });
}
