/**
 * GET /api/forum/moderation/queue
 * Moderation queue: high-report posts/comments (moderator or dashboard key).
 */

import { resolveModerationActor } from '../../../../lib/forum-moderation-auth.js';
import { getModerationQueue } from '../../../../lib/forum-moderation.js';
import { forumListPreviewText } from '../../../../lib/forum-list-preview.js';
import { getAdminClient } from '../../../../lib/server-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await resolveModerationActor(req, res);
  if (!actor) return undefined;

  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const queue = await getModerationQueue({ limit });

  const authorIds = [
    ...new Set([
      ...(queue.posts || []).map((p) => p.author_id),
      ...(queue.comments || []).map((c) => c.author_id),
    ].filter(Boolean)),
  ];

  const admin = getAdminClient();
  const { data: profiles } = authorIds.length
    ? await admin.from('profiles').select('id, display_name').in('id', authorIds)
    : { data: [] };

  const nameById = {};
  (profiles || []).forEach((p) => { nameById[p.id] = p.display_name; });

  return res.status(200).json({
    posts: (queue.posts || []).map((p) => ({
      id: p.id,
      title: p.title,
      topic: p.topic,
      visibility: p.visibility,
      report_count: p.report_count,
      created_at: p.created_at,
      is_pinned: p.is_pinned || false,
      is_highlighted: p.is_highlighted || false,
      preview: forumListPreviewText(p.content, { maxLength: 160 }),
      author_display_name: nameById[p.author_id] || null,
      author_id: p.author_id,
      forum_url: `/forum/${p.id}`,
    })),
    comments: (queue.comments || []).map((c) => ({
      id: c.id,
      post_id: c.post_id,
      report_count: c.report_count,
      is_hidden: c.is_hidden,
      created_at: c.created_at,
      preview: forumListPreviewText(c.content, { maxLength: 160 }),
      author_display_name: nameById[c.author_id] || null,
      author_id: c.author_id,
      forum_url: `/forum/${c.post_id}#comments`,
    })),
    recent_reports: queue.recent_reports,
    via_dashboard: actor.viaDashboard,
  });
}
