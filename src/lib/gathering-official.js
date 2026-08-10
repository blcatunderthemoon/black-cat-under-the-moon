/**
 * Official Moonlight Gatherings — platform / Black Cat admin only.
 *
 * User-hosted gatherings must NEVER get featured「官方」treatment.
 * #001 (synthetic moonlight-gathering-001) is always official.
 */

import { canAdminForum, getForumRole } from './forum-roles.js';

/** Primary Black Cat ops account (also forum admin in production). */
export const OFFICIAL_GATHERING_HOST_EMAILS = new Set([
  'blcatunderthemoon@gmail.com',
]);

/**
 * @param {{ forum_role?: string, email?: string|null }|null|undefined} profile
 */
export function isOfficialGatheringHost(profile) {
  if (!profile) return false;
  if (canAdminForum(getForumRole(profile))) return true;
  const email = String(profile.email || '').trim().toLowerCase();
  return Boolean(email && OFFICIAL_GATHERING_HOST_EMAILS.has(email));
}

/**
 * Annotate a public gathering payload with featured/official flags.
 * Strips featured from non-official (user) gatherings.
 *
 * @param {Record<string, unknown>|null} publicGathering
 * @param {{ host?: object|null, row?: object|null }} [opts]
 */
export function withOfficialFeatureFlags(publicGathering, { host = null, row = null } = {}) {
  if (!publicGathering) return publicGathering;

  const syntheticOfficial = publicGathering.id === 'moonlight-gathering-001';

  const fromRow = row?.is_official === true;
  const fromHost = host?.is_official_host === true || isOfficialGatheringHost(host);
  const official = syntheticOfficial || fromRow || fromHost;

  if (!official) {
    return {
      ...publicGathering,
      is_official: false,
      featured: false,
      featured_label: undefined,
    };
  }

  return {
    ...publicGathering,
    is_official: true,
    featured: true,
    featured_label: publicGathering.featured_label || '官方',
  };
}
