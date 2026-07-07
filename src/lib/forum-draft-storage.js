/**
 * Browser localStorage drafts for forum compose (posts + comments).
 */

const DRAFT_PREFIX = 'bcutm:forum:draft:';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const FORUM_POST_DRAFT_KEY = `${DRAFT_PREFIX}post`;

export function forumCommentDraftKey(postId) {
  return `${DRAFT_PREFIX}comment:${postId}`;
}

export function readForumDraft(key) {
  if (typeof window === 'undefined' || !key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.savedAt && Date.now() - new Date(parsed.savedAt).getTime() > MAX_AGE_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeForumDraft(key, payload) {
  if (typeof window === 'undefined' || !key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify({
      ...payload,
      savedAt: new Date().toISOString(),
    }));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function clearForumDraft(key) {
  if (typeof window === 'undefined' || !key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function hasForumPostDraftContent(form) {
  if (!form || typeof form !== 'object') return false;
  return Boolean(
    form.title?.trim()
    || form.content?.trim()
    || form.synopsis?.trim()
    || form.cover_image_url?.trim()
    || (Array.isArray(form.tags) && form.tags.length > 0)
    || (Array.isArray(form.polls) && form.polls.some((poll) => poll?.question?.trim())),
  );
}

export function persistForumPostDraft(form) {
  if (!hasForumPostDraftContent(form)) {
    clearForumDraft(FORUM_POST_DRAFT_KEY);
    return false;
  }
  writeForumDraft(FORUM_POST_DRAFT_KEY, form);
  return true;
}
