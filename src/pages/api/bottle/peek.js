import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { checkIp } from '../../../lib/ip-guard.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ratelimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 peeks per minute per IP
    })
  : null;

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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
    const { success } = await ratelimit.limit(`peek:${ip}`);
    if (!success) {
      return res.status(429).json({ error: '請求太頻繁，請稍後再試。' });
    }
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Server misconfigured.' });
  }

  const { id } = req.query;
  if (!id || !UUID_RE.test(id)) {
    return res.status(400).json({ error: '無效的瓶子 ID。' });
  }

  try {
    const { data, error } = await supabase
      .from('bottles')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: '找不到這個瓶子，可能沉入深海了……' });
    }

    // Fetch reply count
    const { count } = await supabase
      .from('replies')
      .select('id', { count: 'exact', head: true })
      .eq('bottle_id', id);

    // Strip sensitive fields — never expose view_key or user_id
    const { view_key: _vk, user_id: _uid, ...safeBottle } = data;

    return res.status(200).json({ ...safeBottle, reply_count: count ?? 0 });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
