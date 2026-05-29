/**
 * POST /api/dashboard/experiment
 * Body: { userId, weights: { attraction, emotional, lifestyle, communication, relationship, conflictSafety }, useHardFilter }
 * Returns original (v4 default weights) and weighted rankings with delta annotations.
 */

import { createClient } from '@supabase/supabase-js';
import {
  passesHardFilter,
  passesIdentityFilter,
} from '../../../lib/matching.js';
import { computeCompatibility } from '../../../lib/intelligence.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, weights = {}, useHardFilter = true } = req.body || {};
  const uid = Number(userId);
  if (!uid || Number.isNaN(uid)) {
    return res.status(400).json({ error: '需要 userId 參數' });
  }

  try {
    const { data: allUsers, error } = await supabase.from('responses').select('*');
    if (error) return res.status(500).json({ error: error.message });

    const users = allUsers || [];
    const user = users.find((u) => u.id === uid);
    if (!user) return res.status(404).json({ error: '找不到用戶' });

    const candidates = users.filter((c) => c.id !== uid);

    // Apply filter
    const filtered = useHardFilter
      ? candidates.filter((c) => passesHardFilter(user, c))
      : candidates.filter((c) => passesIdentityFilter(user, c)); // soft: only identity required

    // v4 default dimension weights (must match lib/intelligence.js)
    const DEFAULT_WEIGHTS = { attraction: 0.15, emotional: 0.20, lifestyle: 0.15, communication: 0.15, relationship: 0.20, conflictSafety: 0.15 };
    const DIM_KEYS = Object.keys(DEFAULT_WEIGHTS);

    // Original ranking — v4 default weights
    const original = filtered
      .map((c) => {
        const intel = computeCompatibility(user, c);
        if (!intel?.match) return null;
        return { id: c.id, name: c.name, identity: c.identity, score: intel.finalScore, breakdown: intel.dimensionScores };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    // Weighted ranking — apply custom multipliers to v4 dimension scores, renormalize to 0–100
    const modified = filtered
      .map((c) => {
        const intel = computeCompatibility(user, c);
        if (!intel?.match) return null;
        const ds = intel.dimensionScores;
        const w = {};
        for (const k of DIM_KEYS) w[k] = weights[k] != null ? Number(weights[k]) : 1;
        const raw = DIM_KEYS.reduce((s, k) => s + (ds[k] ?? 0) * DEFAULT_WEIGHTS[k] * w[k], 0);
        const maxPossible = DIM_KEYS.reduce((s, k) => s + 20 * DEFAULT_WEIGHTS[k] * w[k], 0);
        const score = maxPossible > 0 ? Math.round((raw / maxPossible) * 100) : 0;
        return { id: c.id, name: c.name, identity: c.identity, score, breakdown: ds };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    // Compute deltas
    const originalRankMap = {};
    original.forEach((r) => { originalRankMap[r.id] = r.rank; });

    const modifiedWithDelta = modified.map((r) => {
      const oldRank = originalRankMap[r.id];
      const delta = oldRank !== undefined ? oldRank - r.rank : null; // positive = moved up
      return { ...r, oldRank, delta };
    });

    return res.status(200).json({ original, modified: modifiedWithDelta });
  } catch (err) {
    console.error('experiment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
