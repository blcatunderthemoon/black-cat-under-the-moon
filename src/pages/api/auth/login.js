/**
 * POST /api/auth/login
 * Server-side email/password login with brute-force lockout.
 *
 * Body: { email, password }
 * Success: { access_token, refresh_token, expires_at, expires_in, token_type, user }
 * Locked: 423 { error, code: 'ACCOUNT_LOCKED', lockout_until, retry_after_seconds }
 */

import { createClient } from '@supabase/supabase-js';
import {
  createRateLimiter,
  getClientIp,
  rateLimitOrPass,
  rateLimitResponse,
} from '../../../lib/rate-limit.js';
import { validateEmail } from '../../../lib/auth-credentials-policy.js';
import {
  clearLoginLockout,
  formatLoginLockoutMessage,
  getLoginLockoutBackend,
  getLoginLockoutStatus,
  recordLoginFailure,
} from '../../../lib/login-lockout.js';

const loginIpLimiter = createRateLimiter('auth-login-ip', 40, '15 m');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

function lockoutPayload(status) {
  return {
    error: formatLoginLockoutMessage(status.retryAfterSeconds),
    code: 'ACCOUNT_LOCKED',
    lockout_until: status.lockoutUntil
      ? new Date(status.lockoutUntil).toISOString()
      : null,
    retry_after_seconds: status.retryAfterSeconds,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const backend = getLoginLockoutBackend();
  if (!backend.ok) {
    return rateLimitResponse(res, backend.reason);
  }

  const ip = getClientIp(req);
  const ipLimited = await rateLimitOrPass(loginIpLimiter, `login-ip:${ip}`);
  if (!ipLimited.ok) return rateLimitResponse(res, ipLimited.reason);

  const body = parseBody(req);
  const emailCheck = validateEmail(body.email);
  if (!emailCheck.ok) {
    return res.status(400).json({ error: emailCheck.error, code: 'INVALID_EMAIL' });
  }
  const password = String(body.password || '');
  if (!password) {
    return res.status(400).json({ error: '請填寫密碼。', code: 'INVALID_PASSWORD' });
  }

  const email = emailCheck.value;

  try {
    const lockStatus = await getLoginLockoutStatus(email);
    if (lockStatus.locked) {
      res.setHeader('Retry-After', String(lockStatus.retryAfterSeconds));
      return res.status(423).json(lockoutPayload(lockStatus));
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.session?.access_token) {
      const fail = await recordLoginFailure(email);
      if (fail.locked) {
        res.setHeader('Retry-After', String(fail.retryAfterSeconds));
        return res.status(423).json(lockoutPayload(fail));
      }
      return res.status(401).json({
        error: 'Email 或密碼不正確，請再試。',
        code: 'INVALID_CREDENTIALS',
      });
    }

    await clearLoginLockout(email);

    const session = data.session;
    return res.status(200).json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type || 'bearer',
      user: session.user,
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: '登入失敗，請稍後再試。' });
  }
}
