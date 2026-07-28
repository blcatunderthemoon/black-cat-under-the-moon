/**
 * /admin/moonlight-interest — forum admin: Moonlight Gathering #001 survey feedback
 * (same UI as /dashboard/moonlight-interest; Bearer auth via guardian nav).
 */

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import AppShell from '../../components/AppShell.js';
import ForumHeaderAuth from '../../components/ForumHeaderAuth.js';
import ForumHeaderLogo from '../../components/ForumHeaderLogo.js';
import ForumAdminNav from '../../components/ForumAdminNav.js';
import MoonlightInterestPanel from '../../components/admin/MoonlightInterestPanel.js';
import MoonlightInviteEmailPanel from '../../components/admin/MoonlightInviteEmailPanel.js';
import MoonLoading from '../../components/MoonLoading.js';
import { useAuth } from '../../lib/auth-context.js';
import { canAdminForum } from '../../lib/forum-roles.js';
import { forumAdminFetch } from '../../lib/forum-admin-fetch.js';
import { FORUM_DISPLAY_NAME } from '../../lib/forum-welcome.js';

export default function AdminMoonlightInterestPage() {
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
      router.replace(`/login?redirect=${encodeURIComponent('/admin/moonlight-interest')}`);
      return;
    }
    if (!isAdmin) {
      router.replace('/forum');
    }
  }, [authLoading, profileHydrated, session, isAdmin, router]);

  const breadcrumbs = [
    { href: '/forum', label: FORUM_DISPLAY_NAME },
    { href: '/forum/guardian', label: '月光守護者' },
    { label: 'Moonlight 參加表' },
  ];

  if (authLoading || !profileHydrated || !session || !isAdmin) {
    return (
      <AppShell
        pageClass="app-page--forum app-page--forum-admin"
        breadcrumbs={breadcrumbs}
        headerBrand={<ForumHeaderLogo />}
        headerNav={<ForumHeaderAuth redirectPath="/admin/moonlight-interest" />}
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
      headerNav={<ForumHeaderAuth redirectPath="/admin/moonlight-interest" />}
      maxWidth="100%"
    >
      <div className="forum-admin-page">
        <header className="forum-admin-page__hero">
          <h1 className="forum-admin-page__title">Moonlight 參加表</h1>
          <p className="forum-admin-page__subtitle">#001 · 9/19 下午 2:00–5:00 · 邀請電郵 + 報名回覆</p>
          <Link href="/forum/guardian" className="forum-guardian-page__back">
            <span className="forum-guardian-page__back-icon" aria-hidden="true">←</span>
            返回檢舉佇列
          </Link>
        </header>
        <ForumAdminNav />
        <div className="forum-admin-page__workspace forum-admin-page__workspace--wide">
          <div className="mi-admin-invite-wrap">
            <MoonlightInviteEmailPanel />
          </div>
          <MoonlightInterestPanel apiFetch={apiFetch} />
        </div>
      </div>
    </AppShell>
  );
}
