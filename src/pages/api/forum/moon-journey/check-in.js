/**
 * POST /api/forum/moon-journey/check-in — daily forum check-in (+2 EXP)
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../lib/server-auth.js';
import { performDailyCheckIn } from '../../../../lib/moon-journey.js';

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
    const result = await performDailyCheckIn(admin, user.id);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[forum/moon-journey/check-in] failed:', err?.message || err);
    return res.status(500).json({ error: '打卡失敗，請稍後再試。' });
  }
}
