/**
 * Public Turnstile site key for static pages (e.g. drift-bottle.html).
 * Pair with CF_TURNSTILE_SECRET on the server.
 */
const DEFAULT_SITE_KEY = '0x4AAAAAADYg006rqWz6ukif';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({
    siteKey: process.env.NEXT_PUBLIC_CF_TURNSTILE_SITE_KEY || DEFAULT_SITE_KEY,
  });
}
