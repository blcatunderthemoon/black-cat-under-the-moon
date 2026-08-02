/**
 * Client-side filters for dashboard email automation pair lists.
 * Sent status is keyed by responses.id pair → sent_matches.id (not quota or auth user_id).
 */

/** Canonical pair key from normalised questionnaire response ids. */
export function automationPairKey(pair) {
  const a = Number(pair?.user_a_id);
  const b = Number(pair?.user_b_id);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a <= b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * True when this pair exists in sent_matches.
 * Prefer sent_match_id; also honour already_sent so a remapped/historical row
 * never leaks into「未發送」if the id annotation was dropped.
 */
export function isAutomationPairSent(pair) {
  if (pair?.sent_match_id != null) return true;
  if (pair?.already_sent === true) return true;
  return false;
}

/** Conduct &lt; 50 (or explicit conduct_blocked) — must not appear on「未發送」. */
export function pairFailsConduct(pair) {
  if (pair?.conduct_blocked) return true;
  const a = pair?.user_a_conduct;
  const b = pair?.user_b_conduct;
  if (a != null && Number.isFinite(Number(a)) && Number(a) < 50) return true;
  if (b != null && Number.isFinite(Number(b)) && Number(b) < 50) return true;
  return false;
}

/** True when both sides share the same questionnaire email. */
export function pairHasSameEmail(pair) {
  const a = String(pair?.user_a?.email || '').trim().toLowerCase();
  const b = String(pair?.user_b?.email || '').trim().toLowerCase();
  return !!(a && b && a === b);
}

export function formatSameEmailPairAlertLine(pair) {
  const email = String(pair?.user_a?.email || pair?.user_b?.email || '').trim().toLowerCase();
  const aId = pair?.user_a_id ?? pair?.userAId;
  const bId = pair?.user_b_id ?? pair?.userBId;
  const nameA = pair?.user_a?.name || '';
  const nameB = pair?.user_b?.name || '';
  return `#${aId} ${nameA} × #${bId} ${nameB}（${email}）`;
}

/** @returns {string|null} Alert body when any pair shares an email, else null. */
export function buildSameEmailPairsAlert(pairs) {
  const blocked = (pairs || []).filter(pairHasSameEmail);
  if (!blocked.length) return null;
  return (
    '無法發送：以下配對雙方使用相同 Email，請確認是否為重複問卷或填寫錯誤：\n\n'
    + blocked.map(formatSameEmailPairAlertLine).join('\n')
    + '\n\n同一 Email 無法同時配對雙方。'
  );
}

export function filterVisibleAutomationPairs(
  pairs,
  { sentFilter = 'unsent', hideQuotaFull = true, premiumOnly = false } = {},
) {
  return (pairs || []).filter((pair) => {
    // Guard the Moonlight Passport view client-side so it never leaks non-premium
    // pairs even if the server response wasn't premium-filtered (stale/racey refetch).
    if (premiumOnly && !pair.has_premium) return false;
    const sent = isAutomationPairSent(pair);
    if (sentFilter === 'unsent') {
      // sent_matches rows never belong on「未發送」; conduct-suspended neither.
      if (sent) return false;
      if (pairFailsConduct(pair)) return false;
    }
    if (sentFilter === 'sent' && !sent) return false;
    if (hideQuotaFull && pair.quota_blocked && !sent) return false;
    return true;
  });
}

/**
 * Free (monthly-limited) users in a pair, with their response id + quota.
 * Premium users (no limit) are excluded.
 */
export function pairLimitedUsers(pair) {
  const out = [];
  for (const side of ['a', 'b']) {
    const id = Number(pair?.[`user_${side}_id`]);
    const quota = pair?.[`user_${side}_quota`];
    if (Number.isFinite(id) && quota && !quota.is_premium && quota.limit != null) {
      out.push({ id, quota });
    }
  }
  return out;
}

/** Map<responseId, number> — how many of these pairs include each free user. */
export function buildSelectedQuotaUsage(selectedPairs) {
  const counts = new Map();
  for (const pair of selectedPairs || []) {
    for (const { id } of pairLimitedUsers(pair)) {
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  return counts;
}

/**
 * Whether selecting `pair` would push a free user past their monthly limit,
 * given the batch usage already accumulated (NOT counting this pair).
 * @returns {{ id: number, quota: object, projected: number } | null} offending user, or null when OK.
 */
export function pairProjectedQuotaExceed(pair, usageExcludingPair) {
  for (const { id, quota } of pairLimitedUsers(pair)) {
    const alreadySelected = usageExcludingPair?.get(id) || 0;
    const projected = (quota.used || 0) + alreadySelected + 1;
    if (projected > quota.limit) {
      return { id, quota, projected };
    }
  }
  return null;
}

export function countAutomationPairsBySent(pairs, { hideQuotaFull = false, premiumOnly = false } = {}) {
  const list = (pairs || []).filter((pair) => {
    if (premiumOnly && !pair.has_premium) return false;
    if (!hideQuotaFull) return true;
    return !(pair.quota_blocked && !isAutomationPairSent(pair));
  });
  //「未發送」count matches filterVisibleAutomationPairs(sentFilter:'unsent'):
  // exclude successful sent_matches AND conduct-suspended pairs.
  const unsent = list.filter((p) => !isAutomationPairSent(p) && !pairFailsConduct(p)).length;
  const sent = list.filter((p) => isAutomationPairSent(p)).length;
  return {
    unsent,
    sent,
    all: list.length,
  };
}

