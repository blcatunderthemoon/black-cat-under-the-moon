/**
 * POST /api/auth/check-email
 * Returns whether an email is available for signup.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { validateEmail } from '../../../lib/auth-credentials-policy.js';
import { isEmailRegistered } from '../../../lib/auth-email-lookup.js';

const ratelimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(12, '1 m'),
    })
  : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || '127.0.0.1';
  if (ratelimit) {
    const { success } = await ratelimit.limit(`signup-check-email:${ip}`);
    if (!success) {
      return res.status(429).json({ error: '查詢太頻繁，請稍後再試。' });
    }
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const emailCheck = validateEmail(body.email);
    if (!emailCheck.ok) {
      return res.status(400).json({ error: emailCheck.error });
    }

    const registered = await isEmailRegistered(emailCheck.value);
    return res.status(200).json({ available: !registered });
  } catch (err) {
    console.error('[check-email]', err);
    return res.status(500).json({ error: '無法驗證 Email，請稍後再試。' });
  }
}
