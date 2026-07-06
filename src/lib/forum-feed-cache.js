/**
 * Session-scoped cache for forum feed — instant revisit; short TTL + periodic refresh.
 */

const CACHE_KEY = 'bcutm_forum_feed_cache';

/** Revalidate in background after this age (ms). */
export const FORUM_FEED_STALE_MS = 90_000;

/** Discard cache entries older than this (ms). */
export const FORUM_FEED_MAX_AGE_MS = 5 * 60_000;

export function forumFeedCacheKey(sort, topic, tag) {
  return `${sort}|${topic}|${tag || ''}`;
}

export function readForumFeedCache(sort, topic, tag) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const key = forumFeedCacheKey(sort, topic, tag);
    const entry = parsed?.entries?.[key];
    if (!entry || !Array.isArray(entry.posts)) return null;
    if (Date.now() - (entry.at || 0) > FORUM_FEED_MAX_AGE_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

export function writeForumFeedCache(sort, topic, tag, payload) {
  if (typeof window === 'undefined' || !Array.isArray(payload?.posts)) return;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : { v: 1, entries: {} };
    if (!parsed.entries || typeof parsed.entries !== 'object') parsed.entries = {};
    const key = forumFeedCacheKey(sort, topic, tag);
    parsed.entries[key] = {
      ...payload,
      at: Date.now(),
    };
    const keys = Object.keys(parsed.entries);
    if (keys.length > 16) {
      keys
        .sort((a, b) => (parsed.entries[a]?.at || 0) - (parsed.entries[b]?.at || 0))
        .slice(0, keys.length - 16)
        .forEach((k) => { delete parsed.entries[k]; });
    }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
  } catch {
    /* quota / private mode */
  }
}

export function isForumFeedCacheStale(entry) {
  if (!entry?.at) return true;
  return Date.now() - entry.at > FORUM_FEED_STALE_MS;
}

export function clearForumFeedCache() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}
