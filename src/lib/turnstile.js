/**
 * src/lib/turnstile.js
 * Cloudflare Turnstile server-side token verification.
 *
 * Setup (one-time, free):
 *   1. https://dash.cloudflare.com → Turnstile → Add site (or edit existing)
 *   2. Hostnames: every domain users visit (e.g. www.example.com, example.com, localhost)
 *   3. Widget mode: **Managed** or **Non-interactive** (fewer false blocks than strict invisible)
 *   4. Copy Secret Key → CF_TURNSTILE_SECRET
 *   5. Copy Site Key → NEXT_PUBLIC_CF_TURNSTILE_SITE_KEY
 *
 * CF_TURNSTILE_BIND_IP=true only if your edge IP matches what Cloudflare saw client-side.
 * Default off — Vercel/CDN often causes IP mismatch and false 403s for real users.
 *
 * Production: CF_TURNSTILE_SECRET required (fail-closed).
 * Local dev without secret: verifyTurnstile() returns { success: true }.
 */

import { isProduction } from './production-guard.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function shouldBindIp() {
  return process.env.CF_TURNSTILE_BIND_IP === 'true';
}

async function callSiteverify(secret, token, ip) {
  const body = new URLSearchParams({ secret, response: token.trim() });
  if (shouldBindIp() && ip) body.set('remoteip', ip);

  const resp = await fetch(VERIFY_URL, { method: 'POST', body });
  if (!resp.ok) return { success: false, errorCodes: ['http-error'] };
  const json = await resp.json();
  return {
    success: json.success === true,
    errorCodes: Array.isArray(json['error-codes']) ? json['error-codes'] : [],
    action: json.action || null,
  };
}

/**
 * User-facing message for a failed verification (never blames the user as a "robot").
 * @param {{ errorCodes?: string[] }} result
 */
export function turnstileFailureMessage(result) {
  const codes = result?.errorCodes || [];
  if (codes.includes('timeout-or-duplicate')) {
    return '驗證已過期，請再按一次送出。';
  }
  if (codes.includes('invalid-input-response') || codes.includes('invalid-widget-id')) {
    return '驗證失敗，請重新整理頁面後再試。';
  }
  if (codes.includes('missing-input-response')) {
    return '請稍候片刻再送出，或重新整理頁面。';
  }
  return '驗證未通過，請再試一次；若仍失敗請重新整理頁面。';
}

/**
 * @param {string | undefined} token
 * @param {string} ip
 * @returns {Promise<{ success: boolean, errorCodes?: string[], action?: string|null }>}
 */
export async function verifyTurnstile(token, ip) {
  const secret = process.env.CF_TURNSTILE_SECRET;

  if (!secret) {
    if (isProduction()) return { success: false, errorCodes: ['not-configured'] };
    return { success: true };
  }

  if (!token || typeof token !== 'string' || token.trim() === '') {
    return { success: false, errorCodes: ['missing-input-response'] };
  }

  try {
    let result = await callSiteverify(secret, token, ip);

    // IP mismatch behind proxies is a common false positive — retry without remoteip once.
    if (!result.success && shouldBindIp() && ip) {
      result = await callSiteverify(secret, token, '');
    }

    return result;
  } catch {
    return { success: false, errorCodes: ['internal-error'] };
  }
}
