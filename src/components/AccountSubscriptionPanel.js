/**
 * Account page — subscription management (PayPal / legacy Stripe vs PayMe/FPS).
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  formatPremiumPeriodEnd,
  getPremiumPeriodEnd,
  isManualSubscription,
  isAutoRenewSubscription,
  isPassportGatingDisabled,
  hasRealPassportSubscription,
  MOONLIGHT_PASSPORT_BRAND,
} from '../lib/premium.js';
import { MANUAL_PAYMENT_SUPPORT_EMAIL } from '../lib/manual-payment.js';

function mapPortalError(data) {
  if (!data?.error) return '無法開啟訂閱管理，請稍後再試。';
  if (data.error === 'paypal_not_configured') {
    return 'PayPal 尚未設定，請聯絡 blcatunderthemoon@gmail.com 協助取消續費。';
  }
  return data.error;
}

export default function AccountSubscriptionPanel({ profile, session, tier }) {
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');

  const openAccess = isPassportGatingDisabled() || profile?.passport_gating_disabled;
  const hasPaid = hasRealPassportSubscription(profile);
  const isManual = isManualSubscription(profile);
  const isAutoRenew = isAutoRenewSubscription(profile);
  const periodEnd = formatPremiumPeriodEnd(getPremiumPeriodEnd(profile));
  const pastDue = isAutoRenew && profile?.subscription?.status === 'past_due';

  async function handleManageSubscription() {
    setPortalLoading(true);
    setPortalError('');
    try {
      const r = await fetch('/api/billing/create-portal-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await r.json();
      if (r.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setPortalError(mapPortalError(data));
    } catch {
      setPortalError('網路錯誤，請重試。');
    } finally {
      setPortalLoading(false);
    }
  }

  if (openAccess && !hasPaid) {
    return (
      <p className="pixel-subtitle account-subscription-open-access">
        而家 {MOONLIGHT_PASSPORT_BRAND} 功能開放試用中，無需升級即可使用進階權限。
      </p>
    );
  }

  if (tier !== 'premium' && !openAccess) {
    return (
      <Link href="/premium" className="pixel-link account-subscription-upgrade">
        升級 {MOONLIGHT_PASSPORT_BRAND} →
      </Link>
    );
  }

  if (tier !== 'premium') {
    return null;
  }

  if (isManual) {
    return (
      <div className="account-subscription-manual">
        <div className="account-subscription-manual__notes">
          <p>此帳號經由人手渠道（PayMe/FPS）開通特權。</p>
          {periodEnd ? (
            <p>
              {MOONLIGHT_PASSPORT_BRAND} 資格將於 <strong>{periodEnd}</strong> 自動結束，無需手動取消續費。
            </p>
          ) : (
            <p>{MOONLIGHT_PASSPORT_BRAND} 資格到期後將自動恢復為一般會員，無需手動取消續費。</p>
          )}
          <p>
            續期由管理員人手處理；如需協助請聯絡{' '}
            <a href={`mailto:${MANUAL_PAYMENT_SUPPORT_EMAIL}`} className="pixel-link account-subscription-manual__email">
              {MANUAL_PAYMENT_SUPPORT_EMAIL}
            </a>
            。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="account-subscription-stripe">
      {pastDue && (
        <p className="pixel-error account-subscription-alert">
          PayPal 續費未能成功，請於 PayPal 帳戶檢查付款方式。
        </p>
      )}
      <button
        type="button"
        onClick={handleManageSubscription}
        disabled={portalLoading}
        className="pixel-btn pixel-btn--ghost account-action-btn"
      >
        {portalLoading ? '開啟中…' : '管理訂閱 / 取消續費'}
      </button>
      {portalError && (
        <p className="pixel-error account-subscription-alert">{portalError}</p>
      )}
      <p className="pixel-subtitle account-subscription-stripe__hint">
        將開啟 PayPal 自動付款管理頁面。取消後仍可使用 {MOONLIGHT_PASSPORT_BRAND} 至本期結束。詳見{' '}
        <a href="/refund.html" className="pixel-link">退款與取消政策</a>。
      </p>
    </div>
  );
}
