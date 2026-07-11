/**
 * Load matches for a user from inbox + sent_matches (email notifications).
 * Premium list also includes computed pairs ≥ PREMIUM_MATCH_MIN_SCORE.
 */

import { isLegacySoloMatchThread, isSoloMatchPayload, soloPartnerResponseId } from './inbox-solo-anchor.js';
import { passesHardFilter } from './matching.js';
import { computeCompatibility } from './intelligence.js';
import { personKeyForResponse } from './response-dedupe.js';

export const PREMIUM_MATCH_MIN_SCORE = 60;
/** Batch size when scanning responses for premium discovery. */
export const DISCOVER_BATCH_SIZE = 500;
/** Max rows to scan (newest first) — avoids missing older ≥60% pairs after a single-batch cap. */
export const DISCOVER_MAX_SCAN = 5000;

function emailNotifiedFromSentRow(notes) {
  if (!notes) return true;
  return !/失敗|failed/i.test(String(notes));
}

async function userHasSubmitted(admin, userId, userEmail) {
  const orParts = [`user_id.eq.${userId}`];
  const email = (userEmail || '').toLowerCase().trim();
  if (email) {
    orParts.push(`normalized_email.eq.${email}`);
    orParts.push(`email.ilike.${email}`);
  }

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
  const email = (userEmail || '').toLowerCase().trim();
  if (email) {
    orParts.push(`normalized_email.eq.${email}`);
    orParts.push(`email.ilike.${email}`);
  }

  const { data } = await admin
    .from('responses')
    .select('id')
    .or(orParts.join(','))
    .or('claim_status.neq.duplicate,claim_status.is.null')
    .order('created_at', { ascending: false });

  // Newest first: callers treat ids[0] as this person's latest submission.
  return (data || []).map((r) => r.id);
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
      .select('id, user_id')
      .in('user_id', uniqueOtherIds)
      .or('claim_status.neq.duplicate,claim_status.is.null');
    for (const row of partnerRows || []) {
      if (row.user_id && !responseByUserId[row.user_id]) {
        responseByUserId[row.user_id] = row.id;
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
    const partnerResponseId = isSolo
      ? soloPartnerResponseId(card.payload, myResponseIds)
      : (responseByUserId[otherId] || null);
    const profile = isSolo ? {} : (profileById[otherId] || {});
    const rawScore = card.payload?.match_score;
    const rA = Number(card.payload?.response_a_id);
    const rB = Number(card.payload?.response_b_id);
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
      },
    };
  });
}

