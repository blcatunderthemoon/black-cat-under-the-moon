/**
 * GET  /api/forum/posts/[id] — post detail + comments
 * POST /api/forum/posts/[id]/like — toggle like
 */

import { getOptionalUser, requireUser, sendAuthError, getAdminClient, getServiceOrUserClient } from '../../../../lib/server-auth.js';
import {
  getViewerBookmarkedPostIds,
  getViewerLikedCommentIds,
  getViewerLikedPostIds,
  isOptionalFeatureError,
} from '../../../../lib/forum-stats.js';
import { getPollsForPost } from '../../../../lib/forum-poll-stats.js';
import { getTagsByPostIds, getTagLabelMapForPosts } from '../../../../lib/forum-tag-stats.js';
import { canonicalForumTagKey } from '../../../../lib/forum-tags.js';
import { resolveForumAuthorDisplayName } from '../../../../lib/forum-author-names.js';
import { awardMoonJourneyExp, MOON_JOURNEY_EXP } from '../../../../lib/moon-journey.js';

async function fetchPostComments(admin, postId) {
  const withLikes = await admin
    .from('forum_comments')
    .select('id, author_id, parent_comment_id, content, like_count, created_at')
    .eq('post_id', postId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true });

  if (!withLikes.error) return withLikes.data || [];

  if (!isOptionalFeatureError(withLikes.error)) {
    console.error('[forum/posts] comments query failed:', withLikes.error.message);
    return [];
  }

  const fallback = await admin
    .from('forum_comments')
    .select('id, author_id, parent_comment_id, content, created_at')
    .eq('post_id', postId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true });

  if (fallback.error) {
    console.error('[forum/posts] comments query failed:', fallback.error.message);
    return [];
  }

  return fallback.data || [];
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Post ID required' });

  if (req.method === 'GET') return handleGet(req, res, id);
  if (req.method === 'POST' && req.query.action === 'like') return handleLike(req, res, id);
  if (req.method === 'POST' && req.query.action === 'bookmark') return handleBookmark(req, res, id);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res, postId) {
  const admin = getServiceOrUserClient(req);

  const [viewer, { data: post, error }] = await Promise.all([
    getOptionalUser(req),
    admin
      .from('forum_posts')
      .select('id, author_id, title, content, topic, mood_tag, anonymous_name_snapshot, like_count, comment_count, visibility, created_at')
      .eq('id', postId)
      .maybeSingle(),
  ]);

  if (error || !post) return res.status(404).json({ error: 'Post not found' });

  if (!viewer) {
    res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=60');
  } else {
    res.setHeader('Cache-Control', 'private, no-cache');
  }

  // Visibility gate
  if (post.visibility === 'hidden') return res.status(404).json({ error: 'Post not found' });
  if (post.visibility === 'members_only' && !viewer) {
    return res.status(403).json({
      error: 'Login required to view this post',
      code: 'members_only',
    });
  }

  const [
    comments,
    { data: mirrorCard },
    { data: authorProfile },
    tagsByPostId,
    polls,
  ] = await Promise.all([
    fetchPostComments(admin, postId),
    admin
      .from('mirror_cards')
      .select('public_slug, mirror_type')
      .eq('user_id', post.author_id)
      .maybeSingle(),
    admin
      .from('profiles')
      .select('display_name, subscription_tier')
      .eq('id', post.author_id)
      .maybeSingle(),
    getTagsByPostIds(admin, [postId]),
    getPollsForPost(admin, postId, viewer?.id),
  ]);

  const authorIds = [...new Set((comments || []).map((c) => c.author_id).filter(Boolean))];
  const commentIds = (comments || []).map((c) => c.id);
  const postTags = tagsByPostId[postId] || (post.mood_tag ? [canonicalForumTagKey(post.mood_tag)] : []);

  const [
    profilesResult,
    cardsResult,
    likedCommentIds,
    likedIds,
    bookmarkedIds,
    tagLabels,
  ] = await Promise.all([
    authorIds.length
      ? admin.from('profiles').select('id, display_name, subscription_tier').in('id', authorIds)
      : Promise.resolve({ data: [] }),
    authorIds.length
      ? admin.from('mirror_cards').select('user_id, public_slug, mirror_type').in('user_id', authorIds)
      : Promise.resolve({ data: [] }),
    getViewerLikedCommentIds(admin, viewer?.id, commentIds),
    getViewerLikedPostIds(admin, viewer?.id, [postId]),
    getViewerBookmarkedPostIds(admin, viewer?.id, [postId]),
    getTagLabelMapForPosts(admin, { [postId]: postTags }),
  ]);

  const authorMap = {};
  (profilesResult.data || []).forEach((p) => {
    authorMap[p.id] = {
      display_name: resolveForumAuthorDisplayName(p.display_name),
      is_premium: p.subscription_tier === 'premium',
    };
  });
  (cardsResult.data || []).forEach((c) => {
    if (authorMap[c.user_id]) {
      authorMap[c.user_id].mirror_slug = c.public_slug;
      authorMap[c.user_id].mirror_type = c.mirror_type;
    }
  });

  const enrichedComments = (comments || []).map((c) => ({
    id: c.id,
    parent_comment_id: c.parent_comment_id,
    content: c.content,
    like_count: c.like_count || 0,
    created_at: c.created_at,
    author: {
      ...(authorMap[c.author_id] || { display_name: '神秘貓咪', is_premium: false }),
    },
    is_mine: viewer?.id === c.author_id,
    is_op: c.author_id === post.author_id,
    viewer_liked: likedCommentIds.has(c.id),
  }));

  return res.status(200).json({
    post: {
      ...post,
      comment_count: post.comment_count ?? enrichedComments.length,
      author_id: undefined,
      is_mine: viewer?.id === post.author_id,
      viewer_liked: likedIds.has(postId),
      viewer_bookmarked: bookmarkedIds.has(postId),
      author: {
        display_name: resolveForumAuthorDisplayName(
          authorProfile?.display_name,
          post.anonymous_name_snapshot,
        ),
        mirror_slug: mirrorCard?.public_slug || null,
        mirror_type: mirrorCard?.mirror_type || null,
        is_premium: authorProfile?.subscription_tier === 'premium',
      },
      tags: postTags,
    },
    tag_labels: tagLabels,
    comments: enrichedComments,
    polls,
    viewer_logged_in: !!viewer,
  });
}

