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
    const { bottle_id, content, user_id, turnstile_token, parent_reply_id } = body;

    // Validate bottle_id first (needed for cooldown check and parent validation)
    if (!bottle_id || typeof bottle_id !== 'string' || !UUID_RE.test(bottle_id)) {
      return res.status(400).json({ error: '無效的瓶子 ID。' });
    }
    if (!user_id || typeof user_id !== 'string') {
      return res.status(400).json({ error: '缺少用戶標識。' });
    }

    const isSubReply = !!parent_reply_id;
    const authUser = await getOptionalUser(req);

    // Human verification — required for anonymous top-level comments; logged-in users skip
    if (!isSubReply && !authUser) {
      const ts = await verifyTurnstile(turnstile_token, ip);
      if (!ts.success) {
        return res.status(403).json({ error: '人機驗證失敗，請重新整理頁面後再試。' });
      }
    }

    // Validate parent_reply_id (sub-reply case)
    if (isSubReply) {
      if (typeof parent_reply_id !== 'string' || !UUID_RE.test(parent_reply_id)) {
        return res.status(400).json({ error: '無效的回覆 ID。' });
      }
      // Parent must exist in the same bottle, be visible, and be top-level (no further nesting)
      const { data: parent, error: pErr } = await supabase
        .from('replies')
        .select('id, bottle_id, parent_reply_id, is_hidden')
        .eq('id', parent_reply_id)
        .single();
      if (pErr || !parent) {
        return res.status(400).json({ error: '找不到要回覆的留言。' });
      }
      if (parent.bottle_id !== bottle_id) {
        return res.status(400).json({ error: '留言不屬於此瓶子。' });
      }
      if (parent.is_hidden) {
        return res.status(400).json({ error: '無法回覆已隱藏的留言。' });
      }
      if (parent.parent_reply_id !== null) {
        return res.status(400).json({ error: '只能回覆頂層留言，不能再深一層。' });
      }
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

    // Cooldown check (30s per user per bottle, top-level only)
    const safeUserId = String(user_id).slice(0, 64);
    if (!isSubReply) {
      const { data: lastReply } = await supabase
        .from('replies')
        .select('created_at')
        .eq('bottle_id', bottle_id)
        .eq('user_id', safeUserId)
        .is('parent_reply_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastReply) {
        const elapsed = Date.now() - new Date(lastReply.created_at).getTime();
        const wait = Math.ceil((30000 - elapsed) / 1000);
        if (wait > 0) {
          return res.status(429).json({ error: `請等待 ${wait} 秒後再留言。`, wait });
        }
      }
    }

    const { error } = await supabase.from('replies').insert({
      bottle_id,
      content:         content.trim(),
      user_id:         safeUserId,
      parent_reply_id: isSubReply ? parent_reply_id : null,
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
