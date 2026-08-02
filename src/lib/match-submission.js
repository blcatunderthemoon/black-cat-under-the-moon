/** Active rows: legacy null, unclaimed, or already claimed — not duplicate/disputed. */
import { databaseNowIso } from './hong-kong-time.js';
import { normalizeEmailForPersonKey } from './response-dedupe.js';

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
  const key = normalizeEmailForPersonKey(normalized);
  if (!key) return null;
  const claimOr = forHasSubmitted ? NON_DUPLICATE_CLAIM_OR : ACTIVE_CLAIM_OR;
  const select = full ? RESPONSE_ANSWER_SELECT : 'id';
  // Prefer column filters (.eq / .ilike) over `.or("email.eq.…")` strings —
  // emails contain `.` which breaks PostgREST or-grammar unless perfectly quoted.
  const raw = String(normalized || '').toLowerCase().trim();
  const variants = [...new Set([key, `${key}.`, raw].filter(Boolean))];

  for (const v of variants) {
    const { data: byNorm } = await admin
      .from('responses')
      .select(select)
      .eq('normalized_email', v)
      .or(claimOr)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byNorm) return byNorm;

    const { data: byEmail } = await admin
      .from('responses')
      .select(select)
      .ilike('email', v)
      .or(claimOr)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byEmail) return byEmail;
  }
  return null;
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
  if (!userId || !normalized) return false;

  if (await findResponseByUserId(admin, userId)) return true;

  const { data: otherClaim } = await admin
    .from('responses')
    .select('id')
    .eq('normalized_email', normalized)
    .eq('claim_status', 'claimed')
    .not('user_id', 'is', null)
    .neq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (otherClaim) return false;

  // Also try legacy trailing-dot spelling + raw email column.
  const emailVariants = [...new Set([normalized, `${normalized}.`])];
  let candidates = [];
  for (const v of emailVariants) {
    const { data, error } = await admin
      .from('responses')
      .select('id')
      .eq('normalized_email', v)
      .or(LEGACY_LINKABLE_OR)
      .is('user_id', null)
      .order('created_at', { ascending: false });
    if (!error && data?.length) {
      candidates = data;
      break;
    }
    const { data: byEmail, error: err2 } = await admin
      .from('responses')
      .select('id')
      .ilike('email', v)
      .or(LEGACY_LINKABLE_OR)
      .is('user_id', null)
      .order('created_at', { ascending: false });
    if (!err2 && byEmail?.length) {
      candidates = byEmail;
      break;
    }
  }

  if (!candidates.length) return false;

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
