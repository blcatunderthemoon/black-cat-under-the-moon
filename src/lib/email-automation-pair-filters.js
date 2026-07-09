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

/** True when this exact pair exists in sent_matches (by sent_match_id). */
export function isAutomationPairSent(pair) {
  return pair?.sent_match_id != null;
}

export function filterVisibleAutomationPairs(pairs, { sentFilter = 'unsent', hideQuotaFull = true } = {}) {
  return (pairs || []).filter((pair) => {
    const sent = isAutomationPairSent(pair);
    if (sentFilter === 'unsent' && sent) return false;
    if (sentFilter === 'sent' && !sent) return false;
    if (hideQuotaFull && pair.quota_blocked && !sent) return false;
    return true;
  });
}

export function countAutomationPairsBySent(pairs, { hideQuotaFull = false } = {}) {
  const list = (pairs || []).filter((pair) => {
    if (!hideQuotaFull) return true;
    return !(pair.quota_blocked && !isAutomationPairSent(pair));
  });
  return {
    unsent: list.filter((p) => !isAutomationPairSent(p)).length,
    sent: list.filter((p) => isAutomationPairSent(p)).length,
    all: list.length,
  };
}
