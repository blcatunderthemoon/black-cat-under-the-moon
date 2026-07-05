/**
 * /billing/success — Post-PayPal payment success landing page
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context.js';
import { MOONLIGHT_PASSPORT_BRAND } from '../../lib/premium.js';
import AppShell from '../../components/AppShell.js';

export default function BillingSuccessPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!session?.access_token || !router.isReady) return;

    const subscriptionId = String(router.query.subscription_id || '').trim();

    const refreshMe = () => {
      fetch('/api/me', { headers: { Authorization: `Bearer ${session.access_token}` } });
    };

    if (!subscriptionId) {
      const timer = setTimeout(refreshMe, 2000);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    setSyncing(true);

    (async () => {
      try {
        await fetch('/api/billing/activate-subscription', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ subscription_id: subscriptionId }),
        });
        if (!cancelled) refreshMe();
      } catch {
        /* webhook may still activate */
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    return () => { cancelled = true; };
  }, [session?.access_token, router.isReady, router.query.subscription_id]);

  return (
    <>
      <Head><title>付款成功 — Black Cat Under The Moon</title></Head>
      <AppShell centered hideHeader>
        <div className="pixel-card pixel-card--auth">
          <span style={{ fontSize: 56 }}>🎉</span>
          <h1 className="pixel-title">{MOONLIGHT_PASSPORT_BRAND} 啟用成功！</h1>
          <p className="pixel-subtitle" style={{ lineHeight: 1.8 }}>
            {syncing ? '正在確認 PayPal 訂閱狀態…' : (
              <>
                感謝支持月光社群。你的 {MOONLIGHT_PASSPORT_BRAND} 功能已即時開通，
                包括詳細 Mirror Card、主動投信與即時連線通知。
              </>
            )}
          </p>
          <Link href="/mirror-card/me" className="pixel-btn pixel-btn--primary" style={{ textDecoration: 'none', marginTop: 8 }}>
            前往我的 Mirror Card
          </Link>
          <Link href="/forum" className="pixel-btn pixel-btn--ghost" style={{ textDecoration: 'none', width: '100%' }}>
            去月光圍爐
          </Link>
        </div>
      </AppShell>
    </>
  );
}
