/**
 * Forum tags — stored lowercase (canonical key), displayed with optional label.
 */

export const FORUM_TAG_LIMITS = {
  maxTagsPerPost: 5,
  minLength: 1,
  maxLength: 30,
};

const TAG_CHAR_RE = /^[\p{L}\p{N}_]+$/u;

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizeForumTagInput(raw) {
  let value = String(raw || '').trim();
  if (value.startsWith('#')) value = value.slice(1).trim();
  return value;
}

/**
 * Canonical storage key (lowercase).
 * @param {string} raw
 * @returns {string}
 */
export function canonicalForumTagKey(raw) {
  return normalizeForumTagInput(raw).toLowerCase();
}

/**
 * @param {unknown} tags
 * @returns {{ ok: true, tags: string[], displayByKey: Record<string, string> } | { ok: false, error: string }}
 */
export function validateForumTags(tags) {
  const input = Array.isArray(tags) ? tags : [];
  const normalized = [];
  const displayByKey = {};
  const seen = new Set();

  for (const raw of input) {
    const display = normalizeForumTagInput(raw);
    if (!display) continue;

    const key = display.toLowerCase();

    if (key.length < FORUM_TAG_LIMITS.minLength) {
      return { ok: false, error: '標籤不可為空。' };
    }
    if (key.length > FORUM_TAG_LIMITS.maxLength) {
      return { ok: false, error: `標籤最多 ${FORUM_TAG_LIMITS.maxLength} 個字元。` };
    }
    if (!TAG_CHAR_RE.test(key)) {
      return { ok: false, error: '標籤只可包含文字、數字與底線。' };
    }
    if (seen.has(key)) continue;

    seen.add(key);
    normalized.push(key);
    if (!displayByKey[key]) {
      displayByKey[key] = display;
    }
  }

  if (normalized.length > FORUM_TAG_LIMITS.maxTagsPerPost) {
    return { ok: false, error: `每篇貼文最多 ${FORUM_TAG_LIMITS.maxTagsPerPost} 個標籤。` };
  }

  return { ok: true, tags: normalized, displayByKey };
}

/**
 * @param {string} tagKey
 * @param {string} [displayLabel]
 * @param {Record<string, string>} [labelMap]
 * @returns {string}
 */
export function formatForumTagLabel(tagKey, displayLabel, labelMap) {
  const key = String(tagKey || '').trim();
  if (!key) return '';

  const label = displayLabel
    || (labelMap && labelMap[key])
    || key;

  return `#${label}`;
}

/**
 * @param {string} tagKey
 * @param {Record<string, string>} [labelMap]
 * @returns {string}
 */
export function getForumTagDisplayLabel(tagKey, labelMap) {
  const key = String(tagKey || '').trim();
  if (!key) return '';
  return (labelMap && labelMap[key]) || key;
}
