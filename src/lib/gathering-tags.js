/**
 * Moonlight Gatherings — preset + custom event tags.
 * Spec: docs/community/MOONLIGHT-GATHERINGS-PLAN.md §3.1
 *
 * Presets are split by gathering mode (`online` / `offline`).
 * Custom tags remain allowed for either mode.
 */

/** @typedef {'online'|'offline'} GatheringTagMode */

/**
 * @type {{ id: string, label: string, modes: GatheringTagMode[] }[]}
 */
export const GATHERING_TAGS = [
  // ── Offline ──
  { id: 'boardgame', label: '#深夜枱遊', modes: ['offline'] },
  { id: 'drinks', label: '#去酒吧', modes: ['offline'] },
  { id: 'hiking', label: '#行山局', modes: ['offline'] },
  { id: 'movie', label: '#睇戲', modes: ['offline'] },
  { id: 'sports', label: '#打波局', modes: ['offline'] },
  { id: 'cafe', label: '#咖啡局', modes: ['offline'] },
  { id: 'karaoke', label: '#唱K', modes: ['offline'] },
  { id: 'yumcha', label: '#飲茶', modes: ['offline'] },
  { id: 'hotpot', label: '#打邊爐', modes: ['offline'] },
  { id: 'mall', label: '#商場行街', modes: ['offline'] },
  // ── Online ──
  { id: 'voice', label: '#語音房', modes: ['online'] },
  { id: 'watchparty', label: '#一齊睇', modes: ['online'] },
  { id: 'onlinegame', label: '#線上遊戲', modes: ['online'] },
  // ── Both ──
  { id: 'treehole', label: '#傾偈樹洞', modes: ['online', 'offline'] },
  { id: 'bookclub', label: '#讀書會', modes: ['online', 'offline'] },
  { id: 'tarot', label: '#睇塔羅', modes: ['online', 'offline'] },
  { id: 'chat', label: '#純傾計', modes: ['online', 'offline'] },
];

export const GATHERING_TAG_IDS = GATHERING_TAGS.map((t) => t.id);

export const GATHERING_TAG_LABEL_BY_ID = Object.fromEntries(
  GATHERING_TAGS.map((t) => [t.id, t.label]),
);

export const GATHERING_MAX_TAGS = 8;
export const GATHERING_CUSTOM_TAG_MAX_LEN = 12;

const PRESET_LABEL_TO_ID = Object.fromEntries(
  GATHERING_TAGS.map((t) => [t.label.replace(/^#/, ''), t.id]),
);

/**
 * @param {boolean} isOnline
 * @returns {GatheringTagMode}
 */
export function gatheringTagMode(isOnline) {
  return isOnline ? 'online' : 'offline';
}

/**
 * Preset chips for the create form (online vs offline).
 * @param {boolean} isOnline
 */
export function gatheringTagsForMode(isOnline) {
  const mode = gatheringTagMode(isOnline);
  return GATHERING_TAGS.filter((t) => (t.modes || ['online', 'offline']).includes(mode));
}

export const GATHERING_TAGS_ONLINE = gatheringTagsForMode(true);
export const GATHERING_TAGS_OFFLINE = gatheringTagsForMode(false);

/**
 * Custom tags always allowed; presets must match mode.
 * @param {string} tagId
 * @param {boolean} isOnline
 */
export function isGatheringTagAllowedForMode(tagId, isOnline) {
  if (!tagId) return false;
  if (!isPresetGatheringTag(tagId)) return true;
  const tag = GATHERING_TAGS.find((t) => t.id === tagId);
  if (!tag) return false;
  return (tag.modes || ['online', 'offline']).includes(gatheringTagMode(isOnline));
}

/**
 * @param {string[]} tags
 * @param {boolean} isOnline
 */
export function filterGatheringTagsForMode(tags, isOnline) {
  return (tags || []).filter((t) => isGatheringTagAllowedForMode(t, isOnline));
}

/**
 * Normalise one tag token (preset id or custom text without #).
 * @returns {string|null}
 */
export function normalizeGatheringTagToken(raw) {
  let s = String(raw || '').trim().replace(/^#+/u, '').trim();
  if (!s) return null;
  if (GATHERING_TAG_IDS.includes(s)) return s;
  if (PRESET_LABEL_TO_ID[s]) return PRESET_LABEL_TO_ID[s];
  // custom label: strip whitespace, keep CJK / letters / numbers
  s = s.replace(/\s+/gu, '');
  if (!s) return null;
  if (s.length > GATHERING_CUSTOM_TAG_MAX_LEN) {
    s = s.slice(0, GATHERING_CUSTOM_TAG_MAX_LEN);
  }
  // reject empties after slice / weird control chars
  if (!/^[\p{L}\p{N}_\-]+$/u.test(s)) return null;
  return s;
}

/**
 * @returns {string[]} unique preset ids and/or custom labels (without #)
 */
export function normalizeGatheringTags(input, { max = GATHERING_MAX_TAGS } = {}) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const raw of input) {
    const id = normalizeGatheringTagToken(raw);
    if (!id || out.includes(id)) continue;
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

export function gatheringTagLabel(id) {
  if (!id) return '';
  if (GATHERING_TAG_LABEL_BY_ID[id]) return GATHERING_TAG_LABEL_BY_ID[id];
  return id.startsWith('#') ? id : `#${id}`;
}

export function gatheringTagLabels(tagIds) {
  return (tagIds || []).map(gatheringTagLabel);
}

export function isPresetGatheringTag(id) {
  return GATHERING_TAG_IDS.includes(id);
}
