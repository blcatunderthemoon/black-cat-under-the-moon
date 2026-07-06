/**
 * Full-page centered loading — same size/position as mirror card boot (hero moon).
 */

import Head from 'next/head';
import AppShell from './AppShell.js';
import MoonLoading from './MoonLoading.js';

export default function PageLoadingShell({
  label = '載入中…',
  title,
  pageClassName = '',
  maxWidth,
  hideHeader = false,
  headerVariant,
  backHref,
  nav,
  warmBackground,
  showStarfield,
  headerBrand,
  loadingSmooth = false,
}) {
  const mergedPageClass = ['app-page--page-loading', pageClassName].filter(Boolean).join(' ');

  return (
    <>
      {title ? (
        <Head>
          <title>{title}</title>
        </Head>
      ) : null}
      <AppShell
        title={title}
        pageClassName={mergedPageClass}
        maxWidth={maxWidth}
        hideHeader={hideHeader}
        headerVariant={headerVariant}
        backHref={backHref}
        nav={nav}
        warmBackground={warmBackground}
        showStarfield={showStarfield}
        headerBrand={headerBrand}
      >
        <MoonLoading label={label} variant="hero" className="page-loading" smooth={loadingSmooth} />
      </AppShell>
    </>
  );
}
