/**
 * Curated lesbian / HK-Les hit-topic bank for forum banner rotation.
 * Cron picks a stable daily subset and upserts into forum_banner.
 */

import { getHongKongDateString } from './hong-kong-time.js';
import { FORUM_TOPICS } from './forum-categories.js';
import { newBannerMessageId } from './forum-banner.js';

export const HIT_TOPIC_SOURCE = 'hit_topic_cron';
export const HIT_TOPIC_DAILY_COUNT = 3;

/**
 * @typedef {{
 *   id: string,
 *   text: string,
 *   icon?: string,
 *   topic?: string,
 *   tag?: string,
 *   compose?: boolean,
 * }} ForumHitTopic
 */

/** Lesbian / dating / community engagement prompts (Cantonese-friendly). */
export const FORUM_HIT_TOPICS = [
  // 徵友
  {
    id: 'recruit-intro-1',
    text: '今日話題：用三句介紹自己——你係邊種貓？',
    icon: '🌸',
    topic: '徵友',
    tag: '介紹自己',
    compose: true,
  },
  {
    id: 'recruit-same-clan',
    text: '尋找同族：有冇 Mirror 同家族想傾下近況？',
    icon: '🐈‍⬛',
    topic: '徵友',
    tag: '尋找同族',
    compose: true,
  },
  {
    id: 'recruit-weekend',
    text: '週末想識人？寫低你想去邊、想傾咩～',
    icon: '☕',
    topic: '徵友',
    tag: '徵友',
    compose: true,
  },
  {
    id: 'recruit-offline',
    text: '線下聚會：有冇想約咖啡／行山／睇展嘅？',
    icon: '📍',
    topic: '徵友',
    tag: '線下聚會',
    compose: true,
  },
  {
    id: 'recruit-slow-burn',
    text: '你鍾意慢熱定直球？留言認親同族～',
    icon: '🌙',
    topic: '徵友',
    tag: '介紹自己',
    compose: true,
  },
  {
    id: 'recruit-first-msg',
    text: '收到 Inbox 第一句，你最想見到咩開場白？',
    icon: '✉️',
    topic: '徵友',
    tag: '徵友',
  },

  // 感情
  {
    id: 'love-situationship',
    text: '曖昧好耐：你會等、問清楚，定慢慢抽離？',
    icon: '💕',
    topic: '感情',
    tag: '曖昧',
    compose: true,
  },
  {
    id: 'love-crush',
    text: '暗戀中：你有冇一句想講但未敢講出口？',
    icon: '🙈',
    topic: '感情',
    tag: '暗戀',
    compose: true,
  },
  {
    id: 'love-single',
    text: '單身日常：最近最治癒你嘅小事係咩？',
    icon: '✨',
    topic: '感情',
    tag: '單身',
    compose: true,
  },
  {
    id: 'love-partner',
    text: '伴侶小事：佢做過咩令你覺得「就係你」？',
    icon: '💗',
    topic: '感情',
    tag: '伴侶',
    compose: true,
  },
  {
    id: 'love-breakup',
    text: '分手後：你點樣慢慢返返嚟自己？',
    icon: '🌧️',
    topic: '感情',
    tag: '分手',
    compose: true,
  },
  {
    id: 'love-first-date',
    text: '第一次同女仔約會，你會點準備？',
    icon: '🍷',
    topic: '感情',
    tag: '曖昧',
    compose: true,
  },
  {
    id: 'love-red-flag',
    text: '約會紅旗／綠旗：你遇過最明顯嘅一個？',
    icon: '🚩',
    topic: '感情',
    tag: '單身',
  },
  {
    id: 'love-texting',
    text: '已讀不回 vs 慢回：你嘅底線係？',
    icon: '📱',
    topic: '感情',
    tag: '曖昧',
  },

  // 社群
  {
    id: 'community-coming-out',
    text: '出櫃話題：你最想俾後輩知道咩？',
    icon: '🌈',
    topic: '社群',
    tag: '出櫃',
    compose: true,
  },
  {
    id: 'community-daily',
    text: '今日樹洞：用一句講你而家嘅心情',
    icon: '🔥',
    topic: '社群',
    tag: '日常',
    compose: true,
  },
  {
    id: 'community-work',
    text: '上班好累？傾下女同志職場小日常',
    icon: '💼',
    topic: '社群',
    tag: '工作',
    compose: true,
  },
  {
    id: 'community-rant',
    text: '吐槽專區：今日最想呻一句…',
    icon: '💢',
    topic: '社群',
    tag: '吐槽',
    compose: true,
  },
  {
    id: 'community-hk-les',
    text: '香港 Les 日常：你最鍾意邊個 hangout 位？',
    icon: '🏙️',
    topic: '社群',
    tag: '日常',
    compose: true,
  },
  {
    id: 'community-chosen-family',
    text: 'Chosen family：邊個朋友令你覺得有家？',
    icon: '🏠',
    topic: '社群',
    tag: '日常',
  },

  // 命理 / Mirror
  {
    id: 'mirror-family',
    text: 'Mirror 結果出爐？分享你嘅貓家族同頻率～',
    icon: '🔮',
    topic: '命理',
    tag: 'mirror家族',
    compose: true,
  },
  {
    id: 'mbti-date',
    text: 'MBTI 配對玄學：你覺得準定鬧交配方？',
    icon: '🧠',
    topic: '命理',
    tag: 'mbti',
  },
  {
    id: 'zodiac-week',
    text: '本週星座運勢：你最想問邊方面？',
    icon: '⭐',
    topic: '命理',
    tag: '星座',
  },

  // 娛樂 / 興趣
  {
    id: 'ent-thaibl',
    text: '泰百推介：最近入坑邊套？劇透前請標明！',
    icon: '🎬',
    topic: '娛樂',
    tag: '泰百',
    compose: true,
  },
  {
    id: 'ent-movie-date',
    text: '約會電影：女同向／百合向你會揀邊套？',
    icon: '🍿',
    topic: '娛樂',
    tag: '電影',
  },
  {
    id: 'hobby-food',
    text: '今晚食咩好？分享你嘅治癒食堂',
    icon: '🍜',
    topic: '興趣',
    tag: '美食',
    compose: true,
  },
  {
    id: 'hobby-trip',
    text: '想計劃一趟兩女旅行——目的地投票！',
    icon: '✈️',
    topic: '興趣',
    tag: '旅遊',
  },

  // 親密話題（溫和引導，唔過火）
  {
    id: 'intimacy-boundary',
    text: '親密話題：你點樣同對方講清楚界線？',
    icon: '🌙',
    topic: '親密話題',
    tag: '界線與同意',
    compose: true,
  },
  {
    id: 'intimacy-desire',
    text: '慾望探索：你第一次敢講出喜好係幾時？',
    icon: '🕯️',
    topic: '親密話題',
    tag: '慾望探索',
  },
  {
    id: 'intimacy-consent',
    text: '同意與節奏：點樣問先至舒服？',
    icon: '🤝',
    topic: '親密話題',
    tag: '界線與同意',
  },

  // 寫故事 / 綜合 hook
  {
    id: 'story-prompt',
    text: '寫故事挑戰：用 200 字寫「月下初遇」',
    icon: '📖',
    topic: '寫故事',
    compose: true,
  },
  {
    id: 'love-language',
    text: '愛情語言：你最需要被點樣對待？',
    icon: '🗣️',
    topic: '感情',
    tag: '伴侶',
    compose: true,
  },
  {
    id: 'recruit-voice-note',
    text: '若可以聽一段語音自我介紹——你會講咩？',
    icon: '🎤',
    topic: '徵友',
    tag: '介紹自己',
    compose: true,
  },
  {
    id: 'community-soft-launch',
    text: 'Soft launch：你會點樣喺朋友圈「暗示」有對象？',
    icon: '📱',
    topic: '感情',
    tag: '伴侶',
  },
  {
    id: 'recruit-age-gap',
    text: '年齡差、生活方式差——你點睇？',
    icon: '⏳',
    topic: '徵友',
    tag: '徵友',
  },
  {
    id: 'love-long-distance',
    text: '異地戀／兩地生活：最難同最甜嘅係？',
    icon: '🌏',
    topic: '感情',
    tag: '伴侶',
    compose: true,
  },
];

