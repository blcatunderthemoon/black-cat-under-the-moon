/**
 * GET  /api/forum/posts — list posts (paginated, filterable by topic/sort)
 * POST /api/forum/posts — create a new post (auth required, quota enforced)
 */

import { getOptionalUser, requireUser, ensureProfile, sendAuthError, getAdminClient, getServiceOrUserClient } from '../../../lib/server-auth.js';
import { filterContent } from '../../../lib/content-filter.js';
import { dispatchForumMentions } from '../../../lib/forum-mention-notify.js';
import { extractPollIdsFromContent, validatePollsForContent } from '../../../lib/forum-poll.js';
import { insertPollsForPost } from '../../../lib/forum-poll-stats.js';
import { getViewerBookmarkedPostIds, getViewerLikedPostIds } from '../../../lib/forum-stats.js';
import { mapForumPostListPreview } from '../../../lib/forum-list-preview.js';
import { loadForumAuthorMeta, resolveForumAuthorDisplayName } from '../../../lib/forum-author-names.js';
import { getTagsByPostIds, getPostIdsForTag, insertTagsForPost, getTagLabelMapForPosts } from '../../../lib/forum-tag-stats.js';
import { validateForumTags } from '../../../lib/forum-tags.js';
import { assertAndConsumeQuota } from '../../../lib/permissions.js';
import { awardMoonJourneyExp, MOON_JOURNEY_EXP } from '../../../lib/moon-journey.js';
import {
  VALID_POST_TOPICS,
  getTopicDbValues,
  isValidPostTopic,
} from '../../../lib/forum-categories.js';
import {
  isMatureForumTopic,
  applyExcludeMatureTopics,
  validateMaturePostContent,
} from '../../../lib/forum-mature.js';
import {
  isStoryTopic,
  STORY_CONTENT_MAX,
  STORY_SYNOPSIS_MAX,
  normalizeForumBodyContent,
  validateStoryCoverUrl,
} from '../../../lib/forum-story.js';
import { STORY_CHAPTER_TITLE_MAX } from '../../../lib/forum-story-chapters.js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(5, '10 m') })
  : null;

const POST_LIST_CORE = `
  id,
  author_id,
  title,
  content,
  topic,
  mood_tag,
  anonymous_name_snapshot,
  like_count,
  comment_count,
  visibility,
  is_pinned,
  is_highlighted,
  pinned_at,
  created_at
`;

const POST_LIST_COLUMN_TIERS = [
  `${POST_LIST_CORE.trim()}, cover_image_url, synopsis, view_count, story_completed`,
  `${POST_LIST_CORE.trim()}, cover_image_url, synopsis, view_count`,
  `${POST_LIST_CORE.trim()}, cover_image_url, synopsis`,
  `
  id,
  author_id,
  title,
  content,
  topic,
  mood_tag,
  anonymous_name_snapshot,
  like_count,
  comment_count,
  visibility,
  created_at
`,
];

function applyPostListSort(query, sort, columns) {
  const hasPinned = String(columns).includes('is_pinned');
  if (hasPinned) {
    if (sort === 'popular') {
      return query
        .order('is_pinned', { ascending: false })
        .order('like_count', { ascending: false })
        .order('created_at', { ascending: false });
    }
    return query
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
  }
  if (sort === 'popular') {
    return query
      .order('like_count', { ascending: false })
      .order('created_at', { ascending: false });
  }
  return query.order('created_at', { ascending: false });
}

async function fetchPostList(admin, buildQuery, sort) {
  for (const columns of POST_LIST_COLUMN_TIERS) {
    let query = buildQuery(columns);
    query = applyPostListSort(query, sort, columns);
    const result = await query;
    if (!result.error) return result;
    if (result.error?.code !== '42703') return result;
  }
  return { data: [], error: { message: 'Post list columns unavailable', code: '42703' } };
}

const VALID_SORTS = ['latest', 'popular', 'clan', 'saved'];

function applyTopicFilter(query, topic) {
  const dbTopics = getTopicDbValues(topic);
  if (dbTopics?.length) return query.in('topic', dbTopics);
  return query;
}

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

function escapeIlikeTerm(value) {
  return String(value).replace(/[%_\\]/g, '\\$&');
}

async function handleGet(req, res) {
  try {
    return await handleGetInner(req, res);
  } catch (err) {
    console.error('[forum/posts] unhandled:', err?.message || err);
    return res.status(500).json({ error: 'Failed to load posts' });
  }
}

