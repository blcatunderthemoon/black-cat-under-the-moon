/**
 * Soft unlock for Moonlight Passport entitlements (early-traffic mode).
 * Does not change subscriptions / PayPal rows — only gating + quotas.
 *
 * Set both in production so server + client stay in sync:
 *   PASSPORT_GATING_DISABLED=1
 *   NEXT_PUBLIC_PASSPORT_GATING_DISABLED=1
 */

function envFlagOn(value) {
  if (value == null || value === '') return false;
  const v = String(value).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/** True when Passport paywalls / free-tier locks are disabled. */
export function isPassportGatingDisabled() {
  return (
    envFlagOn(process.env.PASSPORT_GATING_DISABLED)
    || envFlagOn(process.env.NEXT_PUBLIC_PASSPORT_GATING_DISABLED)
  );
}
