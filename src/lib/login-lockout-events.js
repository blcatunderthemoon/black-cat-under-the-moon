/**
 * Persistent audit log for login lockout (freeze) events — dashboard investigation.
 */

import { getAdminClient } from './server-auth.js';
import {
  LOGIN_MAX_FAILED_ATTEMPTS,
  LOGIN_LOCKOUT_SEC,
} from './login-lockout.js';

/** Rolling window used to flag “too often”. */
export const LOGIN_LOCKOUT_FREQUENT_WINDOW_DAYS = 30;

/** Lockouts inside the window that mark a user as frequent / highlighted. */
export const LOGIN_LOCKOUT_FREQUENT_THRESHOLD = 3;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Best-effort resolve auth user id for an email.
 * @param {string} email
 * @returns {Promise<string | null>}
 */
async function resolveUserIdByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const admin = getAdminClient();

  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', normalized)
      .maybeSingle();
    if (profile?.id) return profile.id;
  } catch {
    /* profiles.email may be absent on older schemas */
  }

  try {
    const { data, error } = await admin.rpc('dashboard_search_auth_users', {
      search_query: normalized,
      result_limit: 5,
    });
    if (!error && Array.isArray(data)) {
      const hit = data.find((row) => String(row.email || '').toLowerCase() === normalized);
      if (hit?.id) return hit.id;
    }
  } catch {
    /* ignore */
  }

  return null;
}

/**
 * Record a freeze event (call only when lockout is newly triggered).
 * Best-effort — never throws to the login path.
 *
 * @param {{
 *   email: string,
 *   ip?: string | null,
 *   userAgent?: string | null,
 *   failureCount?: number,
 *   lockoutUntil?: number | null,
 *   userId?: string | null,
 * }} payload
 */
