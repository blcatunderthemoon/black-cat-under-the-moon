/**
 * /api/dashboard/email-automation
 *
 * Pair list source of truth (who appears / already sent):
 *   - `responses`  → live score + hard filters (latest row per email)
 *   - `sent_matches` → already_sent / quota used /「已發送」history
 *
 * Secondary annotation only (does NOT invent pairs):
 *   - `email_drafts` → in_draft badge
 *   - `subscriptions` → Passport / unlimited quota badges
 *
 * GET  ?mode=pairs&minScore=60  → pairs above threshold + annotations
 * GET  ?mode=drafts              → list email_drafts with user names
 * POST {action:'save_draft', pairs:[{userAId,userBId,match_score}]}
 *                                → upsert pairs into email_drafts
 * DELETE ?draftId=X              → remove single draft row
 */

import { createClient } from '@supabase/supabase-js';
import { passesHardFilter, passesConductFilter } from '../../../lib/matching.js';
import { computeCompatibility } from '../../../lib/intelligence.js';
import {
  buildMonthlyMatchCounts,
  getResponseMatchQuota,
} from '../../../lib/match-delivery-quota.js';
import { buildMatchResponsePremiumContext } from '../../../lib/match-response-premium.js';
import { filterSuccessfulSentRows, isFailedSentMatchNote } from '../../../lib/match-sent-record.js';
import { pairHasSameResponseEmail } from '../../../lib/match-response-auth.js';
import { pickLatestResponsesPerPerson } from '../../../lib/response-dedupe.js';
import { buildLatestResponseIdResolver, remapPairRowToLatest } from '../../../lib/match-person-remap.js';
import { fetchAllRows } from '../../../lib/supabase-fetch-all.js';
import { authorizeStationOrForumAdmin } from '../../../lib/station-or-forum-admin-auth.js';
import {
  buildAutomationUserStub,
  buildSentMatchLookups,
  listMissingSuccessfulSentPairs,
} from '../../../lib/email-automation-sent-merge.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

/** Normalise pair so the smaller ID is always user_a_id */
function normalisePair(a, b) {
  return a <= b ? [a, b] : [b, a];
}

