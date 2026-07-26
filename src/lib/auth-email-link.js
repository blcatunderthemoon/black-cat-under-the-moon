/**
 * Resolve Supabase auth email links on our own domain (Free-plan friendly).
 * Supports:
 * - token_hash + type → verifyOtp (branded email templates)
 * - code → exchangeCodeForSession (legacy ConfirmationURL / PKCE)
 *
 * Security: secrets stay in memory only; scrub from address bar ASAP so analytics,
 * Referer headers, and history do not retain third-party auth tokens.
 */

const ALLOWED_OTP_TYPES = new Set([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

/** Query / hash keys that must never leave the auth handshake. */
export const AUTH_SECRET_QUERY_KEYS = [
  'token_hash',
  'token',
  'code',
  'access_token',
  'refresh_token',
  'provider_token',
  'provider_refresh_token',
  'confirmation_url',
];

const AUTH_SECRET_KEY_SET = new Set(AUTH_SECRET_QUERY_KEYS);

function isSafeInternalPath(path) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
}

export function pickAuthLinkParams(query = {}) {
  const tokenHash = typeof query.token_hash === 'string' ? query.token_hash.trim() : '';
  const rawType = typeof query.type === 'string' ? query.type.trim() : '';
  const type = ALLOWED_OTP_TYPES.has(rawType) ? rawType : '';
  const code = typeof query.code === 'string' ? query.code.trim() : '';
  const urlError = typeof query.error === 'string' ? query.error : '';
  const urlDesc = typeof query.error_description === 'string' ? query.error_description : '';
  return { tokenHash, type, code, urlError, urlDesc };
}

/**
 * Strip auth secrets from a URL string (for analytics / logging).
 * @param {string} href
 * @returns {string}
 */
export function scrubAuthSecretsFromHref(href) {
  if (!href || typeof href !== 'string') return href || '';
  try {
    const u = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'https://www.blackcatunderthemoon.com');
    for (const key of AUTH_SECRET_QUERY_KEYS) {
      u.searchParams.delete(key);
    }
    // Drop sensitive hash fragments (implicit flow leftovers)
    if (u.hash && /access_token|refresh_token|token_hash|provider_token/i.test(u.hash)) {
      u.hash = '';
    }
    return u.pathname + u.search + u.hash;
  } catch {
    return String(href).split('#')[0].replace(/([?&])(token_hash|token|code|access_token|refresh_token)=[^&]*/gi, '$1');
  }
}

/**
 * Remove secrets from the address bar without navigation (keeps safe params like redirect).
 * Call as soon as params are copied into local variables.
 */
export function scrubAuthSecretsFromLocation() {
  if (typeof window === 'undefined') return;
  try {
    const u = new URL(window.location.href);
    let changed = false;
    for (const key of AUTH_SECRET_QUERY_KEYS) {
      if (u.searchParams.has(key)) {
        u.searchParams.delete(key);
        changed = true;
      }
    }
    if (u.hash && /access_token|refresh_token|token_hash|provider_token/i.test(u.hash)) {
      u.hash = '';
      changed = true;
    }
    if (!changed) return;
    const next = u.pathname + u.search + u.hash;
    window.history.replaceState(window.history.state, '', next);
  } catch {
    /* ignore */
  }
}

/**
 * After verify, prefer ?redirect=; else parse ?redirect_to= (full RedirectTo from email).
 * Only same-origin relative paths are accepted (blocks open redirects).
 */
export function resolveAuthRedirectPath(query = {}, { fallback = '' } = {}) {
  if (isSafeInternalPath(query.redirect)) {
    return query.redirect;
  }
  const redirectTo = typeof query.redirect_to === 'string' ? query.redirect_to : '';
  if (!redirectTo) return fallback;
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.blackcatunderthemoon.com';
    const u = new URL(redirectTo, origin);
    if (u.origin !== origin) return fallback;
    const nested = u.searchParams.get('redirect');
    if (isSafeInternalPath(nested)) return nested;
    if (isSafeInternalPath(u.pathname + u.search)) return u.pathname + u.search;
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Never surface raw tokens / long hashes in UI error text. */
export function sanitizeAuthErrorMessage(message, fallback = '連結無效或已過期。') {
  const raw = String(message || '').trim();
  if (!raw) return fallback;
  if (/token_hash|access_token|refresh_token|supabase\.co\/auth/i.test(raw)) return fallback;
  if (/[a-f0-9]{32,}/i.test(raw)) return fallback;
  if (raw.length > 180) return fallback;
  return raw;
}

/**
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
 */
export async function establishSessionFromAuthLink(client, query = {}) {
  const { tokenHash, type, code, urlError, urlDesc } = pickAuthLinkParams(query);

  // Copy secrets into locals, then scrub the bar before any await / third-party work.
  scrubAuthSecretsFromLocation();

  if (urlError) {
    return { ok: false, message: sanitizeAuthErrorMessage(urlDesc || urlError) };
  }

  if (tokenHash && type) {
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      return { ok: false, message: sanitizeAuthErrorMessage(error.message, '連結無效或已過期。') };
    }
    return { ok: true };
  }

  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) {
      return { ok: false, message: sanitizeAuthErrorMessage(error.message, '連結無效或已過期。') };
    }
    return { ok: true };
  }

  // Hash fragments / delayed client restore (legacy)
  await new Promise((r) => setTimeout(r, 600));
  scrubAuthSecretsFromLocation();
  const { data: { session } } = await client.auth.getSession();
  if (session) return { ok: true };
  return { ok: false, message: '連結無效或已過期。' };
}

export function hasAuthSecretInQuery(query = {}) {
  return AUTH_SECRET_QUERY_KEYS.some((key) => typeof query[key] === 'string' && query[key]);
}

export { AUTH_SECRET_KEY_SET };
