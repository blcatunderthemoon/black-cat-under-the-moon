/**
 * POST /api/my-cat/shop/buy — purchase a room furniture item with moon shards (§12.5).
 * Body: { item_id: 'bowl_moon' | 'window_galaxy' | … }
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../lib/server-auth.js';
import { performRoomBuy } from '../../../../lib/my-cat-server.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const itemId = body.item_id;

  try {
    const admin = getAdminClient();
    const result = await performRoomBuy(admin, user.id, itemId);
    if (!result.ok) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[my-cat/shop/buy] failed:', err?.message || err);
    return res.status(500).json({ error: '購買失敗，請稍後再試。' });
  }
}
