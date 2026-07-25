/**
 * Forum category + preset tag catalog (Layer 1 & 2).
 * Layer 3 = posts filtered by topic + tag.
 */

import { canonicalForumTagKey } from './forum-tags.js';

/** Filter row on /forum (includes 全部). */
export const FORUM_TOPICS = ['全部', '感情', '徵友', '寫故事', '社群', '娛樂', '命理', '興趣', '親密話題'];

/** Topics assignable when creating a post (excludes 全部). */
export const FORUM_POST_TOPICS = FORUM_TOPICS.filter((t) => t !== '全部');

/** Server-side valid stored topic values (includes 官方公告). */
export const VALID_POST_TOPICS = [...FORUM_POST_TOPICS, '官方公告'];

/** DB values to match when filtering a canonical topic (includes legacy names). */
export const TOPIC_DB_ALIASES = {
  感情: ['感情', '感情圍爐'],
  社群: ['社群', '圈內日常'],
  娛樂: ['娛樂'],
  命理: ['命理', 'Mirror同類'],
  興趣: ['興趣'],
  徵友: ['徵友', '識人徵友'],
  親密話題: ['親密話題'],
  寫故事: ['寫故事'],
  官方公告: ['官方公告'],
};

/** Map legacy stored topic → canonical display topic. */
export const LEGACY_TOPIC_DISPLAY = {
  感情圍爐: '感情',
  圈內日常: '社群',
  Mirror同類: '命理',
  識人徵友: '徵友',
};

export const TOPIC_STYLES = {
  全部: { icon: 'flame', accent: '#ff9f43', glow: 'rgba(255, 159, 67, 0.25)' },
  感情: { icon: 'heart', accent: '#f472b6', glow: 'rgba(244, 114, 182, 0.22)' },
  社群: { icon: 'rainbow', accent: '#60a5fa', glow: 'rgba(96, 165, 250, 0.22)' },
  娛樂: { icon: 'film', accent: '#fbbf24', glow: 'rgba(251, 191, 36, 0.22)' },
  命理: { icon: 'crystal', accent: '#bd93f9', glow: 'rgba(189, 147, 249, 0.25)' },
  興趣: { icon: 'gamepad', accent: '#4ade80', glow: 'rgba(74, 222, 128, 0.2)' },
  徵友: { icon: 'blossom', accent: '#fb7185', glow: 'rgba(251, 113, 133, 0.22)' },
  親密話題: { icon: 'intimate', accent: '#e8b4a8', glow: 'rgba(200, 140, 130, 0.2)' },
  寫故事: { icon: 'book', accent: '#d4a574', glow: 'rgba(212, 165, 116, 0.24)' },
  官方公告: { icon: 'megaphone', accent: '#94a3b8', glow: 'rgba(148, 163, 184, 0.2)' },
};

/**
 * Official preset tags per category (Layer 2).
 * Order matters — 泰百 is always first under 娛樂.
 * Keys are storage/filter ids (no spaces/punctuation); labels are HK display text.
 */
