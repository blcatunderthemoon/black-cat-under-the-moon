/**
 * POST /api/profile/exchange-photo — save Cloudinary URL as exchange photo
 * Body: { photo_url: string }
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../lib/server-auth.js';
import { saveExchangePhotoUrl } from '../../../lib/photo-exchange.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const photoUrl = String(body.photo_url || '').trim();

  if (!photoUrl) {
    return res.status(400).json({ error: '請提供相片網址。' });
  }

  const result = await saveExchangePhotoUrl(user.id, photoUrl);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  const admin = getAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('exchange_photo_url, exchange_photo_updated_at')
    .eq('id', user.id)
    .maybeSingle();

  return res.status(200).json({
    success: true,
    exchange_photo_url: profile?.exchange_photo_url || result.photo_url,
    exchange_photo_updated_at: profile?.exchange_photo_updated_at || null,
  });
}
