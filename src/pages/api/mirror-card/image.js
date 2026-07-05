/**
 * POST /api/mirror-card/image
 *
 * Stub endpoint — server-side image generation is not yet implemented.
 * Card images are generated client-side via html2canvas in the browser.
 *
 * Returns HTTP 501 with a clear message so callers can gracefully fall back
 * to the client-side download flow.
 *
 * If we ever implement server-side image storage (e.g. to Supabase Storage),
 * this endpoint will accept a card snapshot payload and return a hosted URL.
 */

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  return res.status(501).json({
    error: 'server_image_not_implemented',
    message: 'Server-side card image generation is not yet available. Use the client-side download button instead.',
    fallback: 'client_download',
  });
}
