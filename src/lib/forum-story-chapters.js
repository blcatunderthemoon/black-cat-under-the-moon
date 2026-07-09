/**
 * Story chapter helpers (寫故事 multi-chapter books).
 */

import { isStoryPost, normalizeForumBodyContent } from './forum-story.js';

export const STORY_CHAPTER_TITLE_MAX = 80;
export const GUEST_FREE_CHAPTER_COUNT = 3;

export function isGuestReadableChapter(chapterNumber, loggedIn = false) {
  if (loggedIn) return true;
  const n = Math.max(1, Number(chapterNumber) || 1);
  return n <= GUEST_FREE_CHAPTER_COUNT;
}

export function chapterDisplayTitle(chapter) {
  const custom = String(chapter?.title || '').trim();
  if (custom) return custom;
  const n = chapter?.chapter_number || 1;
  return `第${n}章`;
}

export function normalizeLegacyChapters(post) {
  const content = normalizeForumBodyContent(post?.content);
  if (!content.trim()) return [];
  return [{
    id: 'legacy-1',
    chapter_number: 1,
    title: null,
    content,
    created_at: post.created_at,
  }];
}

export async function fetchStoryChapters(admin, post) {
  if (!post?.id || !isStoryPost(post)) return [];

  const { data, error } = await admin
    .from('forum_story_chapters')
    .select('id, chapter_number, title, content, created_at')
    .eq('story_post_id', post.id)
    .order('chapter_number', { ascending: true });

  if (error?.code === '42703' || error?.code === '42P01') {
    return normalizeLegacyChapters(post);
  }
  if (error) {
    console.error('[forum-story-chapters] fetch failed:', error.message);
    return normalizeLegacyChapters(post);
  }
  if (!data?.length) return normalizeLegacyChapters(post);
  return data;
}

export function serializeStoryChapters(chapters, { includeContent = true } = {}) {
  return (chapters || []).map((ch) => ({
    id: ch.id,
    chapter_number: ch.chapter_number,
    title: ch.title || null,
    display_title: chapterDisplayTitle(ch),
    ...(includeContent ? { content: ch.content } : {}),
    created_at: ch.created_at,
  }));
}

/** Chapter list metadata only (no body) — for locked previews if needed. */
export function serializeStoryChapterMeta(chapters) {
  return serializeStoryChapters(chapters, { includeContent: false });
}

/** Guest preview: full content for the first N chapters, metadata only for the rest. */
export function serializeGuestStoryChapters(
  chapters,
  freeCount = GUEST_FREE_CHAPTER_COUNT,
) {
  return (chapters || []).map((ch) => {
    const n = ch.chapter_number || 1;
    const base = {
      id: ch.id,
      chapter_number: n,
      title: ch.title || null,
      display_title: chapterDisplayTitle(ch),
      created_at: ch.created_at,
      locked: n > freeCount,
    };
    if (n <= freeCount) {
      return { ...base, content: ch.content };
    }
    return base;
  });
}

export function getChapterByNumber(chapters, chapterNumber) {
  const n = Math.max(1, Number(chapterNumber) || 1);
  return (chapters || []).find((ch) => ch.chapter_number === n) || null;
}

export async function ensureChapterOneMigrated(admin, post, existingChapters) {
  if (existingChapters?.length) return existingChapters;
  const legacy = normalizeLegacyChapters(post);
  if (!legacy.length) return [];

  const { data, error } = await admin
    .from('forum_story_chapters')
    .insert({
      story_post_id: post.id,
      chapter_number: 1,
      title: null,
      content: legacy[0].content,
    })
    .select('id, chapter_number, title, content, created_at')
    .single();

  if (error) {
    console.error('[forum-story-chapters] migrate ch1 failed:', error.message);
    return legacy;
  }
  return [data];
}
