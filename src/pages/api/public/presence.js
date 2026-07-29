/**
 * GET/POST /api/public/presence — DISABLED.
 * Real-time visitor counting was removed to stop Upstash Redis burn.
 */

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(200).json({ enabled: false, count: null });
}
