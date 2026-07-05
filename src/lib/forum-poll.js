/**
 * Forum poll tokens: ::poll[POLL_UUID]
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POLL_TOKEN_RE = /::poll\[([0-9a-f-]{36})\]/gi;
export const POLL_LINE_RE = /^::poll\[([0-9a-f-]{36})\]$/i;

export const POLL_LIMITS = {
  minOptions: 2,
  maxOptions: 6,
  maxOptionLength: 80,
  maxTitleLength: 60,
  maxPollsPerPost: 3,
};

const LEGACY_POLL_BLOCK_RE = /(\*\*📊\s*([^*]*?)\s*\*\*)\s*\n((?:[ \t]*[-*+][ \t]+\[[ xX]\][ \t]+.+(?:\n|$))+)/g;

export function isValidPollId(id) {
  return UUID_RE.test(String(id || ''));
}

export function buildPollMarkdown(pollId) {
  if (!isValidPollId(pollId)) return null;
  return `\n::poll[${pollId}]\n`;
}

/**
 * @param {string} content
 * @returns {string[]}
 */
export function extractPollIdsFromContent(content) {
  const ids = [];
  const re = new RegExp(POLL_TOKEN_RE.source, 'gi');
  let match = re.exec(String(content || ''));
  while (match) {
    if (isValidPollId(match[1])) ids.push(match[1]);
    match = re.exec(String(content || ''));
  }
  return ids;
}

/**
 * @param {unknown} poll
 * @returns {{ id: string, title: string, options: string[] } | null}
 */
export function normalizePollPayload(poll) {
  if (!poll || typeof poll !== 'object') return null;
  const id = String(poll.id || '');
  if (!isValidPollId(id)) return null;

  const title = String(poll.title || '投票').trim().slice(0, POLL_LIMITS.maxTitleLength) || '投票';
  const options = (Array.isArray(poll.options) ? poll.options : [])
    .map((o) => String(o || '').trim())
    .filter(Boolean)
    .slice(0, POLL_LIMITS.maxOptions)
    .map((o) => o.slice(0, POLL_LIMITS.maxOptionLength));

  if (options.length < POLL_LIMITS.minOptions) return null;
  return { id, title, options };
}

/**
 * @param {string} content
 * @param {unknown[]} polls
 * @returns {{ ok: true, polls: Array<{ id: string, title: string, options: string[] }> } | { ok: false, error: string }}
 */
export function validatePollsForContent(content, polls) {
  const idsInContent = extractPollIdsFromContent(content);
  const uniqueIds = [...new Set(idsInContent)];

  if (uniqueIds.length > POLL_LIMITS.maxPollsPerPost) {
    return { ok: false, error: `每篇貼文最多 ${POLL_LIMITS.maxPollsPerPost} 個投票。` };
  }

  const normalized = [];
  const seen = new Set();

  for (const raw of Array.isArray(polls) ? polls : []) {
    const poll = normalizePollPayload(raw);
    if (!poll) return { ok: false, error: '投票格式不正確。' };
    if (seen.has(poll.id)) return { ok: false, error: '投票 ID 重複。' };
    seen.add(poll.id);
    normalized.push(poll);
  }

  if (uniqueIds.length !== normalized.length) {
    return { ok: false, error: '投票內容與標記不一致。' };
  }

  for (const id of uniqueIds) {
    if (!seen.has(id)) {
      return { ok: false, error: '缺少投票選項資料。' };
    }
  }

  return { ok: true, polls: normalized };
}

/**
 * Split markdown into md chunks and legacy checklist polls (pre-token posts).
 * @param {string} text
 * @returns {Array<{ type: 'md' | 'legacy_poll', text?: string, title?: string, options?: string[] }>}
 */
export function splitLegacyPollBlocks(text) {
  const raw = String(text || '');
  if (!raw) return [];

  const parts = [];
  let lastIndex = 0;
  const re = new RegExp(LEGACY_POLL_BLOCK_RE.source, 'g');
  let match = re.exec(raw);

  while (match) {
    if (match.index > lastIndex) {
      const chunk = raw.slice(lastIndex, match.index);
      if (chunk.trim()) parts.push({ type: 'md', text: chunk });
    }

    const title = String(match[2] || '').trim() || '投票';
    const options = String(match[3] || '')
      .split('\n')
      .map((line) => line.match(/^\s*[-*+]\s+\[[ xX]\]\s+(.+?)\s*$/))
      .filter(Boolean)
      .map((m) => m[1].trim())
      .filter(Boolean);

    if (options.length >= POLL_LIMITS.minOptions) {
      parts.push({ type: 'legacy_poll', title, options });
    } else {
      parts.push({ type: 'md', text: match[0] });
    }

    lastIndex = match.index + match[0].length;
    match = re.exec(raw);
  }

  if (lastIndex < raw.length) {
    const chunk = raw.slice(lastIndex);
    if (chunk.trim()) parts.push({ type: 'md', text: chunk });
  }

  if (!parts.length && raw.trim()) {
    parts.push({ type: 'md', text: raw });
  }

  return parts;
}

export function createPollId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}
