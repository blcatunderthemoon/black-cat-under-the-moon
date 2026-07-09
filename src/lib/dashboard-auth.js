/**
 * Shared dashboard API authentication.
 * Dev: skips check when DASHBOARD_SECRET is not configured.
 * Production: requires DASHBOARD_SECRET (fail-closed).
 */

import { isProduction } from './production-guard.js';
import { resolveModerationActor } from './forum-moderation-auth.js';
import { getDashboardSecret } from './dashboard-secret.js';

export { getDashboardSecret } from './dashboard-secret.js';

export function checkDashboardAuth(req, res) {
  const secret = getDashboardSecret();
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
  const secret = getDashboardSecret();
  if (!secret) return !isProduction();
  return (provided || '') === secret;
}

/** Dashboard API: local key, dev bypass, or production forum admin Bearer. */
export async function authorizeDashboardAccess(req, res) {
  const dashKey = req.headers['x-dashboard-key'] || '';
  if (isDashboardKeyValid(dashKey)) return true;

  const secret = getDashboardSecret();
  if (!secret && !isProduction()) return true;

  const actor = await resolveModerationActor(req, res, { requireAdmin: true });
  return !!actor;
}
