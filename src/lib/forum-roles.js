/**
 * Forum RBAC helpers (profiles.forum_role).
 */

export const FORUM_ROLES = ['member', 'moderator', 'admin'];

export function getForumRole(profile) {
  const role = profile?.forum_role;
  return FORUM_ROLES.includes(role) ? role : 'member';
}

export function canModerateForum(role) {
  return role === 'moderator' || role === 'admin';
}

export function canAdminForum(role) {
  return role === 'admin';
}

export function isForumStaffRole(role) {
  return canModerateForum(role);
}
