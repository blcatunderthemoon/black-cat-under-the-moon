/**
 * Server-side auth email lookup (service role).
 */

import { getAdminClient } from './server-auth.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export async function isEmailRegistered(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const admin = getAdminClient();

  const { data, error } = await admin.rpc('auth_email_is_registered', {
    check_email: normalized,
  });
  if (!error) return data === true;

  const { data: rows, error: searchError } = await admin.rpc('dashboard_search_auth_users', {
    search_query: normalized,
    result_limit: 10,
  });
  if (searchError) {
    const err = new Error(searchError.message || 'Email lookup failed');
    err.status = 500;
    throw err;
  }

  return (rows || []).some((row) => row.email?.toLowerCase() === normalized);
}
