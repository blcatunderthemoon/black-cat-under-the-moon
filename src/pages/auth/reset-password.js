/**
 * /auth/reset-password — Set new password after email recovery link
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { getBrowserClient } from '../../lib/auth-context.js';
import { validatePassword, PASSWORD_MIN_LENGTH, PASSWORD_PLACEHOLDER } from '../../lib/auth-credentials-policy.js';
import PasswordRequirementsChecklist from '../../components/PasswordRequirementsChecklist.js';
import AppShell from '../../components/AppShell.js';
import MoonLoading from '../../components/MoonLoading.js';
import { resolvePostAuthDestination } from '../../lib/post-auth-redirect.js';

function buildRedirectQuery(redirect) {
  if (!redirect || typeof redirect !== 'string') return '';
  return `?redirect=${encodeURIComponent(redirect)}`;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const redirect = typeof router.query.redirect === 'string' ? router.query.redirect : '';
  const redirectQuery = buildRedirectQuery(redirect);

  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;

    async function initRecoverySession() {
      const client = getBrowserClient();
      if (!client) {
        setErrorMsg('無法連線，請重新整理頁面。');
        setStatus('error');
        return;
      }

      const { error: urlError, error_description: urlDesc, code } = router.query;

      if (urlError) {
        setErrorMsg(String(urlDesc || urlError));
        setStatus('error');
        return;
      }

      if (code) {
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(String(code));
        if (exchangeError) {
          setErrorMsg(exchangeError.message || '連結無效或已過期，請重新申請重設密碼。');
          setStatus('error');
          return;
        }
      } else {
        await new Promise((r) => setTimeout(r, 600));
      }

      const { data: { session } } = await client.auth.getSession();
      if (!session) {
        setErrorMsg('連結無效或已過期，請重新申請重設密碼。');
        setStatus('error');
        return;
      }

      setStatus('ready');
    }

    initRecoverySession();
  }, [router.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) {
      setFormError(passwordCheck.error);
      return;
    }
    if (password !== confirm) {
      setFormError('兩次密碼不一致。');
      return;
    }

    setSubmitting(true);
    try {
      const client = getBrowserClient();
      const { error } = await client.auth.updateUser({ password: passwordCheck.value });
      if (error) {
        setFormError(error.message || '密碼重設失敗，請重試。');
        setSubmitting(false);
        return;
      }

      try {
        const { data: { session } } = await client.auth.getSession();
        if (session?.access_token) {
          await fetch('/api/auth/clear-login-lockout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
        }
      } catch {
        /* lockout clear is best-effort */
      }

      const dest = resolvePostAuthDestination(redirect);
      if (dest.endsWith('.html')) {
        window.location.href = dest;
      } else {
        router.replace(dest);
      }
    } catch {
      setFormError('網路錯誤，請重試。');
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head><title>重設密碼 — Black Cat Under The Moon</title></Head>
      <AppShell centered hideHeader>
        <div className="pixel-card pixel-card--auth">
          {status === 'loading' && (
            <MoonLoading />
          )}

          {status === 'error' && (
            <>
              <div style={{ fontSize: 40 }}>⚠️</div>
              <h1 className="pixel-title">無法重設密碼</h1>
              <p className="pixel-subtitle" style={{ lineHeight: 1.8 }}>{errorMsg}</p>
              <Link
                href={`/forgot-password${redirectQuery}`}
                className="pixel-btn pixel-btn--primary"
                style={{ marginTop: 8, textDecoration: 'none' }}
              >
                重新申請重設連結
              </Link>
              <Link
                href={`/login${redirectQuery}`}
                className="pixel-btn pixel-btn--ghost"
                style={{ marginTop: 8, textDecoration: 'none', width: '100%' }}
              >
                返回登入
              </Link>
            </>
          )}

          {status === 'ready' && (
            <>
              <img src="/entrancelogo.png" alt="" className="auth-logo" />
              <h1 className="pixel-title">設定新密碼</h1>
              <p className="pixel-subtitle">請輸入你的新密碼</p>

              <form onSubmit={handleSubmit} className="pixel-form">
                <label className="pixel-label">新密碼</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={PASSWORD_PLACEHOLDER}
                  minLength={PASSWORD_MIN_LENGTH}
                  autoComplete="new-password"
                  className="pixel-input"
                  disabled={submitting}
                />
                <PasswordRequirementsChecklist password={password} />

                <label className="pixel-label">確認密碼</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="再輸入一次密碼"
                  autoComplete="new-password"
                  className="pixel-input"
                  disabled={submitting}
                />

                {formError && <p className="pixel-error">{formError}</p>}

                <button type="submit" className="pixel-btn pixel-btn--primary" disabled={submitting}>
                  {submitting ? '更新中…' : '更新密碼'}
                </button>
              </form>
            </>
          )}
        </div>
      </AppShell>
    </>
  );
}
