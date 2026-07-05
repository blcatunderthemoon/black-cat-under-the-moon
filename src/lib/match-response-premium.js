/**
 * Resolve Moonlight Passport status for questionnaire responses.
 * Uses linked profiles.user_id when claimed; falls back to auth email match.
 */

import { getAdminClient, getSubscriptionTiers } from './server-auth.js';
import { databaseNowIso } from './hong-kong-time.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * @param {Array<{ id?: number, user_id?: string|null, email?: string|null }>} responses
 * @returns {Promise<{
 *   tierByUserId: Record<string, 'free'|'premium'>,
 *   premiumEmails: Set<string>,
 *   isResponsePremium: (row: { user_id?: string|null, email?: string|null }) => boolean,
 * }>}
 */
export async function buildMatchResponsePremiumContext(responses) {
  const admin = getAdminClient();
  const rows = responses || [];

  const profileUserIds = rows.map((r) => r.user_id).filter(Boolean);
  const tierByUserId = await getSubscriptionTiers(profileUserIds);

  const nowIso = databaseNowIso();
  const { data: subs } = await admin
    .from('subscriptions')
    .select('user_id, status, current_period_end')
    .in('status', ['active', 'manual', 'past_due'])
    .gt('current_period_end', nowIso);

  const premiumUserIds = [...new Set((subs || []).map((s) => s.user_id).filter(Boolean))];

  // Also trust subscription rows directly (covers users not in current response batch)
  for (const sub of subs || []) {
    if (sub?.user_id) tierByUserId[sub.user_id] = 'premium';
  }

  const premiumEmails = new Set();
  await Promise.all(
    premiumUserIds.map(async (userId) => {
      try {
        const { data: { user } } = await admin.auth.admin.getUserById(userId);
        const email = normalizeEmail(user?.email);
        if (email) premiumEmails.add(email);
      } catch {
        // skip
      }
    }),
  );

  const isResponsePremium = (row) => {
    if (row?.user_id && tierByUserId[row.user_id] === 'premium') return true;
    const email = normalizeEmail(row?.email);
    return !!(email && premiumEmails.has(email));
  };

  return { tierByUserId, premiumEmails, isResponsePremium };
}
