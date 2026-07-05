/**
 * POST /api/auth/refresh-session
 * Refresh a Supabase session for static pages (echo.html, mirror.html) that read tokens from localStorage.
 * Body: { refresh_token: string }
 */

import {
  createRateLimiter,
  getClientIp,
  rateLimitOrPass,
  rateLimitResponse,
} from '../../../lib/rate-limit.js';

const refreshLimiter = createRateLimiter('auth-refresh', 20, '1 m');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const ip = getClientIp(req);
  const limited = await rateLimitOrPass(refreshLimiter, `refresh:${ip}`);
  if (!limited.ok) return rateLimitResponse(res, limited.reason);

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const refreshToken = body.refresh_token;
  if (!refreshToken) {
    return res.status(400).json({ error: 'refresh_token is required' });
  }

  try {
    const tokenResp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const data = await tokenResp.json().catch(() => ({}));
    if (!tokenResp.ok || !data.access_token) {
      return res.status(401).json({ error: data.error_description || data.msg || 'Refresh failed' });
    }

    return res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      expires_in: data.expires_in,
    });
  } catch (err) {
    console.error('[auth/refresh-session]', err);
    return res.status(500).json({ error: 'Refresh failed' });
  }
}
