/**
 * POST /api/moonlight-interest
 * Save Moonlight Gathering #001 interest survey responses.
 * Body: { interest, time_slots?, dates?, price_range?, email?, display_name?, message? }
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { checkIp } from '../../lib/ip-guard.js';
import { filterContent } from '../../lib/content-filter.js';
import { getOptionalUser, getAdminClient } from '../../lib/server-auth.js';

const INTEREST = new Set(['interested', 'unsure', 'skip']);
const TIME_SLOTS = new Set(['sat_afternoon', 'sat_eve', 'sun_afternoon', 'sun_eve']);
const PRICE = new Set(['250-300', '300-350', '350-400']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NAME = 40;
const MAX_EMAIL = 120;
const MAX_MESSAGE = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_DATES = new Set([
  '2026-09-12', '2026-09-13',
  '2026-09-19', '2026-09-20', '2026-09-26', '2026-09-27',
]);

const ratelimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(8, '1 h'),
    })
  : null;

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const ip = (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || '127.0.0.1';

    const guard = await checkIp(ip);
    if (guard.blocked) {
      return res.status(429).json({
        error: guard.reason === 'burst' ? '操作太頻繁，已暫時限制訪問。' : '訪問受限，請稍後再試。',
      });
    }

    if (ratelimit) {
      const { success } = await ratelimit.limit(`moonlight-interest:${ip}`);
      if (!success) {
        return res.status(429).json({ error: '傳送太頻繁，請稍後再試。' });
      }
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const interest = typeof body.interest === 'string' ? body.interest.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const priceRange = typeof body.price_range === 'string' ? body.price_range.trim() : '';
    const timeSlots = asStringArray(body.time_slots);
    const dates = asStringArray(body.dates);

    if (!INTEREST.has(interest)) {
      return res.status(400).json({ error: '請選擇是否有興趣參加。' });
    }

    if (displayName.length > MAX_NAME) {
      return res.status(400).json({ error: `稱呼不能超過 ${MAX_NAME} 字。` });
    }
    if (email.length > MAX_EMAIL) {
      return res.status(400).json({ error: '電郵過長。' });
    }
    if (email && !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: '請輸入有效電郵。' });
    }
    if (message.length > MAX_MESSAGE) {
      return res.status(400).json({ error: `留言不能超過 ${MAX_MESSAGE} 字。` });
    }

    let cleanSlots = [];
    let cleanDates = [];
    let cleanPrice = null;
    let cleanMessage = null;

    if (interest === 'interested') {
      if (!email) {
        return res.status(400).json({ error: '請留下電郵方便優先通知。' });
      }
      if (!displayName) {
        return res.status(400).json({ error: '請填寫稱呼。' });
      }
      if (message) {
        const { blocked } = filterContent(message);
        if (blocked) {
          return res.status(400).json({ error: '留言包含不當字眼，無法傳送。' });
        }
        cleanMessage = message;
      }
      cleanSlots = timeSlots.filter((s) => TIME_SLOTS.has(s));
      cleanDates = dates.filter((d) => DATE_RE.test(d) && ALLOWED_DATES.has(d));
      if (!cleanSlots.length) {
        return res.status(400).json({ error: '請至少揀一個可參加時段。' });
      }
      if (!cleanDates.length) {
        return res.status(400).json({ error: '請至少揀一個可參加日期。' });
      }
      if (!PRICE.has(priceRange)) {
        return res.status(400).json({ error: '請選擇可以接受嘅收費範圍。' });
      }
      cleanPrice = priceRange;
    }

    const authUser = await getOptionalUser(req);
    const admin = getAdminClient();

    const { error } = await admin.from('moonlight_interest').insert({
      interest,
      time_slots: cleanSlots,
      dates: cleanDates,
      price_range: cleanPrice,
      email: email || null,
      display_name: displayName || null,
      message: cleanMessage,
      user_id: authUser?.id || null,
    });

    if (error) {
      if (error.code === '42P01') {
        return res.status(503).json({ error: '調查表尚未設定完成，請稍後再試。' });
      }
      console.error('[moonlight-interest] insert failed:', error.message, error.code);
      return res.status(500).json({ error: '無法儲存回覆，請稍後再試。' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[moonlight-interest] unexpected error:', err);
    return res.status(500).json({ error: '無法儲存回覆，請稍後再試。' });
  }
}
