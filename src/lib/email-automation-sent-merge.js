/**
 * Ensure successful sent_matches still show on the email-automation list
 * even when the live pair no longer clears minScore / hard filters.
 * Also helps annotate live pairs as already-sent via person keys when
 * response ids were remapped after resubmit.
 */

import { personKeyForResponse } from './response-dedupe.js';

/** @param {(a: number, b: number) => [number, number]} normalisePair */
export function listMissingSuccessfulSentPairs(existingPairKeys, successfulSentRows, normalisePair) {
  const missing = [];
  const seen = new Set();
  for (const row of successfulSentRows || []) {
    const rawA = Number(row.user_a_id);
    const rawB = Number(row.user_b_id);
    if (!Number.isFinite(rawA) || !Number.isFinite(rawB)) continue;
    const [a, b] = normalisePair(rawA, rawB);
    if (a === b) continue;
    const key = `${a}:${b}`;
    if (existingPairKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    missing.push({ key, user_a_id: a, user_b_id: b, row });
  }
  return missing;
}

export function buildAutomationUserStub(responseRow) {
  if (!responseRow) return null;
  return {
    id: responseRow.id,
    name: responseRow.name,
    identity: responseRow.identity,
    ig_username: responseRow.ig_username,
    email: responseRow.email,
    user_id: responseRow.user_id || null,
    claimed: !!responseRow.user_id,
  };
}

/**
 * Build id→personKey and look up sent_matches by remapped response-id pair
 * AND by person-pair key (so resubmits don't reappear as「未發送」).
 *
 * @param {Array} identityRows  responses with id + email/user_id (incl. superseded)
 * @param {Array} successfulSentRows  already remapped to latest response ids when possible
 * @param {(a: number, b: number) => [number, number]} normalisePair
 */
export function buildSentMatchLookups(identityRows, successfulSentRows, normalisePair) {
  const idToPersonKey = new Map();
  for (const r of identityRows || []) {
    const id = Number(r.id);
    if (!Number.isFinite(id)) continue;
    const key = personKeyForResponse(r);
    if (key != null) idToPersonKey.set(id, key);
  }

  const resolvePersonPairKey = (idA, idB) => {
    const ka = idToPersonKey.get(Number(idA));
    const kb = idToPersonKey.get(Number(idB));
    if (ka == null || kb == null) return null;
    return ka <= kb ? `${ka}::${kb}` : `${kb}::${ka}`;
  };

  const sentMap = new Map();
  const sentPersonPairMap = new Map();
  for (const r of successfulSentRows || []) {
    const rawA = Number(r.user_a_id);
    const rawB = Number(r.user_b_id);
    if (!Number.isFinite(rawA) || !Number.isFinite(rawB)) continue;
    const [a, b] = normalisePair(rawA, rawB);
    const id = Number(r.id);
    if (!Number.isFinite(id)) continue;
    sentMap.set(`${a}:${b}`, id);
    const pk = resolvePersonPairKey(a, b);
    if (pk) sentPersonPairMap.set(pk, id);
  }

  const lookupSentMatchId = (idA, idB) => {
    const [a, b] = normalisePair(Number(idA), Number(idB));
    const byId = sentMap.get(`${a}:${b}`);
    if (byId != null) return byId;
    const pk = resolvePersonPairKey(a, b);
    if (pk != null && sentPersonPairMap.has(pk)) return sentPersonPairMap.get(pk);
    return null;
  };

  return { sentMap, sentPersonPairMap, resolvePersonPairKey, lookupSentMatchId };
}
