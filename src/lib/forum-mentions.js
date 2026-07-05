/**
 * Forum @-mention tokens: @[顯示名稱](userId)
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/gi;

export function isMentionUserId(value) {
  return UUID_RE.test(String(value || ''));
}

/**
 * @param {string} content
 * @returns {string[]}
 */
export function parseMentionUserIds(content) {
  const ids = new Set();
  const re = new RegExp(MENTION_TOKEN_RE.source, 'gi');
  let match = re.exec(String(content || ''));
  while (match) {
    if (UUID_RE.test(match[2])) ids.add(match[2]);
    match = re.exec(String(content || ''));
  }
  return [...ids];
}

/**
 * @param {string} content
 * @param {number} cursor
 * @returns {{ query: string, start: number } | null}
 */
export function getActiveMentionQuery(content, cursor) {
  const before = String(content || '').slice(0, cursor);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (/[\n\r[\]()]/.test(query)) return null;
  if (query.length > 24) return null;
  return { query, start: at };
}

/**
 * @param {string} content
 * @param {number} start
 * @param {number} end
 * @param {{ id: string, display_name: string }} user
 */
export function buildMentionInsert(content, start, end, user) {
  const name = String(user.display_name || '貓咪').slice(0, 20);
  const token = `@[${name}](${user.id}) `;
  const next = `${content.slice(0, start)}${token}${content.slice(end)}`;
  const cursor = start + token.length;
  return { value: next, cursor };
}

export function mentionTokenForUser(user) {
  const name = String(user.display_name || '貓咪').slice(0, 20);
  return `@[${name}](${user.id})`;
}
