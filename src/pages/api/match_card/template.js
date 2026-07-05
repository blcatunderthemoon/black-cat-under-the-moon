import { checkDashboardAuth } from '../../../lib/dashboard-auth.js';
import { getAdminClient } from '../../../lib/server-auth.js';
import { computeCompatibility } from '../../../lib/intelligence.js';
import { buildMatchCardHtml, clampScore } from '../../../lib/match-card-html.js';
import { getSiteUrlFromRequest } from '../../../lib/site-seo.js';

export { buildMatchCardHtml };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!checkDashboardAuth(req, res)) return;

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const userId = Number(body.userId);
    const targetId = Number(body.targetId);
    const score = clampScore(body.match_score);
    const breakdown = body.score_breakdown || {};
    const intelligence = body.intelligence || null;

    if (!userId || !targetId) {
      return res.status(400).json({ error: 'userId and targetId are required' });
    }

    const admin = getAdminClient();
    const { data: rows, error } = await admin
      .from('responses')
      .select('*')
      .in('id', [userId, targetId]);

    if (error) {
      return res.status(500).json({ error: error.message || 'Failed to fetch users' });
    }

    const user = rows?.find((r) => Number(r.id) === userId);
    const target = rows?.find((r) => Number(r.id) === targetId);

    if (!user || !target) {
      return res.status(404).json({ error: 'User pair not found' });
    }

    const resolvedIntelligence = intelligence ?? computeCompatibility(user, target);
    const resolvedScore = clampScore(resolvedIntelligence.finalScore ?? score);
    const html = buildMatchCardHtml({
      user,
      target,
      score: resolvedScore,
      breakdown,
      intelligence: resolvedIntelligence,
      siteUrl: getSiteUrlFromRequest(req),
    });
    return res.status(200).json({
      success: true,
      title: `靈魂共鳴連線通知 - ${user.name} x ${target.name}`,
      html,
      plain_text: `${user.name} 連線成功：${target.name}，同步率 ${resolvedScore}/100`,
      data: {
        user_id: user.id,
        target_id: target.id,
        user_name: user.name,
        target_name: target.name,
        match_score: resolvedScore,
        score_breakdown: breakdown,
      },
    });
  } catch (err) {
    console.error('Match card template error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
