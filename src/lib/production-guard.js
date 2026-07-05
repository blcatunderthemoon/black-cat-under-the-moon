/**
 * Production fail-closed guards for secrets and admin operations.
 */

export function isProduction() {
  return (
    process.env.NODE_ENV === 'production'
    || process.env.VERCEL_ENV === 'production'
  );
}

/** Local dev may skip optional secrets; production may not. */
export function allowDevBypass() {
  return !isProduction();
}

/**
 * Trusted site origin for PayPal redirects etc.
 * Production: NEXT_PUBLIC_SITE_URL only.
 * Dev: also localhost / 127.0.0.1 from Origin header.
 */
export function getTrustedSiteOrigin(req) {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      /* fall through */
    }
  }

  if (allowDevBypass()) {
    const origin = String(req?.headers?.origin || '').trim();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      return origin;
    }
    return 'http://localhost:3000';
  }

  throw new Error('NEXT_PUBLIC_SITE_URL is required in production');
}
