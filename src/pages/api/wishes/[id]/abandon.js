/**
 * POST /api/wishes/[id]/abandon — owner abandons an active/expired wish
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../lib/server-auth.js';
import {
  maybeExpireWish,
  toPublicWish,
  enrichWishOwners,
} from '../../../../lib/wishes.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: '缺少心願 id' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const admin = getAdminClient();
  const { data: row } = await admin.from('wishes').select('*').eq('id', id).maybeSingle();
  if (!row) return res.status(404).json({ error: '找不到此心願。' });

  const wish = await maybeExpireWish(admin, row);
  if (wish.user_id !== user.id) {
    return res.status(403).json({ error: '只有你可以放棄自己嘅心願。' });
  }
  if (!['active', 'expired'].includes(wish.status)) {
    return res.status(400).json({ error: '此心願無法放棄。' });
  }

  const { data: updated, error } = await admin
    .from('wishes')
    .update({ status: 'abandoned' })
    .eq('id', wish.id)
    .select('*')
    .single();

  if (error) {
    console.error('[wishes/abandon] failed:', error.message);
    return res.status(500).json({ error: '放棄失敗。' });
  }

  const ownerMap = await enrichWishOwners(admin, [updated]);
  return res.status(200).json({
    wish: toPublicWish(updated, { owner: ownerMap.get(updated.user_id) }),
  });
}
