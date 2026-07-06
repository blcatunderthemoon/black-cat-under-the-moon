/**
 * GET /api/forum/moderation/log
 */

import { resolveModerationActor } from '../../../../lib/forum-moderation-auth.js';
import { getAdminClient } from '../../../../lib/server-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await resolveModerationActor(req, res);
  if (!actor) return undefined;

  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('forum_moderation_log')
    .select('id, actor_id, action, target_type, target_id, payload, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Moderation log not configured yet.' });
    }
    return res.status(500).json({ error: 'Failed to load log' });
  }

  return res.status(200).json({ log: data || [], offset, limit });
}
