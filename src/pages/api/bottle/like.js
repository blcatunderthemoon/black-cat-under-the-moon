import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { checkIp } from '../../../lib/ip-guard.js';

const ratelimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(30, '1 h'), // 30 likes per hour per IP
    })
  : null;

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || '127.0.0.1';

  const guard = await checkIp(ip);
  if (guard.blocked) {
    return res.status(429).json({
      error: guard.reason === 'burst' ? '操作太頻繁，已暫時限制訪問。' : '訪問受限，請稍後再試。',
    });
  }

  if (ratelimit) {
    const { success } = await ratelimit.limit(`like:${ip}`);
    if (!success) {
      return res.status(429).json({ error: '點讚太頻繁，請稍後再試。' });
    }
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Server misconfigured.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { bottle_id, reply_id } = body;

    if (reply_id) {
      if (typeof reply_id !== 'string' || !UUID_RE.test(reply_id)) {
        return res.status(400).json({ error: '無效的回聲 ID。' });
      }
      const { error } = await supabase.rpc('increment_reply_like', { p_reply_id: reply_id });
      if (error) return res.status(500).json({ error: error.message });
    } else {
      if (!bottle_id || typeof bottle_id !== 'string' || !UUID_RE.test(bottle_id)) {
        return res.status(400).json({ error: '無效的瓶子 ID。' });
      }
      const { error } = await supabase.rpc('increment_bottle_like', { p_bottle_id: bottle_id });
      if (error) return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
