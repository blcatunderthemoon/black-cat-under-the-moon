/**
 * Live comment counts from forum_comments (denormalized comment_count can drift).
 */

export function isOptionalFeatureError(error) {
  if (!error) return false;
  const code = error.code || '';
  if (code === '42P01' || code === '42703' || code === 'PGRST204' || code === 'PGRST205') return true;
  const msg = error.message || '';
  return /schema cache|does not exist|could not find/i.test(msg);
}

export async function getCommentCountsByPostIds(admin, postIds) {
  if (!postIds?.length) return {};
  const { data, error } = await admin
    .from('forum_comments')
    .select('post_id')
    .in('post_id', postIds)
    .eq('is_hidden', false);
  if (error) {
    console.error('[forum-stats] comment count query failed:', error.message);
    return {};
  }
  const counts = {};
  for (const row of data || []) {
    counts[row.post_id] = (counts[row.post_id] || 0) + 1;
  }
  return counts;
}

export async function getViewerLikedPostIds(admin, userId, postIds) {
  if (!userId || !postIds?.length) return new Set();
  const { data, error } = await admin
    .from('forum_likes')
    .select('post_id')
    .eq('user_id', userId)
    .in('post_id', postIds);
  if (error) {
    if (isOptionalFeatureError(error)) return new Set();
    console.error('[forum-stats] liked query failed:', error.message);
    return new Set();
  }
  return new Set((data || []).map((r) => r.post_id));
}

export async function getViewerLikedCommentIds(admin, userId, commentIds) {
  if (!userId || !commentIds?.length) return new Set();
  const { data, error } = await admin
    .from('forum_comment_likes')
    .select('comment_id')
    .eq('user_id', userId)
    .in('comment_id', commentIds);
  if (error) {
    if (isOptionalFeatureError(error)) return new Set();
    console.error('[forum-stats] comment liked query failed:', error.message);
    return new Set();
  }
  return new Set((data || []).map((r) => r.comment_id));
}

export async function getViewerBookmarkedPostIds(admin, userId, postIds) {
  if (!userId || !postIds?.length) return new Set();
  const { data, error } = await admin
    .from('forum_bookmarks')
    .select('post_id')
    .eq('user_id', userId)
    .in('post_id', postIds);
  if (error) {
    if (isOptionalFeatureError(error)) return new Set();
    console.error('[forum-stats] bookmarks query failed:', error.message);
    return new Set();
  }
  return new Set((data || []).map((r) => r.post_id));
}
