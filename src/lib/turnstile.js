/**
 * src/lib/turnstile.js
 * Cloudflare Turnstile server-side token verification.
 *
 * Setup (one-time, free):
 *   1. https://dash.cloudflare.com → Turnstile → Add site
 *   2. Domain: blackcatunderthemoon.vercel.app  (also add localhost for dev)
 *   3. Mode: Managed | Theme: Dark
 *   4. Copy Secret Key → Vercel env var: CF_TURNSTILE_SECRET
 *   5. Copy Site Key → replace TURNSTILE_SITE_KEY placeholder in drift-bottle.html
 *
 * If CF_TURNSTILE_SECRET is not set (local dev without the env var),
 * verifyTurnstile() returns { success: true } so development is not blocked.
 */

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

  // Bypass in development when secret is not configured
  if (!secret) return { success: true };

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
