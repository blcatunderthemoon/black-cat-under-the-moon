/**
 * Station dashboard (x-dashboard-key) OR website forum admin (Bearer + forum_role admin).
 *
 * Prefer Bearer when present so /admin/* pages are not blocked by a missing /
 * mismatched station key when DASHBOARD_SECRET is unset or only for /dashboard.
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
