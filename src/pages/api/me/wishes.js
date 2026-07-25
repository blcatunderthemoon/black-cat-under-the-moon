/**
 * GET /api/me/wishes — current user's wishes
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../lib/server-auth.js';
import {
  maybeExpireWish,
  enrichWishOwners,
  toPublicWish,
  WISH_LIST_MAX_LIMIT,
} from '../../../lib/wishes.js';
import { hasClaimedWishFirstCreate } from '../../../lib/my-cat-awards.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const admin = getAdminClient();
  const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), WISH_LIST_MAX_LIMIT);

  const { data, error } = await admin
    .from('wishes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[me/wishes] failed:', error.message);
    if (error.message?.includes('wishes') || error.code === '42P01') {
      return res.status(503).json({ error: '月光心願尚未啟用，請先執行 migration。' });
    }
    return res.status(500).json({ error: '無法載入我的心願。' });
  }

  const rows = [];
  for (const row of data || []) {
    rows.push(await maybeExpireWish(admin, row));
  }
  const ownerMap = await enrichWishOwners(admin, rows);
  let firstCreateBonusAvailable = true;
  try {
    firstCreateBonusAvailable = !(await hasClaimedWishFirstCreate(admin, user.id));
  } catch (err) {
    console.error('[me/wishes] first-create check failed:', err?.message || err);
  }

  return res.status(200).json({
    wishes: rows.map((row) => toPublicWish(row, { owner: ownerMap.get(row.user_id) })),
    total: rows.length,
    first_create_bonus_available: firstCreateBonusAvailable,
  });
}
