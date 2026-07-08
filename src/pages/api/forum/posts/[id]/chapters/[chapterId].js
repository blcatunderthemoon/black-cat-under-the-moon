/**
 * PATCH /api/forum/posts/[id]/chapters/[chapterId] — update chapter (author only)
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../../../lib/server-auth.js';
import { filterContent } from '../../../../../../lib/content-filter.js';
import { isStoryPost, STORY_CONTENT_MAX, normalizeForumBodyContent } from '../../../../../../lib/forum-story.js';
import {
  STORY_CHAPTER_TITLE_MAX,
  ensureChapterOneMigrated,
  fetchStoryChapters,
  serializeStoryChapters,
} from '../../../../../../lib/forum-story-chapters.js';

export default async function handler(req, res) {
  const { id, chapterId } = req.query;
  if (!id || typeof id !== 'string' || !chapterId || typeof chapterId !== 'string') {
    return res.status(400).json({ error: 'Post ID and chapter ID required' });
  }

  if (req.method === 'PATCH') return handlePatch(req, res, id, chapterId);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function loadStoryPost(admin, postId) {
  const { data, error } = await admin
    .from('forum_posts')
    .select('id, author_id, title, content, topic, created_at, visibility')
    .eq('id', postId)
    .maybeSingle();
  if (error || !data) return null;
  if (!isStoryPost(data)) return null;
  return data;
}

async function resolveChapter(admin, post, chapterId) {
  let chapters = await fetchStoryChapters(admin, post);

  if (chapterId === 'legacy-1') {
    chapters = await ensureChapterOneMigrated(admin, post, chapters.filter((ch) => ch.id !== 'legacy-1'));
    return { chapters, chapter: chapters.find((ch) => ch.chapter_number === 1) || null };
  }

  const chapter = chapters.find((ch) => String(ch.id) === String(chapterId));
  if (chapter?.id === 'legacy-1') {
    chapters = await ensureChapterOneMigrated(admin, post, []);
    return { chapters, chapter: chapters.find((ch) => ch.chapter_number === 1) || null };
  }

  return { chapters, chapter: chapter || null };
}

async function handlePatch(req, res, postId, chapterId) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const admin = getAdminClient();
  const post = await loadStoryPost(admin, postId);
  if (!post) return res.status(404).json({ error: 'Story not found' });
  if (post.author_id !== user.id) {
    return res.status(403).json({ error: '只有作者可以編輯章節。' });
  }

  const { chapter } = await resolveChapter(admin, post, chapterId);
  if (!chapter?.id || chapter.id === 'legacy-1') {
    return res.status(404).json({ error: '章節不存在。' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const updates = {};

  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    const title = body.title == null ? null : String(body.title).trim().slice(0, STORY_CHAPTER_TITLE_MAX);
    updates.title = title || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'content')) {
    const content = normalizeForumBodyContent(body.content);
    if (!content.trim() || content.trim().length < 10) {
      return res.status(400).json({ error: '章節內容最少需要 10 個字。' });
    }
    if (content.length > STORY_CONTENT_MAX) {
      return res.status(400).json({ error: `章節內容最多 ${STORY_CONTENT_MAX} 字。` });
    }
    updates.content = content;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: '沒有可更新的欄位。' });
  }

  const titleForFilter = updates.title !== undefined ? updates.title : chapter.title;
  const contentForFilter = updates.content !== undefined ? updates.content : chapter.content;
  const { blocked, crisis } = filterContent([titleForFilter, contentForFilter].filter(Boolean).join(' '));
  if (blocked) {
    if (crisis) return res.status(451).json({ error: 'crisis', crisis: true });
    return res.status(422).json({ error: '內容包含不允許的詞語。' });
  }

  const { data: updated, error } = await admin
    .from('forum_story_chapters')
    .update(updates)
    .eq('id', chapter.id)
    .eq('story_post_id', post.id)
    .select('id, chapter_number, title, content, created_at')
    .single();

  if (error) {
    if (error.code === '42P01' || error.code === '42703') {
      return res.status(503).json({ error: '章節功能尚未啟用，請聯絡管理員執行資料庫遷移。' });
    }
    console.error('[forum/chapters] update failed:', error.message);
    return res.status(500).json({ error: '更新章節失敗，請稍後再試。' });
  }

  const allChapters = await fetchStoryChapters(admin, post);
  return res.status(200).json({
    chapter: serializeStoryChapters([updated])[0],
    chapters: serializeStoryChapters(allChapters),
  });
}
