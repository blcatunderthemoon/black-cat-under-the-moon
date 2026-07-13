/**
 * Bridge stored response ids to a person's *current* latest response id.
 *
 * `sent_matches` and `email_drafts` store whatever `responses.id` was current
 * when the record was written. People frequently resubmit the questionnaire,
 * which mints a NEW responses row (the old one is superseded / marked
 * duplicate). Email automation rebuilds its pair list from the latest response
 * per person, so a raw-id lookup against sent/draft records misses anyone who
 * resubmitted after being matched — the already-sent pair wrongly reappears as
 * "unsent" (and their monthly quota undercounts).
 *
 * This resolver maps ANY response id → the latest response id for the same
 * person (keyed by email, then user_id), so downstream matching is person-based
 * instead of row-based. See scripts + response-dedupe.js for the person key.
 */

import { personKeyForResponse } from './response-dedupe.js';

/**
 * @param {Array<{id: number|string, email?: string, normalized_email?: string, user_id?: string|null}>} allResponses
 *   Every responses row (INCLUDING superseded/duplicate) with id + keying fields.
 * @param {Array} latestResponses  Output of pickLatestResponsesPerPerson (canonical rows).
 * @returns {(id: number|string) => number} Resolver → latest id (falls back to the given id).
 */
export function buildLatestResponseIdResolver(allResponses, latestResponses) {
  const idToPersonKey = new Map();
  for (const r of allResponses || []) {
    idToPersonKey.set(Number(r.id), personKeyForResponse(r));
  }
  const personKeyToLatestId = new Map();
  for (const r of latestResponses || []) {
    personKeyToLatestId.set(personKeyForResponse(r), Number(r.id));
  }
  return (id) => {
    const num = Number(id);
    const key = idToPersonKey.get(num);
    if (key == null) return num;
    const latest = personKeyToLatestId.get(key);
    return latest != null ? latest : num;
  };
}

/**
 * Rewrite a record's user_a_id / user_b_id through the resolver so the pair is
 * expressed with each person's current latest response id.
 * @param {(id: number|string) => number} resolveLatestId
 * @param {{user_a_id: number|string, user_b_id: number|string}} row
 */
export function remapPairRowToLatest(resolveLatestId, row) {
  return {
    ...row,
    user_a_id: resolveLatestId(row.user_a_id),
    user_b_id: resolveLatestId(row.user_b_id),
  };
}
