/** Default landing page after login when no return URL is provided. */
export const DEFAULT_POST_AUTH_PATH = '/index.html';

/** Resolve a safe post-login destination from the ?redirect= query param. */
export function resolvePostAuthDestination(redirect) {
  const raw = typeof redirect === 'string' ? redirect.trim() : '';
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return DEFAULT_POST_AUTH_PATH;
}

export function isStaticHtmlPath(path) {
  return /\.html(?:[?#]|$)/.test(path);
}

/** Navigate after successful auth; static .html pages use full navigation (scrolls to top). */
export function navigateAfterAuth(router, dest) {
  if (typeof window === 'undefined') return;
  if (isStaticHtmlPath(dest)) {
    window.location.replace(dest);
    return;
  }
  router.replace(dest).then(() => {
    window.scrollTo(0, 0);
  }).catch(() => {});
}
