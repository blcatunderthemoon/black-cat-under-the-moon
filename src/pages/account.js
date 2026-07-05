/**
 * /account — Account settings page
 */

import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth, getBrowserClient } from '../lib/auth-context.js';
import AppShell from '../components/AppShell.js';
import AppHeaderAuth from '../components/AppHeaderAuth.js';
import AccountMirrorFamilySummary from '../components/AccountMirrorFamilySummary.js';
import PixelMoonIcon from '../components/PixelMoonIcon.js';
import PremiumMoonBadge from '../components/PremiumMoonBadge.js';
import { MOONLIGHT_PASSPORT_BRAND } from '../lib/premium.js';
import AccountSubscriptionPanel from '../components/AccountSubscriptionPanel.js';
import { validateDisplayName, DISPLAY_NAME_MAX_LENGTH } from '../lib/display-name-policy.js';
import { validatePassword, PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENTS_LABEL } from '../lib/auth-credentials-policy.js';
import PasswordRequirementsChecklist from '../components/PasswordRequirementsChecklist.js';
import MoonLoading from '../components/MoonLoading.js';
import { MoonJourneyAccountCard } from '../components/MoonJourneyPanel.js';
import {
  readMoonJourneyCache,
  writeMoonJourneyCache,
  readMoonJourneyCacheEntry,
  resolveMoonJourneyUpdate,
} from '../lib/moon-journey-cache.js';

