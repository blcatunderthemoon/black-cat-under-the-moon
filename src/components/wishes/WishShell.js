/**
 * Shared layout for Moonlight Wishes.
 */

import AppShell from '../AppShell.js';
import AppHeaderAuth from '../AppHeaderAuth.js';

export default function WishShell({
  children,
  title = '月光心願',
  backHref = '/forum',
  backLabel = '圍爐',
  maxWidth = '720px',
  redirectPath = '/wishes',
  hideHeaderTitle = false,
  hideWishEntrance = true,
}) {
  return (
    <AppShell
      title={hideHeaderTitle ? null : title}
      headerVariant="account"
      backHref={backHref}
      backLabel={backLabel}
      maxWidth={maxWidth}
      showStarfield={false}
      warmBackground
      pageClassName={`app-page--wishes${hideHeaderTitle ? ' app-page--wishes-wall' : ''}`}
      nav={<AppHeaderAuth redirectPath={redirectPath} hideWishEntrance={hideWishEntrance} />}
    >
      {children}
    </AppShell>
  );
}
