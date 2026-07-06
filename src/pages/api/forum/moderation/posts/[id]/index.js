/**
 * DELETE /api/forum/moderation/posts/[id] — admin hard delete
 */

import { resolveModerationActor } from '../../../../../../lib/forum-moderation-auth.js';
import { hardDeleteForumPost } from '../../../../../../lib/forum-moderation.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Post ID required' });

  const actor = await resolveModerationActor(req, res, { requireAdmin: true });
  if (!actor) return undefined;

  const result = await hardDeleteForumPost(id, { actorId: actor.actorId });
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  return res.status(200).json({ success: true, deleted: true });
}
