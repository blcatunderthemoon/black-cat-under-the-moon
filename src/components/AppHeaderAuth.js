/**
 * App header auth — same layout as public auth-nav badge (name | inbox | settings | logout).
 */

import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth-context.js';
import { NavLink } from './AppShell.js';
import PixelMixedLabel from './PixelMixedLabel.js';
import HeaderPremiumMoon from './HeaderPremiumMoon.js';
import HeaderMyCatLink from './HeaderMyCatLink.js';
import { HeaderCalendarIcon, HeaderMailIcon, HeaderSettingsIcon } from './HeaderNavIcons.js';
import { readMeCache } from '../lib/me-cache.js';
import { isPremiumUser } from '../lib/premium.js';

function NavSep() {
  return <span className="auth-nav-badge__sep" aria-hidden="true" />;
}

export default function AppHeaderAuth({ redirectPath, hideInbox: hideInboxProp, hideName = false }) {
  const { session, profile, displayName, signOut, loading, profileHydrated } = useAuth();
  const router = useRouter();
  const loginRedirect = redirectPath || router.asPath || '/';
  const onInboxPage = router.pathname === '/inbox' || router.pathname.startsWith('/inbox/');
  const onAccountPage = router.pathname === '/account';
  const onMirrorCardPage = router.pathname.startsWith('/mirror-card/');
  const useUserToolbar = onInboxPage || onAccountPage || onMirrorCardPage;
  const hideInbox = hideInboxProp ?? onInboxPage;

  async function handleLogout() {
    await signOut();
    router.replace(`/login?redirect=${encodeURIComponent(loginRedirect)}`);
  }

  if (loading) return null;

  if (!session) {
    return (
      <NavLink href={`/login?redirect=${encodeURIComponent(loginRedirect)}`}>登入</NavLink>
    );
  }

  const meData = profile ?? (session.user?.id ? readMeCache(session.user.id) : null);
  const name = profileHydrated ? (displayName || '貓咪') : null;
  const unread = meData?.unread_inbox_count || 0;
  const isPremium = isPremiumUser(meData);

  return (
    <>
      <div className={`auth-nav-badge auth-nav-badge--in-header${hideName ? ' auth-nav-badge--compact' : ''}${useUserToolbar ? ' auth-nav-badge--user-toolbar' : ''}`}>
        <div className="auth-nav-badge__inner">
          {(!hideName || isPremium) && (
            <span className="auth-nav-badge__name-group">
              {!hideName && profileHydrated && name && (
                <Link href="/account" className="auth-nav-badge__item auth-nav-badge__item--name" title={name}>
                  <PixelMixedLabel
                    text={name}
                    zhClass="auth-nav-badge__zh"
                    enClass="auth-nav-badge__en"
                  />
                </Link>
              )}
              {isPremium && (
                <HeaderPremiumMoon profile={meData} className="auth-nav-badge__moon" />
              )}
            </span>
          )}
          {!hideName && profileHydrated && name && <NavSep />}
          <span className="auth-nav-badge__icon-group">
            <Link
              href="/gatherings"
              className="auth-nav-badge__item auth-nav-badge__item--icon"
              title="月光聚會"
              aria-label="月光聚會"
            >
              <span className="auth-nav-badge__icon" aria-hidden="true"><HeaderCalendarIcon /></span>
            </Link>
            {!hideInbox && (
              <Link
                href="/inbox"
                className={`auth-nav-badge__item auth-nav-badge__item--icon${unread > 0 ? ' auth-nav-badge__item--inbox-unread' : ''}`}
                title={unread > 0 ? `收件箱（${unread > 99 ? '99+' : unread}）未讀` : '收件箱'}
              >
                <span className="auth-nav-badge__icon" aria-hidden="true"><HeaderMailIcon /></span>
                {unread > 0 && (
                  <span data-unread className="auth-nav-badge__unread">{unread > 99 ? '99+' : unread}</span>
                )}
              </Link>
            )}
            <Link href="/account" className="auth-nav-badge__item auth-nav-badge__item--icon" title="設定">
              <span className="auth-nav-badge__icon" aria-hidden="true"><HeaderSettingsIcon /></span>
            </Link>
            <HeaderMyCatLink
              needsFeedBadge={meData?.my_cat?.needs_feed_badge === true}
              skinId={meData?.my_cat?.skin_id}
            />
          </span>
        </div>
      </div>
      <button
        type="button"
        className="auth-nav-badge__item auth-nav-badge__item--logout app-header-logout-btn"
        onClick={handleLogout}
      >
        登出
      </button>
    </>
  );
}
