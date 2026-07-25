/**
 * POST /api/auth/password-verification-hook
 *
 * Supabase Auth Hook: "Password Verification Attempt".
 * Enforces Redis login lockout for direct GoTrue password grants
 * (bypassing POST /api/auth/login).
 *
 * Configure in Supabase Dashboard → Authentication → Hooks:
 *   Hook: Password Verification Attempt
 *   URL:  https://<your-site>/api/auth/password-verification-hook
 *   Secret: same value as AUTH_HOOK_SECRET in .env
 *
 * When AUTH_HOOK_SECRET is set, /api/auth/login skips failure counting
 * (this hook owns counters) to avoid double-counting.
 *
 * Body (from Supabase): { user_id, valid }
 * Response: { decision: 'continue'|'reject', message?, should_logout_user? }
 */

import { timingSafeEqual } from 'crypto';
import { getAdminClient } from '../../../lib/server-auth.js';
import {
  formatLoginLockoutMessage,
  getLoginLockoutBackend,
  getLoginLockoutStatus,
  recordLoginFailure,
} from '../../../lib/login-lockout.js';
import { recordLoginLockoutEvent } from '../../../lib/login-lockout-events.js';

function parseBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      return {};
    }
  }
  return req.body || {};
}

function secretsEqual(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function extractHookSecret(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return (
    req.headers['x-supabase-auth-hook-secret']
    || req.headers['x-webhook-secret']
    || ''
  );
}

function continueOk() {
  return { decision: 'continue' };
}

function rejectLocked(retryAfterSeconds) {
  return {
    decision: 'reject',
    message: formatLoginLockoutMessage(retryAfterSeconds),
    should_logout_user: false,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.AUTH_HOOK_SECRET || '';
  if (!expected) {
    return res.status(503).json({
      error: 'AUTH_HOOK_SECRET is not configured',
      code: 'AUTH_HOOK_SECRET_MISSING',
    });
  }

  if (!secretsEqual(extractHookSecret(req), expected)) {
    return res.status(401).json({ error: 'Unauthorised.' });
  }

  const backend = getLoginLockoutBackend();
  if (!backend.ok) {
    // Fail closed for password grants when Redis is down in production.
    return res.status(200).json({
      decision: 'reject',
      message: '登入暫時無法使用，請稍後再試。',
      should_logout_user: false,
    });
  }

  const body = parseBody(req);
  const userId = body.user_id || body.userId || null;
  const valid = body.valid === true || body.valid === 'true';

  if (!userId) {
    return res.status(200).json(continueOk());
  }

  try {
    const admin = getAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) {
      // Unknown user — let Auth finish with its own error.
      return res.status(200).json(continueOk());
    }

    const email = data.user.email;
    const lockStatus = await getLoginLockoutStatus(email);
    if (lockStatus.locked) {
      return res.status(200).json(rejectLocked(lockStatus.retryAfterSeconds));
    }

    if (!valid) {
      const fail = await recordLoginFailure(email);
      if (fail.locked) {
        void recordLoginLockoutEvent({
          email,
          ip: null,
          userAgent: 'supabase-password-verification-hook',
          failureCount: fail.failureCount,
          lockoutUntil: fail.lockoutUntil,
        });
        return res.status(200).json(rejectLocked(fail.retryAfterSeconds));
      }
    }

    return res.status(200).json(continueOk());
  } catch (err) {
    console.error('[password-verification-hook]', err?.message || err);
    return res.status(200).json({
      decision: 'reject',
      message: '登入暫時無法使用，請稍後再試。',
      should_logout_user: false,
    });
  }
}
