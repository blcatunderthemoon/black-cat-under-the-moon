/**
 * POST /api/match/legacy-claim/request
 * Pre-check and register intent to claim legacy match data.
 *
 * For users with a verified Email that exactly matches an unclaimed response,
 * this creates a pending legacy_match_claims record so the claim can be
 * completed via POST /api/match/legacy-claim/confirm.
 *
 * Returns the same summary as the status endpoint (count, latest date,
 * claimable) so the frontend doesn't need an extra round-trip.
 *
 * Never returns full questionnaire answers.
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../lib/server-auth.js';
import { getLegacyClaimStatus } from '../../../../lib/legacy-match-claim.js';

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

  // Require verified email — no automatic claim on unverified accounts
  if (!user.email_confirmed_at) {
    return res.status(403).json({
      error: 'email_not_verified',
      message: 'Please verify your email address before claiming match data.',
    });
  }

  const status = await getLegacyClaimStatus(user.id, user.email);

  if (status.already_claimed_by_self) {
    return res.status(200).json({
      requested: false,
      reason: 'already_claimed',
      ...status,
    });
  }

  if (!status.claimable) {
    return res.status(200).json({
      requested: false,
      reason: 'no_claimable_responses',
      ...status,
    });
  }

  // Create a pending claim record (for audit trail and UX state)
  const admin = getAdminClient();
  const normalized = user.email.toLowerCase().trim();

  // Avoid duplicate pending records for the same user + response
  const { data: existing } = await admin
    .from('legacy_match_claims')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('response_id', status.latest_id)
    .eq('status', 'pending')
    .maybeSingle();

  if (!existing) {
    await admin.from('legacy_match_claims').insert({
      user_id: user.id,
      response_id: status.latest_id,
      claim_method: 'email_exact',
      status: 'pending',
      matched_email: normalized,
    });
  }

  return res.status(200).json({
    requested: true,
    ...status,
  });
}
