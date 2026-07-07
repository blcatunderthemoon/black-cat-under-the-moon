/**
 * Client fetch for forum moderation APIs (Bearer token).
 */

export async function forumModFetch(path, { method = 'GET', body, accessToken } = {}) {
  if (!accessToken) {
    return { ok: false, status: 401, data: { error: '需要登入。' } };
  }

  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function loadForumModQueue(accessToken) {
  return forumModFetch('/api/forum/moderation/queue', { accessToken });
}
