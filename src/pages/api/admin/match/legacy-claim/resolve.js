/**
 * POST /api/admin/match/legacy-claim/resolve
 * Admin-only: manually approve or reject a disputed legacy claim.
 *
 * Body: { claim_id: string, action: 'approve' | 'reject', review_note?: string }
 * Requires DASHBOARD_SECRET in x-dashboard-key header (same as existing dashboard auth).
 */

import { adminResolveClaim } from '../../../../../lib/legacy-match-claim.js';
import { getDashboardSecret } from '../../../../../lib/dashboard-secret.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Re-use existing dashboard auth pattern
  const dashKey = req.headers['x-dashboard-key'] || '';
  const secret = getDashboardSecret();
  if (!secret || dashKey !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { claim_id, action, review_note } = body;

  if (!claim_id || !action) {
    return res.status(400).json({ error: 'claim_id and action are required' });
  }

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'action must be "approve" or "reject"' });
  }

  const result = await adminResolveClaim(claim_id, action, review_note || '');

  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Resolution failed' });
  }

  return res.status(200).json({ success: true });
}
