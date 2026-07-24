/**
 * Case- and spacing-insensitive display name uniqueness checks.
 */

export function normalizeDisplayNameKey(name) {
  return String(name || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function escapeIlike(value) {
  return String(value || '').replace(/[%_\\]/g, '\\$&');
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string} displayName
 * @param {{ excludeUserId?: string }} [options]
 * @returns {Promise<boolean>}
 */
export async function isDisplayNameTaken(admin, displayName, options = {}) {
  const trimmed = String(displayName || '').trim();
  const key = normalizeDisplayNameKey(trimmed);
  if (!key) return false;

  // Prefer indexed display_name_key when migration is applied.
  let keyQuery = admin
    .from('profiles')
    .select('id, display_name, status, display_name_key')
    .eq('display_name_key', key)
    .limit(8);

  if (options.excludeUserId) {
    keyQuery = keyQuery.neq('id', options.excludeUserId);
  }

  const keyed = await keyQuery;
  if (!keyed.error) {
    return (keyed.data || []).some((row) => {
      if (!row?.id || row.id === options.excludeUserId) return false;
      if (row.status === 'deleted') return false;
      return normalizeDisplayNameKey(row.display_name_key || row.display_name) === key;
    });
  }

  // Fallback before migration / if column missing from schema cache.
  let query = admin
    .from('profiles')
    .select('id, display_name, status')
    .ilike('display_name', escapeIlike(trimmed));

  if (options.excludeUserId) {
    query = query.neq('id', options.excludeUserId);
  }

  const { data, error } = await query.limit(8);
  if (error) {
    console.error('[display-name-uniqueness] lookup failed:', error.message);
    throw new Error('display_name_lookup_failed');
  }

  return (data || []).some((row) => {
    if (!row?.id || row.id === options.excludeUserId) return false;
    if (row.status === 'deleted') return false;
    return normalizeDisplayNameKey(row.display_name) === key;
  });
}

/** True when a Postgres / PostgREST error is a display_name unique violation. */
export function isDisplayNameUniqueViolation(error) {
  const code = String(error?.code || '');
  const msg = String(error?.message || error?.details || '').toLowerCase();
  return code === '23505' && (
    msg.includes('display_name')
    || msg.includes('profiles_display_name_key')
  );
}
