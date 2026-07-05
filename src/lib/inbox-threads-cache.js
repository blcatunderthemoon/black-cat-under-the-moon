/**
 * Session-scoped cache for /api/inbox/threads — instant inbox list on revisit.
 */

const CACHE_KEY = 'bcutm_inbox_threads_cache';

export function readInboxThreadsCache(userId) {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.threads) || parsed.userId !== userId) return null;
    return parsed.threads;
  } catch {
    return null;
  }
}

export function writeInboxThreadsCache(userId, threads) {
  if (typeof window === 'undefined' || !userId || !Array.isArray(threads)) return;
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ v: 1, userId, threads, at: Date.now() }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearInboxThreadsCache() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}
