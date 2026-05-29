/**
 * /api/match — 靈魂配對 API
 *
 * GET /api/match?userId=<id>
 *
 * 1. Hard Filter：排除自己 + 雙向屬性吻合 + 體型 + 身高差 + 年齡差
 * 2. Scoring（v4 智能引擎）：6 維度各 0–20分，總分 0–100
 * 3. 回傳依 match_score 降序排列的配對結果
 */

import { createClient } from '@supabase/supabase-js';
import { passesHardFilter } from '../../lib/matching.js';
import { computeCompatibility } from '../../lib/intelligence.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

// ======================== API Handler ========================

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing Supabase credentials' });
  }

  const userId = Number(req.query.userId);
  if (!userId || Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Missing or invalid userId query parameter' });
  }

  try {
    // ---- 1. 拉取用戶自己的資料 ----
    const { data: userData, error: userErr } = await supabase
      .from('responses')
      .select('*')
      .eq('id', userId)
      .single();

    if (userErr || !userData) {
      return res.status(404).json({ error: 'User not found', detail: userErr?.message });
    }

    // ---- 2. 拉取所有其他用戶（排除自己）----
    const { data: allCandidates, error: allErr } = await supabase
      .from('responses')
      .select('*')
      .neq('id', userId);

    if (allErr) {
      return res.status(500).json({ error: 'Failed to fetch candidates', detail: allErr.message });
    }

    // ---- 3. Fetch sent pairs for this user so we can exclude them ----
    const { data: sentRows } = await supabase
      .from('sent_matches')
      .select('user_a_id, user_b_id')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

    const sentPartnerIds = new Set(
      (sentRows || []).map((r) =>
        Number(r.user_a_id) === userId ? Number(r.user_b_id) : Number(r.user_a_id)
      )
    );

    // ---- 4. Hard Filter：雙向屬性 + 體型 + 身高差 + 年齡差 + 排除已發送 ----
    const filtered = (allCandidates || []).filter(
      (c) => !sentPartnerIds.has(Number(c.id)) && passesHardFilter(userData, c)
    );

    // ---- 5. Scoring (v4) ----
    const results = filtered
      .map((candidate) => {
        const intel = computeCompatibility(userData, candidate);
        if (!intel?.match) return null;
        return {
          id: candidate.id,
          name: candidate.name,
          age: candidate.age,
          height: candidate.height,
          body_type: candidate.body_type,
          identity: candidate.identity,
          hair_style: candidate.hair_style,
          fashion_styles: candidate.fashion_styles,
          bed_role: candidate.bed_role,
          social_energy: candidate.social_energy,
          weekend_mode: candidate.weekend_mode,
          love_languages: candidate.love_languages,
          communication_style: candidate.communication_style,
          expense_splitting: candidate.expense_splitting,
          living_together: candidate.living_together,
          gap_moe: candidate.gap_moe,
          personal_traits: candidate.personal_traits,
          match_score: intel.finalScore,
          score_breakdown: intel.dimensionScores,
          intelligence: intel,
        };
      })
      .filter(Boolean);

    // ---- 6. 依 match_score 降序排列 ----
    results.sort((a, b) => b.match_score - a.match_score);

    return res.status(200).json({
      user_id: userId,
      total_candidates: allCandidates?.length || 0,
      matched: results.length,
      results,
    });
  } catch (err) {
    console.error('Match API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}