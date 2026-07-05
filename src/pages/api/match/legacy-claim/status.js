/**
 * GET /api/match/legacy-claim/status
 * Returns whether the logged-in user has unclaimed legacy match responses
 * matching their verified email address.
 *
 * Never returns full questionnaire answers — only safe summary info.
 */

import { requireUser, sendAuthError } from '../../../../lib/server-auth.js';
import { getLegacyClaimStatus } from '../../../../lib/legacy-match-claim.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  // Only allow claim via verified email
  if (!user.email_confirmed_at) {
    return res.status(200).json({
      claimable: false,
      reason: 'email_not_verified',
      count: 0,
      latest_id: null,
      latest_submitted_at: null,
      already_claimed_by_self: false,
    });
  }

  const status = await getLegacyClaimStatus(user.id, user.email);

  return res.status(200).json(status);
}
