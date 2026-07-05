/**
 * Resolve header display name synchronously from session, with /api/me as override.
 */

export function resolveDisplayName(session, profileData) {
  if (!session?.user) return null;

  const name =
    profileData?.profile?.display_name?.trim() ||
    session.user.user_metadata?.display_name?.trim() ||
    session.user.email?.split('@')[0]?.trim();

  return name || null;
}
