/**
 * GET  /api/forum/posts/[id] — post detail + comments
 * POST /api/forum/posts/[id]/like — toggle like
 */

import { getOptionalUser, requireUser, sendAuthError, getAdminClient, getServiceOrUserClient, getProfile } from '../../../../lib/server-auth.js';
import { getForumRole, canModerateForum, canAdminForum } from '../../../../lib/forum-roles.js';
import {
  canModerateStoredTopic,
  getModeratorTopicsForUser,
} from '../../../../lib/forum-moderator-assignments.js';
import {
  getViewerBookmarkedPostIds,
  getViewerLikedCommentIds,
  getViewerLikedPostIds,
  isOptionalFeatureError,
} from '../../../../lib/forum-stats.js';
import { getPollsForPost } from '../../../../lib/forum-poll-stats.js';
import { getTagsByPostIds, getTagLabelMapForPosts } from '../../../../lib/forum-tag-stats.js';
import { canonicalForumTagKey } from '../../../../lib/forum-tags.js';
import { mapForumPostAuthorPublic, resolveForumAuthorDisplayName } from '../../../../lib/forum-author-names.js';
import { awardMoonJourneyExp, MOON_JOURNEY_EXP } from '../../../../lib/moon-journey.js';
import { isMatureForumTopicStored } from '../../../../lib/forum-mature.js';
import { isStoryPost, validateStoryCoverUrl, STORY_SYNOPSIS_MAX } from '../../../../lib/forum-story.js';
import {
  fetchStoryChapters,
  serializeStoryChaptersForViewer,
  GUEST_FREE_CHAPTER_COUNT,
} from '../../../../lib/forum-story-chapters.js';

const POST_DETAIL_CORE = `
  id, author_id, title, content, topic, mood_tag, anonymous_name_snapshot, hide_username,
  like_count, comment_count, visibility, is_pinned, is_highlighted, created_at
`;

const POST_DETAIL_COLUMN_TIERS = [
  `${POST_DETAIL_CORE.trim()}, view_count, story_completed, cover_image_url, synopsis`,
  `${POST_DETAIL_CORE.trim()}, view_count, cover_image_url, synopsis`,
  `${POST_DETAIL_CORE.trim()}, cover_image_url, synopsis`,
  `
  id, author_id, title, content, topic, mood_tag, anonymous_name_snapshot,
  like_count, comment_count, visibility, is_pinned, is_highlighted, created_at
`,
];

