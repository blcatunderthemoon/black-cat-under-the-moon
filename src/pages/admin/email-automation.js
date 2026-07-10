/**
 * /admin/email-automation — website admin entry for match email automation.
 */

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import AppShell from '../../components/AppShell.js';
import ForumHeaderAuth from '../../components/ForumHeaderAuth.js';
import ForumHeaderLogo from '../../components/ForumHeaderLogo.js';
import ForumAdminNav from '../../components/ForumAdminNav.js';
import { EmailAutomationPanel } from '../../components/admin/EmailAutomationPanel.js';
import MoonLoading from '../../components/MoonLoading.js';
import { AdminApiContext } from '../../lib/admin-api-context.js';
import { useAuth } from '../../lib/auth-context.js';
import { canAdminForum } from '../../lib/forum-roles.js';
import { forumAdminFetch } from '../../lib/forum-admin-fetch.js';
import { FORUM_DISPLAY_NAME } from '../../lib/forum-welcome.js';

export default function AdminEmailAutomationPage() {
  const router = useRouter();
  const { session, profile, profileHydrated, loading: authLoading } = useAuth();
  const isAdmin = canAdminForum(profile?.profile?.forum_role);

  const apiFetch = useMemo(() => {
    const token = session?.access_token;
    return (url, options) => forumAdminFetch(token, url, options);
  }, [session?.access_token]);

  useEffect(() => {
    if (authLoading || !profileHydrated) return;
    if (!session) {
      router.replace(`/login?redirect=${encodeURIComponent('/admin/email-automation')}`);
      return;
    }
    if (!isAdmin) {
      router.replace('/forum');
    }
  }, [authLoading, profileHydrated, session, isAdmin, router]);

  const breadcrumbs = [
    { href: '/forum', label: `🌙 ${FORUM_DISPLAY_NAME}` },
    { href: '/forum/guardian', label: '月光守護者' },
    { label: '郵件自動化' },
  ];

  if (authLoading || !profileHydrated || !session || !isAdmin) {
    return (
      <AppShell
        pageClass="app-page--forum app-page--forum-admin"
        breadcrumbs={breadcrumbs}
        headerBrand={<ForumHeaderLogo />}
        headerNav={<ForumHeaderAuth redirectPath="/admin/email-automation" />}
        maxWidth="100%"
      >
        <MoonLoading variant="hero" className="forum-guardian-page__loading" />
      </AppShell>
    );
  }

  return (
    <AppShell
      pageClass="app-page--forum app-page--forum-admin"
      breadcrumbs={breadcrumbs}
      headerBrand={<ForumHeaderLogo />}
      headerNav={<ForumHeaderAuth redirectPath="/admin/email-automation" />}
      maxWidth="100%"
    >
      <div className="forum-admin-page">
        <header className="forum-admin-page__hero">
          <h1 className="forum-admin-page__title">📧 郵件自動化</h1>
          <p className="forum-admin-page__subtitle">配對連線通知郵件與 Gmail 草稿管理</p>
          <Link href="/forum/guardian" className="forum-guardian-page__back">
            <span className="forum-guardian-page__back-icon" aria-hidden="true">←</span>
            返回檢舉佇列
          </Link>
        </header>
        <ForumAdminNav />
        <div className="forum-admin-page__workspace forum-admin-page__workspace--wide">
          <AdminApiContext.Provider value={apiFetch}>
            <EmailAutomationPanel />
          </AdminApiContext.Provider>
        </div>
      </div>
    </AppShell>
  );
}