const VALID_TOPIC_SET = new Set(FORUM_TOPICS.filter((t) => t !== '全部'));

function hashString(input) {
  let h = 2166136261;
  const s = String(input || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Build a same-origin forum deep link for a hit topic. */
export function buildHitTopicHref(topic) {
  if (!topic || typeof topic !== 'object') return '/forum';
  const params = new URLSearchParams();
  if (topic.topic && VALID_TOPIC_SET.has(topic.topic)) {
    params.set('topic', topic.topic);
  }
  if (topic.tag) params.set('tag', String(topic.tag));
  if (topic.compose) params.set('compose', '1');
  const qs = params.toString();
  return qs ? `/forum?${qs}` : '/forum';
}

/**
 * Stable daily pick (HK calendar day). Same day → same topics.
 * @param {Date} [date]
 * @param {number} [count]
 * @returns {ForumHitTopic[]}
 */
export function pickDailyHitTopics(date = new Date(), count = HIT_TOPIC_DAILY_COUNT) {
  const dayKey = getHongKongDateString(date);
  const n = Math.max(1, Math.min(Number(count) || HIT_TOPIC_DAILY_COUNT, FORUM_HIT_TOPICS.length));
  const start = hashString(`bcm-hit:${dayKey}`) % FORUM_HIT_TOPICS.length;
  const picked = [];
  const seen = new Set();
  for (let i = 0; i < FORUM_HIT_TOPICS.length && picked.length < n; i += 1) {
    const item = FORUM_HIT_TOPICS[(start + i) % FORUM_HIT_TOPICS.length];
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    picked.push(item);
  }
  return picked;
}

/**
 * Convert hit topics → forum_banner message objects (source tagged for merge).
 * @param {ForumHitTopic[]} topics
 * @param {string} dayKey YYYY-MM-DD HK
 */
export function hitTopicsToBannerMessages(topics, dayKey) {
  return (topics || []).map((topic, index) => ({
    id: `hit-${dayKey}-${topic.id}`,
    active: true,
    text: String(topic.text || '').trim().slice(0, 120),
    type: 'announcement',
    post_id: null,
    href: buildHitTopicHref(topic),
    icon: topic.icon || '🔥',
    sort_order: index,
    source: HIT_TOPIC_SOURCE,
  })).filter((m) => m.text);
}

/**
 * Merge cron hit-topic messages with manually curated banner messages.
 * Cron messages replace previous cron rows; manual rows are kept.
 */
export function mergeHitTopicBannerMessages(existingMessages, hitMessages) {
  const manual = (Array.isArray(existingMessages) ? existingMessages : [])
    .filter((m) => m && m.source !== HIT_TOPIC_SOURCE);
  const hits = Array.isArray(hitMessages) ? hitMessages : [];
  const merged = [...hits, ...manual].map((m, i) => ({
    ...m,
    id: m.id || newBannerMessageId(),
    sort_order: i,
  }));
  return merged.slice(0, 12);
}
