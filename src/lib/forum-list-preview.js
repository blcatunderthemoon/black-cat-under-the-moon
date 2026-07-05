/**
 * Plain-text preview for forum feed cards (strip markdown syntax).
 */

const IMAGE_URL_RE = /(?:res\.cloudinary\.com\/[^/]+\/image\/upload|\.(?:jpg|jpeg|png|gif|webp)(?:\?|$))/i;

const IMAGE_MARK = '🖼 圖片';

function imagePreviewLabel() {
  return IMAGE_MARK;
}

function stripUrls(text) {
  return text.replace(/https?:\/\/\S+/gi, (url) => (
    IMAGE_URL_RE.test(url) ? '🖼 圖片' : '🔗 連結'
  ));
}

export function forumListPreviewText(content, { maxLength = 220, truncated = false } = {}) {
  let text = String(content || '');

  text = text.replace(/::poll\[[0-9a-f-]{36}\]/gi, '📊 投票');
  text = text.replace(/::youtube\[[a-zA-Z0-9_-]{11}\]/g, '📺 YouTube 影片');
  text = text.replace(/\|\|([^|\n]+?)\|\|/g, '█ 隱藏內容');

  // Truncated or complete image markdown
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, imagePreviewLabel);
  text = text.replace(/!\[([^\]]*)\]\([^)\s]*/g, imagePreviewLabel);

  text = text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
  text = text.replace(/@\[([^\]]+)\]\([^)\s]*/g, '@$1');

  // Links that may be broken image refs from truncated previews
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, alt, url) => (
    IMAGE_URL_RE.test(url) ? IMAGE_MARK : String(alt || '').trim() || '🔗 連結'
  ));
  text = text.replace(/\[([^\]]+)\]\([^)\s]*/g, imagePreviewLabel);

  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1');
  text = text.replace(/_([^_\n]+)_/g, '$1');
  text = text.replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '☐ ');
  text = text.replace(/\s+[-*+]\s+\[[ xX]\]\s+/g, ' ☐ ');
  text = text.replace(/^\s*[-*+]\s+/gm, '• ');
  text = text.replace(/^\s*#{1,6}\s+/gm, '');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/\n+/g, ' ');
  text = stripUrls(text);
  text = text.replace(/(🖼 圖片\s*){2,}/g, `${IMAGE_MARK} `);
  text = text.replace(/\s+/g, ' ').trim();

  if (!text) return '';
  if (text.length > maxLength) return `${text.slice(0, maxLength).trim()}…`;
  if (truncated) return `${text}…`;
  return text;
}

export const FORUM_LIST_PREVIEW_MAX = 220;

/**
 * @param {object} post
 * @returns {object}
 */
export function mapForumPostListPreview(post) {
  const fullLength = post?.content?.length || 0;
  return {
    ...post,
    content: forumListPreviewText(post?.content || '', {
      maxLength: FORUM_LIST_PREVIEW_MAX,
      truncated: fullLength > FORUM_LIST_PREVIEW_MAX,
    }),
    content_truncated: fullLength > FORUM_LIST_PREVIEW_MAX,
  };
}
