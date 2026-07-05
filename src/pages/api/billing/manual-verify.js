/**
 * POST /api/billing/manual-verify
 * Admin-only: manually grant or revoke Premium for a user.
 * Used for FPS / PayMe manual payment verification.
 *
 * Body: { user_id, action: 'grant' | 'revoke', days?: number, note?: string }
 * Protected by x-dashboard-key header.
 */

import { checkDashboardAuth } from '../../../lib/dashboard-auth.js';
import { applyManualPremiumAction } from '../../../lib/manual-premium.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkDashboardAuth(req, res)) return;

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { user_id, action, days = 30, note = '' } = body;

  if (!user_id || !action) return res.status(400).json({ error: 'user_id and action are required' });
  if (!['grant', 'revoke'].includes(action)) return res.status(400).json({ error: 'action must be "grant" or "revoke"' });

  const result = await applyManualPremiumAction({ user_id, action, days, note });
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json({ success: true, action: result.action, period_end: result.period_end });
}
