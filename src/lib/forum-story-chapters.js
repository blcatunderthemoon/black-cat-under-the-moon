/**
 * Story chapter helpers (寫故事 multi-chapter books).
 */

import { isStoryPost, normalizeForumBodyContent } from './forum-story.js';

export const STORY_CHAPTER_TITLE_MAX = 80;
export const GUEST_FREE_CHAPTER_COUNT = 3;

// Column set incl. the 番外篇 flag; falls back to base columns when the
// unlock_by_comment migration hasn't been applied yet.
const CHAPTER_COLUMNS = 'id, chapter_number, title, content, created_at, unlock_by_comment';
const CHAPTER_COLUMNS_BASE = 'id, chapter_number, title, content, created_at';

export function isGuestReadableChapter(chapterNumber, loggedIn = false) {
  if (loggedIn) return true;
  const n = Math.max(1, Number(chapterNumber) || 1);
  return n <= GUEST_FREE_CHAPTER_COUNT;
}

/** 番外篇：作者設定「留言解鎖」的章節。 */
export function isBonusChapter(chapter) {
  return !!(chapter && chapter.unlock_by_comment);
}

/**
 * Whether the current viewer has left at least one comment on this story
 * (comments can't be deleted here, so this is a stable unlock signal).
 */
export async function viewerHasCommentedOnPost(admin, postId, userId) {
  if (!postId || !userId) return false;
  const { data, error } = await admin
    .from('forum_comments')
    .select('id')
    .eq('post_id', postId)
    .eq('author_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) {
    if (error.code === 'PGRST116') return false; // no rows
    return false;
  }
  return !!data;
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

  let { data, error } = await admin
    .from('forum_story_chapters')
    .select(CHAPTER_COLUMNS)
    .eq('story_post_id', post.id)
    .order('chapter_number', { ascending: true });

  // unlock_by_comment column not migrated yet → retry with base columns.
  if (error?.code === '42703') {
    ({ data, error } = await admin
      .from('forum_story_chapters')
      .select(CHAPTER_COLUMNS_BASE)
      .eq('story_post_id', post.id)
      .order('chapter_number', { ascending: true }));
  }

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

/**
 * Author / full serializer: includes every chapter's body plus the 番外篇 flag.
 * Use only when the recipient is allowed to read everything (e.g. the author).
 */
export function serializeStoryChapters(chapters, { includeContent = true } = {}) {
  return (chapters || []).map((ch) => ({
    id: ch.id,
    chapter_number: ch.chapter_number,
    title: ch.title || null,
    display_title: chapterDisplayTitle(ch),
    bonus: isBonusChapter(ch),
    ...(includeContent ? { content: ch.content } : {}),
    created_at: ch.created_at,
  }));
}

/** Chapter list metadata only (no body) — for locked previews if needed. */
export function serializeStoryChapterMeta(chapters) {
  return serializeStoryChapters(chapters, { includeContent: false });
}

/**
 * Compute lock state for one chapter given the viewer.
 * - Guest login gate: chapters past the free count need login.
 * - 番外篇 gate: bonus chapters need the viewer to have commented on the story.
 * The author always reads everything.
 */
export function computeChapterLock(chapter, { loggedIn = false, isAuthor = false, hasCommented = false } = {}) {
  const bonus = isBonusChapter(chapter);
  if (isAuthor) return { bonus, locked: false, lock_reason: null };

  const guestLocked = !loggedIn && !isGuestReadableChapter(chapter?.chapter_number, false);
  if (guestLocked) {
    return { bonus, locked: true, lock_reason: bonus ? 'comment' : 'login' };
  }
  if (bonus && !hasCommented) {
    return { bonus, locked: true, lock_reason: 'comment' };
  }
  return { bonus, locked: false, lock_reason: null };
}

/**
 * Reader-facing serializer: applies the guest + 番外篇 gates and strips the body
 * of any locked chapter so gated content never reaches the client.
 */
export function serializeStoryChaptersForViewer(chapters, viewer = {}) {
  return (chapters || []).map((ch) => {
    const { bonus, locked, lock_reason } = computeChapterLock(ch, viewer);
    const base = {
      id: ch.id,
      chapter_number: ch.chapter_number || 1,
      title: ch.title || null,
      display_title: chapterDisplayTitle(ch),
      bonus,
      locked,
      lock_reason,
      created_at: ch.created_at,
    };
    if (locked) return base;
    return { ...base, content: ch.content };
  });
}

/** Guest preview: full content for the first N chapters, metadata only for the rest. */
export function serializeGuestStoryChapters(chapters) {
  return serializeStoryChaptersForViewer(chapters, {
    loggedIn: false,
    isAuthor: false,
    hasCommented: false,
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
