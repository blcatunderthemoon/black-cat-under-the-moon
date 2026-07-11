/**
 * /api/dashboard/email-automation
 *
 * GET  ?mode=pairs&minScore=60  → all global pairs above threshold,
 *                                 annotated with already_sent and in_draft
 * GET  ?mode=drafts              → list email_drafts with user names
 * POST {action:'save_draft', pairs:[{userAId,userBId,match_score}]}
 *                                → upsert pairs into email_drafts
 * DELETE ?draftId=X              → remove single draft row
 */

import { createClient } from '@supabase/supabase-js';
import { passesHardFilter } from '../../../lib/matching.js';
import { computeCompatibility } from '../../../lib/intelligence.js';
import {
  buildMonthlyMatchCounts,
  getResponseMatchQuota,
} from '../../../lib/match-delivery-quota.js';
import { buildMatchResponsePremiumContext } from '../../../lib/match-response-premium.js';
import { filterSuccessfulSentRows } from '../../../lib/match-sent-record.js';
import { pairHasSameResponseEmail } from '../../../lib/match-response-auth.js';
import { pickLatestResponsesPerPerson } from '../../../lib/response-dedupe.js';
import { authorizeStationOrForumAdmin } from '../../../lib/station-or-forum-admin-auth.js';

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

  const { data: allUsers, error: usersError } = await supabase
    .from('responses')
    .select('*')
    .or('claim_status.neq.duplicate,claim_status.is.null');

  if (usersError) return res.status(500).json({ error: usersError.message });

  // Count only each person's latest submission — ignore older/superseded rows
  // (including historical duplicates not yet marked) so matching uses fresh data.
  const users = pickLatestResponsesPerPerson(allUsers || []);
  if (users.length < 2) return res.status(200).json({ pairs: [], total: 0 });

  // Fetch sent_matches and email_drafts in parallel for annotation
  const [sentResult, draftResult] = await Promise.all([
    supabase.from('sent_matches').select('id, user_a_id, user_b_id, sent_at, notes'),
    supabase.from('email_drafts').select('id, user_a_id, user_b_id'),
  ]);
  // Gracefully handle missing tables (code 42P01 = undefined_table)
  const sentRows  = (!sentResult.error  || sentResult.error.code  === '42P01') ? (sentResult.data  || []) : [];
  const draftRows = (!draftResult.error || draftResult.error.code === '42P01') ? (draftResult.data || []) : [];
  const successfulSentRows = filterSuccessfulSentRows(sentRows);

  // Build lookup map with normalised pair keys "smallId:largeId" → sent_matches.id
  const sentMap = new Map(
    successfulSentRows.map((r) => {
      const [a, b] = normalisePair(Number(r.user_a_id), Number(r.user_b_id));
      return [`${a}:${b}`, Number(r.id)];
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
      const quotaA = quotaForResponse(uA);
      const quotaB = quotaForResponse(uB);
      const hasPremium = quotaA.is_premium || quotaB.is_premium;
      const claimedA = !!uA.user_id;
      const claimedB = !!uB.user_id;
      const inboxReady = claimedA && claimedB;
      const sameEmailBlocked = pairHasSameResponseEmail(uA, uB);

      pairs.push({
        user_a: {
          id: uA.id,
          name: uA.name,
          identity: uA.identity,
          ig_username: uA.ig_username,
          email: uA.email,
          user_id: uA.user_id || null,
          claimed: claimedA,
        },
        user_b: {
          id: uB.id,
          name: uB.name,
          identity: uB.identity,
          ig_username: uB.ig_username,
          email: uB.email,
          user_id: uB.user_id || null,
          claimed: claimedB,
        },
        user_a_id: normA,
        user_b_id: normB,
        match_score: finalScore,
        score_breakdown: dimensionScores,
        sent_match_id: sentMap.get(pairKey) ?? null,
        already_sent: sentMap.has(pairKey),
        in_draft: draftMap.has(pairKey),
        draft_id: draftMap.get(pairKey) ?? null,
        user_a_quota: quotaA,
        user_b_quota: quotaB,
        has_premium: hasPremium,
        inbox_ready: inboxReady,
        same_email_blocked: sameEmailBlocked,
        premium_instant_ready: hasPremium && inboxReady && !sentMap.has(pairKey) && quotaA.can_receive && quotaB.can_receive && !sameEmailBlocked,
        quota_blocked: !quotaA.can_receive || !quotaB.can_receive,
      });
    }
  }

  let filteredPairs = pairs;
  if (premiumOnly) {
    filteredPairs = pairs.filter((p) => p.has_premium);
  }

  // Sort: unsent first, premium instant first, then by score desc
  filteredPairs.sort((a, b) => {
    if (a.already_sent !== b.already_sent) return a.already_sent ? 1 : -1;
    if (a.premium_instant_ready !== b.premium_instant_ready) return a.premium_instant_ready ? -1 : 1;
    return b.match_score - a.match_score;
  });

  const summary = {
    total: filteredPairs.length,
    premium_pairs: filteredPairs.filter((p) => p.has_premium).length,
    premium_instant_ready: filteredPairs.filter((p) => p.premium_instant_ready).length,
    quota_blocked: filteredPairs.filter((p) => p.quota_blocked && !p.already_sent).length,
    sent_in_list: filteredPairs.filter((p) => p.sent_match_id != null).length,
    sent_in_db: successfulSentRows.length,
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
