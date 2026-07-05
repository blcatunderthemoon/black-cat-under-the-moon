/**
 * Resolve forum author labels from live profile data (not post-time snapshots).
 */

export const FORUM_FALLBACK_AUTHOR_NAME = '神秘貓咪';

export function resolveForumAuthorDisplayName(liveName, snapshot) {
  const live = String(liveName || '').trim();
  if (live) return live;
  const snap = String(snapshot || '').trim();
  return snap || FORUM_FALLBACK_AUTHOR_NAME;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string[]} userIds
 * @returns {Promise<Record<string, string>>}
 */
export async function loadDisplayNamesByUserIds(admin, userIds) {
  const { names } = await loadForumAuthorMeta(admin, userIds);
  return names;
}

/**
 * Batch-load display names + premium flag (one profiles round-trip).
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string[]} userIds
 * @returns {Promise<{ names: Record<string, string>, premium: Record<string, boolean> }>}
 */
export async function loadForumAuthorMeta(admin, userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  const names = {};
  const premium = {};
  if (!ids.length) return { names, premium };

  const { data, error } = await admin
    .from('profiles')
    .select('id, display_name, subscription_tier')
    .in('id', ids);

  if (error) {
    console.error('[forum-author-names] profile lookup failed:', error.message);
    return { names, premium };
  }

  for (const row of data || []) {
    if (!row?.id) continue;
    names[row.id] = resolveForumAuthorDisplayName(row.display_name);
    premium[row.id] = row.subscription_tier === 'premium';
  }
  return { names, premium };
}
