/**
 * POST /api/inbox/send
 * Send a user letter to another user, or reply in an existing thread.
 *
 * Body: { recipient_id, content, thread_id?, source_type? }
 * - thread_id: if replying to an existing thread
 * - recipient_id: profiles.id UUID of the recipient
 */

import { requireUser, sendAuthError } from '../../../lib/server-auth.js';
import { sendLetter } from '../../../lib/inbox.js';
import { MOONLIGHT_PASSPORT_BRAND } from '../../../lib/premium.js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(10, '1 h') })
  : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  // Per-user rate limit: 10 sends per hour
  if (ratelimit) {
    const { success } = await ratelimit.limit(`inbox_send:${user.id}`);
    if (!success) return res.status(429).json({ error: '發信太頻繁，請稍後再試。' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  let { recipient_id, content, thread_id, source_type, letter_style } = body;

  if (source_type === 'bottle') {
    return res.status(403).json({ error: '漂流瓶不支援主動投信，請保持匿名。' });
  }

  if (!recipient_id || typeof recipient_id !== 'string') {
    return res.status(400).json({ error: 'recipient_id is required' });
  }
  if (!content?.trim()) {
    return res.status(400).json({ error: 'content is required' });
  }

  try {
    const result = await sendLetter({
      senderId: user.id,
      recipientId: recipient_id,
      content,
      existingThreadId: thread_id || null,
      sourceType: source_type || null,
      letterStyle: letter_style || null,
    });
    return res.status(200).json(result);
  } catch (err) {
    if (err.crisis) {
      return res.status(422).json({ error: 'crisis', crisis: true });
    }
    const status = err.status || 500;
    const reasons = {
      not_logged_in: '請先登入',
      blocked: '無法聯絡此用戶',
      premium_required: `升級 ${MOONLIGHT_PASSPORT_BRAND} 即可主動投信`,
      quota_exhausted: '本月主動投信額度已用完',
      no_existing_thread: '找不到與此用戶的對話',
      self_send: '無法發信給自己',
      channel_closed: '神秘通道已關閉，請到對方的 Mirror Card 開啟新通道',
      waiting_for_reply: '請靜候對方回信後再開啟通道',
      reply_used: '本次通道的來回次數已用完',
      open_from_mirror_only: '請到對方的 Mirror Card 投出下一封信',
      photo_exchange_thread: '請使用交換相對話',
    };
    return res.status(status).json({
      error: reasons[err.reason] || err.message || '發送失敗',
      reason: err.reason || null,
      crisis: !!err.crisis,
    });
  }
}
