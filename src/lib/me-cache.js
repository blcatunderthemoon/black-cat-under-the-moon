/**
 * Session-scoped cache for /api/me — instant premium badge + header counts on navigation.
 */

export const ME_CACHE_KEY = 'bcutm_me_cache';
export const PROFILE_UPDATED_EVENT = 'bcutm:profile-updated';

const CACHE_KEY = ME_CACHE_KEY;

function notifyProfileUpdated(userId, data) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: { userId, data } }));
  } catch {
    /* ignore */
  }
}

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
    notifyProfileUpdated(userId, data);
  } catch {
    /* quota / private mode */
  }
}

/** Optimistic display_name sync before a full /api/me refresh completes. */
export function patchMeCacheDisplayName(userId, displayName) {
  if (typeof window === 'undefined' || !userId) return;
  const cached = readMeCache(userId);
  if (!cached?.profile) return;
  writeMeCache(userId, {
    ...cached,
    profile: { ...cached.profile, display_name: displayName },
  });
}

export function clearMeCache() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}