async function handleLike(req, res, postId) {
  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  const admin = getAdminClient();

  const { data: post } = await admin
    .from('forum_posts')
    .select('like_count')
    .eq('id', postId)
    .maybeSingle();

  if (!post) return res.status(404).json({ error: 'Post not found' });

  const { error: insertErr } = await admin
    .from('forum_likes')
    .insert({ post_id: postId, user_id: user.id });

  if (insertErr) {
    if (insertErr.code === '23505') {
      return res.status(409).json({ error: 'already_liked', liked: true });
    }
    if (insertErr.code === '42P01') {
      return res.status(503).json({ error: 'Like feature not configured yet.' });
    }
    console.error('[forum/like] insert failed:', insertErr.message);
    return res.status(500).json({ error: 'Like failed' });
  }

  const nextCount = (post.like_count || 0) + 1;
  await admin.from('forum_posts').update({ like_count: nextCount }).eq('id', postId);

  return res.status(200).json({ success: true, like_count: nextCount, liked: true });
}

async function handleBookmark(req, res, postId) {
  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  const admin = getAdminClient();

  const { data: post, error: postError } = await admin
    .from('forum_posts')
    .select('id, visibility, author_id')
    .eq('id', postId)
    .maybeSingle();
  if (postError || !post || post.visibility === 'hidden') {
    return res.status(404).json({ error: 'Post not found' });
  }

  const { data: existing, error: existingError } = await admin
    .from('forum_bookmarks')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingError && existingError.code === '42P01') {
    return res.status(503).json({ error: 'Bookmark feature not configured yet.' });
  }
  if (existingError) {
    console.error('[forum/bookmark] lookup failed:', existingError.message);
    return res.status(500).json({ error: 'Bookmark failed' });
  }

  if (existing?.id) {
    const { error: removeError } = await admin.from('forum_bookmarks').delete().eq('id', existing.id);
    if (removeError) return res.status(500).json({ error: 'Bookmark failed' });
    return res.status(200).json({ success: true, bookmarked: false });
  }

  const { error: insertError } = await admin
    .from('forum_bookmarks')
    .insert({ post_id: postId, user_id: user.id });

  if (insertError) {
    if (insertError.code === '23505') {
      return res.status(200).json({ success: true, bookmarked: true });
    }
    if (insertError.code === '42P01') {
      return res.status(503).json({ error: 'Bookmark feature not configured yet.' });
    }
    console.error('[forum/bookmark] insert failed:', insertError.message);
    return res.status(500).json({ error: 'Bookmark failed' });
  }

  if (post.author_id && post.author_id !== user.id) {
    awardMoonJourneyExp(admin, {
      userId: post.author_id,
      actionType: 'post_bookmarked',
      sourceId: `${postId}:${user.id}`,
      amount: MOON_JOURNEY_EXP.post_bookmarked,
      skipDailyCommentLimit: true,
    }).catch(() => {});
  }

  return res.status(200).json({ success: true, bookmarked: true });
}
