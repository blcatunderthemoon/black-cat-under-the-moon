import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

const ratelimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 key lookups per minute per IP
    })
  : null;

// Only 6-char keys using the unambiguous charset
const KEY_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || '127.0.0.1';

  if (ratelimit) {
    const { success } = await ratelimit.limit(`find:${ip}`);
    if (!success) {
      return res.status(429).json({ error: '查詢太頻繁，請稍後再試。' });
    }
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Server misconfigured.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { key } = body;

    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: '請輸入神秘鑰匙。' });
    }

    const upperKey = key.toUpperCase().trim();
    if (!KEY_RE.test(upperKey)) {
      return res.status(400).json({ error: '鑰匙格式不對，應為 6 位英數字。' });
    }

    const { data, error } = await supabase
      .from('bottles')
      .select('*, replies(id, content, created_at)')
      .eq('view_key', upperKey)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: '找不到這個瓶子，可能沉入深海了……' });
    }

    // Strip sensitive fields from bottle and each reply
    const { view_key: _vk, user_id: _uid, ...safeBottle } = data;
    const safeReplies = (data.replies || []).map(({ id, content, created_at }) => ({
      id,
      content,
      created_at,
    }));

    return res.status(200).json({ ...safeBottle, replies: safeReplies });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
