/**
 * Resolve auth user IDs for questionnaire responses (claimed or email match).
 */

import { getAdminClient } from './server-auth.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function normalizeResponseEmail(email) {
  return normalizeEmail(email);
}

/** True when both questionnaire rows list the same non-empty email. */
export function pairHasSameResponseEmail(rowA, rowB) {
  const a = normalizeEmail(rowA?.email);
  const b = normalizeEmail(rowB?.email);
  return !!(a && b && a === b);
}

export function formatSameEmailPairLabel(rowA, rowB, aId, bId) {
  const email = normalizeEmail(rowA?.email);
  const nameA = rowA?.name || '';
  const nameB = rowB?.name || '';
  return `#${aId} ${nameA} × #${bId} ${nameB}（${email}）`;
}

/**
 * Find auth.users.id for a response row (claimed user_id or verified email match).
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {{ user_id?: string|null, email?: string|null }} row
 * @returns {Promise<string|null>}
 */
export async function resolveResponseAuthUserId(admin, row) {
  if (row?.user_id) return row.user_id;

  const email = normalizeEmail(row?.email);
  if (!email) return null;

  const { data: rows, error } = await admin.rpc('dashboard_search_auth_users', {
    search_query: email,
    result_limit: 5,
  });
  if (error) return null;

  const exact = (rows || []).find((r) => normalizeEmail(r.email) === email);
  return exact?.id || null;
}

/**
 * Link an unclaimed response to an auth user when emails match exactly.
 * @returns {Promise<string|null>} effective user_id
 */
export async function linkResponseToAuthUser(admin, responseRow, authUserId) {
  if (!responseRow || !authUserId) return responseRow?.user_id || null;
  if (responseRow.user_id) return responseRow.user_id;

  const email = normalizeEmail(responseRow.email);
  if (!email) return null;

  try {
    const { data: { user } } = await admin.auth.admin.getUserById(authUserId);
    if (normalizeEmail(user?.email) !== email) return null;
  } catch {
    return null;
  }

  const { data: otherClaim } = await admin
    .from('responses')
    .select('id')
    .eq('user_id', authUserId)
    .eq('claim_status', 'claimed')
    .neq('id', responseRow.id)
    .limit(1)
    .maybeSingle();

  if (otherClaim) return authUserId;

  await admin
    .from('responses')
    .update({ user_id: authUserId, claim_status: 'claimed' })
    .eq('id', responseRow.id)
    .is('user_id', null);

  return authUserId;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {{ email?: string|null, user_id?: string|null }} row
 * @returns {Promise<string|null>}
 */
export async function resolveResponseDeliveryEmail(admin, row) {
  const direct = String(row?.email || '').trim();
  if (direct) return direct;

  if (!row?.user_id) return null;

  try {
    const client = admin || getAdminClient();
    const { data: { user } } = await client.auth.admin.getUserById(row.user_id);
    return user?.email?.trim() || null;
  } catch {
    return null;
  }
}

export function soloMatchSourceId(responseAId, responseBId) {
  const a = Number(responseAId);
  const b = Number(responseBId);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return `solo:${lo}:${hi}`;
}

export function parseSoloMatchSourceId(sourceId) {
  const raw = String(sourceId || '');
  if (!raw.startsWith('solo:')) return null;
  const parts = raw.split(':');
  const a = Number(parts[1]);
  const b = Number(parts[2]);
  if (!a || !b) return null;
  return { responseAId: a, responseBId: b };
}
