/**
 * 寫故事 — story posts (bookshelf + reading mode).
 */

import { displayTopic } from './forum-categories.js';

export const STORY_TOPIC = '寫故事';
export const STORY_CONTENT_MAX = 20000;
export const STORY_SYNOPSIS_MAX = 400;

/**
 * Keep intentional leading indent; only drop trailing whitespace.
 * Authors use leading spaces (incl. full-width) for paragraph indent.
 */
export function normalizeForumBodyContent(content) {
  return String(content ?? '').replace(/\s+$/u, '');
}

/**
 * Markdown discards paragraph leading spaces — encode them so TipTap / react-markdown keep indent.
 */
export function preserveMarkdownLeadingSpaces(md) {
  return String(md || '').replace(/^[ \t\u3000]+/gm, (lead) => (
    Array.from(lead, (ch) => (ch === '\t' ? '\u00A0\u00A0' : '\u00A0')).join('')
  ));
}

export function isStoryTopic(topic) {
  if (!topic) return false;
  return displayTopic(topic) === STORY_TOPIC;
}

export function isStoryPost(post) {
  return isStoryTopic(post?.topic);
}

export function validateStoryCoverUrl(url) {
  if (url == null || url === '') return { ok: true, value: null };
  const value = String(url).trim();
  if (!value) return { ok: true, value: null };
  if (!/^https:\/\//i.test(value)) {
    return { ok: false, error: '封面圖片連結無效。' };
  }
  if (value.length > 2048) {
    return { ok: false, error: '封面圖片連結過長。' };
  }
  return { ok: true, value };
}

export function storySynopsisPreview(synopsis, fallbackContent, maxLength = 120) {
  const text = String(synopsis || '').trim()
    || String(fallbackContent || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}

/** Synopsis for story detail — prefers synopsis column, legacy short content as fallback. */
export function resolveStorySynopsis(post) {
  const synopsis = String(post?.synopsis || '').trim();
  if (synopsis) return synopsis;
  const content = String(post?.content || '').trim();
  if (!content) return '';
  const flat = content.replace(/\s+/g, ' ').trim();
  if (flat.length <= STORY_SYNOPSIS_MAX) return content;
  return '';
}
