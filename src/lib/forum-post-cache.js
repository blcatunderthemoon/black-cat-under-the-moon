/**
 * Session-scoped cache for forum post detail — instant paint from feed or prior visit.
 */

const POST_CACHE_KEY = 'bcutm_forum_post_cache';
const POST_CACHE_MAX_AGE_MS = 3 * 60_000;

function listPostToBootstrap(listPost, tagLabels = {}) {
  if (!listPost?.id) return null;
  return {
    post: {
      id: listPost.id,
      title: listPost.title,
      content: listPost.content,
      topic: listPost.topic,
      mood_tag: listPost.mood_tag,
      tags: listPost.tags || [],
      like_count: listPost.like_count,
      comment_count: listPost.comment_count,
      created_at: listPost.created_at,
      visibility: listPost.visibility,
      is_mine: listPost.is_mine,
      viewer_liked: listPost.viewer_liked,
      viewer_bookmarked: listPost.viewer_bookmarked,
      is_pinned: listPost.is_pinned,
      is_highlighted: listPost.is_highlighted,
      cover_image_url: listPost.cover_image_url,
      synopsis: listPost.synopsis,
      view_count: listPost.view_count ?? 0,
      story_completed: !!listPost.story_completed,
      content_truncated: listPost.content_truncated,
      members_gated: listPost.members_gated,
      hide_username: !!listPost.hide_username,
      author: {
        display_name: listPost.anonymous_name_snapshot || '神秘貓咪',
        mirror_slug: listPost.hide_username ? null : (listPost.author_mirror_slug || null),
        mirror_type: listPost.hide_username ? null : (listPost.author_mirror_type || null),
        is_premium: listPost.hide_username ? false : !!listPost.author_is_premium,
        is_anonymous: !!listPost.hide_username,
      },
    },
    tag_labels: tagLabels,
    comments: [],
    polls: [],
    _bootstrap: true,
  };
}

export function findPostInFeedCache(postId) {
  if (typeof window === 'undefined' || !postId) return null;
  try {
    const raw = sessionStorage.getItem('bcutm_forum_feed_cache');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const entries = parsed?.entries;
    if (!entries || typeof entries !== 'object') return null;
    for (const entry of Object.values(entries)) {
      const hit = (entry?.posts || []).find((p) => p.id === postId);
      if (hit) {
        return listPostToBootstrap(hit, entry.tag_labels || {});
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function readForumPostCache(postId) {
  if (typeof window === 'undefined' || !postId) return null;
  try {
    const raw = sessionStorage.getItem(POST_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const entry = parsed?.entries?.[postId];
    if (!entry?.data?.post) return null;
    if (Date.now() - (entry.at || 0) > POST_CACHE_MAX_AGE_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function readForumPostBootstrap(postId) {
  return readForumPostCache(postId) || findPostInFeedCache(postId);
}

export function writeForumPostCache(postId, data) {
  if (typeof window === 'undefined' || !postId || !data?.post) return;
  try {
    const raw = sessionStorage.getItem(POST_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : { v: 1, entries: {} };
    if (!parsed.entries || typeof parsed.entries !== 'object') parsed.entries = {};
    parsed.entries[postId] = {
      data: { ...data, _bootstrap: false },
      at: Date.now(),
    };
    const keys = Object.keys(parsed.entries);
    if (keys.length > 24) {
      keys
        .sort((a, b) => (parsed.entries[a]?.at || 0) - (parsed.entries[b]?.at || 0))
        .slice(0, keys.length - 24)
        .forEach((k) => { delete parsed.entries[k]; });
    }
    sessionStorage.setItem(POST_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    /* quota / private mode */
  }
}
