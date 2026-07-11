/**
 * Canonical "latest questionnaire response per person" helpers.
 *
 * People frequently resubmit the Echo-mode questionnaire, producing several
 * `responses` rows for the same person. Registration linking, email automation,
 * and dashboard matching must all count ONLY the latest submission and ignore
 * the older ones. These helpers give every consumer one shared definition of
 * "person identity" and "latest wins" so behaviour stays consistent.
 *
 * A person is keyed by their email when present (stable across logged-in and
 * legacy rows for the same address), otherwise by user_id, otherwise the row is
 * treated as its own person.
 */

/** Stable identity key for grouping a person's response rows. */
export function personKeyForResponse(row) {
  if (!row) return null;
  const email = String(row.normalized_email || row.email || '').toLowerCase().trim();
  if (email) return `email:${email}`;
  if (row.user_id) return `uid:${row.user_id}`;
  return `rid:${row.id}`;
}

/** True when row `a` is a newer submission than row `b`. */
export function isNewerResponse(a, b) {
  const ta = a?.created_at ? Date.parse(a.created_at) : NaN;
  const tb = b?.created_at ? Date.parse(b.created_at) : NaN;
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta > tb;
  // Fallback when timestamps are missing/equal: higher id is newer.
  return Number(a?.id || 0) > Number(b?.id || 0);
}

/**
 * Reduce a list of response rows to the single latest submission per person.
 * Rows must include at least { id, created_at } plus email/user_id for keying.
 */
export function pickLatestResponsesPerPerson(rows) {
  const latestByKey = new Map();
  for (const row of rows || []) {
    const key = personKeyForResponse(row);
    const existing = latestByKey.get(key);
    if (!existing || isNewerResponse(row, existing)) {
      latestByKey.set(key, row);
    }
  }
  return [...latestByKey.values()];
}

/** IDs of the rows that are NOT the latest for their person (i.e. superseded). */
export function supersededResponseIds(rows) {
  const latestIds = new Set(pickLatestResponsesPerPerson(rows).map((r) => r.id));
  return (rows || []).filter((r) => !latestIds.has(r.id)).map((r) => r.id);
}
