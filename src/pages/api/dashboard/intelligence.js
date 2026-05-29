/**
 * POST /api/dashboard/intelligence
 *
 * Mode A — full computation from raw user objects:
 *   Body: { userA: {...}, userB: {...} }
 *   Returns: computeCompatibility result (finalScore, dimensionScores, summary, insights)
 *
 * Mode B — interpret pre-computed scores:
 *   Body: { scores: { bedRoleScore, loveLanguageScore, socialScore, valuesScore, relationshipScore, riskScore, totalScore } }
 *   Returns: { summary, strengths, risks, prediction }
 */

import { computeCompatibility, interpretScores } from '../../../lib/intelligence.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  try {
    // Mode B: pre-computed scores
    if (body.scores) {
      const result = interpretScores(body.scores);
      return res.status(200).json(result);
    }

    // Mode A: full user objects
    const { userA, userB } = body;
    if (!userA || !userB) {
      return res.status(400).json({ error: 'Provide either { userA, userB } or { scores }' });
    }
    const result = computeCompatibility(userA, userB);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
