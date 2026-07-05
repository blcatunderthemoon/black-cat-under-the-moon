/**
 * Read Supabase auth session from browser localStorage (sb-*-auth-token).
 * Shared by AuthProvider so static pages and Next.js routes use the same token.
 */

export function readStoredAuthSession() {
  if (typeof window === 'undefined') return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = JSON.parse(localStorage.getItem(key) || 'null');
        if (raw?.access_token) return raw;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function sessionFromStored(stored) {
  if (!stored?.access_token) return null;
  const expMs = stored.expires_at ? stored.expires_at * 1000 : 0;
  if (expMs && Date.now() > expMs) return null;
  return {
    access_token: stored.access_token,
    refresh_token: stored.refresh_token || '',
    expires_at: stored.expires_at,
    token_type: stored.token_type || 'bearer',
    user: stored.user,
  };
}

export async function resolveBrowserSession(client) {
  const { data: { session } } = await client.auth.getSession();
  if (session) return session;

  const stored = readStoredAuthSession();
  if (!stored?.access_token) return null;

  if (stored.refresh_token) {
    try {
      const { data, error } = await client.auth.setSession({
        access_token: stored.access_token,
        refresh_token: stored.refresh_token,
      });
      if (!error && data.session) return data.session;
    } catch {
      /* fall through to direct session object */
    }
  }

  return sessionFromStored(stored);
}
