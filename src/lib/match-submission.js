/** Active rows: legacy null, unclaimed, or already claimed — not duplicate/disputed. */
const ACTIVE_CLAIM_OR = 'claim_status.is.null,claim_status.eq.unclaimed,claim_status.eq.claimed';

const LEGACY_LINKABLE_OR = 'claim_status.is.null,claim_status.eq.unclaimed';

function normalizeEmail(email) {
  return (email || '').toLowerCase().trim();
}

function collectEmails({ email, emails, profileEmail } = {}) {
  const out = new Set();
  for (const raw of [email, profileEmail, ...(emails || [])]) {
    const n = normalizeEmail(raw);
    if (n) out.add(n);
  }
  return [...out];
}

async function findResponseByUserId(admin, userId) {
  if (!userId) return null;
  const { data } = await admin
    .from('responses')
    .select('id')
    .eq('user_id', userId)
    .or(ACTIVE_CLAIM_OR)
    .limit(1)
    .maybeSingle();
  return data;
}

async function findResponseByEmail(admin, normalized) {
  if (!normalized) return null;
  const { data } = await admin
    .from('responses')
    .select('id')
    .or(`normalized_email.eq.${normalized},email.ilike.${normalized}`)
    .or(ACTIVE_CLAIM_OR)
    .limit(1)
    .maybeSingle();
  return data;
}

/** Whether a non-duplicate match-mode response exists for this user and/or email(s). */
export async function hasMatchSubmission(admin, { userId, email, emails, profileEmail } = {}) {
  if (await findResponseByUserId(admin, userId)) return true;

  for (const normalized of collectEmails({ email, emails, profileEmail })) {
    if (await findResponseByEmail(admin, normalized)) return true;
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
    .or(`normalized_email.eq.${normalized},email.ilike.${normalized}`)
    .eq('claim_status', 'claimed')
    .not('user_id', 'is', null)
    .neq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (otherClaim) return false;

  const { data: candidates, error } = await admin
    .from('responses')
    .select('id')
    .or(`normalized_email.eq.${normalized},email.ilike.${normalized}`)
    .or(LEGACY_LINKABLE_OR)
    .is('user_id', null)
    .order('created_at', { ascending: false });

  if (error || !candidates?.length) return false;

  const now = new Date().toISOString();
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
