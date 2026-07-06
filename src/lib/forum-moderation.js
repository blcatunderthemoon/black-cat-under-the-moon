/**
 * Forum moderation actions + audit log.
 */

import { databaseNowIso } from './hong-kong-time.js';
import { getAdminClient } from './server-auth.js';
import { validateForumTags } from './forum-tags.js';
import { insertTagsForPost } from './forum-tag-stats.js';

export async function logForumModeration({
  actorId,
  action,
  targetType,
  targetId,
  payload = {},
}) {
  const admin = getAdminClient();
  const { error } = await admin.from('forum_moderation_log').insert({
    actor_id: actorId || null,
    action,
    target_type: targetType,
    target_id: targetId,
    payload,
  });
  if (error && error.code !== '42P01') {
    console.error('[forum-moderation] log failed:', error.message);
  }
}

export async function hideForumPost(postId, { actorId, note } = {}) {
  const admin = getAdminClient();
  const { data: before } = await admin
    .from('forum_posts')
    .select('id, visibility, title')
    .eq('id', postId)
    .maybeSingle();
  if (!before) return { ok: false, status: 404, error: 'Post not found' };

  const patch = { visibility: 'hidden' };
  if (note) patch.moderation_note = String(note).slice(0, 500);

  const { error } = await admin.from('forum_posts').update(patch).eq('id', postId);
  if (error) return { ok: false, status: 500, error: 'Hide failed' };

  await logForumModeration({
    actorId,
    action: 'hide_post',
    targetType: 'post',
    targetId: postId,
    payload: { before: { visibility: before.visibility }, note: note || null },
  });

  return { ok: true, post: before };
}

export async function unhideForumPost(postId, { actorId } = {}) {
  const admin = getAdminClient();
  const { data: before } = await admin
    .from('forum_posts')
    .select('id, visibility')
    .eq('id', postId)
    .maybeSingle();
  if (!before) return { ok: false, status: 404, error: 'Post not found' };

  const { error } = await admin
    .from('forum_posts')
    .update({ visibility: 'public' })
    .eq('id', postId);
  if (error) return { ok: false, status: 500, error: 'Unhide failed' };

  await logForumModeration({
    actorId,
    action: 'unhide_post',
    targetType: 'post',
    targetId: postId,
    payload: { before: { visibility: before.visibility } },
  });

  return { ok: true };
}

export async function pinForumPost(postId, pinned, { actorId } = {}) {
  const admin = getAdminClient();
  const now = databaseNowIso();
  const { data: before } = await admin
    .from('forum_posts')
    .select('id, is_pinned')
    .eq('id', postId)
    .maybeSingle();
  if (!before) return { ok: false, status: 404, error: 'Post not found' };

  const patch = pinned
    ? { is_pinned: true, pinned_at: now, pinned_by: actorId || null }
    : { is_pinned: false, pinned_at: null, pinned_by: null };

  const { error } = await admin.from('forum_posts').update(patch).eq('id', postId);
  if (error) {
    if (error.code === '42703') {
      return { ok: false, status: 503, error: 'Pin feature not configured yet.' };
    }
    return { ok: false, status: 500, error: 'Pin failed' };
  }

  await logForumModeration({
    actorId,
    action: pinned ? 'pin' : 'unpin',
    targetType: 'post',
    targetId: postId,
    payload: { before: { is_pinned: before.is_pinned } },
  });

  return { ok: true, is_pinned: !!pinned };
}

export async function highlightForumPost(postId, highlighted, { actorId } = {}) {
  const admin = getAdminClient();
  const now = databaseNowIso();
  const { data: before } = await admin
    .from('forum_posts')
    .select('id, is_highlighted, visibility')
    .eq('id', postId)
    .maybeSingle();
  if (!before) return { ok: false, status: 404, error: 'Post not found' };
  if (highlighted && before.visibility !== 'public') {
    return { ok: false, status: 400, error: '僅公開帖可加冕至月光精選。', code: 'highlight_public_only' };
  }

  const patch = highlighted
    ? { is_highlighted: true, highlighted_at: now, highlighted_by: actorId || null }
    : { is_highlighted: false, highlighted_at: null, highlighted_by: null };

  const { error } = await admin.from('forum_posts').update(patch).eq('id', postId);
  if (error) {
    if (error.code === '42703') {
      return { ok: false, status: 503, error: 'Highlight feature not configured yet.' };
    }
    return { ok: false, status: 500, error: 'Highlight failed' };
  }

  await logForumModeration({
    actorId,
    action: highlighted ? 'highlight' : 'unhighlight',
    targetType: 'post',
    targetId: postId,
    payload: { before: { is_highlighted: before.is_highlighted } },
  });

  return { ok: true, is_highlighted: !!highlighted };
}

