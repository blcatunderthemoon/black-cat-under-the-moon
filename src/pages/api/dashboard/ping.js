/**
 * GET /api/dashboard/ping — verify x-dashboard-key (used by DashboardAuthGate in _app.js)
 */

import { isDashboardKeyValid } from '../../../lib/dashboard-auth.js';
import { isProduction } from '../../../lib/production-guard.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.DASHBOARD_SECRET;
  const secured = isProduction() ? Boolean(secret) : Boolean(secret);

  if (!secret) {
    return res.status(200).json({
      secured: false,
      valid: true,
    });
  }

  const provided = req.headers['x-dashboard-key'] || '';
  return res.status(200).json({
    secured: true,
    valid: isDashboardKeyValid(provided),
  });
}
