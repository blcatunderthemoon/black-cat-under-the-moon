/**
 * POST /api/auth/init-profile
 * Creates a profile for the logged-in user if one does not already exist.
 * Called explicitly from the login page after a successful sign-in.
 *
 * Returns { profile, created: boolean }
 */

import { requireUser, getProfile, ensureProfile, sendAuthError, getAdminClient } from '../../../lib/server-auth.js';
import { ensureUserCat } from '../../../lib/my-cat-server.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  const existing = await getProfile(user.id);
  if (existing) {
    // Profile already exists — nothing to create
    if (existing.status === 'suspended' || existing.status === 'deleted') {
      return res.status(403).json({ error: 'account_disabled', code: 'ACCOUNT_DISABLED' });
    }
    return res.status(200).json({ created: false, profile: { display_name: existing.display_name, status: existing.status } });
  }

  // Create new profile
  const profile = await ensureProfile(user);

  // Best-effort: give the new user their default cat05 kitten (§3.4).
  // /api/my-cat also auto-creates, so a failure here is non-fatal.
  try {
    await ensureUserCat(getAdminClient(), user.id);
  } catch (err) {
    console.error('[init-profile] cat creation failed:', err?.message || err);
  }

  return res.status(200).json({ created: true, profile: { display_name: profile.display_name, status: profile.status } });
}
