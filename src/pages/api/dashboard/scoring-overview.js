/**
 * GET /api/dashboard/scoring-overview
 * Returns v4 compatibility engine statistics across all passing pairs.
 * Uses computeCompatibility (100-pt) — NOT the legacy 80-pt system.
 *
 * Response:
 *   score_distribution  — 10 buckets: 0–9, 10–19, ..., 90–100
 *   dimension_averages  — avg of each 6 dimension subscores (0–20)
 *   identity_heatmap    — avg finalScore per identity×identity pair
 *   stats               — { mean, median, p75, total_pairs }
 */

import { createClient } from '@supabase/supabase-js';
import { computeCompatibility } from '../../../lib/intelligence.js';
import { passesHardFilter } from '../../../lib/matching.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const { data: allUsers, error } = await supabase.from('responses').select('*');
    if (error) return res.status(500).json({ error: error.message });

    const users = allUsers || [];
    if (users.length < 2) {
      return res.status(200).json({
        score_distribution: [],
        dimension_averages: {},
        identity_heatmap: [],
        stats: { mean: 0, median: 0, p75: 0, total_pairs: 0 },
      });
    }

    const BUCKETS = ['0–9','10–19','20–29','30–39','40–49','50–59','60–69','70–79','80–89','90–100'];
    const bucketCounts = new Array(10).fill(0);

    const dimSums = { attraction: 0, emotional: 0, lifestyle: 0, communication: 0, relationship: 0, conflictSafety: 0 };
    const allScores = [];
    const heatAccum = {};

    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        if (!passesHardFilter(users[i], users[j])) continue;

        const result = computeCompatibility(users[i], users[j]);
        if (!result?.match) continue;

        const { finalScore, dimensionScores } = result;
        allScores.push(finalScore);

        const bi = Math.min(Math.floor(finalScore / 10), 9);
        bucketCounts[bi]++;

        for (const k of Object.keys(dimSums)) {
          dimSums[k] += dimensionScores[k] ?? 0;
        }

        // Identity heatmap
        const a = users[i].identity;
        const b = users[j].identity;
        if (a && b) {
          const key = [a, b].sort().join('|');
          const [ka, kb] = key.split('|');
          if (!heatAccum[key]) heatAccum[key] = { sum: 0, count: 0, x: ka, y: kb };
          heatAccum[key].sum += finalScore;
          heatAccum[key].count++;
        }
      }
    }

    const total_pairs = allScores.length;
    const score_distribution = BUCKETS.map((name, i) => ({ name, value: bucketCounts[i] }));

    const dimension_averages = total_pairs > 0
      ? Object.fromEntries(
          Object.entries(dimSums).map(([k, v]) => [k, Math.round((v / total_pairs) * 10) / 10])
        )
      : Object.fromEntries(Object.keys(dimSums).map((k) => [k, 0]));

    const identity_heatmap = Object.values(heatAccum).map(({ x, y, sum, count }) => ({
      x,
      y,
      value: Math.round(sum / count),
    }));

    // Stats
    let mean = 0, median = 0, p75 = 0;
    if (total_pairs > 0) {
      mean = Math.round(allScores.reduce((s, v) => s + v, 0) / total_pairs);
      const sorted = [...allScores].sort((a, b) => a - b);
      median = sorted[Math.floor(sorted.length / 2)];
      p75 = sorted[Math.floor(sorted.length * 0.75)];
    }

    return res.status(200).json({
      score_distribution,
      dimension_averages,
      identity_heatmap,
      stats: { mean, median, p75, total_pairs },
    });
  } catch (err) {
    console.error('scoring-overview error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
