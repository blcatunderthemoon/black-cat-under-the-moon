/**
 * GET /api/photo-exchange/[id] — exchange state for participant (view / respond page)
 */

import { requireUser, sendAuthError } from '../../../lib/server-auth.js';
import { getPhotoExchangeById } from '../../../lib/photo-exchange.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const exchangeId = String(req.query.id || '').trim();
  if (!exchangeId) {
    return res.status(400).json({ error: '缺少交換 ID。' });
  }

  const result = await getPhotoExchangeById(user.id, exchangeId);

  if (!result.ok) {
    return res.status(result.status || 400).json({ error: result.error });
  }

  return res.status(200).json(result);
}
