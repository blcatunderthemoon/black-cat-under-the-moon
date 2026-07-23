/**
 * Forum homepage scrolling banner — shared validation & serialization.
 */

export const FORUM_BANNER_TEXT_MAX = 120;
export const FORUM_BANNER_MSG_MAX = 12;

export const FORUM_BANNER_TYPES = ['announcement', 'post'];

export function newBannerMessageId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Icons are emoji/symbols only. A purely-ASCII value (e.g. a stray "P" left
 * over from an encoding-corrupted emoji) is treated as invalid and replaced
 * with the type default, since the dashboard has no manual icon input.
 */
export function sanitizeBannerIcon(icon, type) {
  const fallback = type === 'post' ? '✨' : '📢';
  const raw = String(icon || '').trim();
  if (!raw) return fallback;
  let allAscii = true;
  for (const ch of raw) {
    if (ch.codePointAt(0) > 0x7f) { allAscii = false; break; }
  }
  if (allAscii) return fallback;
  return [...raw].slice(0, 4).join('') || fallback;
}

/** Same-origin path only (optional query/hash). Blocks protocol-relative & schemes. */
export function sanitizeBannerHref(href) {
  const raw = String(href || '').trim();
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  if (raw.length > 300) return null;
  return raw;
}

export function normalizeBannerMessage(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const text = String(raw.text || '').trim().slice(0, FORUM_BANNER_TEXT_MAX);
  if (!text) return null;

  const type = FORUM_BANNER_TYPES.includes(raw.type) ? raw.type : 'announcement';
  const postId = type === 'post' && raw.post_id
    ? String(raw.post_id).trim().slice(0, 64)
    : null;
  const href = sanitizeBannerHref(raw.href);
  const source = raw.source ? String(raw.source).trim().slice(0, 40) : null;

  return {
    id: String(raw.id || newBannerMessageId()),
    active: raw.active !== false,
    text,
    type,
    post_id: postId || null,
    href: href || null,
    icon: sanitizeBannerIcon(raw.icon, type),
    sort_order: Number.isFinite(Number(raw.sort_order)) ? Number(raw.sort_order) : index,
    source: source || null,
  };
}

export function normalizeBannerMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m, i) => normalizeBannerMessage(m, i))
    .filter(Boolean)
    .slice(0, FORUM_BANNER_MSG_MAX)
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** Public payload: only globally active + per-message active items. */
export function serializePublicForumBanner(row) {
  if (!row?.active) return { active: false, messages: [] };
  const messages = normalizeBannerMessages(row.messages)
    .filter((m) => m.active)
    .map((m) => {
      let href = null;
      if (m.type === 'post' && m.post_id) href = `/forum/${m.post_id}`;
      else if (m.href) href = m.href;
      return {
        id: m.id,
        text: m.text,
        type: m.type,
        post_id: m.post_id,
        icon: m.icon,
        href,
      };
    });
  if (!messages.length) return { active: false, messages: [] };
  return { active: true, messages };
}
