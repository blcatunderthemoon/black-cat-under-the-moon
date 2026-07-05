/**
 * App header auth — same layout as public auth-nav badge (name | inbox | settings | logout).
 */

import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth-context.js';
import { NavLink } from './AppShell.js';
import PixelMixedLabel from './PixelMixedLabel.js';
import HeaderPremiumMoon from './HeaderPremiumMoon.js';
import { readMeCache } from '../lib/me-cache.js';
import { isPremiumUser } from '../lib/premium.js';

function NavSep() {
  return <span className="auth-nav-badge__sep" aria-hidden="true" />;
}

export default function AppHeaderAuth({ redirectPath, hideInbox: hideInboxProp, hideName = false }) {
  const { session, profile, displayName, signOut, loading } = useAuth();
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
  const name = displayName || '貓咪';
  const unread = meData?.unread_inbox_count || 0;
  const isPremium = isPremiumUser(meData);

  return (
    <>
      <div className={`auth-nav-badge auth-nav-badge--in-header${hideName ? ' auth-nav-badge--compact' : ''}${useUserToolbar ? ' auth-nav-badge--user-toolbar' : ''}`}>
        <div className="auth-nav-badge__inner">
          {(!hideName || isPremium) && (
            <span className="auth-nav-badge__name-group">
              {!hideName && (
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
          {!hideName && <NavSep />}
          <span className="auth-nav-badge__icon-group">
            {!hideInbox && (
              <Link
                href="/inbox"
                className={`auth-nav-badge__item auth-nav-badge__item--icon${unread > 0 ? ' auth-nav-badge__item--inbox-unread' : ''}`}
                title="收件箱"
              >
                {unread > 0 ? (
                  <span data-unread className="auth-nav-badge__unread">{unread}</span>
                ) : (
                  <span className="auth-nav-badge__icon" aria-hidden="true">✉</span>
                )}
              </Link>
            )}
            <Link href="/account" className="auth-nav-badge__item auth-nav-badge__item--icon" title="設定">
              <span className="auth-nav-badge__icon" aria-hidden="true">⚙</span>
            </Link>
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
