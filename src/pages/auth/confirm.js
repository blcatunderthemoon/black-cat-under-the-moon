/**
 * /auth/confirm — Email confirmation callback from Supabase
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { getBrowserClient } from '../../lib/auth-context.js';
import AppShell from '../../components/AppShell.js';
import MoonLoading from '../../components/MoonLoading.js';

export default function AuthConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!router.isReady) return;

    async function handleConfirm() {
      const client = getBrowserClient();
      if (!client) {
        setErrorMsg('無法連線，請重新整理頁面。');
        setStatus('error');
        return;
      }

      const { code, error: urlError, error_description: urlDesc } = router.query;

      if (urlError) {
        setErrorMsg(String(urlDesc || urlError));
        setStatus('error');
        return;
      }

      if (code) {
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(String(code));
        if (exchangeError) {
          setErrorMsg(exchangeError.message || '確認失敗，連結可能已過期。');
          setStatus('error');
          return;
        }
      } else {
        await new Promise((r) => setTimeout(r, 600));
      }

      const { data: { session } } = await client.auth.getSession();
      if (!session) {
        setErrorMsg('確認連結無效或已過期，請重新註冊。');
        setStatus('error');
        return;
      }

      try {
        await fetch('/api/auth/init-profile', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      } catch {
        // non-fatal
      }

      router.replace('/mirror-card/me');
    }

    handleConfirm();
  }, [router.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Head><title>確認帳號 — Black Cat Under The Moon</title></Head>
      <AppShell centered hideHeader>
        <div className="pixel-card pixel-card--auth">
          {status === 'loading' ? (
            <MoonLoading />
          ) : (
            <>
              <div style={{ fontSize: 40 }}>⚠️</div>
              <p className="pixel-subtitle" style={{ lineHeight: 1.8 }}>{errorMsg}</p>
              <Link href="/signup" className="pixel-btn pixel-btn--primary" style={{ marginTop: 8, textDecoration: 'none' }}>
                重新註冊
              </Link>
              <Link href="/login" className="pixel-btn pixel-btn--ghost" style={{ marginTop: 8, textDecoration: 'none', width: '100%' }}>
                前往登入
              </Link>
            </>
          )}
        </div>
      </AppShell>
    </>
  );
}
