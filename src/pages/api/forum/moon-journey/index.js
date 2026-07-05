/**
 * GET /api/forum/moon-journey — current user's Moon Journey state
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../lib/server-auth.js';
import { getMoonJourneyForUser } from '../../../../lib/moon-journey.js';

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
    const moon_journey = await getMoonJourneyForUser(admin, user.id);
    return res.status(200).json({ moon_journey });
  } catch (err) {
    console.error('[forum/moon-journey] GET failed:', err?.message || err);
    return res.status(500).json({ error: '無法載入月光旅程。' });
  }
}
