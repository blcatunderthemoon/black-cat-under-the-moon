/**
 * GET /api/inbox/threads/[id]
 * Returns messages in a specific thread. User must be a participant.
 * Marks unread messages as read on load.
 */

import { requireUser, sendAuthError } from '../../../../lib/server-auth.js';
import { getThread } from '../../../../lib/inbox.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Thread ID required' });

  try {
    const result = await getThread(id, user.id);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
