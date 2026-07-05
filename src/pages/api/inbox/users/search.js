/**
 * POST /api/inbox/users/search — Premium: search users by display_name
 * Body: { q: string }
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { requireUser, sendAuthError } from '../../../../lib/server-auth.js';
import { searchInboxUsers } from '../../../../lib/inbox-user-search.js';
import { MOONLIGHT_PASSPORT_BRAND } from '../../../../lib/premium.js';

const ratelimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(30, '1 m'),
    })
  : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || '127.0.0.1';
  if (ratelimit) {
    const { success } = await ratelimit.limit(`inbox-user-search:${ip}`);
    if (!success) return res.status(429).json({ error: '查詢太頻繁，請稍後再試。' });
  }

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const q = String(body.q || '').trim();

  const result = await searchInboxUsers(user.id, q);
  if (!result.ok) {
    if (result.error === 'premium_required') {
      return res.status(403).json({ error: `需要 ${MOONLIGHT_PASSPORT_BRAND} 才能搜尋用戶。`, code: 'premium_required' });
    }
    return res.status(result.status || 500).json({ error: '搜尋失敗，請稍後再試。' });
  }

  return res.status(200).json({ users: result.users });
}
