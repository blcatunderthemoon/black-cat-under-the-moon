/**
 * Story chapter helpers (寫故事 multi-chapter books).
 */

import { isStoryPost } from './forum-story.js';

export const STORY_CHAPTER_TITLE_MAX = 80;

export function chapterDisplayTitle(chapter) {
  const custom = String(chapter?.title || '').trim();
  if (custom) return custom;
  const n = chapter?.chapter_number || 1;
  return `第${n}章`;
}

export function normalizeLegacyChapters(post) {
  const content = String(post?.content || '').trim();
  if (!content) return [];
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

export function serializeStoryChapters(chapters) {
  return (chapters || []).map((ch) => ({
    id: ch.id,
    chapter_number: ch.chapter_number,
    title: ch.title || null,
    display_title: chapterDisplayTitle(ch),
    content: ch.content,
    created_at: ch.created_at,
  }));
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
