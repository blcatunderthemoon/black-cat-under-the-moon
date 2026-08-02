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
import HeaderMyCatLink from './HeaderMyCatLink.js';
import HeaderIconScrollGroup from './HeaderIconScrollGroup.js';
import {
  HeaderBookmarkIcon,
  HeaderCalendarIcon,
  HeaderWishIcon,
  HeaderMailIcon,
  HeaderSettingsIcon,
  HeaderShieldIcon,
} from './HeaderNavIcons.js';
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
      <>
        <span className="forum-header-guest-group">
          <NavLink href={`/login?redirect=${encodeURIComponent(redirectPath)}`}>登入</NavLink>
          <NavLink
            href={`/signup?redirect=${encodeURIComponent(redirectPath)}`}
            className="forum-header-guest-cta"
          >
            註冊
          </NavLink>
        </span>
        {extra}
      </>
    );
  }

  const meData = profile ?? (session.user?.id ? readMeCache(session.user.id) : null);
  const name = profileHydrated ? (displayName || '') : '';
  const unread = meData?.unread_inbox_count || 0;
  const isPremium = isPremiumUser(meData);
  const forumProfile = meData?.profile;
  // Prefer explicit staff flags from /api/me; fall back to forum_role.
  const isForumStaff = Boolean(
    forumProfile?.is_forum_staff
    || forumProfile?.can_admin_forum
    || canModerateForum(forumProfile?.forum_role),
  );
  const path = (router.asPath || router.pathname || '').split(/[?#]/)[0];
  const onGatheringsPage = path === '/gatherings' || path.startsWith('/gatherings/');
  const onWishesPage = path === '/wishes' || path.startsWith('/wishes/');
  const onGuardianPage = path === '/forum/guardian' || path.startsWith('/forum/guardian/');

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
      <span className="forum-header-actions">
        <HeaderIconScrollGroup>
          <button
            type="button"
            className="app-header__nav-link app-header__nav-link--icon forum-header-bookmark-btn"
            title="我的收藏"
            aria-label="我的收藏"
            onClick={openBookmarks}
          >
            <span className="app-header__nav-icon forum-header-bookmark-btn__icon" aria-hidden="true">
              <HeaderBookmarkIcon />
            </span>
          </button>
          {!onGatheringsPage && (
            <Link
              href="/gatherings"
              className="app-header__nav-link app-header__nav-link--icon"
              title="月光聚會"
              aria-label="月光聚會"
            >
              <span className="app-header__nav-icon" aria-hidden="true"><HeaderCalendarIcon /></span>
            </Link>
          )}
          {!onWishesPage && (
            <Link
              href="/wishes"
              className="app-header__nav-link app-header__nav-link--icon"
              title="月光心願"
              aria-label="月光心願"
            >
              <span className="app-header__nav-icon" aria-hidden="true"><HeaderWishIcon /></span>
            </Link>
          )}
          <Link
            href="/inbox"
            className={`app-header__nav-link app-header__nav-link--icon${unread > 0 ? ' app-header__nav-link--inbox-unread' : ''}`}
            title={unread > 0 ? `收件箱（${unread > 99 ? '99+' : unread}）未讀` : '收件箱'}
          >
            <span className="app-header__nav-icon" aria-hidden="true"><HeaderMailIcon /></span>
            {unread > 0 && (
              <span data-unread className="auth-nav-badge__unread forum-nav-unread">{unread > 99 ? '99+' : unread}</span>
            )}
          </Link>
          <Link href="/account" className="app-header__nav-link app-header__nav-link--icon" title="設定">
            <span className="app-header__nav-icon" aria-hidden="true"><HeaderSettingsIcon /></span>
          </Link>
          {moonJourney}
          <HeaderMyCatLink variant="forum" needsFeedBadge={meData?.my_cat?.needs_feed_badge === true} skinId={meData?.my_cat?.skin_id} />
        </HeaderIconScrollGroup>
        {isForumStaff && (
          <Link
            href="/forum/guardian"
            className={`forum-header-guardian-link${onGuardianPage ? ' is-active' : ''}`}
            title="月光守護者 · 版主工具"
            aria-label="版主工具"
            aria-current={onGuardianPage ? 'page' : undefined}
          >
            <span className="forum-header-guardian-link__icon" aria-hidden="true">
              <HeaderShieldIcon size={15} />
            </span>
            <span className="forum-header-guardian-link__text">版主工具</span>
          </Link>
        )}
        {extra}
      </span>
      <button type="button" className="app-header__action forum-header-logout-btn" onClick={handleLogout}>
        登出
      </button>
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
