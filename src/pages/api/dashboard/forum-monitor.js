/**
 * GET  /api/dashboard/forum-monitor
 *   ?type=post|comment|all  — filter by target type (default: all)
 *   ?threshold=<n>           — report_count threshold (default 3)
 *   ?hidden=0|1              — 0=visible only (default), 1=already hidden
 *   ?limit=&offset=
 *
 * PATCH /api/dashboard/forum-monitor
 *   Body: { target_type: 'post'|'comment', target_id, action: 'hide'|'restore' }
 *
 * Admin-only (x-dashboard-key).
 */

import { getAdminClient } from '../../../lib/server-auth.js';
import { authorizeStationOrForumAdmin } from '../../../lib/station-or-forum-admin-auth.js';

export default async function handler(req, res) {
  if (!(await authorizeStationOrForumAdmin(req, res))) return;
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'PATCH') return handlePatch(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res) {
  const admin = getAdminClient();
  const type = req.query.type || 'all';
  const threshold = Math.max(1, Number(req.query.threshold) || 3);
  const showHidden = req.query.hidden === '1';
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;

  const results = { posts: [], comments: [], total: 0 };

  if (type === 'all' || type === 'post') {
    const { data: posts, count: postCount } = await admin
      .from('forum_posts')
      .select('id, title, content, topic, anonymous_name_snapshot, report_count, visibility, created_at, author_id', { count: 'exact' })
      .gte('report_count', threshold)
      .eq('visibility', showHidden ? 'hidden' : 'public')
      .order('report_count', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    results.posts = (posts || []).map((p) => ({
      ...p,
      content_preview: (p.content || '').slice(0, 120),
      content: undefined,
      author_id: undefined,
    }));
    results.total += postCount || 0;
  }

  if (type === 'all' || type === 'comment') {
    const { data: comments, count: commentCount } = await admin
      .from('forum_comments')
      .select('id, post_id, content, report_count, is_hidden, created_at, author_id', { count: 'exact' })
      .gte('report_count', threshold)
      .eq('is_hidden', showHidden)
      .order('report_count', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    results.comments = (comments || []).map((c) => ({
      ...c,
      content_preview: (c.content || '').slice(0, 120),
      content: undefined,
      author_id: undefined,
    }));
    results.total += commentCount || 0;
  }

  return res.status(200).json({ ...results, threshold, limit, offset });
}

async function handlePatch(req, res) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { target_type, target_id, action } = body;

  if (!target_id || !['post', 'comment'].includes(target_type) || !['hide', 'restore'].includes(action)) {
    return res.status(400).json({ error: 'target_type (post|comment), target_id, and action (hide|restore) required' });
  }

  const admin = getAdminClient();

  if (target_type === 'post') {
    const newVisibility = action === 'hide' ? 'hidden' : 'public';
    const { error } = await admin
      .from('forum_posts')
      .update({ visibility: newVisibility })
      .eq('id', target_id);
    if (error) return res.status(500).json({ error: 'Update failed' });
  } else {
    const { error } = await admin
      .from('forum_comments')
      .update({ is_hidden: action === 'hide' })
      .eq('id', target_id);
    if (error) return res.status(500).json({ error: 'Update failed' });
  }

  return res.status(200).json({ success: true, target_type, action });
}
