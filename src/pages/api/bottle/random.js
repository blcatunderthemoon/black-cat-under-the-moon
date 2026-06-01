import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { checkIp } from '../../../lib/ip-guard.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // Parse exclude list (comma-separated UUIDs from client seen-session tracker)
  const excludeParam = (req.query.exclude || '').trim();
  const excludeIds = excludeParam
    ? excludeParam.split(',').map(s => s.trim()).filter(s => UUID_RE.test(s)).slice(0, 20)
    : [];

  // Optional mood-tag filter (supports multiple tags from topic banner)
  const tagFilters = [].concat(req.query.tag || []).filter(Boolean).map(t => t.slice(0, 40));
  const tagFilter = tagFilters.length > 0 ? tagFilters : null;
  const preferNew = req.query.prefer_new === '1';

  try {
    const now = new Date().toISOString();
    const recentIso = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    async function finalizeBottle(bottle) {
      // Fire-and-forget: increment exposure_count (no await, silent on failure)
      supabase
        .from('bottles')
        .update({ exposure_count: (bottle.exposure_count ?? 0) + 1 })
        .eq('id', bottle.id)
        .then(() => {}).catch(() => {});

      const { count } = await supabase
        .from('replies')
        .select('id', { count: 'exact', head: true })
        .eq('bottle_id', bottle.id);

      const { view_key: _vk, user_id: _uid, ...safeBottle } = bottle;
      return res.status(200).json({ ...safeBottle, reply_count: count ?? 0 });
    }

    async function pickRecentBottle() {
      let q = supabase
        .from('bottles')
        .select('*')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .gte('created_at', recentIso)
        .order('created_at', { ascending: false })
        .limit(24);
      if (tagFilter) q = tagFilter.length === 1 ? q.eq('mood_tag', tagFilter[0]) : q.in('mood_tag', tagFilter);
      if (excludeIds.length > 0) q = q.not('id', 'in', `(${excludeIds.join(',')})`);
      const { data: recentData, error: recentError } = await q;
      if (recentError) return null;
      if (!recentData || recentData.length === 0) return null;
      const pool = recentData.slice(0, Math.min(10, recentData.length));
      return pool[Math.floor(Math.random() * pool.length)] || null;
    }

    // If a tag filter is requested, bypass the RPC and do a direct filtered query
    if (tagFilter) {
      if (preferNew) {
        const recent = await pickRecentBottle();
        if (recent) return finalizeBottle(recent);
      }
      let q = supabase
        .from('bottles')
        .select('*')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .limit(50);
      if (tagFilter.length === 1) {
        q = q.eq('mood_tag', tagFilter[0]);
      } else {
        q = q.in('mood_tag', tagFilter);
      }
      if (excludeIds.length > 0) {
        q = q.not('id', 'in', `(${excludeIds.join(',')})`);
      }
      const { data: tagData, error: tagError } = await q;
      if (tagError) return res.status(500).json({ error: tagError.message });
      if (!tagData || tagData.length === 0) {
        return res.status(404).json({ error: '這個話題還沒有漂流瓶，快去投一個！' });
      }
      const bottle = tagData[Math.floor(Math.random() * tagData.length)];
      return finalizeBottle(bottle);
    }

    if (preferNew) {
      const recent = await pickRecentBottle();
      if (recent) return finalizeBottle(recent);
    }

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

    let bottle = data[0];

    // If the weighted pick is in the exclude list, try a direct query with NOT IN
    if (excludeIds.length > 0 && excludeIds.includes(bottle.id)) {
      const { data: altData } = await supabase
        .from('bottles')
        .select('*')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .not('id', 'in', `(${excludeIds.join(',')})`)
        .limit(30);

      if (altData && altData.length > 0) {
        // Weighted pick from candidates using same score formula approximation
        bottle = altData[Math.floor(Math.random() * altData.length)];
      }
      // If no alternatives exist, fall through and return the original weighted pick
    }
    return finalizeBottle(bottle);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
