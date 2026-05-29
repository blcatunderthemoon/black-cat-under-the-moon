/**
 * GET /api/dashboard/matching-analytics?userId=<id>
 * Returns:
 * - score_distribution: histogram buckets (0-9, 10-19, ..., 90-100) — v4 100-pt scale
 * - dimension_averages: avg per-dimension (6 v4 dims) across all passing pairs
 * - funnel: how many users pass each filter stage
 * - identity_heatmap: avg finalScore for each identity×identity pair combination
 */

import { createClient } from '@supabase/supabase-js';
import {
  passesIdentityFilter,
  passesBodyTypeFilter,
  passesHeightFilter,
  passesAgeFilter,
  passesHardFilter,
} from '../../../lib/matching.js';
import { computeCompatibility } from '../../../lib/intelligence.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const requestedId = req.query.userId ? Number(req.query.userId) : null;

  try {
    const { data: allUsers, error } = await supabase.from('responses').select('*');
    if (error) return res.status(500).json({ error: error.message });

    const users = allUsers || [];
    if (users.length === 0) {
      return res.status(200).json({
        score_distribution: [],
        dimension_averages: {},
        funnel: [],
        identity_heatmap: [],
      });
    }

    // Pick anchor user for funnel (first user if not specified)
    const anchorUser = requestedId
      ? users.find((u) => u.id === requestedId)
      : users[0];

    // ─── Score distribution & dimension averages ───
    // When userId is given → compute for that user vs all candidates
    // When no userId       → compute across ALL pairs (global view)
    const BUCKETS = ['0–9','10–19','20–29','30–39','40–49','50–59','60–69','70–79','80–89','90–100'];
    const bucketCounts = new Array(10).fill(0);
    const dimKeys = ['attraction','emotional','lifestyle','communication','relationship','conflictSafety'];
    const dimSums = Object.fromEntries(dimKeys.map((k) => [k, 0]));
    let pairCount = 0;
    const isUserSpecific = !!(requestedId && anchorUser);

    if (isUserSpecific) {
      // User-specific: anchor vs every other user
      for (const c of users) {
        if (c.id === anchorUser.id) continue;
        if (!passesHardFilter(anchorUser, c)) continue;
        const result = computeCompatibility(anchorUser, c);
        if (!result?.match) continue;
        const { finalScore, dimensionScores } = result;
        const bi = Math.min(Math.floor(finalScore / 10), 9);
        bucketCounts[bi]++;
        for (const k of dimKeys) dimSums[k] += dimensionScores[k] ?? 0;
        pairCount++;
      }
    } else {
      // Global: all unique pairs
      for (let i = 0; i < users.length; i++) {
        for (let j = i + 1; j < users.length; j++) {
          if (!passesHardFilter(users[i], users[j])) continue;
          const result = computeCompatibility(users[i], users[j]);
          if (!result?.match) continue;
          const { finalScore, dimensionScores } = result;
          const bi = Math.min(Math.floor(finalScore / 10), 9);
          bucketCounts[bi]++;
          for (const k of dimKeys) dimSums[k] += dimensionScores[k] ?? 0;
          pairCount++;
        }
      }
    }

    const score_distribution = BUCKETS.map((name, i) => ({ name, value: bucketCounts[i] }));
    const dimension_averages = pairCount > 0
      ? Object.fromEntries(dimKeys.map((k) => [k, Math.round((dimSums[k] / pairCount) * 10) / 10]))
      : Object.fromEntries(dimKeys.map((k) => [k, 0]));

    // ─── Filter funnel for anchor user ───
    const candidates = users.filter((u) => u.id !== anchorUser?.id);
    const afterIdentity = candidates.filter((c) => passesIdentityFilter(anchorUser, c));
    const afterBody     = afterIdentity.filter((c) => passesBodyTypeFilter(anchorUser, c));
    const afterHeight   = afterBody.filter((c) => passesHeightFilter(anchorUser, c));
    const afterAge      = afterHeight.filter((c) => passesAgeFilter(anchorUser, c));

    const funnel = [
      { stage: '全部用戶',     count: candidates.length },
      { stage: '身份篩選後',   count: afterIdentity.length },
      { stage: '體型篩選後',   count: afterBody.length },
      { stage: '身高差篩選後', count: afterHeight.length },
      { stage: '年齡差篩選後', count: afterAge.length },
    ];

    // ─── Identity heatmap: avg finalScore per identity pair (v4, 0–100) ───
    const heatAccum = {};
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const a = users[i].identity;
        const b = users[j].identity;
        if (!a || !b) continue;
        if (!passesHardFilter(users[i], users[j])) continue;
        const result = computeCompatibility(users[i], users[j]);
        if (!result?.match) continue;
        const key = [a, b].sort().join('|');
        if (!heatAccum[key]) heatAccum[key] = { sum: 0, count: 0, a: [a,b].sort()[0], b: [a,b].sort()[1] };
        heatAccum[key].sum += result.finalScore;
        heatAccum[key].count++;
      }
    }
    const identity_heatmap = Object.values(heatAccum).map(({ a, b, sum, count }) => ({
      x: a,
      y: b,
      value: Math.round(sum / count),
    }));

    return res.status(200).json({
      anchor_user_id: anchorUser?.id || null,
      is_user_specific: isUserSpecific,
      score_distribution,
      dimension_averages,
      funnel,
      identity_heatmap,
    });
  } catch (err) {
    console.error('matching-analytics error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
