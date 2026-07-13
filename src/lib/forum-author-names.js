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

/** True when a post was published with username hidden. */
export function isForumPostAnonymous(post) {
  return !!post?.hide_username;
}

/**
 * Public author label for a forum post (respects hide_username).
 * Comments always use resolveForumAuthorDisplayName on the commenter profile.
 */
export function resolveForumPostAuthorDisplayName({ hideUsername, liveName, snapshot } = {}) {
  if (hideUsername) return FORUM_FALLBACK_AUTHOR_NAME;
  return resolveForumAuthorDisplayName(liveName, snapshot);
}

/**
 * Strip mirror / premium hints for anonymous posts.
 * @param {object} post — row with hide_username, anonymous_name_snapshot
 * @param {object} [meta] — { display_name, mirror_slug, mirror_type, is_premium }
 */
export function mapForumPostAuthorPublic(post, meta = {}) {
  const hide = isForumPostAnonymous(post);
  return {
    display_name: resolveForumPostAuthorDisplayName({
      hideUsername: hide,
      liveName: meta.display_name,
      snapshot: post?.anonymous_name_snapshot,
    }),
    mirror_slug: hide ? null : (meta.mirror_slug || null),
    mirror_type: hide ? null : (meta.mirror_type || null),
    is_premium: hide ? false : !!meta.is_premium,
    is_anonymous: hide,
  };
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
