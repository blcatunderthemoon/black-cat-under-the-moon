/**
 * GET /api/inbox/threads
 * Returns the current user's inbox thread list with unread counts.
 */

import { requireUser, sendAuthError } from '../../../lib/server-auth.js';
import { listThreads } from '../../../lib/inbox.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  try {
    const threads = await listThreads(user.id, { limit, offset });
    return res.status(200).json({ threads });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
