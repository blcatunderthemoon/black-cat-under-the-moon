/**
 * PATCH /api/forum/moderation/posts/[id]/tags
 * Body: { tags: string[] }
 */

import { resolveModerationActor } from '../../../../../../lib/forum-moderation-auth.js';
import { updateForumPostTags } from '../../../../../../lib/forum-moderation.js';

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
}

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Post ID required' });

  const actor = await resolveModerationActor(req, res);
  if (!actor) return undefined;

  const { tags } = parseBody(req);
  if (!Array.isArray(tags)) {
    return res.status(400).json({ error: 'tags array is required' });
  }

  const result = await updateForumPostTags(id, tags, { actorId: actor.actorId });
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  return res.status(200).json({ success: true, tags: result.tags });
}
