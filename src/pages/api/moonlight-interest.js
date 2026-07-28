/**
 * POST /api/moonlight-interest
 * Save Moonlight Gathering #001 participation form responses.
 * Body: {
 *   interest?, time_slots?, dates?, price_range?,
 *   email, telegram_username, display_name, answers?, message?
 * }
 *
 * Participation form always stores interest=interested with fixed session
 * 2026-09-19 / sat_afternoon. answers jsonb holds profile Q&A.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { checkIp } from '../../lib/ip-guard.js';
import { filterContent } from '../../lib/content-filter.js';
import { getOptionalUser, getAdminClient } from '../../lib/server-auth.js';
import { PROFILE_QUESTIONS } from '../../lib/moonlight-interest-meta.js';

const INTEREST = new Set(['interested', 'unsure', 'skip']);
const TIME_SLOTS = new Set(['sat_afternoon', 'sat_eve', 'sun_afternoon', 'sun_eve']);
const PRICE = new Set(['250-300', '300-350', '350-400']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NAME = 40;
const MAX_EMAIL = 120;
const MAX_MESSAGE = 500;
const MAX_ANSWER = 200;
const MAX_TELEGRAM = 32;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEGRAM_RE = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/;

const EVENT_DATE = '2026-09-19';
const EVENT_TIME_SLOT = 'sat_afternoon';

const ALLOWED_DATES = new Set([
  EVENT_DATE,
  '2026-09-12', '2026-09-13', '2026-09-20', '2026-09-26', '2026-09-27',
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

function normalizeTelegramUsername(raw) {
  if (typeof raw !== 'string') return '';
  let v = raw.trim();
  if (v.startsWith('@')) v = v.slice(1);
  return v;
}

function parseAnswers(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const q of PROFILE_QUESTIONS) {
    const v = typeof raw[q.key] === 'string' ? raw[q.key].trim() : '';
    if (!v) return { error: `請回答：${q.label}` };
    if (v.length > MAX_ANSWER) {
      return { error: `「${q.label}」不能超過 ${MAX_ANSWER} 字。` };
    }
    const { blocked } = filterContent(v);
    if (blocked) {
      return { error: `「${q.label}」包含不當字眼，無法傳送。` };
    }
    out[q.key] = v;
  }
  return { answers: out };
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
    let interest = typeof body.interest === 'string' ? body.interest.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : '';
    const telegramUsername = normalizeTelegramUsername(body.telegram_username);
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const priceRange = typeof body.price_range === 'string' ? body.price_range.trim() : '';
    const timeSlots = asStringArray(body.time_slots);
    const dates = asStringArray(body.dates);

    if (!interest) interest = 'interested';
    if (!INTEREST.has(interest)) {
      return res.status(400).json({ error: '無法識別參加意向。' });
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
    let cleanAnswers = null;
    let cleanTelegram = null;

    if (interest === 'interested') {
      if (!email) {
        return res.status(400).json({ error: '請留下電郵方便聯絡。' });
      }
      if (!telegramUsername) {
        return res.status(400).json({ error: '請填寫 Telegram username。' });
      }
      if (telegramUsername.length > MAX_TELEGRAM || !TELEGRAM_RE.test(telegramUsername)) {
        return res.status(400).json({
          error: 'Telegram username 格式唔啱（5–32 個英文字母／數字／底線，唔可以數字開頭）。',
        });
      }
      cleanTelegram = telegramUsername;
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
      const parsed = parseAnswers(body.answers);
      if (parsed?.error) {
        return res.status(400).json({ error: parsed.error });
      }
      cleanAnswers = parsed?.answers || null;

      cleanSlots = timeSlots.filter((s) => TIME_SLOTS.has(s));
      cleanDates = dates.filter((d) => DATE_RE.test(d) && ALLOWED_DATES.has(d));
      if (!cleanSlots.length) cleanSlots = [EVENT_TIME_SLOT];
      if (!cleanDates.length) cleanDates = [EVENT_DATE];
      if (priceRange) {
        if (!PRICE.has(priceRange)) {
          return res.status(400).json({ error: '收費範圍無效。' });
        }
        cleanPrice = priceRange;
      }
    }

    const authUser = await getOptionalUser(req);
    const admin = getAdminClient();

    const row = {
      interest,
      time_slots: cleanSlots,
      dates: cleanDates,
      price_range: cleanPrice,
      email: email || null,
      display_name: displayName || null,
      message: cleanMessage,
      user_id: authUser?.id || null,
    };
    if (cleanTelegram) row.telegram_username = cleanTelegram;
    if (cleanAnswers) row.answers = cleanAnswers;

    const { error } = await admin.from('moonlight_interest').insert(row);

    if (error) {
      if (error.code === '42P01') {
        return res.status(503).json({ error: '參加表尚未設定完成，請稍後再試。' });
      }
      if (error.code === 'PGRST204' || /answers|telegram_username/i.test(error.message || '')) {
        console.error('[moonlight-interest] column missing:', error.message);
        return res.status(503).json({
          error: '參加表欄位尚未設定完成，請稍後再試。',
          hint: 'Run migrations for answers + telegram_username',
        });
      }
      console.error('[moonlight-interest] insert failed:', error.message, error.code);
      return res.status(500).json({ error: '無法提交參加表，請稍後再試。' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[moonlight-interest] unexpected error:', err);
    return res.status(500).json({ error: '無法提交參加表，請稍後再試。' });
  }
}
