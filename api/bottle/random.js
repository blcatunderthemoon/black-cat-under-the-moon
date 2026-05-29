import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { checkIp } from '../../src/lib/ip-guard.js';

const ratelimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 random fetches per minute per IP
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
    const { success } = await ratelimit.limit(`random:${ip}`);
    if (!success) {
      return res.status(429).json({ error: '擈瓶太頻繁，恋一下前個吧。' });
    }
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Server misconfigured.' });
  }

  try {
    // Try Phase 7 weighted RPC; fall back to base get_random_bottle() if not yet migrated
    let data, error;
    const weighted = await supabase.rpc('get_weighted_bottle');
    if (weighted.error) {
      const simple = await supabase.rpc('get_random_bottle');
      data = simple.data;
      error = simple.error;
    } else {
      data = weighted.data;
      error = weighted.error;
    }

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (!data || data.length === 0) {
      return res.status(404).json({ error: '大海上還沒有瓶子，快去投一個！' });
    }

    const bottle = data[0];

    // Fire-and-forget: increment exposure_count (no await, silent on failure)
    supabase
      .from('bottles')
      .update({ exposure_count: (bottle.exposure_count ?? 0) + 1 })
      .eq('id', bottle.id)
      .then(() => {}).catch(() => {});

    // Fetch reply count without loading all reply rows
    const { count } = await supabase
      .from('replies')
      .select('id', { count: 'exact', head: true })
      .eq('bottle_id', bottle.id);

    // Strip view_key and user_id — never expose to the public
    // bottle_type, expires_at, is_mission_bottle are retained in the spread
    const { view_key: _vk, user_id: _uid, ...safeBottle } = bottle;

    return res.status(200).json({ ...safeBottle, reply_count: count ?? 0 });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
