import { isPassportGatingDisabled } from './passport-gating.js';

/** User-facing membership brand (DB tier key remains `premium`). */
export const MOONLIGHT_PASSPORT_BRAND = 'Moonlight Passport';

export { isPassportGatingDisabled } from './passport-gating.js';

/** True when /api/me (or env soft-unlock) grants Passport entitlements. */
export function isPremiumUser(meData) {
  if (isPassportGatingDisabled()) return true;
  if (meData?.passport_gating_disabled) return true;
  return meData?.profile?.subscription_tier === 'premium';
}

/** Paid / granted subscription row present (not only soft-unlock entitlements). */
export function hasRealPassportSubscription(meData) {
  return Boolean(meData?.subscription?.status);
}

/** Billing channel: paypal (auto-renew), stripe (legacy), or manual (PayMe/FPS). */
export function getSubscriptionChannel(meData) {
  const provider = meData?.subscription?.provider;
  if (provider === 'paypal') return 'paypal';
  if (provider === 'stripe') return 'stripe';
  if (provider === 'manual') return 'manual';
  if (isPremiumUser(meData)) {
    // Soft unlock without a billing row is not a payment channel.
    if ((meData?.passport_gating_disabled || isPassportGatingDisabled()) && !meData?.subscription) {
      return null;
    }
    const status = meData?.subscription?.status;
    if (status === 'manual') return 'manual';
    if (status === 'active' || status === 'past_due') return 'paypal';
    return 'manual';
  }
  return null;
}

export function isManualSubscription(meData) {
  return getSubscriptionChannel(meData) === 'manual';
}

export function isPayPalSubscription(meData) {
  return getSubscriptionChannel(meData) === 'paypal';
}

/** @deprecated Legacy Stripe subscribers only */
export function isStripeSubscription(meData) {
  return getSubscriptionChannel(meData) === 'stripe';
}

export function isAutoRenewSubscription(meData) {
  const ch = getSubscriptionChannel(meData);
  return ch === 'paypal' || ch === 'stripe';
}

export function getPremiumPeriodEnd(meData) {
  return meData?.subscription?.current_period_end || null;
}

export function formatPremiumPeriodEnd(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('zh-Hant', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return null;
  }
}

/** Days until premium ends; null = no fixed expiry (e.g. manual grant). */
export function getPremiumDaysRemaining(meData) {
  const end = getPremiumPeriodEnd(meData);
  if (!end) return null;
  const diff = new Date(end).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getPremiumStatusMessage(meData) {
  if (!isPremiumUser(meData)) return null;
  const openAccess = meData?.passport_gating_disabled || isPassportGatingDisabled();
  if (openAccess && !hasRealPassportSubscription(meData)) {
    return `${MOONLIGHT_PASSPORT_BRAND} 功能開放試用中`;
  }
  const days = getPremiumDaysRemaining(meData);
  if (days === null) return `${MOONLIGHT_PASSPORT_BRAND} 會籍長期有效`;
  if (days <= 0) return `${MOONLIGHT_PASSPORT_BRAND} 會籍即將結束`;
  if (days === 1) return `${MOONLIGHT_PASSPORT_BRAND} 尚餘 1 日`;
  return `${MOONLIGHT_PASSPORT_BRAND} 尚餘 ${days} 日`;
}

export function getActiveLetterQuotaLine(meData) {
  if (!isPremiumUser(meData)) return null;
  const quota = meData?.active_letter_quota;
  if (!quota) return null;
  return `本月剩餘主動投信：${quota.remaining}/${quota.limit}`;
}
