/**
 * Moonlight Gatherings — preset + custom event tags.
 * Spec: docs/MOONLIGHT-GATHERINGS-PLAN.md §3.1
 */

export const GATHERING_TAGS = [
  { id: 'boardgame', label: '#深夜桌遊' },
  { id: 'drinks', label: '#微醺酒局' },
  { id: 'treehole', label: '#心靈樹洞' },
  { id: 'hiking', label: '#戶外行山' },
  { id: 'movie', label: '#睇戲搭子' },
  { id: 'bookclub', label: '#讀書會' },
  { id: 'tarot', label: '#塔羅占卜夜' },
  { id: 'voice', label: '#線上語音' },
  { id: 'chat', label: '#純傾計' },
  { id: 'sports', label: '#運動局' },
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
