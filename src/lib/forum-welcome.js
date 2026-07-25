/**
 * Official welcome / pinned intro posts shown per topic when the feed is empty.
 */

import { FORUM_TOPICS, FORUM_POST_TOPICS, TOPIC_STYLES, displayTopic, forumTopicLabel } from './forum-categories.js';

export { FORUM_TOPICS, FORUM_POST_TOPICS, TOPIC_STYLES, displayTopic, forumTopicLabel };

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
    content: '想傾曖昧、拍拖、分手、暗戀，定只係想有人聽？呢度唔使完美人設。\n\n分享你嘅故事、問大家點睇，或者單純講一句「今日有啲掛住佢」。',
    mood_tag: '版規',
  },
  社群: {
    title: '社群 · 輕鬆閒聊',
    content: '今日食咗咩、煲緊邊套劇、路上見到可愛嘅貓 — 日常瑣碎都值得記錄。\n\n呢度冇 KPI，只有真實生活嘅小片段。想呻嘢、搵 hangout 位，都歡迎。',
    mood_tag: '官方',
  },
  娛樂: {
    title: '娛樂 · 追劇同好',
    content: '泰百、煲劇、睇戲、聽歌、動漫 — 分享你喺追咩、推介好作品，或者搵人一齊呻劇情。\n\n用標籤標記類型，同好更容易搵到你。',
    mood_tag: '官方',
  },
  命理: {
    title: '命理 · 探索自己',
    content: 'MBTI、星座、塔羅、Mirror 家族 — 傾下你信咩、測過咩、覺得準唔準。\n\n呢度係認識自己同搵同類嘅好地方。',
    mood_tag: '官方',
  },
  興趣: {
    title: '興趣 · 分享熱愛',
    content: '飲茶食嘢、去旅行、行山、打機、手作、健身 — 分享你鍾意嘅嘢，或者搵人一齊玩。\n\n小眾愛好都值得被看見。',
    mood_tag: '官方',
  },
  徵友: {
    title: '徵友 · 發文指南',
    content: '想識新朋友？簡單報到自介、你想搵咩、鍾意點樣相處就得。\n\n可以出 pool、搵同族、約出街，亦歡迎慢熱同認真交往。\n\n尊重界線、唔好強求回覆 — 好嘅連結由真誠開始。',
    mood_tag: '指南',
  },
  親密話題: {
    title: '親密話題 · 社群規範',
    content: '此版僅供已登入、年滿 18 歲的會員以文字暢談親密話題。\n\n歡迎討論探索喜好、開放關係、玩法／RP、癖好、玩具等；請以尊重與知情同意（同意同界線）為前提。\n\n禁止：色情圖片／影片、裸露連結、性交易、約炮宣傳、騷擾或違法內容。Black Cat 是社群討論空間，不是成人內容平台。',
    mood_tag: '版規',
  },
  寫故事: {
    title: '故事 · 黑貓書櫃',
    content: '在這裡放上你的原創或同人故事。為作品設封面與簡介，讀者從書櫃挑一本，翻開正文就像夜裡讀書。\n\n標題必填；簡介會顯示在書脊旁。正文支援較長篇幅，留言區供讀者交流感想。',
    mood_tag: '官方',
  },
};

export function getWelcomePost(topic, override) {
  if (override) {
    return {
      title: override.title ?? WELCOME_POSTS[topic]?.title ?? WELCOME_POSTS['全部'].title,
      content: override.content ?? WELCOME_POSTS[topic]?.content ?? WELCOME_POSTS['全部'].content,
      mood_tag: override.mood_tag ?? WELCOME_POSTS[topic]?.mood_tag ?? WELCOME_POSTS['全部'].mood_tag,
    };
  }
  return WELCOME_POSTS[topic] || WELCOME_POSTS['全部'];
}

export function getEmptyStateCopy(topic) {
  const style = TOPIC_STYLES[topic] || TOPIC_STYLES['全部'];
  return {
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
