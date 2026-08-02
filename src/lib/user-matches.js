/**
 * Load matches for a user.
 * Passport Echo (`responsesOnly`): live scan of `responses` only.
 * Free / delivered: inbox + sent_matches.
 * Premium list also includes computed pairs ≥ PREMIUM_MATCH_MIN_SCORE when discovery is on
 * without responsesOnly (legacy merge path).
 */

import { isLegacySoloMatchThread, isSoloMatchPayload, soloPartnerResponseId } from './inbox-solo-anchor.js';
import { passesHardFilter } from './matching.js';
import { computeCompatibility } from './intelligence.js';
import {
  dedupeMatchesByPartnerPerson,
  matchPartnerPersonKey,
  normalizeEmailForPersonKey,
  personKeyForResponse,
  responseEmailMatchOrParts,
} from './response-dedupe.js';
import { isSuccessfulSentMatchNote } from './match-sent-record.js';

export const PREMIUM_MATCH_MIN_SCORE = 60;
/** Batch size when scanning responses for premium discovery. */
export const DISCOVER_BATCH_SIZE = 500;
/**
 * Soft ceiling on rows scanned (newest first). Kept high so Passport「即時連線」
 * covers the same candidate pool email-automation uses — a low cap caused ≥60%
 * pairs (esp. older / 單檔 rows) to appear in admin but not on echo.html.
 */
export const DISCOVER_MAX_SCAN = 50000;

