/**
 * Canonical "latest questionnaire response per person" helpers.
 *
 * People frequently resubmit the Echo-mode questionnaire, producing several
 * `responses` rows for the same person (often the same email). Registration
 * linking, email automation, and Echo matching must all count ONLY the latest
 * submission and ignore older ones. These helpers give every consumer one
 * shared definition of "person identity" and "latest wins".
 *
 * A person is keyed by their email when present (stable across logged-in and
 * legacy rows for the same address), otherwise by user_id, otherwise the row is
 * treated as its own person.
 *
 * Doc (asymmetry Echo vs automation — do not reintroduce): 
 * docs/matching/PERSON-IDENTITY-AND-EMAIL-NORMALIZE.md
 */

/**
 * Canonical email for person keys + writes to `normalized_email`.
 * Lowercase, trim, strip trailing dots (typo: user@gmail.com.).
 * Email automation already groups via this; Echo DB lookups must use the same.
 */
export function normalizeEmailForPersonKey(email) {
  return String(email || '').toLowerCase().trim().replace(/\.+$/, '');
}

/**
 * Quote a filter value for PostgREST `.or()` / logical filters.
 * Emails always contain `.` (reserved); trailing `.` typos especially break
 * unquoted values (`user@gmail.com.` parsed as value + stray operator).
 */
export function quotePostgrestFilterValue(value) {
  return `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * PostgREST `.or(...)` fragments that match both canonical and legacy-stored forms.
 * Older rows may have trailing dots in `email` / `normalized_email` because submit
 * used to only lower+trim — automation still collapses those in memory, Echo must
 * query both spellings or sibling /「已通知」lookups miss.
 */
export function responseEmailMatchOrParts(email) {
  const key = normalizeEmailForPersonKey(email);
  if (!key) return [];
  const variants = new Set([key, `${key}.`]);
  const raw = String(email || '').toLowerCase().trim();
  if (raw) variants.add(raw);
  const parts = [];
  for (const v of variants) {
    const q = quotePostgrestFilterValue(v);
    parts.push(`normalized_email.eq.${q}`);
    parts.push(`email.ilike.${q}`);
  }
  return parts;
}

/** Stable identity key for grouping a person's response rows. */
export function personKeyForResponse(row) {
  if (!row) return null;
  const email = normalizeEmailForPersonKey(row.normalized_email || row.email);
  if (email) return `email:${email}`;
  if (row.user_id) return `uid:${row.user_id}`;
  const id = Number(row.id);
  if (Number.isFinite(id) && id > 0) return `rid:${id}`;
  return null;
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
 * Same-email rows (even if claim_status was never marked duplicate) collapse to one.
 */
export function pickLatestResponsesPerPerson(rows) {
  const latestByKey = new Map();
  for (const row of rows || []) {
    const key = personKeyForResponse(row);
    if (key == null) continue;
    const existing = latestByKey.get(key);
    if (!existing || isNewerResponse(row, existing)) {
      latestByKey.set(key, row);
    }
  }
  return [...latestByKey.values()];
}

/** IDs of the rows that are NOT the latest for their person (i.e. superseded). */
export function supersededResponseIds(rows) {
  const latestIds = new Set(pickLatestResponsesPerPerson(rows).map((r) => Number(r.id)));
  return (rows || [])
    .filter((r) => !latestIds.has(Number(r.id)))
    .map((r) => r.id);
}

/**
 * Partner identity for an Echo/list match row.
 * Prefer the responses row (email-first) so uid-linked + email-only rows merge.
 */
export function matchPartnerPersonKey(match, responseRowById = {}) {
  if (!match) return null;
  const rid = Number(match.partner_response_id);
  const row = Number.isFinite(rid) && rid > 0 ? responseRowById[rid] : null;
  if (row) return personKeyForResponse(row);
  const uid = match.other_user?.user_id;
  if (uid) return `uid:${uid}`;
  if (Number.isFinite(rid) && rid > 0) return `rid:${rid}`;
  return null;
}

function matchDeliveryRank(match) {
  if (match?.email_notified || match?.source === 'email') return 3;
  if (match?.source === 'inbox' || match?.thread_id) return 2;
  return 1;
}

/** Keep a single list row per partner person (prefer delivered, then higher score). */
export function dedupeMatchesByPartnerPerson(matches, responseRowById = {}) {
  const bestByKey = new Map();
  for (const match of matches || []) {
    const key = matchPartnerPersonKey(match, responseRowById);
    if (key == null) continue;
    const prev = bestByKey.get(key);
    if (!prev) {
      bestByKey.set(key, match);
      continue;
    }
    const ra = matchDeliveryRank(match);
    const rb = matchDeliveryRank(prev);
    if (ra !== rb) {
      if (ra > rb) bestByKey.set(key, match);
      continue;
    }
    const sa = match.match_score ?? -1;
    const sb = prev.match_score ?? -1;
    if (sa !== sb) {
      if (sa > sb) bestByKey.set(key, match);
      continue;
    }
    if (Number(match.partner_response_id || 0) > Number(prev.partner_response_id || 0)) {
      bestByKey.set(key, match);
    }
  }
  return [...bestByKey.values()];
}
