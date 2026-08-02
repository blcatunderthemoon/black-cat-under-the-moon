/**
 * POST /api/match/deliver-inbox
 * Ops-only Inbox delivery WITHOUT sending email (DASHBOARD_SECRET).
 * Prefer /api/dashboard/send-emails with deliver_inbox:true so email + Inbox stay in sync.
 * Not called by Passport discovery or user-facing match APIs.
 *
 * Body: { user_a_id: number, user_b_id: number, match_score: number, match_summary?: object }
 * user_a_id / user_b_id are responses.id integers.
 *
 * Protected by DASHBOARD_SECRET (same as other admin APIs).
 */

import { deliverMatchCard } from '../../../lib/inbox.js';
import { getDashboardSecret } from '../../../lib/dashboard-secret.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const dashKey = req.headers['x-dashboard-key'] || '';
  const secret = getDashboardSecret();
  if (!secret || dashKey !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { user_a_id, user_b_id, match_score, match_summary } = body;

  if (!user_a_id || !user_b_id) {
    return res.status(400).json({ error: 'user_a_id and user_b_id (responses.id integers) are required' });
  }

  const score = Math.max(0, Math.min(100, Math.round(Number(match_score) || 0)));

  const result = await deliverMatchCard({
    responseAId: Number(user_a_id),
    responseBId: Number(user_b_id),
    matchScore: score,
    matchSummary: match_summary || {},
  });

  if (!result.delivered) {
    return res.status(200).json({ delivered: false, reason: result.reason, details: result.details });
  }

  return res.status(200).json({
    delivered: true,
    thread_id: result.thread_id,
    message_ids: result.message_ids,
    whisper_unlocked: Boolean(result.whisper_unlocked),
    solo: Boolean(result.solo),
  });
}
