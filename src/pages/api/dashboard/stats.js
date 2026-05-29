/**
 * GET /api/dashboard/stats
 * Returns top-level KPI numbers:
 * - total_users
 * - active_users (created_at within last 7 days, falls back to total if column absent)
 * - avg_match_score (computed across first 100 pair combinations for speed)
 * - match_rate (% of users with at least one match scoring ≥ threshold, default 40)
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

  try {
    const { data: allUsers, error } = await supabase.from('responses').select('*');
    if (error) return res.status(500).json({ error: error.message });

    const users = allUsers || [];
    const total = users.length;

    // Active users — last 7 days via created_at
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const active = users.filter((u) => u.created_at && u.created_at >= sevenDaysAgo).length;

    // Avg match score — sample up to 20 users, use intelligence 0-100 scale
    const sampleSize = Math.min(users.length, 20);
    let scoreSum = 0;
    let scorePairs = 0;
    for (let i = 0; i < sampleSize; i++) {
      for (let j = i + 1; j < sampleSize; j++) {
        if (!passesHardFilter(users[i], users[j])) continue;
        const { finalScore } = computeCompatibility(users[i], users[j]);
        scoreSum += finalScore;
        scorePairs++;
      }
    }
    const avg_match_score = scorePairs > 0 ? Math.round(scoreSum / scorePairs) : 0;

    // Match rate — % of users with ≥1 match with intelligence score ≥ threshold (0-100 scale)
    const threshold = Number(req.query.threshold) || 60;
    let usersWithMatch = 0;
    for (const user of users) {
      const hasMatch = users.some((c) => {
        if (c.id === user.id) return false;
        if (!passesHardFilter(user, c)) return false;
        const { finalScore } = computeCompatibility(user, c);
        return finalScore >= threshold;
      });
      if (hasMatch) usersWithMatch++;
    }
    const match_rate = total > 0 ? Math.round((usersWithMatch / total) * 100) : 0;

    return res.status(200).json({
      total_users: total,
      active_users: active || total,
      avg_match_score,
      match_rate,
      users_with_match: usersWithMatch,
    });
  } catch (err) {
    console.error('stats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
