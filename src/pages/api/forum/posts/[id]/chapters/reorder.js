/**
 * PUT /api/forum/posts/[id]/chapters/reorder — author-only chapter order update
 * Body: { ordered_ids: string[] }  (all real chapter ids, new reading order)
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../../lib/server-auth.js';
import { isStoryPost } from '../../../../../lib/forum-story.js';
import {
  ensureChapterOneMigrated,
  fetchStoryChapters,
  serializeStoryChapters,
  reorderStoryChapters,
} from '../../../../../lib/forum-story-chapters.js';

export default async function handler(req, res) {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Post ID required' });
  }

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const admin = getAdminClient();
  const { data: post, error: postErr } = await admin
    .from('forum_posts')
    .select('id, author_id, title, content, topic, created_at, visibility')
    .eq('id', id)
    .maybeSingle();

  if (postErr || !post || !isStoryPost(post)) {
    return res.status(404).json({ error: 'Story not found' });
  }
  if (post.author_id !== user.id) {
    return res.status(403).json({ error: '只有作者可以調整章節順序。' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const orderedIds = Array.isArray(body.ordered_ids) ? body.ordered_ids.map(String) : null;
  if (!orderedIds?.length) {
    return res.status(400).json({ error: '請提供 ordered_ids。' });
  }

  let chapters = await fetchStoryChapters(admin, post);
  chapters = await ensureChapterOneMigrated(
    admin,
    post,
    chapters.filter((ch) => ch.id !== 'legacy-1'),
  );

  // Refresh after possible legacy migration
  chapters = await fetchStoryChapters(admin, post);
  const realChapters = chapters.filter((ch) => ch.id && ch.id !== 'legacy-1');

  if (realChapters.length < 2) {
    return res.status(400).json({ error: '至少需要兩章才能調整順序。' });
  }

  const existingIds = new Set(realChapters.map((ch) => String(ch.id)));
  if (orderedIds.length !== existingIds.size) {
    return res.status(400).json({ error: '章節列表不完整，請重新整理後再試。' });
  }
  for (const cid of orderedIds) {
    if (!existingIds.has(cid)) {
      return res.status(400).json({ error: '包含不屬於此故事的章節。' });
    }
  }

  try {
    const updated = await reorderStoryChapters(admin, post.id, orderedIds);
    return res.status(200).json({
      chapters: serializeStoryChapters(updated),
    });
  } catch (err) {
    console.error('[forum/chapters/reorder] failed:', err?.message || err);
    return res.status(500).json({ error: '調整順序失敗，請稍後再試。' });
  }
}
