/**
 * AppShell — shared pixel-art layout for user-facing Next.js pages.
 */

import Link from 'next/link';
import StarfieldBackground from './StarfieldBackground.js';
import ForumWarmBackground from './ForumWarmBackground.js';
import SiteLegalFooter from './SiteLegalFooter.js';
import PixelMixedLabel from './PixelMixedLabel.js';

const ACCOUNT_HEADER_ZH = 'app-header__text-zh';
const ACCOUNT_HEADER_EN = 'app-header__text-en';

export function AppHeaderMixedText({ text, zhClass = ACCOUNT_HEADER_ZH, enClass = ACCOUNT_HEADER_EN }) {
  if (text == null || text === '') return null;
  return (
    <PixelMixedLabel text={String(text)} zhClass={zhClass} enClass={enClass} />
  );
}

export function AppHeaderUser({ name }) {
  const label = name || '我';
  return (
    <span className="app-header__user">
      <AppHeaderMixedText
        text={label}
        zhClass={`${ACCOUNT_HEADER_ZH} ${ACCOUNT_HEADER_ZH}--user`}
        enClass={`${ACCOUNT_HEADER_EN} ${ACCOUNT_HEADER_EN}--user`}
      />
    </span>
  );
}

export default function AppShell({
  title,
  headerSubtitle,
  backHref = '/index.html',
  backLabel = '主頁',
  nav,
  children,
  maxWidth = '640px',
  centered = false,
  thread = false,
  showStarfield = true,
  warmBackground = false,
  hideHeader = false,
  headerVariant,
  alignHeader = false,
  mainClassName,
  pageClassName = '',
  breadcrumbs,
  headerBrand,
}) {
  const pageClass = centered
    ? 'app-page app-page--centered'
    : thread
      ? 'app-page app-page--thread'
      : 'app-page';

  const constrainHeader = Boolean(
    alignHeader && maxWidth && maxWidth !== '100%',
  );
  const isAccountHeader = headerVariant === 'account';

  const headerClass = [
    'app-header',
    headerVariant ? `app-header--${headerVariant}` : '',
    isAccountHeader ? 'mode-top-bar mode-top-bar--app' : '',
    breadcrumbs ? 'app-header--breadcrumbs' : '',
  ].filter(Boolean).join(' ');

  function renderAccountTitle() {
    if (!title) return null;
    if (headerSubtitle) {
      return (
        <>
          <h1 className="app-header__title">{title}</h1>
          <p className="app-header__subtitle">{headerSubtitle}</p>
        </>
      );
    }
    if (typeof title === 'string') {
      return (
        <AppHeaderMixedText
          text={title}
          zhClass={`${ACCOUNT_HEADER_ZH} ${ACCOUNT_HEADER_ZH}--title`}
          enClass={`${ACCOUNT_HEADER_EN} ${ACCOUNT_HEADER_EN}--title`}
        />
      );
    }
    return title;
  }

  const headerContent = breadcrumbs ? (
    <>
      <nav className="app-header__breadcrumbs" aria-label="breadcrumb">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.label} className="app-header__crumb">
            {i > 0 && <span className="app-header__crumb-sep" aria-hidden="true">/</span>}
            {crumb.href ? (
              <Link href={crumb.href} className="app-header__crumb-link">{crumb.label}</Link>
            ) : (
              <span className="app-header__crumb-current">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="app-header__nav">{nav || null}</div>
    </>
  ) : isAccountHeader ? (
    <div className="mode-top-bar__row">
      <a
        href={backHref}
        className="app-header__back home-back-btn mode-header-chip"
      >
        <span className="home-back-btn__icon" aria-hidden="true">{backLabel === '主頁' ? '⌂' : '←'}</span>
        <span className="home-back-btn__label app-header__back-label">{backLabel}</span>
      </a>
      {title ? (
        <h1 className="app-header__title mode-top-bar__center mode-top-bar__mode-tag">
          {renderAccountTitle()}
        </h1>
      ) : (
        <span className="mode-top-bar__center mode-top-bar__mode-tag" aria-hidden="true" />
      )}
      <div className="app-header__nav mode-top-bar__nav-slot">{nav || null}</div>
    </div>
  ) : (
    <>
      <a
        href={backHref}
        className="app-header__back"
      >
        {backLabel === '主頁' ? '⌂ 主頁' : `← ${backLabel}`}
      </a>
      {headerBrand ? (
        <div className="app-header__brand">{headerBrand}</div>
      ) : title && (
        headerSubtitle ? (
          <div className="app-header__title-wrap">
            <h1 className="app-header__title">{title}</h1>
            <p className="app-header__subtitle">{headerSubtitle}</p>
          </div>
        ) : (
          <h1 className="app-header__title">{title}</h1>
        )
      )}
      {!headerBrand && !title && <div style={{ flex: 1 }} />}
      <div className="app-header__nav">{nav || null}</div>
    </>
  );

  return (
    <div className={`${pageClass}${pageClassName ? ` ${pageClassName}` : ''}`}>
      {warmBackground ? <ForumWarmBackground /> : (showStarfield && <StarfieldBackground />)}

      {!hideHeader && (
        <header className={headerClass}>
          {breadcrumbs ? (
            <div className="app-header__inner app-header__inner--spread">
              {headerContent}
            </div>
          ) : constrainHeader ? (
            <div className="app-header__inner" style={{ maxWidth }}>
              {headerContent}
            </div>
          ) : (
            headerContent
          )}
        </header>
      )}

      <main
        className={centered ? undefined : (mainClassName || 'app-main')}
        style={centered ? undefined : (maxWidth === '100%' ? { maxWidth: '100%', padding: 0 } : { maxWidth })}
      >
        {children}
      </main>
      <SiteLegalFooter />
    </div>
  );
}

/** Convenience nav link for header right side */
export function NavLink({ href, children, dim = false, className = '' }) {
  return (
    <Link
      href={href}
      className={`app-header__nav-link${dim ? ' app-header__nav-link--dim' : ''}${className ? ` ${className}` : ''}`}
    >
      {children}
    </Link>
  );
}

/** Settings link for header right side */
export function NavSettings() {
  return <NavLink href="/account">⚙</NavLink>;
}
