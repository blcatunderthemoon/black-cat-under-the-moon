/**
 * /premium — Premium paywall and benefits page
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../lib/auth-context.js';
import AppShell, { NavLink } from '../components/AppShell.js';
import AppHeaderAuth from '../components/AppHeaderAuth.js';
import ManualPaymentModal from '../components/ManualPaymentModal.js';
import SeoHead from '../components/SeoHead.js';
import PixelMixedLabel from '../components/PixelMixedLabel.js';
import PixelMoonIcon from '../components/PixelMoonIcon.js';
import {
  MANUAL_PAYMENT_AMOUNT_HKD,
  MANUAL_PAYMENT_FPS_NOTE,
  MANUAL_PAYMENT_SUPPORT_EMAIL,
} from '../lib/manual-payment.js';
import { isPremiumUser, getPremiumStatusMessage, getActiveLetterQuotaLine, MOONLIGHT_PASSPORT_BRAND } from '../lib/premium.js';

const BENEFITS = [
  { icon: '🔍', title: '查看詳細 Mirror Card', desc: '從月光圍爐、我的連線查看任何人的深層 Mirror 分析與關係期待。' },
  { icon: '✉️', title: '每月主動投信 3 封', desc: '主動聯絡有共鳴的人，每次開通道可來回傾談最多 10 次。' },
  { icon: '📷', title: '每月交換相 3 次', desc: '在對方 Mirror Card 發起真人相片交換邀請；對方回傳時才扣配額，成功後雙方可查看 7 日。' },
  { icon: '⚡', title: '連線即時通知', desc: '共鳴連線成功後第一時間收到 Inbox 高亮提示與 Email 通知。' },
  { icon: '📝', title: '論壇發文不限', desc: '月光圍爐發文無每日上限；免費會員每日 3 篇。' },
];

export default function PremiumPage() {
  const { session, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [paypalConfigured, setPaypalConfigured] = useState(false);

  useEffect(() => {
    fetch('/api/billing/config')
      .then((r) => r.json())
      .then((data) => setPaypalConfigured(!!data.paypal_configured))
      .catch(() => setPaypalConfigured(false));
  }, []);

  const isPremium = isPremiumUser(profile);
  const premiumStatusLine = isPremium ? getPremiumStatusMessage(profile) : null;
  const letterQuotaLine = isPremium ? getActiveLetterQuotaLine(profile) : null;
  const photoQuotaLine = isPremium && profile?.photo_exchange_quota
    ? `本月剩餘交換相：${profile.photo_exchange_quota.remaining}/${profile.photo_exchange_quota.limit}`
    : null;

  async function handleCheckout() {
    if (!session) { window.location.href = '/login?redirect=/premium'; return; }
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await r.json();
      if (data.error === 'paypal_not_configured') {
        setError('PayPal 尚未設定。請使用人工付款方式聯絡我們。');
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.message || '無法建立付款連結，請稍後再試。');
      }
    } catch {
      setError('付款流程發生錯誤，請稍後再試。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SeoHead
        title={MOONLIGHT_PASSPORT_BRAND}
        description={`${MOONLIGHT_PASSPORT_BRAND} 社群會員 — 解鎖進階 Mirror Card、主動投信、交換相、連線通知與月光圍爐發文額度。`}
        path="/premium"
      />
      <AppShell
        title={MOONLIGHT_PASSPORT_BRAND}
        headerVariant="account"
        backHref="/index.html"
        nav={session ? <AppHeaderAuth redirectPath="/premium" /> : <NavLink href="/login?redirect=/premium">登入</NavLink>}
      >
        <div className="premium-hero">
          <p style={{ fontSize: 52, lineHeight: 1, margin: 0 }}>🌙</p>
          <h1 className="pixel-title" style={{ fontSize: 14 }}>{MOONLIGHT_PASSPORT_BRAND}</h1>
          <p className="pixel-subtitle">{MOONLIGHT_PASSPORT_BRAND} — 解鎖進階 Mirror Card、主動投信、交換相與更多社群功能</p>
        </div>

        {isPremium && (
          <section className="premium-member-status" aria-label={`${MOONLIGHT_PASSPORT_BRAND} 會員狀態`}>
            <div className="premium-member-status__glow" aria-hidden="true" />
            <div className="premium-member-status__inner">
              <div className="premium-member-status__badge">
                <PixelMoonIcon size={34} className="premium-member-status__moon" />
                <span className="premium-member-status__label font-zpix">{MOONLIGHT_PASSPORT_BRAND}</span>
              </div>
              <div className="premium-member-status__copy">
                <p className="premium-member-status__title">你已持有 {MOONLIGHT_PASSPORT_BRAND}</p>
                <p className="premium-member-status__thanks">感謝支持月光社群！</p>
              </div>
              {(premiumStatusLine || letterQuotaLine || photoQuotaLine) && (
                <div className="premium-member-status__meta">
                  {premiumStatusLine && (
                    <span className="premium-member-status__chip premium-member-status__chip--status">
                      {premiumStatusLine}
                    </span>
                  )}
                  {letterQuotaLine && (
                    <span className="premium-member-status__chip">{letterQuotaLine}</span>
                  )}
                  {photoQuotaLine && (
                    <span className="premium-member-status__chip">{photoQuotaLine}</span>
                  )}
                </div>
              )}
              <Link href="/mirror-card/me" className="pixel-btn pixel-btn--primary premium-member-status__cta">
                返回我的 Mirror Card
              </Link>
            </div>
          </section>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {BENEFITS.map((b) => (
            <div key={b.title} className="premium-benefit">
              <span style={{ fontSize: 28, flexShrink: 0, lineHeight: 1 }}>{b.icon}</span>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>{b.title}</h3>
                <p className="pixel-subtitle" style={{ fontSize: 13 }}>{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {!isPremium && (
          <div className="premium-pricing">
            <p className="pixel-section-title pixel-section-title--zh" style={{ margin: 0 }}>月費方案</p>
            <p style={{ fontSize: 18, color: 'var(--text-dim)', margin: 0 }}>
              HKD <span style={{ fontSize: 42, fontWeight: 800, color: 'var(--cream)' }}>58</span> / 月
            </p>
            <p className="pixel-subtitle" style={{ fontSize: 12 }}>
              訂閱即表示同意
              <a href="/tos.html" className="pixel-link" style={{ marginLeft: 4 }}>服務條款</a>
              及
              <a href="/refund.html" className="pixel-link" style={{ marginLeft: 4 }}>退款與取消政策</a>
              。虛擬數位內容，恕不退款。
            </p>
            <p className="pixel-subtitle" style={{ fontSize: 12 }}>可隨時於帳戶設定取消下月自動續費。</p>

            {error && <p className="pixel-error">{error}</p>}

            <div className="premium-payme-block">
              <div className="premium-payme-block__head">
                <span className="premium-payme-block__badge">推薦</span>
                <p className="premium-payme-block__label">PayMe 掃碼付款</p>
              </div>
              <div className="premium-payme-block__card">
                <span className="premium-payme-block__icon" aria-hidden="true">📱</span>
                <p className="premium-payme-block__amount">
                  HKD <strong>{MANUAL_PAYMENT_AMOUNT_HKD}</strong>
                  <span className="premium-payme-block__period">/ 月</span>
                </p>
                <p className="premium-payme-block__teaser">點擊下方按鈕查看收款 QR Code 與完整步驟</p>
              </div>
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                className="pixel-btn pixel-btn--primary premium-payme-block__cta"
              >
                <PixelMixedLabel text="查看 PayMe 付款步驟" />
              </button>
              <p className="pixel-subtitle premium-payme-block__hint">
                備註填註冊 Email，截圖寄至{' '}
                <a href={`mailto:${MANUAL_PAYMENT_SUPPORT_EMAIL}`} className="pixel-link">
                  {MANUAL_PAYMENT_SUPPORT_EMAIL}
                </a>
                ，1–2 個工作天內開通。
              </p>
            </div>

            <div className="premium-fps-note">
              <p className="premium-fps-note__title">FPS 轉數快</p>
              <p className="pixel-subtitle premium-fps-note__copy">
                {MANUAL_PAYMENT_FPS_NOTE}
              </p>
            </div>

            {paypalConfigured ? (
              <div className="premium-paypal-option">
                <p className="pixel-subtitle" style={{ fontSize: 12, margin: 0 }}>
                  或使用 PayPal 自動月費（可隨時取消續費）
                </p>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={loading}
                  className="pixel-btn pixel-btn--ghost"
                  style={{ maxWidth: 320 }}
                >
                  {loading ? (
                    <PixelMixedLabel text="處理中…" />
                  ) : session ? (
                    <PixelMixedLabel text="PayPal 訂閱" />
                  ) : (
                    <PixelMixedLabel text="登入後 PayPal 訂閱" />
                  )}
                </button>
              </div>
            ) : (
              <p className="pixel-subtitle premium-paypal-soon" style={{ fontSize: 12 }}>
                PayPal 自動扣款設定中，暫請使用 PayMe 或 FPS 付款。
              </p>
            )}
          </div>
        )}

        <ManualPaymentModal
          open={manualOpen}
          onClose={() => setManualOpen(false)}
        />

        <div>
          <h2 className="pixel-section-title pixel-section-title--zh">功能對比</h2>
          <table className="premium-table">
            <thead>
              <tr>
                <th>功能</th>
                <th style={{ textAlign: 'center' }}>Free</th>
                <th style={{ textAlign: 'center', color: 'var(--purple-light)' }}>{MOONLIGHT_PASSPORT_BRAND}</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['每日發文', '3 篇', '不限'],
                ['每月連線通知', '最多 3 次', '無限制'],
                ['查看 Mirror Card', '公開卡', '詳細卡'],
                ['主動投信', '✗', '每月 3 封'],
                ['交換相邀請', '✗', '每月 3 次'],
                ['連線通知速度', '批量', '即時 Email'],
              ].map(([feature, free, premium]) => (
                <tr key={feature}>
                  <td>{feature}</td>
                  <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{free}</td>
                  <td style={{ textAlign: 'center', color: 'var(--purple-light)', fontWeight: 600 }}>{premium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppShell>
    </>
  );
}
