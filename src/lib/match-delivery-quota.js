/**
 * Monthly match-delivery quota for email automation / admin tools.
 * Free users: 3 matches per calendar month. Premium: unlimited.
 */

export const FREE_MONTHLY_MATCH_LIMIT = 3;

export function getCurrentMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Count how many sent_matches each response id participated in this month.
 * @param {Array<{ user_a_id: number, user_b_id: number, sent_at?: string }>} sentRows
 * @returns {Map<number, number>}
 */
export function buildMonthlyMatchCounts(sentRows) {
  const monthStart = getCurrentMonthStart();
  const counts = new Map();

  for (const row of sentRows || []) {
    if (row.sent_at && new Date(row.sent_at) < monthStart) continue;
    const a = Number(row.user_a_id);
    const b = Number(row.user_b_id);
    if (Number.isFinite(a)) counts.set(a, (counts.get(a) || 0) + 1);
    if (Number.isFinite(b)) counts.set(b, (counts.get(b) || 0) + 1);
  }

  return counts;
}

/**
 * @param {number} responseId
 * @param {string|null|undefined} profileUserId
 * @param {Record<string, 'free'|'premium'>} tierByUserId
 * @param {Map<number, number>} monthlyCounts
 * @param {{ emailIsPremium?: boolean }} [opts]
 */
export function getResponseMatchQuota(responseId, profileUserId, tierByUserId, monthlyCounts, opts = {}) {
  const used = monthlyCounts.get(Number(responseId)) || 0;
  const isPremium = !!(
    (profileUserId && tierByUserId[profileUserId] === 'premium') ||
    opts.emailIsPremium
  );

  if (isPremium) {
    return {
      used,
      limit: null,
      is_premium: true,
      at_limit: false,
      can_receive: true,
    };
  }

  const limit = FREE_MONTHLY_MATCH_LIMIT;
  return {
    used,
    limit,
    is_premium: false,
    at_limit: used >= limit,
    can_receive: used < limit,
  };
}

/** True when both users can still receive another match this month. */
export function pairCanDeliverMatch(quotaA, quotaB) {
  return !!(quotaA?.can_receive && quotaB?.can_receive);
}
