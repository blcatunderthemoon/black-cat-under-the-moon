/**
 * Profile / mirror card link helpers
 */

export function mirrorCardHref({ isMine, slug }) {
  if (isMine) return '/mirror-card/me';
  if (slug) return `/mirror-card/${slug}`;
  return null;
}
