/**
 * GET /api/public/activity — landing Live Activity Feed (posts / members / gatherings)
 */

import {
  createRateLimiter,
  getClientIp,
  rateLimitOrPass,
  rateLimitResponse,
} from '../../../lib/rate-limit.js';
import { getAdminClient } from '../../../lib/server-auth.js';
import { loadPublicActivityFeed } from '../../../lib/site-activity.js';

const readLimiter = createRateLimiter('activity-read', 60, '1 m');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  const rl = await rateLimitOrPass(readLimiter, ip);
  if (!rl.ok) return rateLimitResponse(res, rl.reason);

  try {
    const admin = getAdminClient();
    const items = await loadPublicActivityFeed(admin);
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({
      items,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[public/activity] failed:', err.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: '無法載入最新動態', items: [] });
  }
}
