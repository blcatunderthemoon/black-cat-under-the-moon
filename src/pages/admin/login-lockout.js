/**
 * /admin/login-lockout — forum admin: look up / clear login password freeze
 * + investigate frequent freeze offenders.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import AppShell from '../../components/AppShell.js';
import ForumHeaderAuth from '../../components/ForumHeaderAuth.js';
import ForumHeaderLogo from '../../components/ForumHeaderLogo.js';
import ForumAdminNav from '../../components/ForumAdminNav.js';
import MoonLoading from '../../components/MoonLoading.js';
import { useAuth } from '../../lib/auth-context.js';
import { canAdminForum } from '../../lib/forum-roles.js';
import { forumAdminFetch } from '../../lib/forum-admin-fetch.js';
import { FORUM_DISPLAY_NAME } from '../../lib/forum-welcome.js';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-HK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminLoginLockoutPage() {
  const router = useRouter();
  const { session, profile, profileHydrated, loading: authLoading } = useAuth();
  const isAdmin = canAdminForum(profile?.profile?.forum_role);

  const apiFetch = useMemo(() => {
    const token = session?.access_token;
    return (url, options) => forumAdminFetch(token, url, options);
  }, [session?.access_token]);

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(true);
  const [frequent, setFrequent] = useState([]);
  const [freqMeta, setFreqMeta] = useState({ window_days: 30, frequent_threshold: 3 });
  const [freqLoading, setFreqLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !profileHydrated) return;
    if (!session) {
      router.replace(`/login?redirect=${encodeURIComponent('/admin/login-lockout')}`);
      return;
    }
    if (!isAdmin) {
      router.replace('/forum');
    }
  }, [authLoading, profileHydrated, session, isAdmin, router]);

  const loadFrequent = useCallback(async () => {
    if (!session?.access_token) return;
    setFreqLoading(true);
    try {
      const res = await apiFetch('/api/dashboard/login-lockout?view=frequent&limit=40');
      const data = await res.json();
      if (res.ok) {
        setFrequent(data.summaries || []);
        setFreqMeta({
          window_days: data.window_days || 30,
          frequent_threshold: data.frequent_threshold || 3,
        });
      }
    } catch {
      /* ignore list errors */
    } finally {
      setFreqLoading(false);
    }
  }, [apiFetch, session?.access_token]);

  useEffect(() => {
    if (!isAdmin || !session) return;
    loadFrequent();
  }, [isAdmin, session, loadFrequent]);

  const breadcrumbs = [
    { href: '/forum', label: `🌙 ${FORUM_DISPLAY_NAME}` },
    { href: '/forum/guardian', label: '月光守護者' },
    { label: '登入鎖定' },
  ];

  async function lookup(e, overrideEmail) {
    e?.preventDefault?.();
    const value = String(overrideEmail ?? email).trim();
    if (!value) {
      setMsgOk(false);
      setMsg('請輸入 Email。');
      return;
    }
    setEmail(value);
    setBusy(true);
    setMsg('');
    setStatus(null);
    try {
      const res = await apiFetch(`/api/dashboard/login-lockout?email=${encodeURIComponent(value)}`);
      const data = await res.json();
      if (!res.ok) {
        setMsgOk(false);
        setMsg(data.error || '查詢失敗');
        return;
      }
      setStatus(data);
      setMsgOk(true);
      if (data.login_lockout_frequent) {
        setMsg(`⚠ 高風險：過去 ${data.frequent_window_days || 30} 日已觸發凍結 ${data.lockout_count_window} 次（≥ ${data.frequent_threshold}）。`);
      } else if (data.locked) {
        setMsg('此 Email 目前處於登入凍結。');
      } else if (data.failure_count > 0) {
        setMsg(`尚未凍結，但已累積 ${data.failure_count} 次失敗。`);
      } else if (data.lockout_count_total > 0) {
        setMsg(`目前未鎖定；歷史凍結 ${data.lockout_count_total} 次。`);
      } else {
        setMsg('此 Email 目前沒有登入鎖定，亦無凍結紀錄。');
      }
    } catch {
      setMsgOk(false);
      setMsg('網路錯誤，請重試。');
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    const value = (status?.email || email).trim();
    if (!value) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await apiFetch('/api/dashboard/login-lockout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsgOk(false);
        setMsg(data.error || '解除失敗');
        return;
      }
      setMsgOk(true);
      setMsg(data.message || '已解除登入鎖定');
      await lookup(null, value);
      loadFrequent();
    } catch {
      setMsgOk(false);
      setMsg('網路錯誤，請重試。');
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !profileHydrated || !session || !isAdmin) {
    return (
      <AppShell
        pageClass="app-page--forum app-page--forum-admin"
        breadcrumbs={breadcrumbs}
        headerBrand={<ForumHeaderLogo />}
        headerNav={<ForumHeaderAuth redirectPath="/admin/login-lockout" />}
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
      headerNav={<ForumHeaderAuth redirectPath="/admin/login-lockout" />}
      maxWidth="100%"
    >
      <div className="forum-admin-page">
        <header className="forum-admin-page__hero">
          <h1 className="forum-admin-page__title">🔓 登入鎖定</h1>
          <p className="forum-admin-page__subtitle">
            查詢／解除凍結，並調查頻繁觸發錯密鎖定的帳號（{freqMeta.window_days} 日 ≥ {freqMeta.frequent_threshold} 次 = 高風險）
          </p>
          <Link href="/forum/guardian" className="forum-guardian-page__back">
            <span className="forum-guardian-page__back-icon" aria-hidden="true">←</span>
            返回檢舉佇列
          </Link>
        </header>
        <ForumAdminNav />
        <div className="forum-admin-page__workspace forum-admin-page__workspace--wide">
          <div className="forum-admin-lockout-grid">
            <section className="forum-admin-lockout">
              <form className="forum-admin-lockout__form" onSubmit={lookup}>
                <label className="forum-admin-lockout__label" htmlFor="lockout-email">Email</label>
                <div className="forum-admin-lockout__row">
                  <input
                    id="lockout-email"
                    type="email"
                    className="forum-admin-lockout__input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    disabled={busy}
                    autoComplete="off"
                  />
                  <button type="submit" className="forum-admin-lockout__btn" disabled={busy}>
                    {busy ? '處理中…' : '查詢'}
                  </button>
                </div>
              </form>

              {msg && (
                <p className={`forum-admin-lockout__msg${msgOk ? '' : ' forum-admin-lockout__msg--err'}`} role="status">
                  {msg}
                </p>
              )}

              {status && (
                <div className={`forum-admin-lockout__card${status.login_lockout_frequent ? ' forum-admin-lockout__card--frequent' : ''}`}>
                  <dl className="forum-admin-lockout__dl">
                    <div>
                      <dt>Email</dt>
                      <dd>{status.email}</dd>
                    </div>
                    <div>
                      <dt>狀態</dt>
                      <dd>
                        {status.locked ? '凍結中' : '未凍結'}
                        {status.login_lockout_frequent ? ' · ⚠ 高風險' : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>失敗次數</dt>
                      <dd>{status.failure_count || 0} / 10</dd>
                    </div>
                    <div>
                      <dt>凍結至</dt>
                      <dd>{formatDate(status.lockout_until)}</dd>
                    </div>
                    <div>
                      <dt>30 日凍結</dt>
                      <dd>{status.lockout_count_window || 0} 次</dd>
                    </div>
                    <div>
                      <dt>歷史凍結</dt>
                      <dd>{status.lockout_count_total || 0} 次 · 最近 {formatDate(status.last_lockout_at)}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className="forum-admin-lockout__btn forum-admin-lockout__btn--unlock"
                    onClick={unlock}
                    disabled={busy || (!status.locked && !(status.failure_count > 0))}
                  >
                    解除登入鎖定
                  </button>

                  {Array.isArray(status.events) && status.events.length > 0 && (
                    <div className="forum-admin-lockout__events">
                      <h3 className="forum-admin-lockout__events-title">凍結紀錄</h3>
                      <ul className="forum-admin-lockout__events-list">
                        {status.events.map((ev) => (
                          <li key={ev.id} className="forum-admin-lockout__events-item">
                            <span>{formatDate(ev.created_at)}</span>
                            <span className="forum-admin-lockout__events-meta">
                              IP {ev.ip || '—'}
                              {ev.failure_count != null ? ` · 錯密 ${ev.failure_count}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="forum-admin-lockout forum-admin-lockout--frequent">
              <div className="forum-admin-lockout__freq-head">
                <h2 className="forum-admin-lockout__freq-title">高風險帳號</h2>
                <button
                  type="button"
                  className="forum-admin-lockout__btn"
                  onClick={loadFrequent}
                  disabled={freqLoading}
                >
                  {freqLoading ? '載入中…' : '重新整理'}
                </button>
              </div>
              <p className="forum-admin-lockout__freq-hint">
                過去 {freqMeta.window_days} 日觸發凍結 ≥ {freqMeta.frequent_threshold} 次。點 Email 可載入詳情。
              </p>
              {frequent.length === 0 ? (
                <p className="forum-admin-lockout__freq-empty">
                  {freqLoading ? '載入中…' : '目前沒有高風險帳號。'}
                </p>
              ) : (
                <ul className="forum-admin-lockout__freq-list">
                  {frequent.map((row) => (
                    <li key={row.email} className="forum-admin-lockout__freq-item">
                      <button
                        type="button"
                        className="forum-admin-lockout__freq-email"
                        onClick={() => lookup(null, row.email)}
                      >
                        {row.email}
                      </button>
                      <span className="forum-admin-lockout__freq-count">
                        {row.lockout_count_window} 次
                      </span>
                      <span className="forum-admin-lockout__freq-meta">
                        最近 {formatDate(row.last_lockout_at)}
                        {row.last_ip ? ` · ${row.last_ip}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
