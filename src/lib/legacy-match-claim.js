/**
 * src/lib/legacy-match-claim.js
 * Logic for linking legacy (unauthenticated) match questionnaire responses
 * to a verified Supabase Auth account.
 *
 * Key invariant: automatic claim is ONLY allowed via verified Email match.
 * IG/TG handle similarity must never trigger automatic linking.
 */

import { getAdminClient } from './server-auth.js';
import { databaseNowIso } from './hong-kong-time.js';

/**
 * Find unclaimed responses matching the user's verified email.
 *
 * Returns safe summary info only — never full questionnaire answers.
 * Shape: { claimable: boolean, count: number, latest_id: bigint|null,
 *          latest_submitted_at: string|null, already_claimed_by_self: boolean }
 */
export async function getLegacyClaimStatus(userId, verifiedEmail) {
  if (!verifiedEmail) {
    return { claimable: false, count: 0, latest_id: null, latest_submitted_at: null, already_claimed_by_self: false };
  }

  const admin = getAdminClient();
  const normalized = verifiedEmail.toLowerCase().trim();

  // Check if user already claimed some responses
  const { data: selfClaimed } = await admin
    .from('responses')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('claim_status', 'claimed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selfClaimed) {
    return {
      claimable: false,
      count: 0,
      latest_id: null,
      latest_submitted_at: null,
      already_claimed_by_self: true,
    };
  }

  // Find responses matching this email that are unclaimed (null or explicit unclaimed)
  const { data: matches, error } = await admin
    .from('responses')
    .select('id, created_at, claim_status')
    .or(`normalized_email.eq.${normalized},email.ilike.${normalized}`)
    .or('claim_status.is.null,claim_status.eq.unclaimed')
    .order('created_at', { ascending: false });

  if (error || !matches?.length) {
    return { claimable: false, count: 0, latest_id: null, latest_submitted_at: null, already_claimed_by_self: false };
  }

  return {
    claimable: true,
    count: matches.length,
    latest_id: matches[0].id,
    latest_submitted_at: matches[0].created_at,
    already_claimed_by_self: false,
  };
}

/**
 * Execute the legacy claim for a verified user.
 *
 * - Claims the newest unclaimed response matching their email.
 * - Marks older duplicate responses as 'duplicate'.
 * - Inserts an audit row in legacy_match_claims.
 *
 * Returns { success: boolean, response_id: bigint|null, error?: string }
 */
export async function confirmLegacyClaim(userId, verifiedEmail) {
  if (!verifiedEmail) return { success: false, error: 'no_email' };

  const admin = getAdminClient();
  const normalized = verifiedEmail.toLowerCase().trim();

  // Fetch all unclaimed responses for this email
  const { data: candidates, error: fetchError } = await admin
    .from('responses')
    .select('id, created_at, claim_status')
    .or(`normalized_email.eq.${normalized},email.ilike.${normalized}`)
    .or('claim_status.is.null,claim_status.eq.unclaimed')
    .order('created_at', { ascending: false });

  if (fetchError || !candidates?.length) {
    return { success: false, error: 'no_claimable_responses' };
  }

  // Double-check this email isn't already claimed by another user
  const { data: otherClaim } = await admin
    .from('responses')
    .select('user_id')
    .eq('normalized_email', normalized)
    .eq('claim_status', 'claimed')
    .neq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (otherClaim) {
    // Insert a disputed claim record for admin review
    await admin.from('legacy_match_claims').insert({
      user_id: userId,
      response_id: candidates[0].id,
      claim_method: 'email_exact',
      status: 'pending',
      matched_email: normalized,
      review_note: 'Email already claimed by another account',
    });
    return { success: false, error: 'email_claimed_by_other' };
  }

  const activeResponseId = candidates[0].id;
  const duplicateIds = candidates.slice(1).map((r) => r.id);
  const now = databaseNowIso();

  // Claim the latest response
  const { error: claimError } = await admin
    .from('responses')
    .update({
      user_id: userId,
      claim_status: 'claimed',
      claimed_at: now,
    })
    .eq('id', activeResponseId);

  if (claimError) {
    return { success: false, error: 'claim_write_failed' };
  }

  // Archive duplicates
  if (duplicateIds.length > 0) {
    await admin
      .from('responses')
      .update({
        claim_status: 'duplicate',
        archived_at: now,
      })
      .in('id', duplicateIds);
  }

  // Insert approved audit row
  await admin.from('legacy_match_claims').insert({
    user_id: userId,
    response_id: activeResponseId,
    claim_method: 'email_exact',
    status: 'approved',
    matched_email: normalized,
    resolved_at: now,
  });

  return { success: true, response_id: activeResponseId };
}

/**
 * Mark a response as 'disputed' — called when user says "this is not my data".
 * Prevents the same response from being auto-prompted again.
 */
export async function disputeLegacyClaim(userId, verifiedEmail) {
  if (!verifiedEmail) return { success: false };

  const admin = getAdminClient();
  const normalized = verifiedEmail.toLowerCase().trim();

  const { data: candidates } = await admin
    .from('responses')
    .select('id')
    .or(`normalized_email.eq.${normalized},email.ilike.${normalized}`)
    .or('claim_status.is.null,claim_status.eq.unclaimed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!candidates) return { success: false, error: 'no_responses_found' };

  await admin
    .from('responses')
    .update({ claim_status: 'disputed' })
    .eq('id', candidates.id);

  await admin.from('legacy_match_claims').insert({
    user_id: userId,
    response_id: candidates.id,
    claim_method: 'email_exact',
    status: 'rejected',
    matched_email: normalized,
    review_note: 'User indicated this is not their data',
    resolved_at: databaseNowIso(),
  });

  return { success: true };
}

/**
 * Admin-only: resolve a pending disputed claim.
 * action: 'approve' | 'reject'
 */
export async function adminResolveClaim(claimId, action, reviewNote = '') {
  const admin = getAdminClient();

  const { data: claim } = await admin
    .from('legacy_match_claims')
    .select('*')
    .eq('id', claimId)
    .single();

  if (!claim) return { success: false, error: 'claim_not_found' };
  if (claim.status !== 'pending') return { success: false, error: 'claim_not_pending' };

  const now = databaseNowIso();

  if (action === 'approve') {
    // Link response to user
    await admin
      .from('responses')
      .update({ user_id: claim.user_id, claim_status: 'claimed', claimed_at: now })
      .eq('id', claim.response_id);

    await admin
      .from('legacy_match_claims')
      .update({ status: 'approved', review_note: reviewNote, resolved_at: now })
      .eq('id', claimId);

    return { success: true };
  }

  // Reject
  await admin
    .from('legacy_match_claims')
    .update({ status: 'rejected', review_note: reviewNote, resolved_at: now })
    .eq('id', claimId);

  return { success: true };
}
