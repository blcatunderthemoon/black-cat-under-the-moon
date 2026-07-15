/**
 * Shared layout for Moonlight Gatherings — standalone from forum.
 */

import AppShell from '../AppShell.js';
import AppHeaderAuth from '../AppHeaderAuth.js';

export default function GatheringShell({
  children,
  title = '月光聚會',
  backHref = '/index.html',
  backLabel = '主頁',
  maxWidth = '720px',
  redirectPath = '/gatherings',
}) {
  return (
    <AppShell
      title={title}
      headerVariant="account"
      backHref={backHref}
      backLabel={backLabel}
      maxWidth={maxWidth}
      showStarfield
      warmBackground={false}
      pageClassName="app-page--gatherings"
      nav={<AppHeaderAuth redirectPath={redirectPath} />}
    >
      {children}
    </AppShell>
  );
}