async function loadSentMatches(admin, userId, userEmail, myResponseIds) {
  const ids = myResponseIds || await loadUserResponseIds(admin, userId, userEmail);
  if (!ids.length) return [];

  const [{ data: sentAsA, error: errA }, { data: sentAsB, error: errB }] = await Promise.all([
    admin
      .from('sent_matches')
      .select('user_a_id, user_b_id, match_score, notes, sent_at')
      .in('user_a_id', myResponseIds),
    admin
      .from('sent_matches')
      .select('user_a_id, user_b_id, match_score, notes, sent_at')
      .in('user_b_id', myResponseIds),
  ]);

  if (errA || errB) return [];

  const sentRows = [...(sentAsA || []), ...(sentAsB || [])];
  const seenPairs = new Set();
  const uniqueSentRows = sentRows.filter((row) => {
    const key = `${Math.min(row.user_a_id, row.user_b_id)}-${Math.max(row.user_a_id, row.user_b_id)}`;
    if (seenPairs.has(key)) return false;
    seenPairs.add(key);
    return true;
  });

  if (!uniqueSentRows.length) return [];

  const partnerResponseIds = uniqueSentRows.map((row) =>
    ids.includes(row.user_a_id) ? row.user_b_id : row.user_a_id
  );

  const { data: partnerResponses } = await admin
    .from('responses')
    .select('id, name, user_id, identity')
    .in('id', [...new Set(partnerResponseIds)]);

  const responseById = Object.fromEntries((partnerResponses || []).map((r) => [r.id, r]));
  const partnerUserIds = (partnerResponses || []).map((r) => r.user_id).filter(Boolean);
  const { profileById, mirrorByUserId } = await enrichOtherUsers(admin, partnerUserIds);

  const results = [];

  for (const row of uniqueSentRows) {
    const partnerResponseId = ids.includes(row.user_a_id) ? row.user_b_id : row.user_a_id;
    const myResponseId = ids.includes(row.user_a_id) ? row.user_a_id : row.user_b_id;
    const partner = responseById[partnerResponseId];
    if (!partner) continue;

    const profile = partner.user_id ? profileById[partner.user_id] : null;
    const displayName = profile?.display_name || partner.name || '神秘貓咪';

    results.push({
      my_response_id: myResponseId,
      partner_response_id: partnerResponseId,
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
      .or('claim_status.neq.duplicate,claim_status.is.null');

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
  const ids = myResponseIds || await loadUserResponseIds(admin, userId, userEmail);
  if (!ids.length) return [];

  const myIdSet = new Set(ids);
  const knownPartners = new Set(
    existingMatches.map((m) => m.partner_response_id).filter(Boolean)
  );
  const knownPartnerUsers = new Set(
    existingMatches.map((m) => m.other_user?.user_id).filter(Boolean)
  );

  const excludeIds = [...ids, ...knownPartners];

  // Match using only the viewer's latest submission (ids are newest-first).
  const latestMyId = ids[0];
  const { data: myRows } = await admin.from('responses').select('*').eq('id', latestMyId);
  if (!myRows?.length) return [];

  const discovered = [];
  const seenPartners = new Set(knownPartners);
  const seenPartnerUsers = new Set(knownPartnerUsers);
  // Skip older duplicate submissions of a person we've already considered
  // (candidates are scanned newest-first, so the latest wins).
  const seenPartnerKeys = new Set();

  let offset = 0;
  while (offset < DISCOVER_MAX_SCAN) {
    const rangeEnd = Math.min(offset + DISCOVER_BATCH_SIZE - 1, DISCOVER_MAX_SCAN - 1);
    let candidateQuery = admin
      .from('responses')
      .select('*')
      .or('claim_status.neq.duplicate,claim_status.is.null')
      .or('conduct_score.gte.50,conduct_score.is.null')
      .neq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, rangeEnd);

    if (excludeIds.length) {
      candidateQuery = candidateQuery.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data: candidateRows } = await candidateQuery;
    if (!candidateRows?.length) break;

    const candidates = candidateRows.filter((r) => !myIdSet.has(r.id));

    for (const myRow of myRows) {
      for (const candidate of candidates) {
        if (candidate.user_id && candidate.user_id === userId) continue;
        if (seenPartners.has(candidate.id)) continue;
        if (candidate.user_id && seenPartnerUsers.has(candidate.user_id)) continue;
        // Candidates are newest-first: the first row per person is their latest.
        // Mark the person seen immediately so any older submission is ignored,
        // even if this latest row is filtered out or scores too low.
        const candidateKey = personKeyForResponse(candidate);
        if (seenPartnerKeys.has(candidateKey)) continue;
        seenPartnerKeys.add(candidateKey);
        if (!passesHardFilter(myRow, candidate)) continue;

        const intel = computeCompatibility(myRow, candidate);
        if (intel.finalScore < PREMIUM_MATCH_MIN_SCORE) continue;

        seenPartners.add(candidate.id);
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
 * Fast path for match card: verify a single pair without scanning all responses.
 */
export async function loadAuthorizedMatchPair(admin, userId, userEmail, myResponseId, partnerResponseId, myResponseIds = null) {
  const myId = Number(myResponseId);
  const partnerId = Number(partnerResponseId);
  if (!myId || !partnerId) return null;

  const ids = myResponseIds || await loadUserResponseIds(admin, userId, userEmail);
  if (!ids.includes(myId)) return null;

  const { data: rows, error } = await admin
    .from('responses')
    .select('*')
    .in('id', [myId, partnerId]);

  if (error || !rows?.length) return null;

  const myRow = rows.find((r) => Number(r.id) === myId);
  const partnerRow = rows.find((r) => Number(r.id) === partnerId);
  if (!myRow || !partnerRow) return null;
  if (partnerRow.user_id && partnerRow.user_id === userId) return null;

  const [{ data: sentA }, { data: sentB }] = await Promise.all([
    admin
      .from('sent_matches')
      .select('match_score')
      .eq('user_a_id', myId)
      .eq('user_b_id', partnerId)
      .maybeSingle(),
    admin
      .from('sent_matches')
      .select('match_score')
      .eq('user_a_id', partnerId)
      .eq('user_b_id', myId)
      .maybeSingle(),
  ]);

  const sentRow = sentA || sentB;
  const intelligence = computeCompatibility(myRow, partnerRow);
  const authorized = !!sentRow || intelligence.finalScore >= PREMIUM_MATCH_MIN_SCORE;
  if (!authorized) return null;

  const score = sentRow?.match_score != null
    ? Number(sentRow.match_score)
    : intelligence.finalScore;

  return { myRow, partnerRow, intelligence, match_score: score };
}

export async function loadUserMatches(admin, userId, userEmail) {
  const [has_submitted, myResponseIds] = await Promise.all([
    userHasSubmitted(admin, userId, userEmail),
    loadUserResponseIds(admin, userId, userEmail),
  ]);

  const [inboxMatches, sentMatches] = await Promise.all([
    loadInboxMatches(admin, userId, myResponseIds),
    loadSentMatches(admin, userId, userEmail, myResponseIds),
  ]);

  const merged = mergeMatches(inboxMatches, sentMatches);

  const [discovered, enrichedMerged] = await Promise.all([
    discoverPremiumMatches(admin, userId, userEmail, merged, myResponseIds),
    enrichMatchScores(admin, userId, userEmail, merged, myResponseIds),
  ]);

  const matches = filterPremiumMatches([...enrichedMerged, ...discovered]);
  return { matches, has_submitted };
}