async function fetchForumPost(admin, postId) {
  for (const columns of POST_DETAIL_COLUMN_TIERS) {
    const result = await admin
      .from('forum_posts')
      .select(columns)
      .eq('id', postId)
      .maybeSingle();
    if (!result.error) return result;
    if (result.error?.code !== '42703') return result;
  }
  return { data: null, error: { message: 'Post columns unavailable', code: '42703' } };
}

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
  if (req.method === 'PATCH') return handlePatchStoryMeta(req, res, id);
  if (req.method === 'DELETE') {
    return res.status(403).json({
      error: '帖子發出後無法修改或刪除。',
      code: 'author_cannot_modify_post',
    });
  }
  if (req.method === 'POST' && req.query.action === 'like') return handleLike(req, res, id);
  if (req.method === 'POST' && req.query.action === 'bookmark') return handleBookmark(req, res, id);
  if (req.method === 'POST' && req.query.action === 'view') return handleStoryView(req, res, id);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res, postId) {
  const admin = getServiceOrUserClient(req);

  const [viewer, postResult] = await Promise.all([
    getOptionalUser(req),
    fetchForumPost(admin, postId),
  ]);

  const { data: post, error } = postResult;
  if (error || !post) return res.status(404).json({ error: 'Post not found' });

  if (!viewer) {
    res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=60');
  } else {
    res.setHeader('Cache-Control', 'private, no-cache');
  }

  if (isMatureForumTopicStored(post.topic) && !viewer) {
    return res.status(401).json({
      error: '請登入並確認年齡後才能瀏覽此版塊。',
      code: 'mature_login_required',
    });
  }
  if (post.visibility === 'members_only' && !viewer) {
    return res.status(403).json({
      error: 'Login required to view this post',
      code: 'members_only',
    });
  }

  const profilePromise = viewer
    ? getProfile(viewer.id)
    : Promise.resolve(null);

  const [
    profile,
    comments,
    { data: mirrorCard },
    { data: authorProfile },
    tagsByPostId,
    polls,
    storyChapters,
  ] = await Promise.all([
    profilePromise,
    fetchPostComments(admin, postId),
    admin
      .from('mirror_cards')
      .select('public_slug, mirror_type')
      .eq('user_id', post.author_id)
      .maybeSingle(),
    admin
      .from('profiles')
      .select('display_name, subscription_tier, forum_role')
      .eq('id', post.author_id)
      .maybeSingle(),
    getTagsByPostIds(admin, [postId]),
    getPollsForPost(admin, postId, viewer?.id),
    isStoryPost(post) ? fetchStoryChapters(admin, post) : Promise.resolve([]),
  ]);

  const role = getForumRole(profile);
  let viewerCanModerate = false;
  let canViewHidden = false;

  if (canModerateForum(role) && viewer) {
    const moderatorTopics = role === 'moderator'
      ? await getModeratorTopicsForUser(admin, viewer.id)
      : null;
    const actor = { role, moderatorTopics, viaDashboard: false };
    viewerCanModerate = canModerateStoredTopic(actor, post.topic);
    canViewHidden = viewerCanModerate || canAdminForum(role);
  }

  if (post.visibility === 'hidden' && !canViewHidden) {
    return res.status(404).json({ error: 'Post not found' });
  }

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
      display_name: p.display_name,
      is_premium: p.subscription_tier === 'premium',
    };
  });
  (cardsResult.data || []).forEach((c) => {
    if (authorMap[c.user_id]) {
      authorMap[c.user_id].mirror_slug = c.public_slug;
      authorMap[c.user_id].mirror_type = c.mirror_type;
    }
  });

  const viewerIsAuthor = !!viewer && viewer.id === post.author_id;
  const viewerHasCommented = viewerIsAuthor
    || (!!viewer && (comments || []).some((c) => c.author_id === viewer.id));

  const enrichedComments = (comments || []).map((c) => ({
    id: c.id,
    parent_comment_id: c.parent_comment_id,
    content: c.content,
    like_count: c.like_count || 0,
    created_at: c.created_at,
    author: {
      display_name: resolveForumAuthorDisplayName(authorMap[c.author_id]?.display_name),
      is_premium: authorMap[c.author_id]?.is_premium || false,
      mirror_slug: authorMap[c.author_id]?.mirror_slug || null,
      mirror_type: authorMap[c.author_id]?.mirror_type || null,
    },
    is_mine: viewer?.id === c.author_id,
    is_op: c.author_id === post.author_id,
    viewer_liked: likedCommentIds.has(c.id),
  }));

  const liveCommentCount = enrichedComments.length;
  if ((Number(post.comment_count) || 0) !== liveCommentCount) {
    // Heal denormalized counter when comments were hidden/auto-modded
    Promise.resolve(
      admin.from('forum_posts').update({ comment_count: liveCommentCount }).eq('id', postId),
    ).catch((err) => {
      console.error('[forum/posts] comment_count heal failed:', err?.message || err);
    });
  }

  return res.status(200).json({
    post: {
      ...post,
      // Prefer live visible comments over denormalized column (can drift after hide/moderation)
      comment_count: liveCommentCount,
      author_id: undefined,
      is_mine: viewer?.id === post.author_id,
      viewer_liked: likedIds.has(postId),
      viewer_bookmarked: bookmarkedIds.has(postId),
      author: {
        ...mapForumPostAuthorPublic(post, {
          display_name: authorProfile?.display_name,
          mirror_slug: mirrorCard?.public_slug,
          mirror_type: mirrorCard?.mirror_type,
          is_premium: authorProfile?.subscription_tier === 'premium',
        }),
        forum_role: ['moderator', 'admin'].includes(authorProfile?.forum_role)
          ? authorProfile.forum_role
          : undefined,
      },
      hide_username: !!post.hide_username,
      tags: postTags,
      is_pinned: post.is_pinned || false,
      is_highlighted: post.is_highlighted || false,
      is_hidden: post.visibility === 'hidden',
      view_count: post.view_count ?? 0,
      story_completed: !!post.story_completed,
      viewer_can_moderate: viewerCanModerate,
    },
    tag_labels: tagLabels,
    comments: enrichedComments,
    polls,
    chapters: isStoryPost(post)
      ? serializeStoryChaptersForViewer(storyChapters, {
        loggedIn: !!viewer,
        isAuthor: viewerIsAuthor,
        hasCommented: viewerHasCommented,
      })
      : undefined,
    chapters_locked: isStoryPost(post) && !viewer,
    guest_free_chapters: isStoryPost(post) ? GUEST_FREE_CHAPTER_COUNT : undefined,
    chapter_count: isStoryPost(post) ? storyChapters.length : undefined,
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
  const { error: updateErr } = await admin
    .from('forum_posts')
    .update({ like_count: nextCount })
    .eq('id', postId);

  if (updateErr) {
    await admin.from('forum_likes').delete().eq('post_id', postId).eq('user_id', user.id);
    console.error('[forum/like] count update failed:', updateErr.message);
    return res.status(500).json({ error: 'Like failed' });
  }

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

async function handleStoryView(req, res, postId) {
  const admin = getAdminClient();
  const { data: post, error } = await admin
    .from('forum_posts')
    .select('id, author_id, topic, view_count')
    .eq('id', postId)
    .maybeSingle();

  if (error?.code === '42703') {
    return res.status(200).json({ view_count: 0 });
  }
  if (error || !post || !isStoryPost(post)) {
    return res.status(404).json({ error: 'Story not found' });
  }

  const viewer = await getOptionalUser(req);
  const current = post.view_count ?? 0;
  if (viewer?.id === post.author_id) {
    return res.status(200).json({ view_count: current });
  }

  const next = current + 1;
  admin
    .from('forum_posts')
    .update({ view_count: next })
    .eq('id', postId)
    .then(() => {})
    .catch(() => {});

  return res.status(200).json({ view_count: next });
}

async function handlePatchStoryMeta(req, res, postId) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const admin = getAdminClient();
  const { data: post, error: postError } = await admin
    .from('forum_posts')
    .select('id, author_id, topic')
    .eq('id', postId)
    .maybeSingle();

  if (postError || !post || !isStoryPost(post)) {
    return res.status(404).json({ error: 'Story not found' });
  }
  if (post.author_id !== user.id) {
    return res.status(403).json({ error: '只有作者可以更新故事資料。' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const updates = {};

  if (Object.prototype.hasOwnProperty.call(body, 'cover_image_url')) {
    const coverCheck = validateStoryCoverUrl(body.cover_image_url);
    if (!coverCheck.ok) return res.status(400).json({ error: coverCheck.error });
    updates.cover_image_url = coverCheck.value;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'synopsis')) {
    if (body.synopsis == null || body.synopsis === '') {
      updates.synopsis = null;
    } else {
      const text = String(body.synopsis).trim();
      updates.synopsis = text ? text.slice(0, STORY_SYNOPSIS_MAX) : null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'story_completed')) {
    updates.story_completed = !!body.story_completed;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: '沒有可更新的欄位。' });
  }

  const PATCH_SELECT_TIERS = [
    'cover_image_url, synopsis, view_count, story_completed',
    'cover_image_url, synopsis, view_count',
    'cover_image_url, synopsis',
  ];

  let updated = null;
  let updateError = null;
  for (const columns of PATCH_SELECT_TIERS) {
    const result = await admin
      .from('forum_posts')
      .update(updates)
      .eq('id', postId)
      .select(columns)
      .single();
    updated = result.data;
    updateError = result.error;
    if (!updateError) break;
    if (updateError?.code !== '42703') break;
  }

  if (updateError) {
    if (updateError.code === '42703') {
      return res.status(503).json({ error: '故事欄位尚未設定。' });
    }
    console.error('[forum/posts] story meta update failed:', updateError.message);
    return res.status(500).json({ error: '更新失敗。' });
  }

  return res.status(200).json({ post: updated });
}
