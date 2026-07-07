/**
 * POST /api/forum/moderation/posts/[id]/pin
 * Body: { pinned: boolean }
 */

import { resolveModerationActorForPost } from '../../../../../../lib/forum-moderation-auth.js';
import { pinForumPost } from '../../../../../../lib/forum-moderation.js';

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Post ID required' });

  const actor = await resolveModerationActorForPost(req, res, id);
  if (!actor) return undefined;

  const { pinned } = parseBody(req);
  if (typeof pinned !== 'boolean') {
    return res.status(400).json({ error: 'pinned (boolean) is required' });
  }

  const result = await pinForumPost(id, pinned, { actorId: actor.actorId });
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  return res.status(200).json({ success: true, is_pinned: result.is_pinned });
}