// ── GET ──────────────────────────────────────────────────────────────────────
async function handleGet(req, res) {
  const mode = req.query.mode || 'pairs';

  // ── Mode: drafts ─────────────────────────────────────────────────────────
  if (mode === 'drafts') {
    const { data: drafts, error } = await supabase
      .from('email_drafts')
      .select('*')
      .order('created_at', { ascending: false });

    // If the table doesn't exist yet, return empty rather than 500
    if (error) {
      if (error.code === '42P01') return res.status(200).json({ drafts: [] });
      return res.status(500).json({ error: error.message });
    }
    if (!drafts || drafts.length === 0) return res.status(200).json({ drafts: [] });

    // Fetch user names / identity for display
    const userIds = [...new Set(drafts.flatMap((d) => [d.user_a_id, d.user_b_id]))];
    const { data: users } = await supabase
      .from('responses')
      .select('id, name, identity, ig_username, email')
      .in('id', userIds);

    const userMap = Object.fromEntries((users || []).map((u) => [u.id, u]));

    const enriched = drafts.map((d) => ({
      ...d,
      user_a: userMap[d.user_a_id] || null,
      user_b: userMap[d.user_b_id] || null,
    }));

    return res.status(200).json({ drafts: enriched });
  }

  // ── Mode: pairs (global) ─────────────────────────────────────────────────
  const minScore = req.query.minScore ? Number(req.query.minScore) : 60;
  const premiumOnly = req.query.premium_only === '1';

  // Paginate past PostgREST's 1000-row cap so matching sees every response.
  const { data: allUsers, error: usersError } = await fetchAllRows(() =>
    supabase
      .from('responses')
      .select('*')
      .or('claim_status.neq.duplicate,claim_status.is.null'),
  );

  if (usersError) return res.status(500).json({ error: usersError.message });

  // Same email (or same user_id) → one person. Always pair with the latest row only,
  // even when older copies were never marked claim_status=duplicate.
  const usersLatest = pickLatestResponsesPerPerson(allUsers || []);
  const excludedDuplicateCount = (allUsers || []).length - usersLatest.length;
  // Conduct < 50 (incl. 0) must not enter live pairing. Null score still counts as 100.
  // Keep usersLatest for historical「已發送」merge even when the live pool is tiny.
  const users = usersLatest.filter((u) => passesConductFilter(u));
  const excludedConductCount = usersLatest.length - users.length;

  // Fetch sent_matches, email_drafts and the full response identity index in
  // parallel for annotation. The identity index MUST include superseded/duplicate
  // rows so we can map old sent/draft response ids back to a person's latest row.
  const [sentResult, draftResult, allResponseKeysResult] = await Promise.all([
    fetchAllRows(() => supabase.from('sent_matches').select('id, user_a_id, user_b_id, match_score, sent_at, notes')),
    fetchAllRows(() => supabase.from('email_drafts').select('id, user_a_id, user_b_id')),
    fetchAllRows(() => supabase.from('responses').select('id, email, normalized_email, user_id')),
  ]);
  // Gracefully handle missing tables (code 42P01 = undefined_table)
  const rawSentRows  = (!sentResult.error  || sentResult.error.code  === '42P01') ? (sentResult.data  || []) : [];
  const rawDraftRows = (!draftResult.error || draftResult.error.code === '42P01') ? (draftResult.data || []) : [];

  // Sent/draft records store the response id that was current at send time. After
  // a person resubmits the questionnaire they get a NEW latest id, so match those
  // records by PERSON (latest id) — otherwise already-sent pairs wrongly reappear
  // as unsent and monthly quota undercounts. Falls back to raw ids when unknown.
  const identityRows = allResponseKeysResult.error
    ? (allUsers || [])
    : (allResponseKeysResult.data || []);
  const resolveLatestId = buildLatestResponseIdResolver(identityRows, usersLatest);
  const sentRows  = rawSentRows.map((r) => remapPairRowToLatest(resolveLatestId, r));
  const draftRows = rawDraftRows.map((r) => remapPairRowToLatest(resolveLatestId, r));
  const successfulSentRows = filterSuccessfulSentRows(sentRows);

  // Response-id pair + person-key pair → sent_matches.id (person key covers resubmits).
  const { lookupSentMatchId } = buildSentMatchLookups(
    identityRows,
    successfulSentRows,
    normalisePair,
  );
  // Failed attempts: a sent_matches row exists but its notes mark it as a failed
  // delivery. These are intentionally excluded from successful lookups so the pair
  // remains available for retry — we surface them via `last_send_failed`.
  const failedMap = new Map(
    sentRows
      .filter((r) => isFailedSentMatchNote(r.notes))
      .map((r) => {
        const [a, b] = normalisePair(Number(r.user_a_id), Number(r.user_b_id));
        return [`${a}:${b}`, { at: r.sent_at || null, notes: r.notes || null }];
      }),
  );
  const draftMap = new Map(
    (draftRows || []).map((r) => {
      const [a, b] = normalisePair(Number(r.user_a_id), Number(r.user_b_id));
      return [`${a}:${b}`, r.id];
    })
  );

  const monthlyMatchCounts = buildMonthlyMatchCounts(successfulSentRows);
  const premiumCtx = await buildMatchResponsePremiumContext(users);

  const quotaForResponse = (responseRow) =>
    getResponseMatchQuota(
      responseRow.id,
      responseRow.user_id || null,
      premiumCtx.tierByUserId,
      monthlyMatchCounts,
      { emailIsPremium: premiumCtx.isResponsePremium(responseRow) },
    );

  // Compute all unique pairs
  const pairs = [];
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const uA = users[i];
      const uB = users[j];

      if (!passesHardFilter(uA, uB)) continue;

      const result = computeCompatibility(uA, uB);
      if (!result?.match) continue;

      const { finalScore, dimensionScores } = result;
      if (finalScore < minScore) continue;

      const [normA, normB] = normalisePair(Number(uA.id), Number(uB.id));
      const pairKey = `${normA}:${normB}`;

      // `normalisePair` may swap so the smaller id is user_a. Align every side-keyed
      // field (user, quota) with the SAME normalised order so the client can safely
      // pair user_a_id ↔ user_a_quota. Misalignment here breaks the per-user monthly
      // quota badge + selection guard (a free user's quota gets keyed to the partner).
      const firstIsA = Number(uA.id) <= Number(uB.id);
      const first = firstIsA ? uA : uB;
      const second = firstIsA ? uB : uA;
      const quotaFirst = quotaForResponse(first);
      const quotaSecond = quotaForResponse(second);
      const hasPremium = quotaFirst.is_premium || quotaSecond.is_premium;
      const claimedFirst = !!first.user_id;
      const claimedSecond = !!second.user_id;
      const inboxReady = claimedFirst && claimedSecond;
      const sameEmailBlocked = pairHasSameResponseEmail(first, second);

      const sentMatchId = lookupSentMatchId(normA, normB);
      const alreadySent = sentMatchId != null;

      pairs.push({
        user_a: {
          id: first.id,
          name: first.name,
          identity: first.identity,
          ig_username: first.ig_username,
          email: first.email,
          user_id: first.user_id || null,
          claimed: claimedFirst,
        },
        user_b: {
          id: second.id,
          name: second.name,
          identity: second.identity,
          ig_username: second.ig_username,
          email: second.email,
          user_id: second.user_id || null,
          claimed: claimedSecond,
        },
        user_a_id: normA,
        user_b_id: normB,
        match_score: finalScore,
        score_breakdown: dimensionScores,
        sent_match_id: sentMatchId,
        already_sent: alreadySent,
        last_send_failed: !alreadySent && failedMap.has(pairKey),
        last_send_failed_at: (!alreadySent && failedMap.get(pairKey)?.at) || null,
        in_draft: draftMap.has(pairKey),
        draft_id: draftMap.get(pairKey) ?? null,
        user_a_quota: quotaFirst,
        user_b_quota: quotaSecond,
        has_premium: hasPremium,
        inbox_ready: inboxReady,
        same_email_blocked: sameEmailBlocked,
        premium_instant_ready: hasPremium && inboxReady && !alreadySent && quotaFirst.can_receive && quotaSecond.can_receive && !sameEmailBlocked,
        quota_blocked: !quotaFirst.can_receive || !quotaSecond.can_receive,
        below_live_threshold: false,
        conduct_blocked: false,
        user_a_conduct: first.conduct_score ?? 100,
        user_b_conduct: second.conduct_score ?? 100,
      });
    }
  }

  // Live scoring can drop historical sends below minScore / hard-filter — still
  // surface those successful sent_matches so the「已發送」tab is complete.
  const userById = new Map(usersLatest.map((u) => [Number(u.id), u]));
  const existingPairKeys = new Set(
    pairs.map((p) => `${Number(p.user_a_id)}:${Number(p.user_b_id)}`),
  );
  for (const missing of listMissingSuccessfulSentPairs(existingPairKeys, successfulSentRows, normalisePair)) {
    const firstRow = userById.get(missing.user_a_id);
    const secondRow = userById.get(missing.user_b_id);
    if (!firstRow || !secondRow) continue;

    let finalScore = missing.row.match_score != null ? Number(missing.row.match_score) : null;
    let dimensionScores = null;
    if (passesHardFilter(firstRow, secondRow)) {
      const result = computeCompatibility(firstRow, secondRow);
      if (result?.match) {
        finalScore = result.finalScore;
        dimensionScores = result.dimensionScores;
      }
    }

    const quotaFirst = quotaForResponse(firstRow);
    const quotaSecond = quotaForResponse(secondRow);
    const hasPremium = quotaFirst.is_premium || quotaSecond.is_premium;
    const claimedFirst = !!firstRow.user_id;
    const claimedSecond = !!secondRow.user_id;
    const pairKey = missing.key;
    const conductBlocked = !passesConductFilter(firstRow) || !passesConductFilter(secondRow);

    pairs.push({
      user_a: buildAutomationUserStub(firstRow),
      user_b: buildAutomationUserStub(secondRow),
      user_a_id: missing.user_a_id,
      user_b_id: missing.user_b_id,
      match_score: finalScore,
      score_breakdown: dimensionScores,
      sent_match_id: lookupSentMatchId(missing.user_a_id, missing.user_b_id) ?? Number(missing.row.id) ?? null,
      already_sent: true,
      last_send_failed: false,
      last_send_failed_at: null,
      in_draft: draftMap.has(pairKey),
      draft_id: draftMap.get(pairKey) ?? null,
      user_a_quota: quotaFirst,
      user_b_quota: quotaSecond,
      has_premium: hasPremium,
      inbox_ready: claimedFirst && claimedSecond,
      same_email_blocked: pairHasSameResponseEmail(firstRow, secondRow),
      premium_instant_ready: false,
      quota_blocked: !quotaFirst.can_receive || !quotaSecond.can_receive,
      below_live_threshold: true,
      conduct_blocked: conductBlocked,
      user_a_conduct: firstRow.conduct_score ?? 100,
      user_b_conduct: secondRow.conduct_score ?? 100,
      sent_at: missing.row.sent_at || null,
    });
  }

  let filteredPairs = pairs;
  if (premiumOnly) {
    filteredPairs = pairs.filter((p) => p.has_premium);
  }

  // Sort: unsent first, premium instant first, then by score desc
  filteredPairs.sort((a, b) => {
    if (a.already_sent !== b.already_sent) return a.already_sent ? 1 : -1;
    if (a.premium_instant_ready !== b.premium_instant_ready) return a.premium_instant_ready ? -1 : 1;
    return (Number(b.match_score) || 0) - (Number(a.match_score) || 0);
  });

  const summary = {
    total: filteredPairs.length,
    premium_pairs: filteredPairs.filter((p) => p.has_premium).length,
    premium_instant_ready: filteredPairs.filter((p) => p.premium_instant_ready).length,
    quota_blocked: filteredPairs.filter((p) => p.quota_blocked && !p.already_sent).length,
    sent_in_list: filteredPairs.filter((p) => p.sent_match_id != null).length,
    sent_in_db: successfulSentRows.length,
    last_send_failed: filteredPairs.filter((p) => p.last_send_failed).length,
    excluded_conduct: excludedConductCount,
    excluded_duplicate_responses: excludedDuplicateCount,
  };

  return res.status(200).json({
    pairs: filteredPairs,
    total: filteredPairs.length,
    summary,
  });
}

