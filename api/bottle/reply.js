import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { checkIp } from '../../src/lib/ip-guard.js';
import { filterContent } from '../../src/lib/content-filter.js';
import { verifyTurnstile } from '../../src/lib/turnstile.js';

const ratelimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(60, '1 h'), // 60 replies per hour per IP
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

  // Burst detection + 24h IP block
  const guard = await checkIp(ip);
  if (guard.blocked) {
    return res.status(429).json({
      error: guard.reason === 'burst' ? '操作太頻繁，已暫時限制訪問。' : '訪問受限，請稍後再試。',
    });
  }

  // Per-IP rate limit: 10 replies per hour
  if (ratelimit) {
    const { success } = await ratelimit.limit(`reply:${ip}`);
    if (!success) {
      return res.status(429).json({ error: '留言太頻繁，稍後再試。' });
    }
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Server misconfigured.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { bottle_id, content, user_id, turnstile_token } = body;

    // Human verification
    const ts = await verifyTurnstile(turnstile_token, ip);
    if (!ts.success) {
      return res.status(403).json({ error: '人機驗證失敗，請重新整理頁面後再試。' });
    }

    if (!bottle_id || typeof bottle_id !== 'string' || !UUID_RE.test(bottle_id)) {
      return res.status(400).json({ error: '無效的瓶子 ID。' });
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: '留言不能為空。' });
    }
    if (content.trim().length > 100) {
      return res.status(400).json({ error: '留言不能超過 100 字。' });
    }

    // Content moderation
    const { blocked, crisis } = filterContent(content.trim());
    if (crisis)  return res.status(451).json({ error: 'crisis' });
    if (blocked) return res.status(400).json({ error: '內容包含不當字眼，無法發送。' });

    if (!user_id || typeof user_id !== 'string') {
      return res.status(400).json({ error: '缺少用戶標識。' });
    }

    const { error } = await supabase.from('replies').insert({
      bottle_id,
      content: content.trim(),
      user_id:  String(user_id).slice(0, 64),
    });

    if (error) {
      // Unique constraint violation — already replied to this bottle
      if (error.code === '23505') {
        return res.status(409).json({ error: '你已經留過言了。' });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
