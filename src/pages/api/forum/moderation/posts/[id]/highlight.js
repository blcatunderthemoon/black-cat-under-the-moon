/**
 * POST /api/forum/moderation/posts/[id]/highlight
 * Body: { highlighted: boolean }
 */

import { resolveModerationActor } from '../../../../../../lib/forum-moderation-auth.js';
import { highlightForumPost } from '../../../../../../lib/forum-moderation.js';

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Post ID required' });

  const actor = await resolveModerationActor(req, res);
  if (!actor) return undefined;

  const { highlighted } = parseBody(req);
  if (typeof highlighted !== 'boolean') {
    return res.status(400).json({ error: 'highlighted (boolean) is required' });
  }

  const result = await highlightForumPost(id, highlighted, { actorId: actor.actorId });
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  return res.status(200).json({ success: true, is_highlighted: result.is_highlighted });
}
