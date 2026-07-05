/**
 * Session-scoped cache for /api/me — instant premium badge + header counts on navigation.
 */

const CACHE_KEY = 'bcutm_me_cache';

export function readMeCache(userId) {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || parsed.userId !== userId) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeMeCache(userId, data) {
  if (typeof window === 'undefined' || !userId || !data) return;
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ v: 1, userId, data, at: Date.now() }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearMeCache() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}
