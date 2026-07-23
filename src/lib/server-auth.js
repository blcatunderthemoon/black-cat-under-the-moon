/**
 * src/lib/server-auth.js
 * Server-side Supabase auth helpers.
 * Use SUPABASE_SERVICE_ROLE_KEY for admin ops; anon key for user-scoped ops.
 *
 * IMPORTANT: Never import this in client-side code or expose the service role key.
 */

import { createClient } from '@supabase/supabase-js';
import { resolveSafeDisplayName, DISPLAY_NAME_MAX_LENGTH } from './display-name-policy.js';
import { isDisplayNameTaken } from './display-name-uniqueness.js';
import { isProduction } from './production-guard.js';

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL env var');
if (!supabaseAnonKey) throw new Error('Missing SUPABASE_ANON_KEY env var');
if (isProduction() && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in production');
}

function resolveServiceKey() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) return serviceKey;
  return supabaseAnonKey;
}

/**
 * Admin client — bypasses RLS. Use only in server API routes, never in
 * client-facing code. Requires SUPABASE_SERVICE_ROLE_KEY in production.
 */
export function getAdminClient() {
  return createClient(supabaseUrl, resolveServiceKey(), {
    auth: { persistSession: false },
  });
}

/**
 * Forum/public reads: prefer service role; otherwise use the caller's JWT
 * (authenticated) or anon key (guest). Requires forum_posts SELECT RLS when
 * service role is not configured.
 */
export function getServiceOrUserClient(req) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return getAdminClient();
  }
  const token = extractToken(req);
  if (!token) return getAnonClient();
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export function isUsingServiceRole() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Anon client — respects RLS. Suitable for operations that don't need admin.
 */
export function getAnonClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
}

/**
 * Extract the Bearer token from the Authorization header.
 * Returns null if missing or malformed.
 */
function extractToken(req) {
  const auth = req.headers?.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}

/**
 * Verify the JWT from the request and return the Supabase user object.
 * Throws a 401-like error object if token is missing or invalid.
 *
 * Usage in an API handler:
 *   const user = await requireUser(req);
 */
export async function requireUser(req) {
  const token = extractToken(req);
  if (!token) {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }

  const admin = getAdminClient();
  const { data, error } = await admin.auth.getUser(token);

  if (error || !data?.user) {
    const err = new Error('Invalid or expired token');
    err.status = 401;
    throw err;
  }

  return data.user;
}

/**
 * Like requireUser but returns null instead of throwing.
 * Use for endpoints where auth is optional (e.g. /api/submit).
 */
export async function getOptionalUser(req) {
  try {
    return await requireUser(req);
  } catch {
    return null;
  }
}

/**
 * Get the profile row for a given user id.
 * Returns null if not found.
 */
export async function getProfile(userId) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data;
}

/**
 * Ensure a profile row exists for the user.
 * Creates one with defaults if missing.
 * Returns the profile row.
 */
export async function ensureProfile(user) {
  const existing = await getProfile(user.id);
  if (existing) return existing;

  const admin = getAdminClient();
  let displayName = resolveSafeDisplayName(
    user.user_metadata?.display_name,
    user.email,
  );

  if (await isDisplayNameTaken(admin, displayName)) {
    const suffix = user.id.replace(/-/g, '').slice(0, 4);
    const base = displayName.slice(0, Math.max(1, DISPLAY_NAME_MAX_LENGTH - suffix.length - 1));
    displayName = `${base}#${suffix}`;
  }

  const { data, error } = await admin
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email,
      display_name: displayName,
      status: 'active',
      subscription_tier: 'free',
    })
    .select()
    .single();

  if (error) {
    const err = new Error('Failed to create profile: ' + error.message);
    err.status = 500;
    throw err;
  }

  return data;
}

/**
 * Derive subscription tier from a subscriptions row (or null).
 */
export function resolveSubscriptionTier(subscription) {
  if (!subscription) return 'free';
  if (subscription.status === 'manual' || subscription.status === 'active' || subscription.status === 'past_due') {
    if (subscription.current_period_end) {
      const expired = new Date(subscription.current_period_end) < new Date();
      if (expired) return 'free';
    }
    return 'premium';
  }
  return 'free';
}

/**
 * Get the subscription tier for a user.
 * Returns 'free' if no subscription row or expired.
 * Falls back to profiles.subscription_tier when the subscriptions ledger has no active row
 * (covers manual grants / sync lag so Passport UI is not stuck on free).
 */
export async function getSubscriptionTier(userId) {
  const admin = getAdminClient();
  const { data } = await admin
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
    .in('status', ['active', 'manual', 'past_due'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) {
    return resolveSubscriptionTier(data);
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle();

  return profile?.subscription_tier === 'premium' ? 'premium' : 'free';
}

/** Batch lookup subscription tiers for multiple users (single DB round-trip). */
export async function getSubscriptionTiers(userIds) {
  const unique = [...new Set((userIds || []).filter(Boolean))];
  const tiers = Object.fromEntries(unique.map((id) => [id, 'free']));
  if (!unique.length) return tiers;

  const admin = getAdminClient();
  const { data: rows } = await admin
    .from('subscriptions')
    .select('user_id, status, current_period_end')
    .in('user_id', unique)
    .in('status', ['active', 'manual', 'past_due']);

  const now = Date.now();
  const bestByUser = {};
  for (const row of rows || []) {
    if (!row?.user_id) continue;
    const end = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
    if (end && end < now) continue;
    if (row.status === 'active' || row.status === 'manual' || row.status === 'past_due') {
      bestByUser[row.user_id] = 'premium';
    }
  }
  for (const id of unique) {
    if (bestByUser[id]) tiers[id] = 'premium';
  }
  return tiers;
}

/**
 * Returns true if the user currently has an active premium subscription.
 */
export async function isPremium(userId) {
  const tier = await getSubscriptionTier(userId);
  return tier === 'premium';
}

/**
 * Helper: send a uniform 401 or 403 JSON error response.
 * Call after catching errors from requireUser.
 */
export function sendAuthError(res, err) {
  const status = err?.status || 401;
  const message =
    status === 403 ? 'Forbidden' : 'Authentication required';
  return res.status(status).json({ error: message });
}
