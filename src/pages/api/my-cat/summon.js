/**
 * POST /api/my-cat/summon — 召喚離家出走嘅貓（飽腹 0）。
 * 記低 summoned_at；1 小時後貓咪返嚟，先可以再餵食／摸摸。
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../lib/server-auth.js';
import { performCatSummon } from '../../../lib/my-cat-server.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  try {
    const admin = getAdminClient();
    const result = await performCatSummon(admin, user.id);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[my-cat/summon] failed:', err?.message || err);
    return res.status(500).json({ error: '召喚失敗，請稍後再試。' });
  }
}
