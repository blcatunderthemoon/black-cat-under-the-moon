/**
 * Official welcome / pinned intro posts shown per topic when the feed is empty.
 */

import { FORUM_TOPICS, FORUM_POST_TOPICS, TOPIC_STYLES, displayTopic } from './forum-categories.js';

export { FORUM_TOPICS, FORUM_POST_TOPICS, TOPIC_STYLES, displayTopic };

/** User-facing product name for /forum */
export const FORUM_DISPLAY_NAME = '黑貓樹洞';

export const WELCOME_POSTS = {
  全部: {
    title: '歡迎來到黑貓樹洞',
    content: '這裡是 Black Cat Under The Moon 的黑貓樹洞。你可以分享心情、認識同頻嘅她、或者安靜咁放低今天。\n\n揀一個分類，再揀標籤，寫低你想講嘅第一句 — 真誠就係最好嘅開始。',
    mood_tag: '官方',
  },
  感情: {
    title: '感情 · 圍爐傾訴',
    content: '想聊曖昧、伴侶、分手、暗戀，或只是需要被聽見？這裡不用完美人設。\n\n分享你的故事、問大家的看法，或單純說一句「今天有點想她」。',
    mood_tag: '版規',
  },
  社群: {
    title: '社群 · 輕鬆閒聊',
    content: '今天吃了什麼、看了什麼劇、路上看到可愛的貓 — 日常瑣碎也值得被記錄。\n\n這裡沒有 KPI，只有真實生活的小片段。',
    mood_tag: '官方',
  },
  娛樂: {
    title: '娛樂 · 追劇同好',
    content: '泰百、電影、音樂、動漫 — 分享你在追什麼、推薦好作品，或找人一起吐槽劇情。\n\n用標籤標記作品類型，同好更容易找到你。',
    mood_tag: '官方',
  },
  命理: {
    title: '命理 · 探索自己',
    content: 'MBTI、星座、塔羅、Mirror 家族 — 聊聊你信什麼、測過什麼、覺得準唔準。\n\n這裡是認識自己同搵同類的好地方。',
    mood_tag: '官方',
  },
  興趣: {
    title: '興趣 · 分享熱愛',
    content: '手作、旅遊、美食、遊戲 — 分享你的興趣，或找人一起玩。\n\n小眾愛好也值得被看見。',
    mood_tag: '官方',
  },
  徵友: {
    title: '徵友 · 發文指南',
    content: '想認識新朋友？簡單介紹自己、你在找什麼、喜歡怎樣的相處方式。\n\n尊重界線、不強求回覆 — 好的連結從真誠開始。',
    mood_tag: '指南',
  },
};

export function getWelcomePost(topic) {
  return WELCOME_POSTS[topic] || WELCOME_POSTS['全部'];
}

export function getEmptyStateCopy(topic) {
  const style = TOPIC_STYLES[topic] || TOPIC_STYLES['全部'];
  return {
    emoji: style.emoji,
    headline: '這裡空空的…',
    subline: '扔塊柴火進來吧！',
    accent: style.accent,
  };
}

/** Read-only intro posts shown to guests when the feed has no public posts yet. */
export function buildGuestPreviewPosts(topic) {
  const key = topic === '全部' ? '全部' : topic;
  const welcome = getWelcomePost(key);
  const feedTopic = key === '全部' ? '官方公告' : key;
  return [{
    id: `welcome-preview-${key}`,
    is_preview: true,
    topic: feedTopic,
    title: welcome.title,
    content: welcome.content,
    mood_tag: welcome.mood_tag,
    anonymous_name_snapshot: '黑貓管理員',
    like_count: 0,
    comment_count: 0,
    visibility: 'public',
    created_at: null,
    tags: welcome.mood_tag ? [welcome.mood_tag.toLowerCase()] : [],
    author_is_premium: false,
    viewer_bookmarked: false,
  }];
}
