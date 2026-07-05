/**
 * src/lib/turnstile.js
 * Cloudflare Turnstile server-side token verification.
 *
 * Setup (one-time, free):
 *   1. https://dash.cloudflare.com → Turnstile → Add site (or edit existing)
 *   2. Hostnames: every domain users visit (e.g. www.example.com, example.com, localhost)
 *      Turnstile only issues tokens for listed hostnames — domain changes need this updated.
 *   3. Mode: Managed | Theme: Dark
 *   4. Copy Secret Key → Vercel env: CF_TURNSTILE_SECRET
 *   5. Copy Site Key → Vercel env: NEXT_PUBLIC_CF_TURNSTILE_SITE_KEY
 *      (drift-bottle.html loads it via /api/turnstile/site-key)
 *
 * Production: CF_TURNSTILE_SECRET required (fail-closed).
 * Local dev without secret: verifyTurnstile() returns { success: true }.
 */

import { isProduction } from './production-guard.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verify a Cloudflare Turnstile token submitted by the frontend.
 *
 * @param {string | undefined} token  — value of `turnstile_token` from req.body
 * @param {string} ip                 — client IP for additional binding
 * @returns {Promise<{ success: boolean }>}
 */
export async function verifyTurnstile(token, ip) {
  const secret = process.env.CF_TURNSTILE_SECRET;

  if (!secret) {
    if (isProduction()) return { success: false };
    return { success: true };
  }

  // Missing token → fail
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return { success: false };
  }

  try {
    const body = new URLSearchParams({
      secret,
      response: token.trim(),
      remoteip: ip || '',
    });

    const resp = await fetch(VERIFY_URL, {
      method: 'POST',
      body,
    });

    if (!resp.ok) return { success: false };
    const json = await resp.json();
    return { success: json.success === true };
  } catch {
    // Network error talking to Cloudflare — fail closed to prevent bots
    // bypassing verification during a CF outage.
    return { success: false };
  }
}
