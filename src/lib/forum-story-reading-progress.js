/**
 * Browser localStorage for story reading position (per post).
 */

const PREFIX = 'bcutm:forum:story-read:';

function storageKey(postId) {
  return `${PREFIX}${postId}`;
}

export function getStoryReadingProgress(postId) {
  if (typeof window === 'undefined' || !postId) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(postId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const chapterNumber = parseInt(parsed?.chapterNumber, 10);
    if (!Number.isFinite(chapterNumber) || chapterNumber < 1) return null;
    return { chapterNumber };
  } catch {
    return null;
  }
}

export function getStoryReadingChapter(postId, chapters = []) {
  const progress = getStoryReadingProgress(postId);
  if (!progress || !chapters.length) return 1;
  const exists = chapters.some((ch) => ch.chapter_number === progress.chapterNumber);
  return exists ? progress.chapterNumber : 1;
}

export function readStoryReadingResume(postId, chapters = []) {
  if (typeof window === 'undefined' || !postId) {
    return { chapterNumber: 1, hasProgress: false };
  }
  const progress = getStoryReadingProgress(postId);
  return {
    chapterNumber: getStoryReadingChapter(postId, chapters),
    hasProgress: !!progress,
  };
}

export function saveStoryReadingChapter(postId, chapterNumber) {
  if (typeof window === 'undefined' || !postId) return;
  const num = parseInt(chapterNumber, 10);
  if (!Number.isFinite(num) || num < 1) return;
  try {
    window.localStorage.setItem(storageKey(postId), JSON.stringify({
      chapterNumber: num,
      savedAt: new Date().toISOString(),
    }));
  } catch {
    /* quota exceeded */
  }
}
