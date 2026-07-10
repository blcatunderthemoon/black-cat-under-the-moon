/**
 * /forum/guardian/monitor — website admin: forum content monitor.
 */

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import AppShell from '../../../components/AppShell.js';
import ForumHeaderAuth from '../../../components/ForumHeaderAuth.js';
import ForumHeaderLogo from '../../../components/ForumHeaderLogo.js';
import ForumAdminNav from '../../../components/ForumAdminNav.js';
import ForumMonitorPanel from '../../../components/forum-admin/ForumMonitorPanel.js';
import MoonLoading from '../../../components/MoonLoading.js';
import { useAuth } from '../../../lib/auth-context.js';
import { canAdminForum } from '../../../lib/forum-roles.js';
import { forumAdminFetch } from '../../../lib/forum-admin-fetch.js';
import { FORUM_DISPLAY_NAME } from '../../../lib/forum-welcome.js';

export default function ForumGuardianMonitorPage() {
  const router = useRouter();
  const { session, profile, profileHydrated, loading: authLoading } = useAuth();
  const isAdmin = canAdminForum(profile?.profile?.forum_role);

  const apiFetch = useCallback(
    (url, options) => forumAdminFetch(session?.access_token, url, options),
    [session?.access_token],
  );

  useEffect(() => {
    if (authLoading || !profileHydrated) return;
    if (!session) {
      router.replace(`/login?redirect=${encodeURIComponent('/forum/guardian/monitor')}`);
      return;
    }
    if (!isAdmin) {
      router.replace('/forum/guardian');
    }
  }, [authLoading, profileHydrated, session, isAdmin, router]);

  const breadcrumbs = [
    { href: '/forum', label: `🌙 ${FORUM_DISPLAY_NAME}` },
    { href: '/forum/guardian', label: '月光守護者' },
    { label: '內容監控' },
  ];

  if (authLoading || !profileHydrated || !session || !isAdmin) {
    return (
      <AppShell
        pageClass="app-page--forum app-page--forum-guardian"
        breadcrumbs={breadcrumbs}
        headerBrand={<ForumHeaderLogo />}
        headerNav={<ForumHeaderAuth redirectPath="/forum/guardian/monitor" />}
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
      headerNav={<ForumHeaderAuth redirectPath="/forum/guardian/monitor" />}
      maxWidth="100%"
    >
      <div className="forum-admin-page">
        <header className="forum-admin-page__hero">
          <h1 className="forum-admin-page__title">🔍 內容監控</h1>
          <p className="forum-admin-page__subtitle">高檢舉數貼文與留言，可隱藏或恢復</p>
          <Link href="/forum/guardian" className="forum-guardian-page__back">
            <span className="forum-guardian-page__back-icon" aria-hidden="true">←</span>
            返回檢舉佇列
          </Link>
        </header>
        <ForumAdminNav />
        <div className="forum-admin-page__workspace forum-admin-page__workspace--wide">
          <ForumMonitorPanel apiFetch={apiFetch} />
        </div>
      </div>
    </AppShell>
  );
}
