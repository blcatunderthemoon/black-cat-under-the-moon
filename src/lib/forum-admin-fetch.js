/**
 * Website forum admin API fetch (Bearer token for /api/dashboard/* with admin role).
 */

export function forumAdminFetch(accessToken, url, options = {}) {
  if (!accessToken) {
    return Promise.reject(new Error('未登入'));
  }
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
