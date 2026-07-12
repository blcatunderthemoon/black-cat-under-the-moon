/**
 * GET /api/my-cat — current user's cat state + moon journey summary.
 * Auto-creates the default cat05 kitten on first visit.
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../lib/server-auth.js';
import { getMyCatState } from '../../../lib/my-cat-server.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  try {
    const admin = getAdminClient();
    const state = await getMyCatState(admin, user.id);
    return res.status(200).json(state);
  } catch (err) {
    console.error('[my-cat] failed:', err?.message || err);
    return res.status(500).json({ error: '貓咪走失了一下，請稍後再試。' });
  }
}
