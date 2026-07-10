/**
 * /signup — Email + Password registration page
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../lib/auth-context.js';
import { resolvePostAuthDestination, navigateAfterAuth } from '../lib/post-auth-redirect.js';
import { validateDisplayName, sanitizeDisplayNameInput, DISPLAY_NAME_MAX_LENGTH } from '../lib/display-name-policy.js';
import { validateEmail, validatePassword, PASSWORD_MIN_LENGTH, PASSWORD_PLACEHOLDER } from '../lib/auth-credentials-policy.js';
import { isDuplicateSignupError, DUPLICATE_EMAIL_ERROR } from '../lib/auth-signup-errors.js';
import AppShell from '../components/AppShell.js';
import AuthBrandHeader from '../components/AuthBrandHeader.js';
import PasswordRequirementsChecklist from '../components/PasswordRequirementsChecklist.js';

export default function SignupPage() {
  const { signUp, session, loading } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session && router.isReady) {
      const dest = resolvePostAuthDestination(router.query.redirect);
      navigateAfterAuth(router, dest);
    }
  }, [session, loading, router.isReady, router.query.redirect, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!displayName.trim()) { setError('請填寫你的暱稱。'); return; }
    const nameCheck = validateDisplayName(displayName);
    if (!nameCheck.ok) { setError(nameCheck.error); return; }
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) { setError(emailCheck.error); return; }
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) { setError(passwordCheck.error); return; }
    if (password !== confirm) { setError('兩次密碼不一致。'); return; }
    if (!agreed) { setError('請先同意條款及私隱政策。'); return; }

    setSubmitting(true);

    try {
      const availabilityRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailCheck.value }),
      });
      const availabilityData = await availabilityRes.json().catch(() => ({}));
      if (!availabilityRes.ok) {
        setError(availabilityData.error || '無法驗證 Email，請稍後再試。');
        return;
      }
      if (!availabilityData.available) {
        setError(DUPLICATE_EMAIL_ERROR);
        return;
      }

      const nameAvailabilityRes = await fetch('/api/auth/check-display-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: nameCheck.value }),
      });
      const nameAvailabilityData = await nameAvailabilityRes.json().catch(() => ({}));
      if (!nameAvailabilityRes.ok) {
        setError(nameAvailabilityData.error || '無法驗證暱稱，請稍後再試。');
        return;
      }
      if (!nameAvailabilityData.available) {
        setError('此暱稱已被使用，請換一個名字。');
        return;
      }

      const { data: signUpData, error: signUpError } = await signUp(
        emailCheck.value,
        passwordCheck.value,
        nameCheck.value,
      );

      if (signUpError || isDuplicateSignupError(signUpError, signUpData)) {
        if (isDuplicateSignupError(signUpError, signUpData)) {
          setError(DUPLICATE_EMAIL_ERROR);
        } else if (signUpError?.message?.includes('rate limit') || signUpError?.status === 429) {
          setError('系統繁忙，請稍等幾分鐘後再試。（Email 傳送限制）');
        } else if (signUpError?.message?.includes('invalid') && signUpError?.message?.includes('email')) {
          setError('Email 格式不正確，請重新輸入。');
        } else {
          setError('註冊失敗：' + (signUpError?.message || '請稍後再試。'));
        }
        return;
      }

      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  const redirect = typeof router.query.redirect === 'string' ? router.query.redirect : '';
  const redirectQuery = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';

  if (success) {
    return (
      <>
        <Head><title>確認 Email — Black Cat Under The Moon</title></Head>
        <AppShell centered hideHeader pageClassName="app-page--signup">
          <div className="pixel-card pixel-card--auth pixel-card--signup pixel-card--signup-success">
            <AuthBrandHeader />
            <p className="signup-success__icon" aria-hidden="true">✉️</p>
            <h2 className="auth-success-headline">確認你的 Email</h2>
            <p className="signup-success__body pixel-subtitle">
              我們已發送確認信至
              <strong className="signup-success__email">{email}</strong>
              請點擊信中連結完成註冊。
            </p>
            <Link href={`/login${redirectQuery}`} className="pixel-btn pixel-btn--primary pixel-btn--signup">
              返回登入
            </Link>
          </div>
        </AppShell>
      </>
    );
  }

  return (
    <>
      <Head><title>註冊 — Black Cat Under The Moon</title></Head>
      <AppShell centered hideHeader pageClassName="app-page--signup">
        <div className="pixel-card pixel-card--auth pixel-card--signup">
          <AuthBrandHeader tagline="加入月光社群" subtitle="安全、溫暖、找到同頻的她" />

          <form onSubmit={handleSubmit} className="pixel-form pixel-form--signup" noValidate>
            <label className="pixel-label pixel-label--with-meta" htmlFor="signup-display-name">
              <span>站內暱稱</span>
              <span className="pixel-char-count" aria-live="polite">
                {displayName.length}/{DISPLAY_NAME_MAX_LENGTH}
              </span>
            </label>
            <input
              id="signup-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(sanitizeDisplayNameInput(e.target.value))}
              placeholder="中英文、數字，最多 10 字"
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              className="pixel-input"
              disabled={submitting}
              autoComplete="nickname"
            />

            <label className="pixel-label" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              autoComplete="email"
              className="pixel-input"
              disabled={submitting}
            />

            <label className="pixel-label" htmlFor="signup-password">密碼</label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={PASSWORD_PLACEHOLDER}
              minLength={PASSWORD_MIN_LENGTH}
              autoComplete="new-password"
              className="pixel-input"
              disabled={submitting}
            />
            <PasswordRequirementsChecklist password={password} className="password-requirements--signup" />

            <label className="pixel-label" htmlFor="signup-confirm">確認密碼</label>
            <input
              id="signup-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="再輸入一次密碼"
              autoComplete="new-password"
              className="pixel-input"
              disabled={submitting}
            />

            <label className="pixel-check-row auth-terms">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
                disabled={submitting}
              />
              <span>
                我同意{' '}
                <a href="/tos.html" target="_blank" rel="noopener" className="pixel-link">服務條款</a>
                {' '}及{' '}
                <a href="/privacy.html" target="_blank" rel="noopener" className="pixel-link">私隱政策</a>
              </span>
            </label>

            {error && <p className="pixel-error">{error}</p>}

            <button type="submit" className="pixel-btn pixel-btn--primary pixel-btn--signup" disabled={submitting}>
              {submitting ? '處理中…' : '立即註冊'}
            </button>
          </form>

          <p className="pixel-footer-text">
            已有帳號？{' '}
            <Link href={`/login${redirectQuery}`} className="pixel-link">登入</Link>
          </p>
        </div>
      </AppShell>
    </>
  );
}
