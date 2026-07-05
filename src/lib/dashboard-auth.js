/**
 * Shared dashboard API authentication.
 * Dev: skips check when DASHBOARD_SECRET is not configured.
 * Production: requires DASHBOARD_SECRET (fail-closed).
 */

import { isProduction } from './production-guard.js';

export function checkDashboardAuth(req, res) {
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) {
    if (isProduction()) {
      res.status(503).json({
        error: 'Dashboard authentication is not configured',
        code: 'DASHBOARD_SECRET_MISSING',
      });
      return false;
    }
    return true;
  }

  const provided = req.headers['x-dashboard-key'] || '';
  if (provided !== secret) {
    res.status(401).json({
      error: 'Dashboard 金鑰無效',
      code: 'DASHBOARD_KEY_INVALID',
    });
    return false;
  }
  return true;
}

export function isDashboardKeyValid(provided) {
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) return !isProduction();
  return (provided || '') === secret;
}
