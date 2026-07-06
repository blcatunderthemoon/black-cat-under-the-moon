/**
 * Auth for forum moderation APIs: Bearer + forum_role, or station x-dashboard-key.
 */

import { isDashboardKeyValid } from './dashboard-auth.js';
import { getForumRole, canModerateForum, canAdminForum } from './forum-roles.js';
import { requireUser, getProfile, sendAuthError, getAdminClient } from './server-auth.js';

async function resolveDashboardActorId() {
  const admin = getAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('forum_role', 'admin')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

/**
 * @returns {Promise<{ actorId: string|null, role: string, viaDashboard: boolean }|null>}
 */
export async function resolveModerationActor(req, res, { requireAdmin = false } = {}) {
  const dashKey = req.headers['x-dashboard-key'] || '';
  if (isDashboardKeyValid(dashKey)) {
    const actorId = await resolveDashboardActorId();
    return { actorId, role: 'admin', viaDashboard: true };
  }

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    sendAuthError(res, err);
    return null;
  }

  const profile = await getProfile(user.id);
  if (!profile) {
    res.status(403).json({ error: 'Profile not found' });
    return null;
  }
  if (profile.status === 'suspended' || profile.status === 'limited') {
    res.status(403).json({ error: '你的帳號目前受到限制。' });
    return null;
  }

  const role = getForumRole(profile);
  if (requireAdmin && !canAdminForum(role)) {
    res.status(403).json({ error: '需要管理員權限。', code: 'admin_required' });
    return null;
  }
  if (!canModerateForum(role)) {
    res.status(403).json({ error: '需要月光守護者權限。', code: 'moderator_required' });
    return null;
  }

  return { actorId: user.id, role, viaDashboard: false };
}
