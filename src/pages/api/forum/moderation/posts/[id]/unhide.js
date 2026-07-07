/**
 * POST /api/forum/moderation/posts/[id]/unhide
 */

import { resolveModerationActorForPost } from '../../../../../../lib/forum-moderation-auth.js';
import { unhideForumPost } from '../../../../../../lib/forum-moderation.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Post ID required' });

  const actor = await resolveModerationActorForPost(req, res, id);
  if (!actor) return undefined;

  const result = await unhideForumPost(id, { actorId: actor.actorId });
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  return res.status(200).json({ success: true, visibility: 'public' });
}
