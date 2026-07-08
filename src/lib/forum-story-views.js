/**
 * Story page view tracking — one count per browser session per story.
 */

const VIEWED_PREFIX = 'bcutm:story-viewed:';

export function formatStoryViewCount(count) {
  const n = Number(count) || 0;
  if (n >= 10000) {
    const wan = n / 10000;
    return Number.isInteger(wan) ? `${wan} 萬` : `${wan.toFixed(1)} 萬`;
  }
  return n.toLocaleString('zh-Hant');
}

/**
 * Record a story page view (session-deduped). Returns updated view_count or null.
 * @param {string} postId
 * @param {string} [accessToken]
 */
export async function recordStoryView(postId, accessToken) {
  if (typeof window === 'undefined' || !postId) return null;
  const key = `${VIEWED_PREFIX}${postId}`;
  try {
    if (sessionStorage.getItem(key)) return null;
    sessionStorage.setItem(key, '1');
  } catch {
    /* private mode — still try to record */
  }

  try {
    const headers = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const res = await fetch(
      `/api/forum/posts/${encodeURIComponent(postId)}?action=view`,
      { method: 'POST', headers },
    );
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data.view_count ?? null;
  } catch {
    return null;
  }
}
