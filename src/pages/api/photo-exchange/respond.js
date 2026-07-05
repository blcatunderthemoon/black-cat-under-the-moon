/**
 * POST /api/photo-exchange/respond — accept exchange by sharing your photo
 * Body: { exchange_id: string, photo_url?: string }
 */

import { requireUser, sendAuthError } from '../../../lib/server-auth.js';
import { respondPhotoExchange } from '../../../lib/photo-exchange.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const exchangeId = String(body.exchange_id || '').trim();
  const photoUrl = body.photo_url ? String(body.photo_url).trim() : null;

  if (!exchangeId) {
    return res.status(400).json({ error: '缺少交換邀請 ID。' });
  }

  const result = await respondPhotoExchange(user.id, exchangeId, photoUrl);

  if (!result.ok) {
    const status = result.status || 400;
    if (result.error === 'blocked') {
      return res.status(403).json({ error: '無法與此用戶交換相片。', code: 'blocked' });
    }
    if (result.status === 429) {
      return res.status(429).json({ error: result.error, code: 'quota_exhausted' });
    }
    return res.status(status).json({ error: result.error });
  }

  return res.status(200).json({
    success: true,
    exchange_id: result.exchange_id,
    status: result.status,
    expires_at: result.expires_at,
    days_remaining: result.days_remaining,
    other_party_photo_url: result.other_party_photo_url,
  });
}
