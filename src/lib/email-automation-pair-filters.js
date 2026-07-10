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
