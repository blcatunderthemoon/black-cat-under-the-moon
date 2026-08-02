/** Active rows: legacy null, unclaimed, or already claimed — not duplicate/disputed. */
import { databaseNowIso } from './hong-kong-time.js';
import { normalizeEmailForPersonKey, responseEmailMatchOrParts } from './response-dedupe.js';

/**
 * Rows that still count as "this person filled Echo".
 * Must stay aligned with `userHasSubmitted` in user-matches.js — otherwise
 * logged-in users with a non-duplicate response (e.g. disputed, or odd legacy
 * claim_status) get the questionnaire again instead of results / thank-you.
 */
const NON_DUPLICATE_CLAIM_OR = 'claim_status.neq.duplicate,claim_status.is.null';

const ACTIVE_CLAIM_OR = 'claim_status.is.null,claim_status.eq.unclaimed,claim_status.eq.claimed';

const LEGACY_LINKABLE_OR = 'claim_status.is.null,claim_status.eq.unclaimed';

function normalizeEmail(email) {
  return normalizeEmailForPersonKey(email);
}

function collectEmails({ email, emails, profileEmail } = {}) {
  const out = new Set();
  for (const raw of [email, profileEmail, ...(emails || [])]) {
    const n = normalizeEmail(raw);
    if (n) out.add(n);
  }
  return [...out];
}

const RESPONSE_ANSWER_SELECT = [
  'id',
  'created_at',
  'user_id',
  'email',
  'normalized_email',
  'name',
  'age',
  'height',
  'body_type',
  'identity',
  'hair_style',
  'fashion_styles',
  'bed_role',
  'social_energy',
  'weekend_mode',
  'interests',
  'exercise_habits',
  'travel_mode',
  'relationship_goal',
  'time_commitment',
  'deal_breakers',
  'love_languages',
  'security_needs',
  'daily_love_ritual',
  'decision_making',
  'communication_style',
  'expense_splitting',
  'living_together',
  'ideal_identity',
  'ideal_body_type',
  'ideal_height_gap',
  'ideal_age_gap',
  'gap_moe',
  'preferred_attribute',
  'ideal_appearance',
  'personal_traits',
  'ig_username',
  'tg_username',
  'feedback',
].join(', ');

async function findResponseByUserId(admin, userId, { full = false, forHasSubmitted = false } = {}) {
  if (!userId) return null;
  const claimOr = forHasSubmitted ? NON_DUPLICATE_CLAIM_OR : ACTIVE_CLAIM_OR;
  const { data } = await admin
    .from('responses')
    .select(full ? RESPONSE_ANSWER_SELECT : 'id')
    .eq('user_id', userId)
    .or(claimOr)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function findResponseByEmail(admin, normalized, { full = false, forHasSubmitted = false } = {}) {
  const emailOr = responseEmailMatchOrParts(normalized);
  if (!emailOr.length) return null;
  const claimOr = forHasSubmitted ? NON_DUPLICATE_CLAIM_OR : ACTIVE_CLAIM_OR;
  const { data } = await admin
    .from('responses')
    .select(full ? RESPONSE_ANSWER_SELECT : 'id')
    .or(emailOr.join(','))
    .or(claimOr)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/**
 * Latest active Echo response owned by this account (user_id and/or matching email).
 * Prefer user-linked row; fall back to email match for legacy submissions.
 */
export async function findLatestMatchResponse(admin, { userId, email, emails, profileEmail } = {}) {
  const byUser = await findResponseByUserId(admin, userId, { full: true, forHasSubmitted: true });
  if (byUser) return byUser;

  for (const normalized of collectEmails({ email, emails, profileEmail })) {
    const byEmail = await findResponseByEmail(admin, normalized, { full: true, forHasSubmitted: true });
    if (byEmail) return byEmail;
  }
  return null;
}

/** Whether a non-duplicate match-mode response exists for this user and/or email(s). */
export async function hasMatchSubmission(admin, { userId, email, emails, profileEmail } = {}) {
  if (await findResponseByUserId(admin, userId, { forHasSubmitted: true })) return true;

  for (const normalized of collectEmails({ email, emails, profileEmail })) {
    if (await findResponseByEmail(admin, normalized, { forHasSubmitted: true })) return true;
  }
  return false;
}

/**
 * Silently link legacy email-only responses (null/unclaimed, no user_id) to a logged-in account.
 * Returns true when the user now has a linked submission.
 */
export async function autoLinkLegacyMatchResponses(admin, userId, email) {
  const normalized = normalizeEmail(email);
  const emailOr = responseEmailMatchOrParts(normalized);
  if (!userId || !emailOr.length) return false;

  if (await findResponseByUserId(admin, userId)) return true;

  const { data: otherClaim } = await admin
    .from('responses')
    .select('id')
    .or(emailOr.join(','))
    .eq('claim_status', 'claimed')
    .not('user_id', 'is', null)
    .neq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (otherClaim) return false;

  const { data: candidates, error } = await admin
    .from('responses')
    .select('id')
    .or(emailOr.join(','))
    .or(LEGACY_LINKABLE_OR)
    .is('user_id', null)
    .order('created_at', { ascending: false });

  if (error || !candidates?.length) return false;

  const now = databaseNowIso();
  const [primary, ...dupes] = candidates;

  const { error: claimError } = await admin
    .from('responses')
    .update({
      user_id: userId,
      claim_status: 'claimed',
      claimed_at: now,
    })
    .eq('id', primary.id);

  if (claimError) return false;

  if (dupes.length) {
    await admin
      .from('responses')
      .update({ claim_status: 'duplicate', archived_at: now })
      .in('id', dupes.map((r) => r.id));
  }

  return true;
}
