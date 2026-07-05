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
