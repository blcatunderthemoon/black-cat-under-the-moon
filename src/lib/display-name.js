/**
 * Resolve header display name synchronously from session, with /api/me as override.
 * Avoid session user_metadata until profile has been fetched — prevents login flash of stale names.
 */

export function resolveDisplayName(session, profileData, { profileHydrated = true } = {}) {
  if (!session?.user) return null;

  const profileName = profileData?.profile?.display_name?.trim();
  if (profileName) return profileName;

  if (!profileHydrated) return null;

  return (
    session.user.user_metadata?.display_name?.trim() ||
    session.user.email?.split('@')[0]?.trim() ||
    null
  );
}
