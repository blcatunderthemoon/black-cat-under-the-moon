/**
 * GET  /api/forum/posts/[id]/chapters — list chapters
 * POST /api/forum/posts/[id]/chapters — add chapter (author only)
 */

import { requireUser, sendAuthError, getAdminClient } from '../../../../../lib/server-auth.js';
import { isStoryPost, STORY_CONTENT_MAX, normalizeForumBodyContent } from '../../../../../lib/forum-story.js';
import {
  STORY_CHAPTER_TITLE_MAX,
  ensureChapterOneMigrated,
  fetchStoryChapters,
  serializeStoryChapters,
} from '../../../../../lib/forum-story-chapters.js';

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Post ID required' });
  }

  if (req.method === 'GET') return handleGet(req, res, id);
  if (req.method === 'POST') return handlePost(req, res, id);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function loadStoryPost(admin, postId) {
  const { data, error } = await admin
    .from('forum_posts')
    .select('id, author_id, title, content, topic, created_at, visibility, story_completed')
    .eq('id', postId)
    .maybeSingle();
  if (error || !data) return null;
  if (!isStoryPost(data)) return null;
  return data;
}

async function handleGet(req, res, postId) {
  try {
    await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const admin = getAdminClient();
  const post = await loadStoryPost(admin, postId);
  if (!post) return res.status(404).json({ error: 'Story not found' });

  const chapters = await fetchStoryChapters(admin, post);
  return res.status(200).json({
    chapters: serializeStoryChapters(chapters),
  });
}

async function handlePost(req, res, postId) {
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
    return res.status(403).json({ error: '只有作者可以新增章節。' });
  }
  if (post.story_completed) {
    return res.status(409).json({ error: '此書已標記完結，請先取消完結再新增章節。' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const content = normalizeForumBodyContent(body.content);
  const title = body.title != null ? String(body.title).trim().slice(0, STORY_CHAPTER_TITLE_MAX) : null;

  if (!content.trim() || content.trim().length < 10) {
    return res.status(400).json({ error: '章節內容最少需要 10 個字。' });
  }
  if (content.length > STORY_CONTENT_MAX) {
    return res.status(400).json({ error: `章節內容最多 ${STORY_CONTENT_MAX} 字。` });
  }

  let chapters = await fetchStoryChapters(admin, post);
  chapters = await ensureChapterOneMigrated(admin, post, chapters.filter((ch) => ch.id !== 'legacy-1'));

  const maxNumber = chapters.reduce((max, ch) => Math.max(max, ch.chapter_number || 0), 0);
  const nextNumber = maxNumber + 1;

  const { data: inserted, error } = await admin
    .from('forum_story_chapters')
    .insert({
      story_post_id: post.id,
      chapter_number: nextNumber,
      title: title || null,
      content,
    })
    .select('id, chapter_number, title, content, created_at')
    .single();

  if (error) {
    if (error.code === '42P01' || error.code === '42703') {
      return res.status(503).json({ error: '章節功能尚未啟用，請聯絡管理員執行資料庫遷移。' });
    }
    console.error('[forum/chapters] insert failed:', error.message);
    return res.status(500).json({ error: '新增章節失敗，請稍後再試。' });
  }

  const allChapters = await fetchStoryChapters(admin, { ...post, content: post.content });
  return res.status(201).json({
    chapter: serializeStoryChapters([inserted])[0],
    chapters: serializeStoryChapters(allChapters),
  });
}
