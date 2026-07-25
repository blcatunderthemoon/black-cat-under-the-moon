/**
 * /forgot-password — Request password reset email
 */

import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../lib/auth-context.js';
import { validateEmail } from '../lib/auth-credentials-policy.js';
import AppShell from '../components/AppShell.js';
import { HeaderMailIcon } from '../components/UiIcons.js';

function buildRedirectQuery(redirect) {
  if (!redirect || typeof redirect !== 'string') return '';
  return `?redirect=${encodeURIComponent(redirect)}`;
}

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const router = useRouter();
  const redirect = typeof router.query.redirect === 'string' ? router.query.redirect : '';
  const redirectQuery = buildRedirectQuery(redirect);

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      setError(emailCheck.error);
      return;
    }

    setSubmitting(true);
    const { error: resetError } = await resetPassword(emailCheck.value, redirect || undefined);
    setSubmitting(false);

    if (resetError) {
      if (resetError.message?.includes('rate limit') || resetError.status === 429) {
        setError('系統繁忙，請稍等幾分鐘後再試。（Email 傳送限制）');
      } else if (resetError.message?.includes('invalid') && resetError.message?.includes('email')) {
        setError('Email 格式不正確，請重新輸入。');
      } else {
        setError('無法寄出重設連結，請稍後再試。');
      }
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <>
        <Head><title>重設密碼 — Black Cat Under The Moon</title></Head>
        <AppShell centered hideHeader>
          <div className="pixel-card pixel-card--auth">
            <div style={{ fontSize: 40 }} aria-hidden="true"><HeaderMailIcon size={40} /></div>
            <h1 className="pixel-title">請檢查 Email</h1>
            <p className="pixel-subtitle" style={{ lineHeight: 1.8 }}>
              如果此 Email 有註冊帳號，我們已寄出重設密碼連結至<br />
              <strong style={{ color: 'var(--purple-light)' }}>{email}</strong><br />
              請檢查收件匣（及垃圾郵件），並在連結過期前完成重設。
            </p>
            <Link
              href={`/login${redirectQuery}`}
              className="pixel-btn pixel-btn--primary"
              style={{ textDecoration: 'none' }}
            >
              返回登入
            </Link>
          </div>
        </AppShell>
      </>
    );
  }

  return (
    <>
      <Head><title>忘記密碼 — Black Cat Under The Moon</title></Head>
      <AppShell centered hideHeader>
        <div className="pixel-card pixel-card--auth">
          <img src="/entrancelogo.png" alt="" className="auth-logo" />
          <h1 className="pixel-title">忘記密碼</h1>
          <p className="pixel-subtitle">輸入註冊 Email，我們會寄送重設連結給你</p>

          <form onSubmit={handleSubmit} className="pixel-form">
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

            {error && <p className="pixel-error">{error}</p>}

            <button type="submit" className="pixel-btn pixel-btn--primary" disabled={submitting}>
              {submitting ? '寄送中…' : '寄送重設連結'}
            </button>
          </form>

          <p className="pixel-footer-text">
            <Link href={`/login${redirectQuery}`} className="pixel-link">返回登入</Link>
          </p>
        </div>
      </AppShell>
    </>
  );
}
