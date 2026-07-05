/**
 * Public Turnstile site key for static pages (e.g. drift-bottle.html).
 * Pair with CF_TURNSTILE_SECRET on the server.
 */
const DEFAULT_SITE_KEY = '0x4AAAAAADYg006rqWz6ukif';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const hasSecret = !!process.env.CF_TURNSTILE_SECRET;
  res.setHeader('Cache-Control', 'public, max-age=60');
  return res.status(200).json({
    siteKey: process.env.NEXT_PUBLIC_CF_TURNSTILE_SITE_KEY || DEFAULT_SITE_KEY,
    verification: hasSecret ? 'required' : 'optional',
    // flexible = challenge only when Cloudflare suspects automation (fewer false blocks than invisible)
    widgetSize: 'flexible',
  });
}
