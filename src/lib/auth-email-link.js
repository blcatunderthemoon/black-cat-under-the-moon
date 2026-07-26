/**
 * Resolve Supabase auth email links on our own domain (Free-plan friendly).
 * Supports:
 * - token_hash + type → verifyOtp (branded email templates)
 * - code → exchangeCodeForSession (legacy ConfirmationURL / PKCE)
 */

const ALLOWED_OTP_TYPES = new Set([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

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
 * After verify, prefer ?redirect=; else parse ?redirect_to= (full RedirectTo from email).
 */
export function resolveAuthRedirectPath(query = {}, { fallback = '' } = {}) {
  if (typeof query.redirect === 'string' && query.redirect.startsWith('/')) {
    return query.redirect;
  }
  const redirectTo = typeof query.redirect_to === 'string' ? query.redirect_to : '';
  if (!redirectTo) return fallback;
  try {
    const u = new URL(redirectTo, typeof window !== 'undefined' ? window.location.origin : 'https://www.blackcatunderthemoon.com');
    const nested = u.searchParams.get('redirect');
    if (nested && nested.startsWith('/')) return nested;
  } catch {
    /* ignore */
  }
  return fallback;
}

/**
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
 */
export async function establishSessionFromAuthLink(client, query = {}) {
  const { tokenHash, type, code, urlError, urlDesc } = pickAuthLinkParams(query);

  if (urlError) {
    return { ok: false, message: String(urlDesc || urlError) };
  }

  if (tokenHash && type) {
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      return { ok: false, message: error.message || '連結無效或已過期。' };
    }
    return { ok: true };
  }

  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) {
      return { ok: false, message: error.message || '連結無效或已過期。' };
    }
    return { ok: true };
  }

  // Hash fragments / delayed client restore (legacy)
  await new Promise((r) => setTimeout(r, 600));
  const { data: { session } } = await client.auth.getSession();
  if (session) return { ok: true };
  return { ok: false, message: '連結無效或已過期。' };
}
