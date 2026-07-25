/**
 * GET  /api/dashboard/login-lockout?email=
 *   → current freeze status + recent freeze events + frequent flag
 *
 * GET  /api/dashboard/login-lockout?view=frequent
 *   → summaries of emails that triggered freeze often (default last 30 days)
 *
 * GET  /api/dashboard/login-lockout?view=recent
 *   → all emails with ≥1 freeze in window, sorted by count
 *
 * POST /api/dashboard/login-lockout
 *   Body: { email }
 *   → clears login failure counter + freeze for that email
 *
 * Auth: station dashboard key OR website forum admin Bearer.
 */

import { authorizeStationOrForumAdmin } from '../../../lib/station-or-forum-admin-auth.js';
import { validateEmail } from '../../../lib/auth-credentials-policy.js';
import {
  clearLoginLockout,
  getLoginLockoutBackend,
  getLoginLockoutDetails,
} from '../../../lib/login-lockout.js';
import {
  LOGIN_LOCKOUT_FREQUENT_THRESHOLD,
  LOGIN_LOCKOUT_FREQUENT_WINDOW_DAYS,
  listLoginLockoutEventsForEmail,
  listLoginLockoutSummaries,
  getLoginLockoutStatsMany,
} from '../../../lib/login-lockout-events.js';
import { rateLimitResponse } from '../../../lib/rate-limit.js';

function serializeDetails(details, stats, events) {
  return {
    email: details.email,
    locked: details.locked,
    lockout_until: details.lockoutUntil
      ? new Date(details.lockoutUntil).toISOString()
      : null,
    retry_after_seconds: details.retryAfterSeconds,
    failure_count: details.failureCount,
    lockout_count_total: stats?.lockout_count_total || 0,
    lockout_count_window: stats?.lockout_count_window || 0,
    last_lockout_at: stats?.last_lockout_at || null,
    login_lockout_frequent: !!stats?.login_lockout_frequent,
    frequent_threshold: LOGIN_LOCKOUT_FREQUENT_THRESHOLD,
    frequent_window_days: LOGIN_LOCKOUT_FREQUENT_WINDOW_DAYS,
    events: events || [],
  };
}

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

export default async function handler(req, res) {
  if (!(await authorizeStationOrForumAdmin(req, res))) return;

  const backend = getLoginLockoutBackend();
  if (!backend.ok) {
    return rateLimitResponse(res, backend.reason);
  }

  if (req.method === 'GET') {
    const view = String(req.query.view || '').trim().toLowerCase();

    if (view === 'frequent' || view === 'recent') {
      const days = Number(req.query.days) || LOGIN_LOCKOUT_FREQUENT_WINDOW_DAYS;
      const limit = Number(req.query.limit) || 50;
      const result = await listLoginLockoutSummaries({
        days,
        limit,
        frequentOnly: view === 'frequent',
      });
      return res.status(200).json(result);
    }

    const emailCheck = validateEmail(req.query.email);
    if (!emailCheck.ok) {
      return res.status(400).json({ error: emailCheck.error, code: 'INVALID_EMAIL' });
    }

    const [details, events, statsMap] = await Promise.all([
      getLoginLockoutDetails(emailCheck.value),
      listLoginLockoutEventsForEmail(emailCheck.value, { limit: 30 }),
      getLoginLockoutStatsMany([emailCheck.value]),
    ]);
    const stats = statsMap.get(emailCheck.value);
    return res.status(200).json(serializeDetails(details, stats, events));
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const emailCheck = validateEmail(body.email);
    if (!emailCheck.ok) {
      return res.status(400).json({ error: emailCheck.error, code: 'INVALID_EMAIL' });
    }

    const result = await clearLoginLockout(emailCheck.value);
    return res.status(200).json({
      success: true,
      email: result.email,
      was_locked: result.wasLocked,
      failure_count_cleared: result.failureCount,
      message: result.wasLocked || result.failureCount > 0
        ? `已解除 ${result.email} 的登入鎖定／失敗計數。`
        : `${result.email} 目前沒有登入鎖定。`,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
