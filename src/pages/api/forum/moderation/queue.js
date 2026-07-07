/**
 * GET /api/forum/moderation/queue
 * Moderation queue: high-report posts/comments (moderator or dashboard key).
 */

import { resolveModerationActor } from '../../../../lib/forum-moderation-auth.js';
import { canAdminForum } from '../../../../lib/forum-roles.js';
import { filterQueueForActor } from '../../../../lib/forum-moderator-assignments.js';
import { getModerationQueue } from '../../../../lib/forum-moderation.js';
import { forumListPreviewText } from '../../../../lib/forum-list-preview.js';
import { getAdminClient } from '../../../../lib/server-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const actor = await resolveModerationActor(req, res);
  if (!actor) return undefined;

  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const queue = await getModerationQueue({ limit });

  const admin = getAdminClient();
  const commentPostIds = [...new Set((queue.comments || []).map((c) => c.post_id).filter(Boolean))];
  const postTopicById = {};
  (queue.posts || []).forEach((p) => {
    postTopicById[p.id] = p.topic;
  });

  if (commentPostIds.length) {
    const missingIds = commentPostIds.filter((id) => !postTopicById[id]);
    if (missingIds.length) {
      const { data: postRows } = await admin
        .from('forum_posts')
        .select('id, topic')
        .in('id', missingIds);
      (postRows || []).forEach((p) => {
        postTopicById[p.id] = p.topic;
      });
    }
  }

  const scoped = filterQueueForActor(actor, queue, postTopicById);

  const authorIds = [
    ...new Set([
      ...(scoped.posts || []).map((p) => p.author_id),
      ...(scoped.comments || []).map((c) => c.author_id),
    ].filter(Boolean)),
  ];

  const { data: profiles } = authorIds.length
    ? await admin.from('profiles').select('id, display_name').in('id', authorIds)
    : { data: [] };

  const nameById = {};
  (profiles || []).forEach((p) => { nameById[p.id] = p.display_name; });

  return res.status(200).json({
    posts: (scoped.posts || []).map((p) => ({
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
    comments: (scoped.comments || []).map((c) => ({
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
    actor: {
      role: actor.role,
      moderator_topics: actor.moderatorTopics || null,
      via_dashboard: actor.viaDashboard,
      can_admin: canAdminForum(actor.role) || actor.viaDashboard,
    },
  });
}