async function handleGetInner(req, res) {
  const admin = getServiceOrUserClient(req);

  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const topic = req.query.topic || null;
  const tag = typeof req.query.tag === 'string' ? req.query.tag.trim() : '';
  const sort = VALID_SORTS.includes(req.query.sort) ? req.query.sort : 'latest';
  const titleQuery = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';

  // Guests see public + members_only in the feed (content gated server-side).
  const visibilityFilter = ['public', 'members_only'];

  const [viewer, tagPostIds] = await Promise.all([
    getOptionalUser(req),
    typeof req.query.tag === 'string' && req.query.tag.trim()
      ? getPostIdsForTag(admin, req.query.tag.trim(), visibilityFilter)
      : Promise.resolve(null),
  ]);
  const isGuest = !viewer;

  if (isMatureForumTopic(topic) && !viewer) {
    return res.status(401).json({
      error: '請登入並確認年齡後才能瀏覽此版塊。',
      code: 'mature_login_required',
    });
  }

  if (!viewer) {
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=45');
  } else {
    res.setHeader('Cache-Control', 'private, no-cache');
  }

  // For 'clan' sort: look up viewer's mirror_type for metadata; filter to same family
  let clanType = null;
  let clanAuthorIds = null;
  if (sort === 'clan' && viewer) {
    const { data: card } = await admin
      .from('mirror_cards')
      .select('mirror_type')
      .eq('user_id', viewer.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    clanType = card?.mirror_type || null;
    if (!clanType) {
      return res.status(200).json({
        posts: [],
        has_more: false,
        viewer_clan_type: null,
      });
    }
    const { data: clanCards } = await admin
      .from('mirror_cards')
      .select('user_id')
      .eq('mirror_type', clanType);
    clanAuthorIds = [...new Set((clanCards || []).map((c) => c.user_id).filter(Boolean))];
    if (!clanAuthorIds.length) {
      return res.status(200).json({
        posts: [],
        has_more: false,
        viewer_clan_type: clanType,
      });
    }
  }

  if (sort === 'saved' && !viewer) {
    return res.status(401).json({ error: 'Login required to view saved posts' });
  }

  if (tag && tagPostIds && !tagPostIds.length) {
    return res.status(200).json({
      posts: [],
      has_more: false,
      ...(sort === 'clan' ? { viewer_clan_type: clanType } : {}),
    });
  }

  let posts = [];
  let error = null;
  let hasMore = false;

  if (sort === 'saved') {
    const { data: bookmarks, error: bookmarkError } = await admin
      .from('forum_bookmarks')
      .select('post_id, created_at')
      .eq('user_id', viewer.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (bookmarkError) {
      if (bookmarkError.code === '42P01') {
        return res.status(503).json({ error: 'Bookmark feature not configured yet.' });
      }
      return res.status(500).json({ error: 'Failed to load posts' });
    }

    const bookmarkedPostIds = (bookmarks || []).map((b) => b.post_id)
      .filter((id) => !tagPostIds || tagPostIds.includes(id));
    hasMore = (bookmarks || []).length === limit;

    if (bookmarkedPostIds.length > 0) {
      let savedQuery = admin
        .from('forum_posts')
        .select(POST_LIST_COLUMNS)
        .in('id', bookmarkedPostIds)
        .in('visibility', visibilityFilter);
      if (topic && getTopicDbValues(topic)?.length) {
        savedQuery = applyTopicFilter(savedQuery, topic);
      }
      if (tagPostIds) {
        savedQuery = savedQuery.in('id', tagPostIds);
      }
      if (!isMatureForumTopic(topic)) {
        savedQuery = applyExcludeMatureTopics(savedQuery);
      }
      const { data: savedPosts, error: savedError } = await savedQuery;
      if (savedError?.code === '42703') {
        const legacy = await admin
          .from('forum_posts')
          .select(POST_LIST_COLUMNS_LEGACY)
          .in('id', bookmarkedPostIds)
          .in('visibility', visibilityFilter);
        posts = legacy.data || [];
        error = legacy.error;
      } else {
        posts = savedPosts || [];
        error = savedError;
      }

      const orderMap = new Map(bookmarkedPostIds.map((id, i) => [id, i]));
      posts.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
    }
  } else {
    const buildQuery = (columns) => {
      let query = admin
        .from('forum_posts')
        .select(columns)
        .in('visibility', visibilityFilter)
        .range(offset, offset + limit - 1);

      if (topic && getTopicDbValues(topic)?.length) {
        query = applyTopicFilter(query, topic);
      }
      if (tagPostIds) {
        query = query.in('id', tagPostIds);
      }
      if (clanAuthorIds) {
        query = query.in('author_id', clanAuthorIds);
      }
      if (titleQuery) {
        query = query.ilike('title', `%${escapeIlikeTerm(titleQuery)}%`);
      }
      if (!isMatureForumTopic(topic)) {
        query = applyExcludeMatureTopics(query);
      }
      return query;
    };

    const result = await fetchPostList(admin, buildQuery, sort);
    posts = result.data || [];
    error = result.error;
    hasMore = posts.length === limit;
  }

  if (error) {
    console.error('[forum/posts] list failed:', error.message, error.code);
    return res.status(500).json({ error: 'Failed to load posts' });
  }

  const postIds = (posts || []).map((p) => p.id);
  const authorIds = [...new Set((posts || []).map((p) => p.author_id).filter(Boolean))];
  const tagsByPostIdPromise = getTagsByPostIds(admin, postIds);
  const [likedIds, bookmarkedIds, tagsByPostId, authorCardsResult, authorMeta, tagLabels] = await Promise.all([
    getViewerLikedPostIds(admin, viewer?.id, postIds),
    getViewerBookmarkedPostIds(admin, viewer?.id, postIds),
    tagsByPostIdPromise,
    authorIds.length
      ? admin.from('mirror_cards').select('user_id, mirror_type, public_slug').in('user_id', authorIds)
      : Promise.resolve({ data: [] }),
    loadForumAuthorMeta(admin, authorIds),
    tagsByPostIdPromise.then((byPost) => getTagLabelMapForPosts(admin, byPost)),
  ]);
  const { names: authorNames, premium: authorPremium } = authorMeta;

  const mirrorByAuthor = {};
  const slugByAuthor = {};
  (authorCardsResult.data || []).forEach((c) => {
    if (c.mirror_type) mirrorByAuthor[c.user_id] = c.mirror_type;
    if (c.public_slug) slugByAuthor[c.user_id] = c.public_slug;
  });

  const previews = (posts || []).map((p) => {
    const mapped = mapForumPostListPreview({
      ...p,
      anonymous_name_snapshot: resolveForumAuthorDisplayName(
        authorNames[p.author_id],
        p.anonymous_name_snapshot,
      ),
      tags: tagsByPostId[p.id] || (p.mood_tag ? [p.mood_tag] : []),
      comment_count: p.comment_count ?? 0,
      is_mine: viewer?.id === p.author_id,
      viewer_liked: likedIds.has(p.id),
      viewer_bookmarked: bookmarkedIds.has(p.id),
      author_is_premium: !!authorPremium[p.author_id],
      author_mirror_type: mirrorByAuthor[p.author_id] || null,
      author_mirror_slug: slugByAuthor[p.author_id] || null,
      author_id: undefined,
    });
    if (isGuest && p.visibility === 'members_only') {
      return {
        ...mapped,
        content: '🔒 會員限定內容，登入後即可閱讀全文。',
        content_truncated: false,
        members_gated: true,
      };
    }
    return { ...mapped, members_gated: false };
  });

  return res.status(200).json({
    posts: previews,
    tag_labels: tagLabels,
    has_more: hasMore,
    ...(sort === 'clan' ? { viewer_clan_type: clanType } : {}),
  });
}

async function handlePost(req, res) {
  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  // Per-user rate limit: 5 post creates per 10 minutes (extra guard on top of quota)
  if (ratelimit) {
    const { success } = await ratelimit.limit(`forum_post:${user.id}`);
    if (!success) return res.status(429).json({ error: '發文太頻繁，請稍後再試。' });
  }

  const profile = await ensureProfile(user);
  if (profile.status === 'limited' || profile.status === 'suspended') {
    return res.status(403).json({ error: '你的帳號目前受到限制，無法發文。' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const {
    title,
    content,
    topic,
    mood_tag: legacyMoodTag,
    tags: tagsPayload,
    visibility,
    polls: pollsPayload,
    cover_image_url: coverPayload,
    synopsis: synopsisPayload,
    chapter_one_title: chapterOneTitlePayload,
  } = body;

  const storyPost = isStoryTopic(topic);

  const rawTags = storyPost
    ? []
    : (Array.isArray(tagsPayload)
      ? tagsPayload
      : (legacyMoodTag ? [legacyMoodTag] : []));
  const tagValidation = validateForumTags(rawTags);
  if (!tagValidation.ok) {
    return res.status(400).json({ error: tagValidation.error });
  }

  if (!content?.trim() || content.trim().length < 10) {
    return res.status(400).json({ error: '內容最少需要 10 個字。' });
  }

  const normalizedContent = normalizeForumBodyContent(content);

  const contentMax = storyPost ? STORY_CONTENT_MAX : 2000;
  if (normalizedContent.length > contentMax) {
    return res.status(400).json({ error: `內容最多 ${contentMax} 字。` });
  }

  if (storyPost && !title?.trim()) {
    return res.status(400).json({ error: '故事需要標題。' });
  }

  let coverImageUrl = null;
  let synopsis = null;
  let chapterOneTitle = null;
  if (storyPost) {
    const coverCheck = validateStoryCoverUrl(coverPayload);
    if (!coverCheck.ok) return res.status(400).json({ error: coverCheck.error });
    coverImageUrl = coverCheck.value;
    if (synopsisPayload != null && String(synopsisPayload).trim()) {
      synopsis = String(synopsisPayload).trim().slice(0, STORY_SYNOPSIS_MAX);
    }
    if (chapterOneTitlePayload != null && String(chapterOneTitlePayload).trim()) {
      chapterOneTitle = String(chapterOneTitlePayload).trim().slice(0, STORY_CHAPTER_TITLE_MAX);
    }
  }
  if (topic && !isValidPostTopic(topic)) {
    return res.status(400).json({ error: '無效的分類。' });
  }

  const postVisibility = isMatureForumTopic(topic)
    ? 'members_only'
    : (visibility === 'members_only' ? 'members_only' : 'public');

  const pollIdsInContent = extractPollIdsFromContent(normalizedContent);
  const pollValidation = validatePollsForContent(normalizedContent, pollsPayload);
  if (!pollValidation.ok) {
    return res.status(400).json({ error: pollValidation.error });
  }
  if (pollIdsInContent.length && !pollValidation.polls.length) {
    return res.status(400).json({ error: '缺少投票選項資料。' });
  }

  // Content moderation (stories skip keyword filter — fiction often uses dramatic language)
  if (!storyPost) {
    const combined = [title, normalizedContent].filter(Boolean).join(' ');
    const { blocked, crisis } = filterContent(combined);
    if (blocked) {
      if (crisis) return res.status(451).json({ error: 'crisis', crisis: true });
      return res.status(422).json({ error: '內容包含不允許的詞語。' });
    }
  }

  if (isMatureForumTopic(topic)) {
    const combined = [title, normalizedContent].filter(Boolean).join(' ');
    const matureCheck = validateMaturePostContent(combined);
    if (!matureCheck.ok) {
      return res.status(422).json({ error: matureCheck.error });
    }
  }

  // Quota check (server-side)
  try {
    await assertAndConsumeQuota(user.id, 'forum_post_daily');
  } catch (err) {
    return res.status(429).json({
      error: err.status === 429 ? '今日發文額度已用盡。' : '配額錯誤，請稍後再試。',
      quota_type: 'forum_post_daily',
    });
  }

  const admin = getAdminClient();
  const insertRow = {
    author_id: user.id,
    title: title?.trim().slice(0, 100) || null,
    content: normalizedContent,
    topic: topic || '社群',
    mood_tag: tagValidation.tags[0] || null,
    anonymous_name_snapshot: profile.display_name,
    visibility: postVisibility,
    ...(storyPost ? {
      cover_image_url: coverImageUrl,
      synopsis,
    } : {}),
  };

  let postResult = await admin
    .from('forum_posts')
    .insert(insertRow)
    .select('id, title, topic, created_at')
    .single();

  if (postResult.error?.code === '42703' && storyPost) {
    const { cover_image_url: _c, synopsis: _s, ...fallbackRow } = insertRow;
    postResult = await admin
      .from('forum_posts')
      .insert(fallbackRow)
      .select('id, title, topic, created_at')
      .single();
  }

  const { data: post, error } = postResult;

  if (error) return res.status(500).json({ error: '發文失敗，請稍後再試。' });

  if (tagValidation.tags.length) {
    const tagResult = await insertTagsForPost(
      admin,
      post.id,
      tagValidation.tags,
      tagValidation.displayByKey,
    );
    if (!tagResult.ok) {
      await admin.from('forum_posts').delete().eq('id', post.id);
      return res.status(500).json({ error: tagResult.error || '儲存標籤失敗。' });
    }
  }

  if (pollValidation.polls.length) {
    const pollResult = await insertPollsForPost(admin, post.id, pollValidation.polls);
    if (!pollResult.ok) {
      await admin.from('forum_posts').delete().eq('id', post.id);
      return res.status(500).json({ error: pollResult.error || '建立投票失敗。' });
    }
  }

  if (storyPost) {
    await admin.from('forum_story_chapters').insert({
      story_post_id: post.id,
      chapter_number: 1,
      title: chapterOneTitle,
      content: normalizedContent,
    }).then(() => {}).catch(() => {});
  }

  dispatchForumMentions({
    content: normalizedContent,
    actorId: user.id,
    postId: post.id,
  }).catch(() => {});

  awardMoonJourneyExp(admin, {
    userId: user.id,
    actionType: 'post_created',
    sourceId: post.id,
    amount: MOON_JOURNEY_EXP.post_created,
    skipDailyCommentLimit: true,
  }).catch(() => {});

  return res.status(201).json({ post });
}
