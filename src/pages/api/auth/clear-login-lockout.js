/**
 * POST /api/auth/clear-login-lockout
 * Clears login failure / freeze state after a successful password reset.
 * Requires a valid Bearer session (recovery or authenticated).
 */

import { requireUser, sendAuthError } from '../../../lib/server-auth.js';
import { clearLoginLockout } from '../../../lib/login-lockout.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await requireUser(req);
    const email = user.email;
    if (email) {
      await clearLoginLockout(email);
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return sendAuthError(res, err);
  }
}
