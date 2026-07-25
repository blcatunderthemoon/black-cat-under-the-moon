/**
 * /my-cat — 我的月光貓（Phase 1 MVP）
 * Single entry via header 🐾 icon (§1.3, docs/my-cat/MY-CAT-GAME-DESIGN.md).
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth-context.js';
import AppShell from '../components/AppShell.js';
import AppHeaderAuth from '../components/AppHeaderAuth.js';
import SeoHead from '../components/SeoHead.js';
import MyCatPanel from '../components/MyCatPanel.js';
import PageLoadingShell from '../components/PageLoadingShell.js';

export default function MyCatPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const didRedirect = useRef(false);

  useEffect(() => {
    if (loading || session || didRedirect.current) return;
    didRedirect.current = true;
    router.replace('/login?redirect=/my-cat');
  }, [loading, session, router]);

  if (loading || !session) {
    return <PageLoadingShell />;
  }

  const soundEnabled = profile?.profile?.letter_prefs?.sound_enabled !== false;

  return (
    <>
      <SeoHead
        title="我的月光貓"
        description="妳的專屬月光小貓：每日餵食打卡、摸摸貓咪，陪牠在月光下慢慢長大。"
        path="/my-cat"
        noindex
      />
      <AppShell
        title="我的月光貓"
        backHref="/index.html"
        maxWidth="560px"
        pageClassName="app-page--my-cat"
        nav={<AppHeaderAuth redirectPath="/my-cat" />}
      >
        <MyCatPanel
          accessToken={session.access_token}
          userId={session.user?.id}
          soundEnabled={soundEnabled}
        />
      </AppShell>
    </>
  );
}
