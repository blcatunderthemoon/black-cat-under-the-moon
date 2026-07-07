/**
 * /forum/guardian — front-end moderation queue for 月光守護者 (Bearer auth).
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import AppShell from '../../components/AppShell.js';
import ForumHeaderAuth from '../../components/ForumHeaderAuth.js';
import ForumHeaderLogo from '../../components/ForumHeaderLogo.js';
import ForumModQueuePanel from '../../components/ForumModQueuePanel.js';
import { useAuth } from '../../lib/auth-context.js';
import { canModerateForum, canAdminForum } from '../../lib/forum-roles.js';
import { formatActorScopeLabel } from '../../lib/forum-moderator-assignments.js';
import { FORUM_DISPLAY_NAME } from '../../lib/forum-welcome.js';

export default function ForumGuardianPage() {
  const router = useRouter();
  const { session, profile, profileHydrated, loading: authLoading } = useAuth();

  const forumRole = profile?.profile?.forum_role;
  const isStaff = canModerateForum(forumRole);
  const isAdmin = canAdminForum(forumRole);

  const [scopeLabel, setScopeLabel] = useState(() => formatActorScopeLabel({
    role: forumRole,
    moderator_topics: profile?.profile?.forum_moderator_topics,
  }));
  const [queueStats, setQueueStats] = useState({ posts: 0, comments: 0, total: 0 });

  const handleQueueLoaded = useCallback((data) => {
    if (data?.actor) {
      setScopeLabel(formatActorScopeLabel(data.actor));
    }
    const posts = data?.posts?.length || 0;
    const comments = data?.comments?.length || 0;
    setQueueStats({ posts, comments, total: posts + comments });
  }, []);

  useEffect(() => {
    if (authLoading || !profileHydrated) return;
    if (!session) {
      router.replace(`/login?redirect=${encodeURIComponent('/forum/guardian')}`);
      return;
    }
    if (!isStaff) {
      router.replace('/forum');
    }
  }, [authLoading, profileHydrated, session, isStaff, router]);

  const breadcrumbs = [
    { href: '/forum', label: `🌙 ${FORUM_DISPLAY_NAME}` },
    { label: '月光守護者' },
  ];

  if (authLoading || !profileHydrated || !session || !isStaff) {
    return (
      <AppShell
        pageClass="app-page--forum app-page--forum-guardian"
        breadcrumbs={breadcrumbs}
        headerBrand={<ForumHeaderLogo />}
        headerNav={<ForumHeaderAuth redirectPath="/forum/guardian" />}
        maxWidth="100%"
      >
        <p className="forum-guardian-page__loading">載入中…</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      pageClass="app-page--forum app-page--forum-guardian"
      breadcrumbs={breadcrumbs}
      headerBrand={<ForumHeaderLogo />}
      headerNav={<ForumHeaderAuth redirectPath="/forum/guardian" />}
      maxWidth="100%"
    >
      <div className="forum-guardian-page">
        <header className="forum-guardian-page__hero">
          <div className="forum-guardian-page__hero-glow" aria-hidden="true" />
          <span className="forum-guardian-page__rivet forum-guardian-page__rivet--tl" aria-hidden="true" />
          <span className="forum-guardian-page__rivet forum-guardian-page__rivet--tr" aria-hidden="true" />
          <span className="forum-guardian-page__rivet forum-guardian-page__rivet--bl" aria-hidden="true" />
          <span className="forum-guardian-page__rivet forum-guardian-page__rivet--br" aria-hidden="true" />

          <div className="forum-guardian-page__hero-top">
            <p className="mirror-card-bio__eyebrow forum-guardian-page__eyebrow">
              <span className="mirror-card-bio__eyebrow-prefix" aria-hidden="true">//</span>
              <span className="mirror-card-bio__eyebrow-label">GUARDIAN</span>
              <span className="mirror-card-bio__eyebrow-line" aria-hidden="true" />
            </p>
            <div className="forum-guardian-page__hero-badges">
              {queueStats.total > 0 && (
                <span className="forum-guardian-page__pending-badge">
                  {queueStats.total} 待處理
                </span>
              )}
            </div>
          </div>

          <h1 className="forum-guardian-page__title">🛡️ 月光守護者</h1>
          <p className="forum-guardian-page__subtitle">
            處理你負責版塊的檢舉內容。操作會寫入審計日誌。
          </p>

          <div className="forum-guardian-page__meta-row">
            <p className="forum-guardian-page__scope">
              負責版塊：<strong>{scopeLabel}</strong>
            </p>
            <p className="forum-guardian-page__role">
              {isAdmin ? '管理員' : '版主'}
            </p>
          </div>

          <div className="forum-guardian-page__links">
            <Link href="/forum" className="forum-guardian-page__back">
              ← 返回論壇
            </Link>
            {isAdmin && (
              <Link href="/dashboard/forum" className="forum-guardian-page__dash-link">
                管理後台 →
              </Link>
            )}
          </div>
        </header>

        <div className="forum-guardian-page__workspace">
          <ForumModQueuePanel
            authMode="bearer"
            accessToken={session.access_token}
            actorMeta={{
              role: forumRole,
              moderator_topics: profile?.profile?.forum_moderator_topics,
              can_admin: profile?.profile?.can_admin_forum,
            }}
            showScope={false}
            showLegend
            onQueueLoaded={handleQueueLoaded}
          />
        </div>
      </div>
    </AppShell>
  );
}