export async function recordLoginLockoutEvent(payload) {
  const email = normalizeEmail(payload?.email);
  if (!email) return null;

  try {
    const admin = getAdminClient();
    let userId = payload.userId || null;
    if (!userId) {
      userId = await resolveUserIdByEmail(email);
    }

    const lockoutUntil = payload.lockoutUntil
      ? new Date(payload.lockoutUntil).toISOString()
      : new Date(Date.now() + LOGIN_LOCKOUT_SEC * 1000).toISOString();

    const row = {
      email,
      user_id: userId,
      ip: payload.ip ? String(payload.ip).slice(0, 128) : null,
      user_agent: payload.userAgent ? String(payload.userAgent).slice(0, 512) : null,
      failure_count: Number(payload.failureCount) || LOGIN_MAX_FAILED_ATTEMPTS,
      lockout_until: lockoutUntil,
    };

    const { data, error } = await admin
      .from('login_lockout_events')
      .insert(row)
      .select('id, email, user_id, created_at')
      .maybeSingle();

    if (error) {
      console.warn('[login-lockout-events] insert failed:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[login-lockout-events] record failed:', err?.message || err);
    return null;
  }
}

/**
 * @param {string} email
 * @param {{ limit?: number, days?: number }} [opts]
 */
export async function listLoginLockoutEventsForEmail(email, opts = {}) {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];

  const limit = Math.min(Math.max(Number(opts.limit) || 20, 1), 100);
  const admin = getAdminClient();
  let query = admin
    .from('login_lockout_events')
    .select('id, email, user_id, ip, user_agent, failure_count, lockout_until, created_at')
    .eq('email', normalized)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (opts.days && Number(opts.days) > 0) {
    const since = new Date(Date.now() - Number(opts.days) * 86400000).toISOString();
    query = query.gte('created_at', since);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('[login-lockout-events] list failed:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Aggregate lockout stats for many emails (dashboard user list).
 * @param {string[]} emails
 * @returns {Promise<Map<string, {
 *   email: string,
 *   lockout_count_total: number,
 *   lockout_count_window: number,
 *   last_lockout_at: string | null,
 *   login_lockout_frequent: boolean,
 * }>>}
 */
export async function getLoginLockoutStatsMany(emails) {
  const unique = [...new Set((emails || []).map(normalizeEmail).filter(Boolean))];
  const map = new Map();
  for (const email of unique) {
    map.set(email, {
      email,
      lockout_count_total: 0,
      lockout_count_window: 0,
      last_lockout_at: null,
      login_lockout_frequent: false,
    });
  }
  if (!unique.length) return map;

  const admin = getAdminClient();
  const since = new Date(
    Date.now() - LOGIN_LOCKOUT_FREQUENT_WINDOW_DAYS * 86400000,
  ).toISOString();

  // Window events (exact for frequent flag) + a wider recent pull for last_at / lifetime-ish total.
  const [{ data: windowRows, error: windowErr }, { data: recentRows, error: recentErr }] = await Promise.all([
    admin
      .from('login_lockout_events')
      .select('email, created_at')
      .in('email', unique)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(Math.min(unique.length * 100, 5000)),
    admin
      .from('login_lockout_events')
      .select('email, created_at')
      .in('email', unique)
      .order('created_at', { ascending: false })
      .limit(Math.min(unique.length * 80, 4000)),
  ]);

  if (windowErr) {
    console.warn('[login-lockout-events] stats window failed:', windowErr.message);
  }
  if (recentErr) {
    console.warn('[login-lockout-events] stats recent failed:', recentErr.message);
  }

  for (const row of recentRows || []) {
    const email = normalizeEmail(row.email);
    const entry = map.get(email);
    if (!entry) continue;
    entry.lockout_count_total += 1;
    if (!entry.last_lockout_at) entry.last_lockout_at = row.created_at;
  }

  for (const row of windowRows || []) {
    const email = normalizeEmail(row.email);
    const entry = map.get(email);
    if (!entry) continue;
    entry.lockout_count_window += 1;
    if (!entry.last_lockout_at || (row.created_at && row.created_at > entry.last_lockout_at)) {
      entry.last_lockout_at = row.created_at;
    }
  }

  for (const entry of map.values()) {
    entry.login_lockout_frequent =
      entry.lockout_count_window >= LOGIN_LOCKOUT_FREQUENT_THRESHOLD;
  }

  return map;
}

/**
 * Top / recent freeze offenders for investigation dashboard.
 * @param {{ days?: number, limit?: number, frequentOnly?: boolean }} [opts]
 */
export async function listLoginLockoutSummaries(opts = {}) {
  const days = Number(opts.days) > 0 ? Number(opts.days) : LOGIN_LOCKOUT_FREQUENT_WINDOW_DAYS;
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 200);
  const frequentOnly = !!opts.frequentOnly;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('login_lockout_events')
    .select('email, user_id, ip, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) {
    console.warn('[login-lockout-events] summary failed:', error.message);
    return {
      window_days: days,
      frequent_threshold: LOGIN_LOCKOUT_FREQUENT_THRESHOLD,
      summaries: [],
      error: error.message,
    };
  }

  /** @type {Map<string, any>} */
  const byEmail = new Map();
  for (const row of data || []) {
    const email = normalizeEmail(row.email);
    if (!email) continue;
    let entry = byEmail.get(email);
    if (!entry) {
      entry = {
        email,
        user_id: row.user_id || null,
        lockout_count_window: 0,
        last_lockout_at: row.created_at,
        last_ip: row.ip || null,
        ips: new Set(),
      };
      byEmail.set(email, entry);
    }
    entry.lockout_count_window += 1;
    if (row.user_id && !entry.user_id) entry.user_id = row.user_id;
    if (row.ip) entry.ips.add(row.ip);
    if (row.created_at > entry.last_lockout_at) {
      entry.last_lockout_at = row.created_at;
      entry.last_ip = row.ip || entry.last_ip;
    }
  }

  let summaries = [...byEmail.values()].map((entry) => ({
    email: entry.email,
    user_id: entry.user_id,
    lockout_count_window: entry.lockout_count_window,
    last_lockout_at: entry.last_lockout_at,
    last_ip: entry.last_ip,
    distinct_ips: entry.ips.size,
    login_lockout_frequent: entry.lockout_count_window >= LOGIN_LOCKOUT_FREQUENT_THRESHOLD,
  }));

  summaries.sort((a, b) => {
    if (b.lockout_count_window !== a.lockout_count_window) {
      return b.lockout_count_window - a.lockout_count_window;
    }
    return String(b.last_lockout_at || '').localeCompare(String(a.last_lockout_at || ''));
  });

  if (frequentOnly) {
    summaries = summaries.filter((s) => s.login_lockout_frequent);
  }

  return {
    window_days: days,
    frequent_threshold: LOGIN_LOCKOUT_FREQUENT_THRESHOLD,
    summaries: summaries.slice(0, limit),
  };
}
