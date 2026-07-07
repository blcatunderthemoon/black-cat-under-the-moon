import {
  createRateLimiter,
  getClientIp,
  rateLimitOrPass,
  rateLimitResponse,
} from '../../../lib/rate-limit.js';
import {
  getSitePresenceCount,
  isSitePresenceEnabled,
  touchSitePresence,
} from '../../../lib/site-presence.js';

const heartbeatLimiter = createRateLimiter('presence-hb', 40, '1 m');
const readLimiter = createRateLimiter('presence-read', 80, '1 m');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!isSitePresenceEnabled()) {
    return res.status(200).json({ enabled: false, count: null });
  }

  const ip = getClientIp(req);

  if (req.method === 'GET') {
    const rl = await rateLimitOrPass(readLimiter, ip);
    if (!rl.ok) return rateLimitResponse(res, rl.reason);
    const count = await getSitePresenceCount();
    return res.status(200).json({ enabled: true, count });
  }

  if (req.method === 'POST') {
    const rl = await rateLimitOrPass(heartbeatLimiter, ip);
    if (!rl.ok) return rateLimitResponse(res, rl.reason);
    const sessionId = typeof req.body?.session_id === 'string'
      ? req.body.session_id.trim()
      : '';
    if (!UUID_RE.test(sessionId)) {
      return res.status(400).json({ error: 'invalid session_id' });
    }
    const count = await touchSitePresence(sessionId);
    return res.status(200).json({ enabled: true, count });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
