/**
 * POST /api/match/legacy-claim/confirm
 * Link the logged-in user's verified email to their legacy match responses.
 *
 * Body: { action: 'claim' | 'dispute' }
 * - 'claim': link the newest matching unclaimed response to this account
 * - 'dispute': mark matching responses as disputed (not my data)
 */

import { requireUser, sendAuthError } from '../../../../lib/server-auth.js';
import { confirmLegacyClaim, disputeLegacyClaim } from '../../../../lib/legacy-match-claim.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  // Require verified email for any claim action
  if (!user.email_confirmed_at) {
    return res.status(403).json({ error: 'Email must be verified before claiming match data.' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { action } = body;

  if (action === 'dispute') {
    const result = await disputeLegacyClaim(user.id, user.email);
    return res.status(200).json({ success: result.success });
  }

  if (action === 'claim' || !action) {
    const result = await confirmLegacyClaim(user.id, user.email);
    if (!result.success) {
      if (result.error === 'email_claimed_by_other') {
        // Generic message — do not reveal which account claimed it
        return res.status(409).json({ error: 'This match data could not be claimed automatically. Please contact support.' });
      }
      if (result.error === 'no_claimable_responses') {
        return res.status(404).json({ error: 'No claimable match data found for your email.' });
      }
      return res.status(500).json({ error: 'Claim failed. Please try again.' });
    }

    return res.status(200).json({
      success: true,
      response_id: result.response_id,
    });
  }

  return res.status(400).json({ error: 'Invalid action. Expected "claim" or "dispute".' });
}
