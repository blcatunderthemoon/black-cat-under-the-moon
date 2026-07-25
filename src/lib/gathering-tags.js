/**
 * Moonlight Gatherings — preset + custom event tags.
 * Spec: docs/community/MOONLIGHT-GATHERINGS-PLAN.md §3.1
 */

export const GATHERING_TAGS = [
  { id: 'boardgame', label: '#深夜枱遊' },
  { id: 'drinks', label: '#去酒吧' },
  { id: 'treehole', label: '#傾偈樹洞' },
  { id: 'hiking', label: '#行山局' },
  { id: 'movie', label: '#睇戲搭子' },
  { id: 'bookclub', label: '#讀書會' },
  { id: 'tarot', label: '#睇塔羅' },
  { id: 'voice', label: '#語音房' },
  { id: 'chat', label: '#純傾計' },
  { id: 'sports', label: '#打波局' },
  { id: 'cafe', label: '#咖啡局' },
  { id: 'karaoke', label: '#唱K' },
  { id: 'yumcha', label: '#飲茶' },
  { id: 'hotpot', label: '#打邊爐' },
  { id: 'mall', label: '#商場行街' },
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