/** Coerce responses.id (PostgREST may return string) to a positive int. */
export function toResponseId(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function emailNotifiedFromSentRow(notes) {
  return isSuccessfulSentMatchNote(notes);
}

/**
 * All response ids for the same person (incl. superseded), for sent_matches lookup.
 * Does not create or mutate rows.
 */
async function loadSiblingResponseIds(admin, responseId) {
  const id = toResponseId(responseId);
  if (!id) return [];

  const { data: row } = await admin
    .from('responses')
    .select('id, user_id, email, normalized_email')
    .eq('id', id)
    .maybeSingle();
  if (!row) return [];

  const orParts = [];
  if (row.user_id) orParts.push(`user_id.eq.${row.user_id}`);
  orParts.push(...responseEmailMatchOrParts(row.normalized_email || row.email));
  if (!orParts.length) return [id];

  const { data: siblings } = await admin
    .from('responses')
    .select('id')
    .or(orParts.join(','));

  const ids = [...new Set((siblings || []).map((r) => toResponseId(r.id)).filter(Boolean))];
  return ids.length ? ids : [id];
}

/**
 * Map any historical responses.id → that person's latest non-duplicate row.
 * Used when someone registered / resubmitted after a match was listed.
 */
export async function resolveLatestActiveResponseId(admin, responseId) {
  const id = toResponseId(responseId);
  if (!id) return null;

  const { data: row } = await admin
    .from('responses')
    .select('id, user_id, email, normalized_email')
    .eq('id', id)
    .maybeSingle();
  if (!row) return null;

  const orParts = [];
  if (row.user_id) orParts.push(`user_id.eq.${row.user_id}`);
  orParts.push(...responseEmailMatchOrParts(row.normalized_email || row.email));
  if (!orParts.length) return id;

  const { data: latest } = await admin
    .from('responses')
    .select('id')
    .or(orParts.join(','))
    .or('claim_status.neq.duplicate,claim_status.is.null')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return toResponseId(latest?.id) || id;
}

async function userHasSubmitted(admin, userId, userEmail) {
  const orParts = [`user_id.eq.${userId}`];
  orParts.push(...responseEmailMatchOrParts(userEmail));

  const { data } = await admin
    .from('responses')
    .select('id')
    .or(orParts.join(','))
    .or('claim_status.neq.duplicate,claim_status.is.null')
    .limit(1)
    .maybeSingle();

  return !!data;
}

export async function loadUserResponseIds(admin, userId, userEmail) {
  const orParts = [`user_id.eq.${userId}`];
  orParts.push(...responseEmailMatchOrParts(userEmail));

  const { data } = await admin
    .from('responses')
    .select('id')
    .or(orParts.join(','))
    .or('claim_status.neq.duplicate,claim_status.is.null')
    .order('created_at', { ascending: false });

  // Newest first: callers treat ids[0] as this person's latest submission.
  return (data || []).map((r) => toResponseId(r.id)).filter(Boolean);
}

async function enrichOtherUsers(admin, userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  const profileById = {};
  const mirrorByUserId = {};

  if (!ids.length) return { profileById, mirrorByUserId };

  const [{ data: profiles }, { data: mirrorCards }] = await Promise.all([
    admin.from('profiles').select('id, display_name').in('id', ids),
    admin.from('mirror_cards').select('user_id, slug').in('user_id', ids),
  ]);

  for (const p of profiles || []) profileById[p.id] = p;
  for (const mc of mirrorCards || []) mirrorByUserId[mc.user_id] = mc.slug;

  return { profileById, mirrorByUserId };
}

async function loadInboxMatches(admin, userId, myResponseIds) {
  const { data: threads, error: threadsError } = await admin
    .from('inbox_threads')
    .select('id, participant_a, participant_b, source_id, last_message_at, created_at')
    .eq('source_type', 'match')
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
    .order('last_message_at', { ascending: false });

  if (threadsError || !threads?.length) return [];

  const threadIds = threads.map((t) => t.id);
  const { data: cards, error: cardsError } = await admin
    .from('inbox_messages')
    .select('thread_id, payload, created_at')
    .eq('message_type', 'match_card')
    .eq('recipient_id', userId)
    .in('thread_id', threadIds);

  if (cardsError) return [];

  const cardByThread = Object.fromEntries((cards || []).map((c) => [c.thread_id, c]));
  const qualifying = threads.filter((t) => cardByThread[t.id]);

  if (!qualifying.length) return [];

  const otherIds = qualifying.map((t) =>
    t.participant_a === userId ? t.participant_b : t.participant_a
  );
  const { profileById, mirrorByUserId } = await enrichOtherUsers(admin, otherIds);

  const responseByUserId = {};
  const uniqueOtherIds = [...new Set(otherIds.filter(Boolean))];
  if (uniqueOtherIds.length) {
    const { data: partnerRows } = await admin
      .from('responses')
      .select('id, user_id, identity')
      .in('user_id', uniqueOtherIds)
      .or('claim_status.neq.duplicate,claim_status.is.null')
      .order('created_at', { ascending: false });
    for (const row of partnerRows || []) {
      if (row.user_id && !responseByUserId[row.user_id]) {
        responseByUserId[row.user_id] = row;
      }
    }
  }

  const defaultMyId = myResponseIds[0] || null;
  const myIdSet = new Set((myResponseIds || []).map(Number));

  const soloPartnerIds = [];
  for (const t of qualifying) {
    const card = cardByThread[t.id];
    if (!isSoloMatchPayload(card?.payload) && !isLegacySoloMatchThread(t)) continue;
    const partnerId = soloPartnerResponseId(card.payload, myResponseIds);
    if (partnerId) soloPartnerIds.push(partnerId);
  }
  const soloNameById = {};
  if (soloPartnerIds.length) {
    const { data: soloRows } = await admin
      .from('responses')
      .select('id, name')
      .in('id', [...new Set(soloPartnerIds)]);
    for (const row of soloRows || []) soloNameById[row.id] = row.name;
  }

  return qualifying.map((t) => {
    const card = cardByThread[t.id];
    const otherId = t.participant_a === userId ? t.participant_b : t.participant_a;
    const isSolo = isSoloMatchPayload(card.payload) || isLegacySoloMatchThread(t);
    const rA = Number(card.payload?.response_a_id);
    const rB = Number(card.payload?.response_b_id);
    const payloadPartnerId = myIdSet.has(rA) ? rB : myIdSet.has(rB) ? rA : null;
    const partnerRow = !isSolo && otherId ? responseByUserId[otherId] : null;
    const partnerResponseId = isSolo
      ? soloPartnerResponseId(card.payload, myResponseIds)
      : (partnerRow?.id || payloadPartnerId || null);
    const profile = isSolo ? {} : (profileById[otherId] || {});
    const rawScore = card.payload?.match_score;
    return {
      thread_id: t.id,
      my_response_id: myIdSet.has(rA) ? rA : myIdSet.has(rB) ? rB : defaultMyId,
      partner_response_id: partnerResponseId,
      match_score: rawScore == null ? null : Number(rawScore),
      match_summary: card.payload?.match_summary || {},
      matched_at: card.created_at || t.last_message_at,
      source: 'inbox',
      email_notified: false,
      other_user: {
        user_id: isSolo ? null : otherId,
        display_name: (isSolo && partnerResponseId ? soloNameById[partnerResponseId] : null)
          || profile.display_name
          || '神秘貓咪',
        mirror_card_slug: isSolo ? null : (mirrorByUserId[otherId] || null),
        identity: partnerRow?.identity || null,
      },
    };
  });
}

async function loadSentMatches(admin, userId, userEmail, myResponseIds) {
  const ids = (myResponseIds || await loadUserResponseIds(admin, userId, userEmail))
    .map(toResponseId)
    .filter(Boolean);
  if (!ids.length) return [];

  // Expand to historical response ids so sent_matches written before a resubmit
  // still resolve (rows store the id current at send time).
  const siblingLists = await Promise.all(ids.map((id) => loadSiblingResponseIds(admin, id)));
  const queryIds = [...new Set(siblingLists.flat().concat(ids))];
  const myIdSet = new Set(queryIds);

  const [{ data: sentAsA, error: errA }, { data: sentAsB, error: errB }] = await Promise.all([
    admin
      .from('sent_matches')
      .select('user_a_id, user_b_id, match_score, notes, sent_at')
      .in('user_a_id', queryIds),
    admin
      .from('sent_matches')
      .select('user_a_id, user_b_id, match_score, notes, sent_at')
      .in('user_b_id', queryIds),
  ]);

  if (errA || errB) return [];

  const sentRows = [...(sentAsA || []), ...(sentAsB || [])];
  const seenPairs = new Set();
  const uniqueSentRows = sentRows.filter((row) => {
    const a = toResponseId(row.user_a_id);
    const b = toResponseId(row.user_b_id);
    if (!a || !b) return false;
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    if (seenPairs.has(key)) return false;
    seenPairs.add(key);
    return true;
  });

  if (!uniqueSentRows.length) return [];

  const partnerResponseIds = uniqueSentRows.map((row) => {
    const a = toResponseId(row.user_a_id);
    const b = toResponseId(row.user_b_id);
    return myIdSet.has(a) ? b : a;
  });

  const { data: partnerResponses } = await admin
    .from('responses')
    .select('id, name, user_id, identity, email, normalized_email')
    .in('id', [...new Set(partnerResponseIds)]);

  const responseById = Object.fromEntries(
    (partnerResponses || []).map((r) => [toResponseId(r.id), r]),
  );
  const partnerUserIds = (partnerResponses || []).map((r) => r.user_id).filter(Boolean);
  const { profileById, mirrorByUserId } = await enrichOtherUsers(admin, partnerUserIds);

  const results = [];

  for (const row of uniqueSentRows) {
    const a = toResponseId(row.user_a_id);
    const b = toResponseId(row.user_b_id);
    const partnerResponseId = myIdSet.has(a) ? b : a;
    const myResponseId = myIdSet.has(a) ? a : b;
    const partner = responseById[partnerResponseId];
    if (!partner) continue;

    // Always map to latest active row for the same email / user_id.
    const latestPartnerId = (await resolveLatestActiveResponseId(admin, partnerResponseId))
      || partnerResponseId;

    const profile = partner.user_id ? profileById[partner.user_id] : null;
    const displayName = profile?.display_name || partner.name || '神秘貓咪';

    results.push({
      my_response_id: myResponseId,
      partner_response_id: latestPartnerId,
      thread_id: null,
      match_score: row.match_score == null ? null : Number(row.match_score),
      match_summary: {},
      matched_at: row.sent_at || null,
      source: 'email',
      email_notified: emailNotifiedFromSentRow(row.notes),
      other_user: {
        user_id: partner.user_id || null,
        display_name: displayName,
        mirror_card_slug: partner.user_id ? (mirrorByUserId[partner.user_id] || null) : null,
        identity: partner.identity || null,
        email: partner.email || partner.normalized_email || null,
      },
    });
  }

  return results;
}

function mergeMatches(inboxMatches, sentMatches) {
  const results = inboxMatches.map((m) => ({ ...m }));
  const seenResponseIds = new Set();

  for (const sent of sentMatches) {
    const uid = sent.other_user?.user_id;
    const rid = sent.partner_response_id;

    if (uid) {
      const existing = results.find((m) => m.other_user?.user_id === uid);
      if (existing) {
        existing.email_notified = sent.email_notified;
        if (existing.match_score == null && sent.match_score != null) {
          existing.match_score = sent.match_score;
        }
        if (!existing.matched_at && sent.matched_at) {
          existing.matched_at = sent.matched_at;
        }
        if (!existing.partner_response_id && sent.partner_response_id) {
          existing.partner_response_id = sent.partner_response_id;
        }
        if (!existing.my_response_id && sent.my_response_id) {
          existing.my_response_id = sent.my_response_id;
        }
        continue;
      }
    }

    if (rid) {
      const existingByRid = results.find((m) => m.partner_response_id === rid);
      if (existingByRid) {
        existingByRid.email_notified = sent.email_notified;
        if (existingByRid.match_score == null && sent.match_score != null) {
          existingByRid.match_score = sent.match_score;
        }
        continue;
      }
      if (seenResponseIds.has(rid)) continue;
      seenResponseIds.add(rid);
    }

    results.push({ ...sent });
  }

  return results;
}

async function enrichMatchScores(admin, userId, userEmail, matches, myResponseIds) {
  if (!matches.length) return matches;

  const ids = myResponseIds || await loadUserResponseIds(admin, userId, userEmail);
  if (!ids.length) return matches;

  const defaultMyId = ids[0];
  const needsScore = matches.filter(
    (m) => m.match_score == null || !Object.keys(m.match_summary || {}).length
  );

  const missingUserIds = [
    ...new Set(
      matches
        .filter((m) => !m.partner_response_id && m.other_user?.user_id)
        .map((m) => m.other_user.user_id)
    ),
  ];

  if (missingUserIds.length) {
    const { data: partnerRows } = await admin
      .from('responses')
      .select('id, user_id')
      .in('user_id', missingUserIds)
      .or('claim_status.neq.duplicate,claim_status.is.null')
      .order('created_at', { ascending: false });

    const byUserId = {};
    for (const row of partnerRows || []) {
      if (row.user_id && !byUserId[row.user_id]) byUserId[row.user_id] = row.id;
    }

    for (const match of matches) {
      if (!match.partner_response_id && match.other_user?.user_id) {
        match.partner_response_id = byUserId[match.other_user.user_id] || null;
      }
    }
  }

  for (const match of matches) {
    if (!match.my_response_id) match.my_response_id = defaultMyId;
  }

  if (!needsScore.length) {
    matches.sort((a, b) => {
      const sa = a.match_score ?? -1;
      const sb = b.match_score ?? -1;
      return sb - sa;
    });
    return matches;
  }

  const responseIds = new Set(ids);
  for (const match of needsScore) {
    responseIds.add(match.my_response_id);
    if (match.partner_response_id) responseIds.add(match.partner_response_id);
  }

  const { data: rows } = await admin
    .from('responses')
    .select('*')
    .in('id', [...responseIds]);

  const byId = Object.fromEntries((rows || []).map((r) => [r.id, r]));

  for (const match of matches) {
    const partnerRow = match.partner_response_id ? byId[match.partner_response_id] : null;
    if (partnerRow && match.other_user) {
      match.other_user.identity = partnerRow.identity || null;
    }
  }

  for (const match of needsScore) {
    const myRow = byId[match.my_response_id];
    const partnerRow = match.partner_response_id ? byId[match.partner_response_id] : null;
    if (!myRow || !partnerRow) continue;

    const intel = computeCompatibility(myRow, partnerRow);
    if (match.match_score == null) {
      match.match_score = intel.finalScore;
    }
    if (!Object.keys(match.match_summary || {}).length && intel.summary) {
      match.match_summary = intel.summary;
    }
  }

  matches.sort((a, b) => {
    const sa = a.match_score ?? -1;
    const sb = b.match_score ?? -1;
    return sb - sa;
  });

  return matches;
}

async function discoverPremiumMatches(admin, userId, userEmail, existingMatches, myResponseIds) {
  const ids = (myResponseIds || await loadUserResponseIds(admin, userId, userEmail))
    .map(toResponseId)
    .filter(Boolean);
  if (!ids.length) return [];

  const myIdSet = new Set(ids);
  const knownPartners = new Set(
    existingMatches.map((m) => toResponseId(m.partner_response_id)).filter(Boolean),
  );
  const knownPartnerUsers = new Set(
    existingMatches.map((m) => m.other_user?.user_id).filter(Boolean),
  );

  const excludeIds = [...ids, ...knownPartners];

  // Match using only the viewer's latest submission (ids are newest-first).
  const latestMyId = ids[0];
  const { data: myRows } = await admin.from('responses').select('*').eq('id', latestMyId);
  if (!myRows?.length) return [];
  const myKey = personKeyForResponse(myRows[0]);

  const discovered = [];
  const seenPartners = new Set(knownPartners);
  const seenPartnerUsers = new Set(knownPartnerUsers);
  // Skip older duplicate submissions of a person we've already considered
  // (candidates are scanned newest-first, so the latest wins).
  const seenPartnerKeys = new Set();
  if (myKey) seenPartnerKeys.add(myKey);

  // Seed person keys from inbox/sent partners so a newer duplicate-email row
  // cannot appear as a second Echo connection for the same person.
  if (knownPartners.size) {
    const { data: existingPartnerRows } = await admin
      .from('responses')
      .select('id, email, normalized_email, user_id')
      .in('id', [...knownPartners]);
    for (const r of existingPartnerRows || []) {
      const key = personKeyForResponse(r);
      if (key) seenPartnerKeys.add(key);
    }
  }

  let offset = 0;
  while (offset < DISCOVER_MAX_SCAN) {
    const rangeEnd = Math.min(offset + DISCOVER_BATCH_SIZE - 1, DISCOVER_MAX_SCAN - 1);
    let candidateQuery = admin
      .from('responses')
      .select('*')
      .or('claim_status.neq.duplicate,claim_status.is.null')
      .or('conduct_score.gte.50,conduct_score.is.null')
      // Include unclaimed rows (user_id IS NULL). Plain `.neq('user_id', me)` drops
      // NULLs in PostgREST/SQL, which hid「單檔」partners from Passport echo while
      // email-automation still listed them.
      .or(`user_id.is.null,user_id.neq.${userId}`)
      .order('created_at', { ascending: false })
      .range(offset, rangeEnd);

    if (excludeIds.length) {
      candidateQuery = candidateQuery.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data: candidateRows } = await candidateQuery;
    if (!candidateRows?.length) break;

    const candidates = candidateRows.filter((r) => !myIdSet.has(toResponseId(r.id)));

    for (const myRow of myRows) {
      for (const candidate of candidates) {
        if (candidate.user_id && candidate.user_id === userId) continue;
        const candidateId = toResponseId(candidate.id);
        if (candidateId && seenPartners.has(candidateId)) continue;
        if (candidate.user_id && seenPartnerUsers.has(candidate.user_id)) continue;
        // Candidates are newest-first: the first row per person is their latest.
        // Mark the person seen immediately so any older same-email submission is
        // ignored, even if this latest row is filtered out or scores too low.
        const candidateKey = personKeyForResponse(candidate);
        if (!candidateKey || seenPartnerKeys.has(candidateKey)) continue;
        seenPartnerKeys.add(candidateKey);
        if (!passesHardFilter(myRow, candidate)) continue;

        const intel = computeCompatibility(myRow, candidate);
        if (intel.finalScore < PREMIUM_MATCH_MIN_SCORE) continue;

        if (candidateId) seenPartners.add(candidateId);
        if (candidate.user_id) seenPartnerUsers.add(candidate.user_id);
        discovered.push({
          my_response_id: myRow.id,
          partner_response_id: candidate.id,
          thread_id: null,
          match_score: intel.finalScore,
          match_summary: intel.summary || {},
          matched_at: null,
          source: 'computed',
          email_notified: false,
          other_user: {
            user_id: candidate.user_id || null,
            display_name: candidate.name || '神秘貓咪',
            mirror_card_slug: null,
            identity: candidate.identity || null,
          },
        });
      }
    }

    offset += candidateRows.length;
    if (candidateRows.length < DISCOVER_BATCH_SIZE) break;
  }

  if (!discovered.length) return discovered;

  const partnerUserIds = discovered.map((d) => d.other_user.user_id).filter(Boolean);
  const { profileById, mirrorByUserId } = await enrichOtherUsers(admin, partnerUserIds);

  for (const match of discovered) {
    const uid = match.other_user.user_id;
    if (uid && profileById[uid]?.display_name) {
      match.other_user.display_name = profileById[uid].display_name;
    }
    if (uid && mirrorByUserId[uid]) {
      match.other_user.mirror_card_slug = mirrorByUserId[uid];
    }
  }

  return discovered;
}

function filterPremiumMatches(matches) {
  return matches.filter(
    (m) => m.match_score != null && Number(m.match_score) >= PREMIUM_MATCH_MIN_SCORE
  );
}

/**
 * Overlay email_notified (+ optional sent score) from sent_matches onto Echo list.
 * Does not add/remove partners — only annotates rows already from `responses`.
 *
 * Looks up sent_matches from BOTH sides (viewer siblings + partner siblings) so a
 * pair still marks「已通知」when the id stored at send time is an older questionnaire
 * row, or when the viewer's email/user_id remapping alone would miss the row.
 */
async function annotateEmailNotifiedFromSentMatches(
  admin,
  userId,
  userEmail,
  matches,
  myResponseIds,
) {
  if (!matches?.length) return matches;

  const myIds = (myResponseIds || [])
    .map(toResponseId)
    .filter(Boolean);
  if (!myIds.length) return matches;

  const mySibLists = await Promise.all(myIds.map((id) => loadSiblingResponseIds(admin, id)));
  const myIdSet = new Set(mySibLists.flat().concat(myIds));

  const partnerIds = [
    ...new Set(matches.map((m) => toResponseId(m.partner_response_id)).filter(Boolean)),
  ];
  const partnerSibLists = await Promise.all(
    partnerIds.map((id) => loadSiblingResponseIds(admin, id)),
  );
  const partnerIdSet = new Set(partnerSibLists.flat().concat(partnerIds));

  const myIdList = [...myIdSet];
  const partnerIdList = [...partnerIdSet];
  if (!partnerIdList.length) return matches;

  const [
    { data: sentMeA },
    { data: sentMeB },
    { data: sentPaA },
    { data: sentPaB },
  ] = await Promise.all([
    admin
      .from('sent_matches')
      .select('user_a_id, user_b_id, match_score, notes, sent_at')
      .in('user_a_id', myIdList),
    admin
      .from('sent_matches')
      .select('user_a_id, user_b_id, match_score, notes, sent_at')
      .in('user_b_id', myIdList),
    admin
      .from('sent_matches')
      .select('user_a_id, user_b_id, match_score, notes, sent_at')
      .in('user_a_id', partnerIdList),
    admin
      .from('sent_matches')
      .select('user_a_id, user_b_id, match_score, notes, sent_at')
      .in('user_b_id', partnerIdList),
  ]);

  const seenPairs = new Set();
  const sentRows = [];
  for (const row of [
    ...(sentMeA || []),
    ...(sentMeB || []),
    ...(sentPaA || []),
    ...(sentPaB || []),
  ]) {
    const a = toResponseId(row.user_a_id);
    const b = toResponseId(row.user_b_id);
    if (!a || !b) continue;
    if (!emailNotifiedFromSentRow(row.notes)) continue;
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    sentRows.push(row);
  }
  if (!sentRows.length) return matches;

  const involvedIds = [
    ...new Set(
      sentRows.flatMap((row) => [
        toResponseId(row.user_a_id),
        toResponseId(row.user_b_id),
      ]).filter(Boolean),
    ),
  ];
  const loadIds = [...new Set([...involvedIds, ...myIdList, ...partnerIdList])];
  const { data: responseRows } = await admin
    .from('responses')
    .select('id, email, normalized_email, user_id')
    .in('id', loadIds);
  const byId = Object.fromEntries(
    (responseRows || []).map((r) => [toResponseId(r.id), r]),
  );

  const myPersonKeys = new Set();
  for (const id of myIdList) {
    const pk = personKeyForResponse(byId[id]);
    if (pk) myPersonKeys.add(pk);
  }
  if (userId) myPersonKeys.add(`uid:${userId}`);
  const myEmail = normalizeEmailForPersonKey(userEmail);
  if (myEmail) myPersonKeys.add(`email:${myEmail}`);

  function sideIsMe(responseId) {
    if (myIdSet.has(responseId)) return true;
    const row = byId[responseId];
    const pk = personKeyForResponse(row);
    if (pk && myPersonKeys.has(pk)) return true;
    if (row?.user_id && row.user_id === userId) return true;
    return false;
  }

  /** @type {Map<string, { score: number|null }>} */
  const notifiedByKey = new Map();

  function markPartner(partnerResponseId, score) {
    const info = { score: score != null ? Number(score) : null };
    const rid = toResponseId(partnerResponseId);
    if (!rid) return;
    notifiedByKey.set(`rid:${rid}`, info);
    const row = byId[rid];
    const pk = personKeyForResponse(row);
    if (pk) notifiedByKey.set(pk, info);
    if (row?.user_id) notifiedByKey.set(`uid:${row.user_id}`, info);
  }

  for (const row of sentRows) {
    const a = toResponseId(row.user_a_id);
    const b = toResponseId(row.user_b_id);
    const aIsMe = sideIsMe(a);
    const bIsMe = sideIsMe(b);
    if (aIsMe === bIsMe) continue; // neither or both — not a Circle↔partner send
    const partnerRid = aIsMe ? b : a;
    // Only annotate partners that appear (or are siblings of someone) on this Echo list.
    if (!partnerIdSet.has(partnerRid) && !byId[partnerRid]) continue;
    markPartner(partnerRid, row.match_score);
    for (const sid of await loadSiblingResponseIds(admin, partnerRid)) {
      markPartner(sid, row.match_score);
      partnerIdSet.add(sid);
    }
  }

  if (!notifiedByKey.size) return matches;

  for (const match of matches) {
    const key = matchPartnerPersonKey(match, byId);
    const uid = match.other_user?.user_id;
    const rid = toResponseId(match.partner_response_id);
    const hit = (key && notifiedByKey.get(key))
      || (uid && notifiedByKey.get(`uid:${uid}`))
      || (rid && notifiedByKey.get(`rid:${rid}`))
      || null;
    if (!hit) continue;
    match.email_notified = true;
    if (hit.score != null) match.sent_match_score = hit.score;
  }

  return matches;
}

/**
 * Fast path for match card: verify a single pair without scanning all responses.
 * Resolves stale questionnaire ids (register / resubmit) to the same person's
 * latest row — never inserts duplicate match records.
 *
 * Echo list can show an Inbox-stored score while live recompute on the latest
 * questionnaire dips below 60 — still authorize via Inbox / sent_matches so the
 * drawer never says「Match not found」for a row that is already on the list.
 */
export async function loadAuthorizedMatchPair(
  admin,
  userId,
  userEmail,
  myResponseId,
  partnerResponseId,
  myResponseIds = null,
  opts = {},
) {
  const listedMyId = toResponseId(myResponseId);
  const listedPartnerId = toResponseId(partnerResponseId);
  if (!listedPartnerId) return null;

  const ids = (myResponseIds || await loadUserResponseIds(admin, userId, userEmail))
    .map(toResponseId)
    .filter(Boolean);
  if (!ids.length) return null;

  let myId = listedMyId && ids.includes(listedMyId) ? listedMyId : ids[0];

  // Try the id Echo listed first, then the same person's latest active row.
  const latestPartnerId = await resolveLatestActiveResponseId(admin, listedPartnerId);
  const partnerCandidates = [];
  for (const pid of [listedPartnerId, latestPartnerId]) {
    if (pid && !partnerCandidates.includes(pid)) partnerCandidates.push(pid);
  }

  let best = null;
  for (const partnerId of partnerCandidates) {
    const got = await authorizeMatchPairOnce(
      admin,
      userId,
      myId,
      partnerId,
      ids,
      opts,
    );
    if (got) {
      // Prefer a pair that clears the live ≥60 bar; otherwise keep first authorized.
      if (got.intelligence?.finalScore >= PREMIUM_MATCH_MIN_SCORE) return got;
      if (!best) best = got;
    }
  }
  return best;
}

async function findInboxDeliveredScore(admin, userId, mySet, partnerSet) {
  const myList = [...mySet];
  const partnerList = [...partnerSet];
  if (!myList.length || !partnerList.length) return null;

  // Match cards store the response ids used at delivery time (may be pre-resubmit).
  const { data: cards } = await admin
    .from('inbox_messages')
    .select('payload')
    .eq('message_type', 'match_card')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(80);

  for (const card of cards || []) {
    const a = toResponseId(card.payload?.response_a_id);
    const b = toResponseId(card.payload?.response_b_id);
    if (!a || !b) continue;
    const hit = (mySet.has(a) && partnerSet.has(b)) || (mySet.has(b) && partnerSet.has(a));
    if (!hit) continue;
    const score = card.payload?.match_score;
    return {
      match_score: score == null ? null : Number(score),
    };
  }
  return null;
}

async function authorizeMatchPairOnce(admin, userId, myId, partnerId, myOwnedIds, opts) {
  const { data: rows, error } = await admin
    .from('responses')
    .select('*')
    .in('id', [myId, partnerId]);

  if (error || !rows?.length) return null;

  const myRow = rows.find((r) => toResponseId(r.id) === myId);
  const partnerRow = rows.find((r) => toResponseId(r.id) === partnerId);
  if (!myRow || !partnerRow) return null;
  if (partnerRow.user_id && partnerRow.user_id === userId) return null;
  if (!myOwnedIds.includes(myId)) return null;

  const [mySiblings, partnerSiblings] = await Promise.all([
    loadSiblingResponseIds(admin, myId),
    loadSiblingResponseIds(admin, partnerId),
  ]);
  const mySet = new Set(mySiblings.length ? mySiblings : [myId]);
  const partnerSet = new Set(partnerSiblings.length ? partnerSiblings : [partnerId]);

  let sentRow = null;
  const [{ data: sentAsA }, { data: sentAsB }] = await Promise.all([
    admin
      .from('sent_matches')
      .select('match_score, user_a_id, user_b_id')
      .in('user_a_id', [...mySet])
      .in('user_b_id', [...partnerSet]),
    admin
      .from('sent_matches')
      .select('match_score, user_a_id, user_b_id')
      .in('user_a_id', [...partnerSet])
      .in('user_b_id', [...mySet]),
  ]);
  sentRow = (sentAsA && sentAsA[0]) || (sentAsB && sentAsB[0]) || null;

  const intelligence = computeCompatibility(myRow, partnerRow);
  const liveOk = intelligence.finalScore >= PREMIUM_MATCH_MIN_SCORE;

  // Free (deliveredOnly): must exist in sent_matches / Inbox delivery tables.
  // Passport Echo: authorize from `responses` live score only — same bar as the list.
  let authorized = false;
  let score = intelligence.finalScore;
  if (opts.deliveredOnly) {
    const inboxDelivery = (!sentRow)
      ? await findInboxDeliveredScore(admin, userId, mySet, partnerSet)
      : null;
    authorized = !!(sentRow || inboxDelivery);
    if (sentRow?.match_score != null) score = Number(sentRow.match_score);
    else if (inboxDelivery?.match_score != null) score = Number(inboxDelivery.match_score);
  } else {
    authorized = liveOk;
    score = intelligence.finalScore;
  }
  if (!authorized) return null;

  return { myRow, partnerRow, intelligence, match_score: score };
}

/**
 * @param {{ includeDiscovery?: boolean, responsesOnly?: boolean }} [opts]
 *   includeDiscovery: scan `responses` for ≥60 pairs (Passport Echo).
 *   responsesOnly: when true with discovery, IGNORE inbox/sent_matches for the list
 *   so Echo is not polluted by historical delivery rows.
 *   Free users pass includeDiscovery:false — delivered tables only.
 */
export async function loadUserMatches(admin, userId, userEmail, opts = {}) {
  const includeDiscovery = opts.includeDiscovery !== false;
  const responsesOnly = opts.responsesOnly === true;

  const [has_submitted, myResponseIds] = await Promise.all([
    userHasSubmitted(admin, userId, userEmail),
    loadUserResponseIds(admin, userId, userEmail),
  ]);

  // Passport Echo: who appears = `responses` live scan only.
  // `sent_matches` only annotates「電郵通知」— never adds extra people to the list.
  if (includeDiscovery && responsesOnly) {
    const discovered = await discoverPremiumMatches(
      admin,
      userId,
      userEmail,
      [],
      myResponseIds,
    );
    const matches = filterPremiumMatches(discovered);
    await annotateEmailNotifiedFromSentMatches(
      admin,
      userId,
      userEmail,
      matches,
      myResponseIds,
    );
    matches.sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
    return { matches, has_submitted };
  }

  const [inboxMatches, sentMatches] = await Promise.all([
    loadInboxMatches(admin, userId, myResponseIds),
    loadSentMatches(admin, userId, userEmail, myResponseIds),
  ]);

  const merged = mergeMatches(inboxMatches, sentMatches);
  const enrichedMerged = await enrichMatchScores(admin, userId, userEmail, merged, myResponseIds);

  const combined = includeDiscovery
    ? filterPremiumMatches([
      ...enrichedMerged,
      ...(await discoverPremiumMatches(admin, userId, userEmail, enrichedMerged, myResponseIds)),
    ])
    : enrichedMerged;

  const partnerIds = [
    ...new Set(combined.map((m) => toResponseId(m.partner_response_id)).filter(Boolean)),
  ];
  let responseRowById = {};
  if (partnerIds.length) {
    const { data: partnerRows } = await admin
      .from('responses')
      .select('id, email, normalized_email, user_id')
      .in('id', partnerIds);
    responseRowById = Object.fromEntries(
      (partnerRows || []).map((r) => [toResponseId(r.id), r]),
    );
  }

  const matches = dedupeMatchesByPartnerPerson(combined, responseRowById);
  matches.sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
  return { matches, has_submitted };
}
