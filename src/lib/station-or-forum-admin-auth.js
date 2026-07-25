/**
 * Station dashboard (x-dashboard-key) OR website forum admin (Bearer + forum_role admin).
 *
 * Intentional product model: production /dashboard is gated by forum admin session
 * (see ProductionDashboardAdminGate). Station key remains for local ops and automation.
 * Prefer Bearer when present so /admin/* works without a station key.
 */

import { isDashboardKeyValid } from './dashboard-auth.js';
import { resolveModerationActor } from './forum-moderation-auth.js';

export async function authorizeStationOrForumAdmin(req, res) {
  const bearer = req.headers?.authorization || '';
  if (bearer.startsWith('Bearer ')) {
    const actor = await resolveModerationActor(req, res, { requireAdmin: true });
    if (!actor) return null;
    return { mode: 'forum_admin', actor };
  }

  const dashKey = req.headers['x-dashboard-key'] || '';
  if (isDashboardKeyValid(dashKey)) {
    return { mode: 'dashboard' };
  }

  // No Bearer and no valid station key — fall through to actor resolver for a
  // consistent 401/403 (e.g. missing Authorization).
  const actor = await resolveModerationActor(req, res, { requireAdmin: true });
  if (!actor) return null;
  return { mode: 'forum_admin', actor };
}