export default function AccountPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [mirrorCard, setMirrorCard] = useState(undefined);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveOk, setSaveOk] = useState(true);

  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwOk, setPwOk] = useState(true);
  const [pwSaving, setPwSaving] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState({ email_on_match: true, email_on_letter: true });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');
  const [notifOk, setNotifOk] = useState(true);

  const [moonJourney, setMoonJourneyState] = useState(null);

  const setMoonJourney = (next) => {
    setMoonJourneyState(next);
    const userId = session?.user?.id;
    if (userId && next) writeMoonJourneyCache(userId, next);
  };

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setMoonJourneyState(null);
      return;
    }
    const cached = readMoonJourneyCache(userId);
    if (cached) setMoonJourneyState((prev) => prev ?? cached);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch('/api/me', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const entry = readMoonJourneyCacheEntry(session.user.id);
        const next = resolveMoonJourneyUpdate(entry, data.moon_journey || null);
        if (next) setMoonJourney(next);
      })
      .catch(() => {});
  }, [session?.access_token, session?.user?.id]);

  useEffect(() => {
    if (!router.isReady) return;
    window.scrollTo(0, 0);
    if (router.asPath.includes('#')) {
      router.replace('/account', undefined, { scroll: false });
    }
  }, [router.isReady, router.asPath, router]);

  useEffect(() => {
    if (mirrorCard === undefined) return;
    window.scrollTo(0, 0);
  }, [mirrorCard]);

  useEffect(() => {
    if (!loading && !session) router.replace('/login?redirect=/account');
  }, [session, loading, router]);

  useEffect(() => {
    if (profile?.profile) {
      setDisplayName(profile.profile.display_name || '');
      setBio(profile.profile.bio || '');
      const prefs = profile.profile.notification_prefs || {};
      setNotifPrefs({
        email_on_match: prefs.email_on_match !== false,
        email_on_letter: prefs.email_on_letter !== false,
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch('/api/mirror-card/me', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => setMirrorCard(data.card || null))
      .catch(() => setMirrorCard(null));
  }, [session?.access_token]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    const nameCheck = validateDisplayName(displayName, {
      previousName: profile?.profile?.display_name,
    });
    if (!nameCheck.ok) {
      setSaveOk(false);
      setSaveMsg(nameCheck.error);
      setSaving(false);
      return;
    }
    try {
      const r = await fetch('/api/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          display_name: nameCheck.value,
          bio,
        }),
      });
      const data = await r.json();
      if (r.ok) {
        setSaveOk(true);
        setSaveMsg('✅ 已儲存！');
      } else {
        setSaveOk(false);
        setSaveMsg(data.error || '儲存失敗，請重試。');
      }
    } catch {
      setSaveOk(false);
      setSaveMsg('網路錯誤，請重試。');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (pwNew !== pwConfirm) { setPwOk(false); setPwMsg('新密碼與確認密碼不一致。'); return; }
    const passwordCheck = validatePassword(pwNew);
    if (!passwordCheck.ok) { setPwOk(false); setPwMsg(passwordCheck.error); return; }
    setPwSaving(true);
    setPwMsg('');
    try {
      const client = getBrowserClient();
      const { error } = await client.auth.updateUser({ password: passwordCheck.value });
      if (error) { setPwOk(false); setPwMsg(error.message || '密碼更改失敗，請重試。'); }
      else { setPwOk(true); setPwMsg('✅ 密碼已更新！'); setPwNew(''); setPwConfirm(''); }
    } catch {
      setPwOk(false);
      setPwMsg('網路錯誤，請重試。');
    } finally {
      setPwSaving(false);
    }
  }

  async function handleSaveNotifPrefs(e) {
    e.preventDefault();
    setNotifSaving(true);
    setNotifMsg('');
    try {
      const r = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ notification_prefs: notifPrefs }),
      });
      const data = await r.json();
      if (r.ok) { setNotifOk(true); setNotifMsg('✅ 通知設定已儲存！'); }
      else { setNotifOk(false); setNotifMsg(data.error || '儲存失敗。'); }
    } catch { setNotifOk(false); setNotifMsg('網路錯誤，請重試。'); }
    finally { setNotifSaving(false); }
  }

  if (loading || !session) return null;

  const tier = profile?.profile?.subscription_tier || 'free';

  return (
    <>
      <Head>
        <title>帳號設定 — Black Cat Under The Moon</title>
      </Head>
      <AppShell
        title="帳號"
        backHref="/index.html"
        headerVariant="account"
        pageClassName="app-page--account"
        maxWidth="520px"
        nav={<AppHeaderAuth redirectPath="/account" />}
      >
        <section id="mirror-card" className="pixel-card pixel-card--moon account-mirror-section">
          {mirrorCard === undefined ? (
            <MoonLoading label="載入中…" centered={false} />
          ) : mirrorCard ? (
            <>
              <h2 className="pixel-section-title">// 貓家族</h2>
              <AccountMirrorFamilySummary card={mirrorCard} />
            </>
          ) : (
            <div className="pixel-empty account-mirror-empty">
              <PixelMoonIcon />
              <p className="pixel-subtitle account-mirror-empty__text">
                你還沒有 Mirror Card。<br />
                先完成 Mirror Mode 測驗，生成你的專屬鏡像卡。
              </p>
              <a href="/mirror.html" className="pixel-btn pixel-btn--primary account-action-btn account-mirror-empty__cta">
                開始 Mirror Mode<span className="account-btn-arrow" aria-hidden="true"> ▶</span>
              </a>
            </div>
          )}
        </section>

        <MoonJourneyAccountCard
          moonJourney={moonJourney}
          accessToken={session?.access_token}
          onJourneyUpdate={setMoonJourney}
        />

        <section className="pixel-card pixel-card--moon">
          <h2 className="pixel-section-title">// 個人資料</h2>
          <form onSubmit={handleSaveProfile} className="pixel-form">
            <label className="pixel-label">
              顯示名稱
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                required
                className="pixel-input"
              />
              <span className="pixel-char-count" style={{ textAlign: 'right' }}>{displayName.length}/{DISPLAY_NAME_MAX_LENGTH}</span>
            </label>

            <label className="pixel-label">
              自我介紹（選填）
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={200}
                rows={3}
                className="pixel-textarea"
                placeholder="簡短介紹自己…"
              />
              <span className="pixel-char-count" style={{ textAlign: 'right' }}>{bio.length}/200</span>
            </label>

            {saveMsg && <p className={saveOk ? 'pixel-success' : 'pixel-error'}>{saveMsg}</p>}
            <button type="submit" disabled={saving} className="pixel-btn pixel-btn--primary account-action-btn">
              {saving ? '儲存中…' : '儲存變更'}
            </button>
          </form>
        </section>

        <section className="pixel-card pixel-card--moon">
          <h2 className="pixel-section-title">// 帳號資訊</h2>
          <div className="pixel-info-row">
            <span style={{ color: 'var(--text-muted)' }}>Email</span>
            <span>{session.user?.email || '—'}</span>
          </div>
          <div className="pixel-info-row">
            <span style={{ color: 'var(--text-muted)' }}>Email 驗證</span>
            <span style={{ color: session.user?.email_confirmed_at ? '#4ade80' : '#fbbf24' }}>
              {session.user?.email_confirmed_at ? '✅ 已驗證' : '⚠️ 未驗證'}
            </span>
          </div>
          <div className="pixel-info-row">
            <span style={{ color: 'var(--text-muted)' }}>會員等級</span>
            {tier === 'premium' ? (
              <span className="account-tier-value account-tier-value--premium">
                {MOONLIGHT_PASSPORT_BRAND}
                <PremiumMoonBadge className="account-tier-moon" />
              </span>
            ) : (
              <span className="account-tier-value account-tier-value--free">Free</span>
            )}
          </div>
          {(tier === 'premium' || tier === 'free') && (
            <div className="account-subscription-block">
              <AccountSubscriptionPanel
                profile={profile}
                session={session}
                tier={tier}
              />
            </div>
          )}
        </section>

        <section className="pixel-card pixel-card--moon">
          <h2 className="pixel-section-title">// 更改密碼</h2>
          <form onSubmit={handleChangePassword} className="pixel-form">
            <label className="pixel-label">
              {PASSWORD_REQUIREMENTS_LABEL}
              <input
                type="password"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                minLength={PASSWORD_MIN_LENGTH}
                required
                className="pixel-input"
                autoComplete="new-password"
              />
            </label>
            <PasswordRequirementsChecklist password={pwNew} />
            <label className="pixel-label">
              確認新密碼
              <input
                type="password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                required
                className="pixel-input"
                autoComplete="new-password"
              />
            </label>
            {pwMsg && <p className={pwOk ? 'pixel-success' : 'pixel-error'}>{pwMsg}</p>}
            <button type="submit" disabled={pwSaving} className="pixel-btn pixel-btn--primary account-action-btn">
              {pwSaving ? '更新中…' : '更新密碼'}
            </button>
          </form>
        </section>

        <section className="pixel-card pixel-card--moon">
          <h2 className="pixel-section-title">// 通知設定</h2>
          <form onSubmit={handleSaveNotifPrefs} className="pixel-form">
            <label className="pixel-check-row">
              <input
                type="checkbox"
                checked={notifPrefs.email_on_match}
                onChange={(e) => setNotifPrefs((p) => ({ ...p, email_on_match: e.target.checked }))}
                style={{ accentColor: 'var(--accent)' }}
              />
              連線成功時寄送 Email 通知
            </label>
            <label className="pixel-check-row">
              <input
                type="checkbox"
                checked={notifPrefs.email_on_letter}
                onChange={(e) => setNotifPrefs((p) => ({ ...p, email_on_letter: e.target.checked }))}
                style={{ accentColor: 'var(--accent)' }}
              />
              收到新月光信時寄送 Email 通知
            </label>
            {notifMsg && <p className={notifOk ? 'pixel-success' : 'pixel-error'}>{notifMsg}</p>}
            <button type="submit" disabled={notifSaving} className="pixel-btn pixel-btn--primary account-action-btn">
              {notifSaving ? '儲存中…' : '儲存通知設定'}
            </button>
          </form>
        </section>
      </AppShell>
    </>
  );
}