export const PRESET_TAGS_BY_TOPIC = {
  娛樂: [
    { key: '泰百', label: '泰百' },
    { key: '煲劇', label: '煲劇' },
    { key: '睇戲', label: '睇戲' },
    { key: '聽歌', label: '聽歌' },
    { key: '動漫', label: '動漫' },
    { key: '綜藝', label: '綜藝' },
  ],
  命理: [
    { key: 'mbti', label: 'MBTI' },
    { key: '星座', label: '星座' },
    { key: '塔羅', label: '塔羅' },
    { key: '八字', label: '八字' },
    { key: '紫微', label: '紫微' },
    { key: 'mirror家族', label: 'Mirror 家族' },
  ],
  感情: [
    { key: '曖昧', label: '曖昧' },
    { key: '拍拖', label: '拍拖' },
    { key: '分手', label: '分手' },
    { key: '暗戀', label: '暗戀' },
    { key: '單身', label: '單身' },
    { key: '已讀不回', label: '已讀不回' },
    { key: '異地戀', label: '異地戀' },
  ],
  社群: [
    { key: '樹洞', label: '樹洞' },
    { key: '呻嘢', label: '呻嘢' },
    { key: '出櫃', label: '出櫃' },
    { key: '上班', label: '上班' },
    { key: 'hangout', label: 'Hangout 位' },
  ],
  興趣: [
    { key: '飲茶食嘢', label: '飲茶食嘢' },
    { key: '去旅行', label: '去旅行' },
    { key: '行山', label: '行山' },
    { key: '打機', label: '打機' },
    { key: '手作', label: '手作' },
    { key: '健身', label: '健身' },
  ],
  徵友: [
    { key: '出pool', label: '出 pool' },
    { key: '報到自介', label: '報到自介' },
    { key: '搵同族', label: '搵同族' },
    { key: '約出街', label: '約出街' },
    { key: '慢熱', label: '慢熱交友' },
    { key: '認真交往', label: '認真交往' },
  ],
  親密話題: [
    { key: '探索喜好', label: '探索喜好' },
    { key: '開放關係', label: '開放關係' },
    { key: '玩法', label: '玩法／RP' },
    { key: '癖好', label: '癖好' },
    { key: '玩具', label: '玩具' },
    { key: '同意界線', label: '同意同界線' },
  ],
};

const OFFICIAL_TAG_KEYS = new Set();
for (const tags of Object.values(PRESET_TAGS_BY_TOPIC)) {
  for (const t of tags) {
    OFFICIAL_TAG_KEYS.add(canonicalForumTagKey(t.key));
  }
}

/** Map canonical topic → shorter UI label (stored DB value unchanged). */
export const TOPIC_UI_LABELS = {
  寫故事: '故事',
};

export function displayTopic(storedTopic) {
  if (!storedTopic) return storedTopic;
  return LEGACY_TOPIC_DISPLAY[storedTopic] || storedTopic;
}

/** User-facing topic name for badges, filters, chips (may differ from stored value). */
export function forumTopicLabel(topic) {
  const canonical = displayTopic(topic);
  return TOPIC_UI_LABELS[canonical] || canonical;
}

export function isValidPostTopic(topic) {
  return VALID_POST_TOPICS.includes(topic);
}

/** @param {string | null | undefined} filterTopic — UI topic (may be 全部) */
export function getTopicDbValues(filterTopic) {
  if (!filterTopic || filterTopic === '全部') return null;
  return TOPIC_DB_ALIASES[filterTopic] || [filterTopic];
}

export function getPresetTagsForTopic(topic) {
  if (!topic || topic === '全部') return [];
  return (PRESET_TAGS_BY_TOPIC[topic] || []).map((t) => ({
    tag: canonicalForumTagKey(t.key),
    display_label: t.label,
    official: true,
  }));
}

export function isOfficialPresetTag(tagKey, topic = null) {
  const key = canonicalForumTagKey(tagKey);
  if (!key) return false;
  if (!topic || topic === '全部') return OFFICIAL_TAG_KEYS.has(key);
  return getPresetTagsForTopic(topic).some((t) => t.tag === key);
}

export function getOfficialTagKeysForTopic(topic) {
  return new Set(getPresetTagsForTopic(topic).map((t) => t.tag));
}

/** Merge preset tags with usage counts; presets always shown in catalog order. */
export function mergePresetTagsWithCounts(topic, hotTags = []) {
  const presets = getPresetTagsForTopic(topic);
  const countMap = new Map((hotTags || []).map((h) => [h.tag, h.count || 0]));
  return presets.map((p) => ({
    ...p,
    count: countMap.get(p.tag) || 0,
  }));
}

/** User-driven hot tags excluding official presets for the topic. */
export function filterUserHotTags(topic, hotTags = []) {
  const official = getOfficialTagKeysForTopic(topic);
  return (hotTags || []).filter((h) => !official.has(h.tag));
}