export async function updateForumPostTags(postId, tagsPayload, { actorId } = {}) {
  const admin = getAdminClient();
  const tagValidation = validateForumTags(tagsPayload);
  if (!tagValidation.ok) {
    return { ok: false, status: 400, error: tagValidation.error };
  }

  const { data: post } = await admin.from('forum_posts').select('id').eq('id', postId).maybeSingle();
  if (!post) return { ok: false, status: 404, error: 'Post not found' };

  await admin.from('forum_post_tags').delete().eq('post_id', postId);

  const tagResult = await insertTagsForPost(
    admin,
    postId,
    tagValidation.tags,
    tagValidation.displayByKey,
  );
  if (!tagResult.ok) {
    return { ok: false, status: 500, error: tagResult.error || 'Tag update failed' };
  }

  if (tagValidation.tags[0]) {
    await admin.from('forum_posts').update({ mood_tag: tagValidation.tags[0] }).eq('id', postId);
  }

  await logForumModeration({
    actorId,
    action: 'edit_tags',
    targetType: 'post',
    targetId: postId,
    payload: { tags: tagValidation.tags },
  });

  return { ok: true, tags: tagValidation.tags };
}

export async function hardDeleteForumPost(postId, { actorId } = {}) {
  const admin = getAdminClient();
  const { data: before } = await admin
    .from('forum_posts')
    .select('id, title, author_id')
    .eq('id', postId)
    .maybeSingle();
  if (!before) return { ok: false, status: 404, error: 'Post not found' };

  const { error } = await admin.from('forum_posts').delete().eq('id', postId);
  if (error) return { ok: false, status: 500, error: 'Delete failed' };

  await logForumModeration({
    actorId,
    action: 'delete_post',
    targetType: 'post',
    targetId: postId,
    payload: { title: before.title, author_id: before.author_id },
  });

  return { ok: true };
}

export async function hideForumComment(commentId, { actorId, note } = {}) {
  const admin = getAdminClient();
  const { data: before } = await admin
    .from('forum_comments')
    .select('id, is_hidden, post_id')
    .eq('id', commentId)
    .maybeSingle();
  if (!before) return { ok: false, status: 404, error: 'Comment not found' };

  const { error } = await admin
    .from('forum_comments')
    .update({ is_hidden: true })
    .eq('id', commentId);
  if (error) return { ok: false, status: 500, error: 'Hide failed' };

  await logForumModeration({
    actorId,
    action: 'hide_comment',
    targetType: 'comment',
    targetId: commentId,
    payload: { post_id: before.post_id, note: note || null },
  });

  return { ok: true };
}

export async function getModerationQueue({ limit = 30 } = {}) {
  const admin = getAdminClient();
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  const [postsRes, commentsRes, reportsRes] = await Promise.all([
    admin
      .from('forum_posts')
      .select('id, title, content, topic, visibility, report_count, created_at, author_id, is_pinned, is_highlighted')
      .gte('report_count', 1)
      .order('report_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(safeLimit),
    admin
      .from('forum_comments')
      .select('id, post_id, content, report_count, is_hidden, created_at, author_id')
      .gte('report_count', 1)
      .order('report_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(safeLimit),
    admin
      .from('forum_reports')
      .select('id, target_type, target_id, created_at')
      .order('created_at', { ascending: false })
      .limit(safeLimit),
  ]);

  const posts = postsRes.error?.code === '42703'
    ? (await admin
      .from('forum_posts')
      .select('id, title, content, topic, visibility, report_count, created_at, author_id')
      .gte('report_count', 1)
      .order('report_count', { ascending: false })
      .limit(safeLimit)).data || []
    : postsRes.data || [];

  return {
    posts: posts || [],
    comments: commentsRes.data || [],
    recent_reports: reportsRes.error?.code === '42P01' ? [] : (reportsRes.data || []),
    errors: [postsRes.error, commentsRes.error, reportsRes.error].filter(Boolean),
  };
}
