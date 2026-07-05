/**
 * /login — Email + Password login page
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth, getBrowserClient } from '../lib/auth-context.js';
import { loadRememberLogin, saveRememberLogin } from '../lib/remember-account.js';
import { resolvePostAuthDestination, navigateAfterAuth } from '../lib/post-auth-redirect.js';
import { validateEmail } from '../lib/auth-credentials-policy.js';
import { writeMeCache } from '../lib/me-cache.js';
import AppShell from '../components/AppShell.js';
import AuthBrandHeader from '../components/AuthBrandHeader.js';
import MoonLoading from '../components/MoonLoading.js';

export default function LoginPage() {
  const { signIn, session, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const saved = loadRememberLogin();
    if (saved.remember) {
      setRememberMe(true);
      setEmail(saved.email);
    }
  }, []);

  useEffect(() => {
    if (!loading && session && router.isReady && !submitting) {
      const dest = resolvePostAuthDestination(router.query.redirect);
      navigateAfterAuth(router, dest);
    }
  }, [session, loading, router.isReady, router.query.redirect, router, submitting]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      setError(emailCheck.error);
      return;
    }
    if (!password) {
      setError('請填寫密碼。');
      return;
    }
    setSubmitting(true);
    const { data: signInData, error: signInError } = await signIn(emailCheck.value, password);
    if (signInError) {
      setSubmitting(false);
      setError('Email 或密碼不正確，請再試。');
      return;
    }
    const token = signInData?.session?.access_token;
    const userId = signInData?.session?.user?.id;
    if (token) {
      const initRes = await fetch('/api/auth/init-profile', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!initRes.ok) {
        const initData = await initRes.json().catch(() => ({}));
        if (initData.code === 'ACCOUNT_DISABLED') {
          await getBrowserClient().auth.signOut();
          setError('此帳號已被停用，請聯繫客服。');
          setSubmitting(false);
          return;
        }
      }
      try {
        const meRes = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (meRes.ok) {
          const data = await meRes.json();
          if (data && userId) writeMeCache(userId, data);
        }
      } catch {
        /* index auth-nav will refetch */
      }
    }
    saveRememberLogin(rememberMe, email);
    setSubmitting(false);
  }

  if (loading) {
    return (
      <>
        <Head><title>登入 — Black Cat Under The Moon</title></Head>
        <AppShell centered hideHeader>
          <MoonLoading label="載入中…" />
        </AppShell>
      </>
    );
  }

  const redirect = typeof router.query.redirect === 'string' ? router.query.redirect : '';
  const redirectQuery = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';

  return (
    <>
      <Head><title>登入 — Black Cat Under The Moon</title></Head>
      <AppShell centered hideHeader>
        <div className="pixel-card pixel-card--auth pixel-card--login">
          <AuthBrandHeader tagline="歡迎回來" />

          <form onSubmit={handleSubmit} className="pixel-form pixel-form--login">
            <label className="pixel-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="pixel-input"
              disabled={submitting}
            />

            <label className="pixel-label">密碼</label>
            <div className="pixel-auth-password-wrap">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="輸入密碼"
                autoComplete="current-password"
                className="pixel-input"
                disabled={submitting}
              />
              <div className="pixel-auth-password-footer">
                <label className="pixel-check-row pixel-check-row--inline">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ accentColor: 'var(--accent)' }}
                    disabled={submitting}
                  />
                  <span>記住帳號</span>
                </label>
                <Link href={`/forgot-password${redirectQuery}`} className="pixel-link pixel-link--subtle">
                  忘記密碼？
                </Link>
              </div>
            </div>

            {error && <p className="pixel-error">{error}</p>}

            <button type="submit" className="pixel-btn pixel-btn--primary" disabled={submitting}>
              {submitting ? '登入中…' : '登入'}
            </button>
          </form>

          <p className="pixel-footer-text">
            還沒有帳號？{' '}
            <Link href={`/signup${redirectQuery}`} className="pixel-link">立即註冊</Link>
          </p>
        </div>
      </AppShell>
    </>
  );
}
