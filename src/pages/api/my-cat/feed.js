/**
 * POST /api/my-cat/feed — unified daily ritual (§5.2, docs/MY-CAT-GAME-DESIGN.md).
 * One HK calendar day: Moon Journey check-in (+2 EXP) + hunger +25 + moon shards +3.
 * Idempotent; repeat calls return already_fed_today.
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../lib/server-auth.js';
import { performCatFeed } from '../../../lib/my-cat-server.js';

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
    const result = await performCatFeed(admin, user.id);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[my-cat/feed] failed:', err?.message || err);
    return res.status(500).json({ error: '餵食失敗，請稍後再試。' });
  }
}
