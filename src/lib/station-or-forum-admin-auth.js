/**
 * Station dashboard (x-dashboard-key) OR website forum admin (Bearer + forum_role admin).
 */

import { isDashboardKeyValid } from './dashboard-auth.js';
import { resolveModerationActor } from './forum-moderation-auth.js';

export async function authorizeStationOrForumAdmin(req, res) {
  const dashKey = req.headers['x-dashboard-key'] || '';
  if (isDashboardKeyValid(dashKey)) {
    return { mode: 'dashboard' };
  }

  const actor = await resolveModerationActor(req, res, { requireAdmin: true });
  if (!actor) return null;
  return { mode: 'forum_admin', actor };
}
