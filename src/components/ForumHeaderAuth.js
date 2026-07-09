/**
 * Forum header auth — same order/items as public auth-nav badge,
 * styled with forum header classes (not auth-nav-badge chrome).
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth-context.js';
import { NavLink } from './AppShell.js';
import ForumBookmarksPanel from './ForumBookmarksPanel.js';
import HeaderPremiumMoon from './HeaderPremiumMoon.js';
import { isPremiumUser } from '../lib/premium.js';
import { canModerateForum } from '../lib/forum-roles.js';
import { readMeCache } from '../lib/me-cache.js';

export default function ForumHeaderAuth({ extra = null, moonJourney = null, redirectPath = '/forum', onBookmarksClick = null }) {
  const { session, profile, displayName, signOut, loading, profileHydrated } = useAuth();
  const router = useRouter();
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const useParentBookmarks = typeof onBookmarksClick === 'function';

  async function handleLogout() {
    await signOut();
    router.replace(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }

  function openBookmarks() {
    if (useParentBookmarks) {
      onBookmarksClick();
      return;
    }
    setBookmarksOpen(true);
  }

  if (loading) {
    return extra ?? null;
  }

  if (!session) {
    return (
      <span className="forum-header-guest-group">
        <NavLink href={`/login?redirect=${encodeURIComponent(redirectPath)}`}>登入</NavLink>
        <NavLink href={`/signup?redirect=${encodeURIComponent(redirectPath)}`}>註冊</NavLink>
        {extra}
      </span>
    );
  }

  const meData = profile ?? (session.user?.id ? readMeCache(session.user.id) : null);
  const name = profileHydrated ? (displayName || '') : '';
  const unread = meData?.unread_inbox_count || 0;
  const isPremium = isPremiumUser(meData);
  const isForumStaff = canModerateForum(meData?.profile?.forum_role);

  return (
    <>
      <span className="forum-header-name-group">
        {profileHydrated && name ? (
          <NavLink href="/mirror-card/me">{name}</NavLink>
        ) : (
          <span className="forum-header-name-placeholder" aria-hidden="true" />
        )}
        {isPremium && (
          <HeaderPremiumMoon profile={meData} className="forum-header-moon" />
        )}
      </span>
      <span className="forum-header-icon-group">
        {isForumStaff && (
          <Link
            href="/forum/guardian"
            className="app-header__nav-link app-header__nav-link--icon forum-header-guardian-btn"
            title="月光守護者"
            aria-label="月光守護者治理面板"
          >
            <span className="app-header__nav-icon" aria-hidden="true">🛡️</span>
          </Link>
        )}
        <button
          type="button"
          className="app-header__nav-link app-header__nav-link--icon forum-header-bookmark-btn"
          title="我的收藏"
          aria-label="我的收藏"
          onClick={openBookmarks}
        >
          <span className="app-header__nav-icon forum-header-bookmark-btn__icon" aria-hidden="true">🔖</span>
        </button>
        <Link
          href="/inbox"
          className={`app-header__nav-link app-header__nav-link--icon${unread > 0 ? ' app-header__nav-link--inbox-unread' : ''}`}
          title="收件箱"
        >
          {unread > 0 ? (
            <span className="forum-nav-unread forum-nav-unread--full">{unread}</span>
          ) : (
            <span className="app-header__nav-icon" aria-hidden="true">✉</span>
          )}
        </Link>
        <Link href="/account" className="app-header__nav-link app-header__nav-link--icon" title="設定">
          <span className="app-header__nav-icon" aria-hidden="true">⚙</span>
        </Link>
        {moonJourney}
      </span>
      <button type="button" className="app-header__action forum-header-logout-btn" onClick={handleLogout}>
        登出
      </button>
      {extra}
      {!useParentBookmarks && bookmarksOpen && (
        <ForumBookmarksPanel
          open={bookmarksOpen}
          onClose={() => setBookmarksOpen(false)}
          accessToken={session.access_token}
        />
      )}
    </>
  );
}
