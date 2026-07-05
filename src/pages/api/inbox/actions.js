/**
 * POST /api/inbox/report
 * Report an inbox message.
 * Body: { message_id }
 *
 * POST /api/inbox/block
 * Block a user (prevents future messages from them).
 * Body: { blocked_id }
 */

import { requireUser, sendAuthError } from '../../../lib/server-auth.js';
import { reportMessage, blockUser } from '../../../lib/inbox.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try { user = await requireUser(req); } catch (err) { return sendAuthError(res, err); }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const action = req.query.action || body.action;

  if (action === 'block') {
    const { blocked_id } = body;
    if (!blocked_id) return res.status(400).json({ error: 'blocked_id is required' });
    try {
      const result = await blockUser(user.id, blocked_id);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  // Default: report a message
  const { message_id } = body;
  if (!message_id) return res.status(400).json({ error: 'message_id is required' });
  try {
    const result = await reportMessage(message_id, user.id);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
