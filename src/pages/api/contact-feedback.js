/**
 * POST /api/contact-feedback
 * Save contact page feedback (意見箱) to the database.
 * Body: { category, display_name?, message }
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { checkIp } from '../../lib/ip-guard.js';
import { filterContent } from '../../lib/content-filter.js';
import { getOptionalUser, getAdminClient } from '../../lib/server-auth.js';

const CATEGORIES = new Set(['功能建議', '問題回報', '內容舉報', '合作洽談', '其他']);
const MAX_NAME_LENGTH = 40;
const MAX_MESSAGE_LENGTH = 2000;

const ratelimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '1 h'),
    })
  : null;

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
      const { success } = await ratelimit.limit(`contact-feedback:${ip}`);
      if (!success) {
        return res.status(429).json({ error: '傳送太頻繁，請稍後再試。' });
      }
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!CATEGORIES.has(category)) {
      return res.status(400).json({ error: '請選擇有效的類別。' });
    }
    if (!message) {
      return res.status(400).json({ error: '請輸入訊息內容。' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `訊息不能超過 ${MAX_MESSAGE_LENGTH} 字。` });
    }
    if (displayName.length > MAX_NAME_LENGTH) {
      return res.status(400).json({ error: `稱呼不能超過 ${MAX_NAME_LENGTH} 字。` });
    }

    const { blocked, crisis } = filterContent(message);
    if (blocked) {
      return res.status(400).json({ error: '內容包含不當字眼，無法傳送。' });
    }

    const authUser = await getOptionalUser(req);
    const admin = getAdminClient();

    const { error } = await admin.from('contact_feedback').insert({
      category,
      display_name: displayName || null,
      message,
      user_id: authUser?.id || null,
      is_crisis: crisis === true,
    });

    if (error) {
      if (error.code === '42P01') {
        return res.status(503).json({ error: '意見箱尚未設定完成，請稍後再試或直接電郵聯絡我們。' });
      }
      console.error('[contact-feedback] insert failed:', error.message, error.code);
      return res.status(500).json({ error: '無法儲存意見，請稍後再試。' });
    }

    return res.status(200).json({ success: true, crisis: crisis === true });
  } catch (err) {
    console.error('[contact-feedback] unexpected error:', err);
    return res.status(500).json({ error: '無法儲存意見，請稍後再試。' });
  }
}
