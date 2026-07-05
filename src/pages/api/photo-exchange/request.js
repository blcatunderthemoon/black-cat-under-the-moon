/**
 * POST /api/photo-exchange/request — Premium user initiates photo exchange
 * Body: { recipient_slug: string }
 */

import { requireUser, sendAuthError } from '../../../lib/server-auth.js';
import { requestPhotoExchange } from '../../../lib/photo-exchange.js';
import { MOONLIGHT_PASSPORT_BRAND } from '../../../lib/premium.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const recipientSlug = String(body.recipient_slug || '').trim();
  const recipientId = String(body.recipient_id || '').trim() || null;

  if (!recipientSlug && !recipientId) {
    return res.status(400).json({ error: '請提供對方用戶或 Mirror Card。' });
  }

  const result = await requestPhotoExchange(user.id, { recipientSlug, recipientId });

  if (!result.ok) {
    const status = result.status || 400;
    if (result.error === 'premium_required') {
      return res.status(403).json({ error: `需要 ${MOONLIGHT_PASSPORT_BRAND} 才能發起交換相。`, code: 'premium_required' });
    }
    if (result.error === 'quota_exhausted') {
      return res.status(429).json({ error: '本月交換相額度已用完（每月 3 次）。', code: 'quota_exhausted' });
    }
    if (result.error === 'blocked') {
      return res.status(403).json({ error: '無法與此用戶交換相片。', code: 'blocked' });
    }
    if (result.error === '請先上傳你的交換用相片。') {
      return res.status(400).json({ error: result.error, code: 'no_exchange_photo' });
    }
    return res.status(status).json({ error: result.error });
  }

  return res.status(200).json({
    success: true,
    exchange_id: result.exchange_id,
    status: result.status,
    inbox_thread_id: result.inbox_thread_id || null,
    inbox_delivered: !!result.inbox_delivered,
  });
}
