/**
 * POST /api/photo-exchange/cancel — cancel a pending outgoing exchange
 * Body: { exchange_id: string }
 */

import { requireUser, sendAuthError } from '../../../lib/server-auth.js';
import { cancelPhotoExchange } from '../../../lib/photo-exchange.js';

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

  if (!exchangeId) {
    return res.status(400).json({ error: '缺少交換邀請 ID。' });
  }

  const result = await cancelPhotoExchange(user.id, exchangeId);

  if (!result.ok) {
    return res.status(result.status || 400).json({ error: result.error });
  }

  return res.status(200).json({ success: true });
}