// ── POST ─────────────────────────────────────────────────────────────────────
async function handlePost(req, res) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { action, pairs } = body;

  if (action !== 'save_draft') {
    return res.status(400).json({ error: 'Unknown action. Use save_draft.' });
  }

  if (!Array.isArray(pairs) || pairs.length === 0) {
    return res.status(400).json({ error: 'pairs must be a non-empty array.' });
  }

  // Validate and normalise each pair
  const rows = [];
  for (const p of pairs) {
    const a = Number(p.userAId);
    const b = Number(p.userBId);
    if (!a || !b || a === b || !Number.isInteger(a) || !Number.isInteger(b)) {
      return res.status(400).json({ error: `Invalid pair: ${JSON.stringify(p)}` });
    }
    const [normA, normB] = normalisePair(a, b);
    rows.push({
      user_a_id: normA,
      user_b_id: normB,
      match_score: p.match_score != null ? Math.round(Number(p.match_score)) : null,
      notes: p.notes || null,
    });
  }

  const { data, error } = await supabase
    .from('email_drafts')
    .upsert(rows, { onConflict: 'user_a_id,user_b_id', ignoreDuplicates: false })
    .select();

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ saved: data?.length ?? rows.length, drafts: data });
}

// ── DELETE ────────────────────────────────────────────────────────────────────
async function handleDelete(req, res) {
  const draftId = Number(req.query.draftId);
  if (!draftId || !Number.isInteger(draftId)) {
    return res.status(400).json({ error: 'draftId must be an integer.' });
  }

  const { error } = await supabase.from('email_drafts').delete().eq('id', draftId);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ deleted: true, id: draftId });
}

// ── Router ────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (!(await authorizeStationOrForumAdmin(req, res))) return;

  if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return res.status(500).json({ error: 'Server misconfigured: missing Supabase credentials' });
  }

  try {
    if (req.method === 'GET')    return await handleGet(req, res);
    if (req.method === 'POST')   return await handlePost(req, res);
    if (req.method === 'DELETE') return await handleDelete(req, res);
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('[email-automation]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
