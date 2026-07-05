import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { checkIp } from '../../../lib/ip-guard.js';
import { filterContent } from '../../../lib/content-filter.js';
import { verifyTurnstile } from '../../../lib/turnstile.js';
import { getOptionalUser } from '../../../lib/server-auth.js';

const ratelimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '1 h'), // 5 bottles per hour per IP
    })
  : null;

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});
const MAX_BOTTLE_CONTENT_LENGTH = 500;

// 6-char key from unambiguous chars (no 0/O/1/I confusion)
function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  // chars.length === 32 === 2^5; 256 / 32 === 8 — zero modulo bias
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

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

  // Per-IP rate limit: 2 bottles per hour
  if (ratelimit) {
    const { success } = await ratelimit.limit(`throw:${ip}`);
    if (!success) {
      return res.status(429).json({ error: '太頻繁了，讓瓶子先沉澱一下吧。' });
    }
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Server misconfigured.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    // Note: never trust client-supplied user_id — derive from auth token only
    const { content, mood_tag, mood_tags, is_mission_bottle, turnstile_token } = body;
    const missionBottle = is_mission_bottle === true;

    // Optional auth: if logged-in user throws a bottle, bind their user_id silently
    // This does NOT expose their identity in the bottle's public view
    const authUser = await getOptionalUser(req);
    const authenticatedUserId = authUser?.id || null;

    // Human verification — anonymous users only; logged-in users skip Turnstile
    if (!authenticatedUserId) {
      const ts = await verifyTurnstile(turnstile_token, ip);
      if (!ts.success) {
        return res.status(403).json({ error: '人機驗證失敗，請重新整理頁面後再試。' });
      }
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: '瓶子裡沒有內容哦。' });
    }
    if (content.trim().length > MAX_BOTTLE_CONTENT_LENGTH) {
      return res.status(400).json({ error: '內容不能超過 500 字。' });
    }

    // Content moderation (crisis → HTTP 451, blocked → HTTP 400)
    const { blocked, crisis } = filterContent(content.trim());
    if (crisis)   return res.status(451).json({ error: 'crisis' });
    if (blocked)  return res.status(400).json({ error: '內容包含不當字眼，無法發送。' });

    let normalizedTags = [];
    if (Array.isArray(mood_tags)) {
      normalizedTags = Array.from(new Set(
        mood_tags
          .map(t => String(t || '').trim())
          .filter(Boolean)
      )).slice(0, 3);
    } else if (mood_tag) {
      normalizedTags = [String(mood_tag).trim()];
    }
    if (normalizedTags.some(t => t.length > 50)) {
      return res.status(400).json({ error: '心情標籤不能超過 50 字。' });
    }

    // Generate unique view_key with up to 5 retries
    let view_key = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateKey();
      const { data: existing } = await supabase
        .from('bottles')
        .select('id')
        .eq('view_key', candidate)
        .maybeSingle();
      if (!existing) {
        view_key = candidate;
        break;
      }
    }
    if (!view_key) {
      return res.status(500).json({ error: '生成鑰匙失敗，請重試。' });
    }

    const { error } = await supabase.from('bottles').insert({
      view_key,
      content:           content.trim(),
      mood_tag:          normalizedTags[0] || null,
      tags:              normalizedTags,
      user_id:           authenticatedUserId,   // null for anonymous; verified from auth token
      is_mission_bottle: missionBottle,
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ view_key });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
