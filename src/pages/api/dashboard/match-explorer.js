/**
 * GET /api/dashboard/match-explorer
 * Query params:
 *   userId      - required anchor user id
 *   identity    - filter candidates by identity (optional)
 *   minAge      - min candidate age (optional)
 *   maxAge      - max candidate age (optional)
 *   minScore    - minimum match score threshold (optional, default 0)
 */

import { createClient } from '@supabase/supabase-js';
import { passesHardFilter } from '../../../lib/matching.js';
import { computeCompatibility } from '../../../lib/intelligence.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { userId, identity, minAge, maxAge, minScore } = req.query;
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

    const scoreThreshold = minScore ? Number(minScore) : 60;

    let candidates = users.filter((c) => {
      if (c.id === uid) return false;
      if (identity && c.identity !== identity) return false;
      if (minAge && Number(c.age) < Number(minAge)) return false;
      if (maxAge && Number(c.age) > Number(maxAge)) return false;
      return true;
    });

    // Fetch sent pairs for badge annotation
    const { data: sentRows } = await supabase
      .from('sent_matches')
      .select('user_a_id, user_b_id, sent_at')
      .or(`user_a_id.eq.${uid},user_b_id.eq.${uid}`);

    const sentMap = new Map(
      (sentRows || []).map((r) => {
        const partnerId = Number(r.user_a_id) === uid ? Number(r.user_b_id) : Number(r.user_a_id);
        return [partnerId, r.sent_at];
      })
    );

    const results = candidates
      .filter((c) => passesHardFilter(user, c))
      .map((c) => {
        const intel = computeCompatibility(user, c);
        return {
          ...c,
          match_score: intel.finalScore,
          score_breakdown: intel.dimensionScores,
          intelligence: intel,
          already_sent: sentMap.has(Number(c.id)),
          sent_at: sentMap.get(Number(c.id)) || null,
        };
      })
      .filter((r) => r.match_score >= scoreThreshold)
      .sort((a, b) => {
        // Already-sent pairs sink to the bottom, then sort by score
        if (a.already_sent !== b.already_sent) return a.already_sent ? 1 : -1;
        return b.match_score - a.match_score;
      });

    return res.status(200).json({
      user: user,
      total: results.length,
      results,
    });
  } catch (err) {
    console.error('match-explorer error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
