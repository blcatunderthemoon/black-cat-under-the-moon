/**
 * PATCH /api/my-cat/equip — switch equipped cat skin (§7.1).
 * Body: { skin_id: 'cat01' | … | 'cat05' }
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../lib/server-auth.js';
import { performCatEquip } from '../../../lib/my-cat-server.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const skinId = body.skin_id;

  try {
    const admin = getAdminClient();
    const result = await performCatEquip(admin, user.id, skinId);
    if (!result.ok) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[my-cat/equip] failed:', err?.message || err);
    return res.status(500).json({ error: '換裝失敗，請稍後再試。' });
  }
}
