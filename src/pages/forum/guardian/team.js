/**
 * /forum/guardian/team — website admin: forum moderator team management.
 */

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import AppShell from '../../../components/AppShell.js';
import ForumHeaderAuth from '../../../components/ForumHeaderAuth.js';
import ForumHeaderLogo from '../../../components/ForumHeaderLogo.js';
import ForumAdminNav from '../../../components/ForumAdminNav.js';
import ForumTeamPanel from '../../../components/forum-admin/ForumTeamPanel.js';
import MoonLoading from '../../../components/MoonLoading.js';
import { useAuth } from '../../../lib/auth-context.js';
import { canAdminForum } from '../../../lib/forum-roles.js';
import { forumAdminFetch } from '../../../lib/forum-admin-fetch.js';
import { FORUM_DISPLAY_NAME } from '../../../lib/forum-welcome.js';

export default function ForumGuardianTeamPage() {
  const router = useRouter();
  const { session, profile, profileHydrated, loading: authLoading } = useAuth();
  const isAdmin = canAdminForum(profile?.profile?.forum_role);

  const apiFetch = useCallback(
    (url, options) => forumAdminFetch(session?.access_token, url, options),
    [session?.access_token],
  );

  const onUnauthorized = useCallback(() => {
    router.replace(`/login?redirect=${encodeURIComponent('/forum/guardian/team')}`);
  }, [router]);

  useEffect(() => {
    if (authLoading || !profileHydrated) return;
    if (!session) {
      router.replace(`/login?redirect=${encodeURIComponent('/forum/guardian/team')}`);
      return;
    }
    if (!isAdmin) {
      router.replace('/forum/guardian');
    }
  }, [authLoading, profileHydrated, session, isAdmin, router]);

  const breadcrumbs = [
    { href: '/forum', label: FORUM_DISPLAY_NAME },
    { href: '/forum/guardian', label: '月光守護者' },
    { label: '版主團隊' },
  ];

  if (authLoading || !profileHydrated || !session || !isAdmin) {
    return (
      <AppShell
        pageClass="app-page--forum app-page--forum-guardian"
        breadcrumbs={breadcrumbs}
        headerBrand={<ForumHeaderLogo />}
        headerNav={<ForumHeaderAuth redirectPath="/forum/guardian/team" />}
        maxWidth="100%"
      >
        <MoonLoading variant="hero" className="forum-guardian-page__loading" />
      </AppShell>
    );
  }

  return (
    <AppShell
      pageClass="app-page--forum app-page--forum-guardian"
      breadcrumbs={breadcrumbs}
      headerBrand={<ForumHeaderLogo />}
      headerNav={<ForumHeaderAuth redirectPath="/forum/guardian/team" />}
      maxWidth="100%"
    >
      <div className="forum-admin-page">
        <header className="forum-admin-page__hero">
          <h1 className="forum-admin-page__title">版主團隊</h1>
          <p className="forum-admin-page__subtitle">指派月光守護者與管理員，設定負責版塊</p>
          <Link href="/forum/guardian" className="forum-guardian-page__back">
            <span className="forum-guardian-page__back-icon" aria-hidden="true">←</span>
            返回檢舉佇列
          </Link>
        </header>
        <ForumAdminNav />
        <div className="forum-admin-page__workspace">
          <ForumTeamPanel apiFetch={apiFetch} onUnauthorized={onUnauthorized} />
        </div>
      </div>
    </AppShell>
  );
}
