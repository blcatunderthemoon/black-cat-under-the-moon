/**
 * Auth for forum moderation APIs: Bearer + forum_role, or station x-dashboard-key.
 */

import { isDashboardKeyValid } from './dashboard-auth.js';
import { getForumRole, canModerateForum, canAdminForum } from './forum-roles.js';
import {
  canModerateStoredTopic,
  getModeratorTopicsForUser,
  getPostStoredTopic,
  getCommentPostStoredTopic,
} from './forum-moderator-assignments.js';
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
 * @returns {Promise<{ actorId: string|null, role: string, viaDashboard: boolean, moderatorTopics?: string[] }|null>}
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

  const admin = getAdminClient();
  const moderatorTopics = role === 'moderator'
    ? await getModeratorTopicsForUser(admin, user.id)
    : null;

  return {
    actorId: user.id,
    role,
    viaDashboard: false,
    moderatorTopics,
  };
}

export function assertModerationTopicAccess(res, actor, storedTopic) {
  if (canModerateStoredTopic(actor, storedTopic)) return true;
  res.status(403).json({
    error: '你未被指派管理此版塊。',
    code: 'topic_access_denied',
  });
  return false;
}

/** Resolve actor and verify they may moderate the post (by post id). */
export async function resolveModerationActorForPost(req, res, postId, options = {}) {
  const actor = await resolveModerationActor(req, res, options);
  if (!actor) return null;

  const admin = getAdminClient();
  const storedTopic = await getPostStoredTopic(admin, postId);
  if (!storedTopic) {
    res.status(404).json({ error: 'Post not found' });
    return null;
  }
  if (!assertModerationTopicAccess(res, actor, storedTopic)) return null;

  return { ...actor, storedTopic };
}

/** Resolve actor and verify they may moderate the comment's parent post topic. */
export async function resolveModerationActorForComment(req, res, commentId, options = {}) {
  const actor = await resolveModerationActor(req, res, options);
  if (!actor) return null;

  const admin = getAdminClient();
  const storedTopic = await getCommentPostStoredTopic(admin, commentId);
  if (!storedTopic) {
    res.status(404).json({ error: 'Comment not found' });
    return null;
  }
  if (!assertModerationTopicAccess(res, actor, storedTopic)) return null;

  return { ...actor, storedTopic };
}
