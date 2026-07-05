/**
 * Site-wide SEO config.
 * Set NEXT_PUBLIC_SITE_URL in production (Search Console property URL).
 */

export const SITE_NAME = 'Black Cat Under The Moon';

export const DEFAULT_TITLE = 'Black Cat Under The Moon — 靈魂共鳴 · 靈魂鏡像 · 月光圍爐';

export const DEFAULT_DESCRIPTION =
  'Black Cat Under The Moon 是月下靈魂社群：Echo Mode 月下緣份、Mirror Mode 性格鏡像、月光漂流瓶與黑貓樹洞。探索你的貓家族人格，遇見共鳴的靈魂。';

/** Static paths included in sitemap (public, indexable). */
export const STATIC_SITEMAP_PATHS = [
  { path: '/index.html', changefreq: 'weekly', priority: '1.0' },
  { path: '/echo.html', changefreq: 'monthly', priority: '0.9' },
  { path: '/mirror.html', changefreq: 'monthly', priority: '0.9' },
  { path: '/cat-families', changefreq: 'monthly', priority: '0.8' },
  { path: '/drift-bottle.html', changefreq: 'monthly', priority: '0.8' },
  { path: '/forum', changefreq: 'daily', priority: '0.9' },
  { path: '/moon-journey', changefreq: 'monthly', priority: '0.7' },
  { path: '/premium', changefreq: 'monthly', priority: '0.7' },
  { path: '/contact.html', changefreq: 'yearly', priority: '0.4' },
  { path: '/about.html', changefreq: 'yearly', priority: '0.5' },
  { path: '/privacy.html', changefreq: 'yearly', priority: '0.3' },
  { path: '/refund.html', changefreq: 'yearly', priority: '0.3' },
  { path: '/tos.html', changefreq: 'yearly', priority: '0.3' },
];

const NOINDEX_EXACT = new Set([
  '/login',
  '/signup',
  '/account',
  '/inbox',
  '/matches',
  '/exchange-photo',
  '/billing/success',
  '/auth/confirm',
  '/auth/reset-password',
  '/forgot-password',
  '/dashboard',
  '/mirror-card/me',
]);

export function isNoIndexPath(pathname) {
  if (!pathname) return false;
  const p = pathname.split('?')[0].replace(/\/$/, '') || '/';
  if (NOINDEX_EXACT.has(p)) return true;
  if (p.startsWith('/inbox/')) return true;
  if (p.startsWith('/dashboard')) return true;
  return false;
}

export const DEFAULT_SITE_URL = 'https://www.blackcatunderthemoon.com';

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
}

export function getSiteHost() {
  try {
    return new URL(getSiteUrl()).host;
  } catch {
    return 'www.blackcatunderthemoon.com';
  }
}

export function getSiteHostFromUrl(siteUrl) {
  try {
    return new URL(siteUrl).host;
  } catch {
    return getSiteHost();
  }
}

function isLocalDevHost(host) {
  if (!host) return false;
  const h = String(host).toLowerCase();
  return (
    h === 'localhost'
    || h.startsWith('localhost:')
    || h === '127.0.0.1'
    || h.startsWith('127.0.0.1:')
    || h === '[::1]'
    || h.startsWith('[::1]:')
    || h.endsWith('.local')
  );
}

/** Prefer the live request host; fall back to canonical URL on localhost/dev. */
export function getSiteUrlFromRequest(req) {
  if (req?.headers) {
    const forwardedHost = req.headers['x-forwarded-host'];
    const forwardedProto = req.headers['x-forwarded-proto'] || 'https';
    if (forwardedHost) {
      const host = String(forwardedHost).split(',')[0].trim();
      if (host && !isLocalDevHost(host)) {
        return `${forwardedProto}://${host}`.replace(/\/$/, '');
      }
    }
    const origin = req.headers.origin;
    if (origin && /^https?:\/\//i.test(origin)) {
      try {
        const host = new URL(origin).host;
        if (!isLocalDevHost(host)) {
          return String(origin).replace(/\/$/, '');
        }
      } catch {
        /* fall through */
      }
    }
  }
  return getSiteUrl();
}

export function absoluteUrl(path) {
  const base = getSiteUrl();
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}${clean}`;
}

export function getCanonicalUrl(path, siteUrl) {
  const base = (siteUrl || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  if (!base) return null;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}${clean}`;
}

export function formatSitemapDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}
