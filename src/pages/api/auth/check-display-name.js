/**
 * POST /api/auth/check-display-name
 * Returns whether a display name is available.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { validateDisplayName } from '../../../lib/display-name-policy.js';
import { isDisplayNameTaken } from '../../../lib/display-name-uniqueness.js';
import { getAdminClient, getOptionalUser } from '../../../lib/server-auth.js';

const ratelimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, '1 m'),
    })
  : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || '127.0.0.1';
  if (ratelimit) {
    const { success } = await ratelimit.limit(`check-display-name:${ip}`);
    if (!success) {
      return res.status(429).json({ error: '查詢太頻繁，請稍後再試。' });
    }
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const viewer = await getOptionalUser(req);
    const nameCheck = validateDisplayName(body.display_name, {
      previousName: body.previous_name,
    });
    if (!nameCheck.ok) {
      return res.status(400).json({ error: nameCheck.error, available: false });
    }

    if (
      body.previous_name &&
      validateDisplayName(body.previous_name).ok &&
      nameCheck.value === String(body.previous_name).trim()
    ) {
      return res.status(200).json({ available: true });
    }

    const admin = getAdminClient();
    const taken = await isDisplayNameTaken(admin, nameCheck.value, {
      excludeUserId: viewer?.id,
    });

    return res.status(200).json({ available: !taken });
  } catch (err) {
    console.error('[check-display-name]', err);
    return res.status(500).json({ error: '無法驗證暱稱，請稍後再試。' });
  }
}
