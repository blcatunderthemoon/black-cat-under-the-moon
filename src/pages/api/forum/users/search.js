/**
 * POST /api/forum/users/search — @mention autocomplete
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { requireUser, sendAuthError, getAdminClient } from '../../../../lib/server-auth.js';

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
    const { success } = await ratelimit.limit(`forum-mention-search:${ip}`);
    if (!success) return res.status(429).json({ error: '查詢太頻繁，請稍後再試。' });
  }

  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const q = String(body.q || '').trim();
  if (q.length < 1) {
    return res.status(200).json({ users: [] });
  }
  if (q.length > 24) {
    return res.status(400).json({ error: '搜尋字串過長。' });
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('id, display_name')
    .ilike('display_name', `%${q.replace(/[%_]/g, '')}%`)
    .neq('id', user.id)
    .neq('status', 'suspended')
    .neq('status', 'deleted')
    .order('display_name', { ascending: true })
    .limit(8);

  if (error) {
    console.error('[forum/users/search]', error.message);
    return res.status(500).json({ error: '搜尋失敗，請稍後再試。' });
  }

  return res.status(200).json({
    users: (data || []).map((row) => ({
      id: row.id,
      display_name: row.display_name || '貓咪',
    })),
  });
}
