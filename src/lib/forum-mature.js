/**
 * Mature / 18+ forum board — login-gated, members-only posts, PayPal-safe framing.
 * Public UI uses「親密話題」; discussion-focused, not adult content hosting.
 */

import { getTopicDbValues } from './forum-categories.js';

/** Canonical UI + DB topic name (avoid「18禁」in routes/product copy). */
export const MATURE_FORUM_TOPIC = '親密話題';

export const MATURE_GATE_STORAGE_KEY = 'bcutm_forum_mature_ack_v1';

export function getMatureGateStorageKey(userId) {
  if (!userId) return MATURE_GATE_STORAGE_KEY;
  return `${MATURE_GATE_STORAGE_KEY}:${userId}`;
}

export const MATURE_DECLINE_WARNING = '此版塊僅供年滿 18 歲會員瀏覽。你將無法進入親密話題，亦不會記錄任何資料。';

export const MATURE_POST_RULES_SUMMARY = [
  '僅限已登入、年滿 18 歲用戶瀏覽與發文',
  '歡迎討論探索喜好、開放關係、玩法／RP、癖好、玩具等話題（文字分享）',
  '禁止色情圖片／影片、裸露連結、性交易、約炮或商業性服務宣傳',
  '禁止騷擾、未經同意公開他人身份、違法內容；違規將被隱藏或封禁',
];

/** Patterns that risk payment-processor policy violations in this board. */
const MATURE_BLOCKED_PATTERNS = [
  /約炮|约炮|援交|包養|卖淫|賣淫|色情片|裸聊|視訊裸|视频裸|onlyfans|only fans/i,
  /pornhub|xvideos|xhamster|javlibrary/i,
  /(?:https?:\/\/)?(?:www\.)?(?:onlyfans|pornhub|xvideos)\./i,
];

export function isMatureForumTopic(topic) {
  return topic === MATURE_FORUM_TOPIC;
}

export function isMatureForumTopicStored(storedTopic) {
  if (!storedTopic) return false;
  const values = getMatureTopicDbValues();
  return values.includes(storedTopic);
}

export function getMatureTopicDbValues() {
  return getTopicDbValues(MATURE_FORUM_TOPIC) || [MATURE_FORUM_TOPIC];
}

/** Exclude mature-board posts from general feeds (全部, hot, featured). */
export function applyExcludeMatureTopics(query) {
  const values = getMatureTopicDbValues();
  if (!values?.length) return query;
  const formatted = `(${values.map((v) => `"${v}"`).join(',')})`;
  return query.not('topic', 'in', formatted);
}

export function isMatureTopicValue(storedTopic) {
  return isMatureForumTopicStored(storedTopic);
}

export function readMatureGateAck(userId) {
  if (typeof window === 'undefined') return false;
  try {
    const key = getMatureGateStorageKey(userId);
    if (localStorage.getItem(key) === '1') return true;
    // one-time migration from old session-only ack
    if (userId && sessionStorage.getItem(MATURE_GATE_STORAGE_KEY) === '1') {
      localStorage.setItem(key, '1');
      sessionStorage.removeItem(MATURE_GATE_STORAGE_KEY);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Resolve ack from server profile and/or local device cache. */
export function resolveMatureGateAck(userId, serverAcknowledged = false) {
  if (serverAcknowledged && userId) {
    writeMatureGateAck(userId);
    return true;
  }
  return readMatureGateAck(userId);
}

export async function persistMatureGateAck({ userId, accessToken }) {
  if (userId) writeMatureGateAck(userId);
  if (!accessToken) return { ok: true };

  try {
    const r = await fetch('/api/forum/mature-ack', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await r.json().catch(() => ({}));
    if (!r.ok) {
      return { ok: false, error: payload.error || 'persist_failed' };
    }
    if (userId) writeMatureGateAck(userId);
    return { ok: true, acknowledged_at: payload.acknowledged_at };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

export async function fetchMatureGateAck(accessToken, userId) {
  if (!accessToken) return readMatureGateAck(userId);
  const localAcked = readMatureGateAck(userId);
  try {
    const r = await fetch('/api/forum/mature-ack', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!r.ok) return localAcked;
    const payload = await r.json().catch(() => ({}));
    if (payload.acknowledged) {
      return resolveMatureGateAck(userId, true);
    }
    if (localAcked) {
      const persisted = await persistMatureGateAck({ userId, accessToken });
      return persisted.ok;
    }
    return false;
  } catch {
    return localAcked;
  }
}

export function writeMatureGateAck(userId) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(getMatureGateStorageKey(userId), '1');
    sessionStorage.removeItem(MATURE_GATE_STORAGE_KEY);
  } catch {
    /* private mode / quota */
  }
}

export function clearMatureGateAck(userId) {
  if (typeof window === 'undefined') return;
  try {
    if (userId) localStorage.removeItem(getMatureGateStorageKey(userId));
    sessionStorage.removeItem(MATURE_GATE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function validateMaturePostContent(text) {
  const raw = String(text || '');
  for (const pattern of MATURE_BLOCKED_PATTERNS) {
    if (pattern.test(raw)) {
      return {
        ok: false,
        error: '此版塊僅供文字討論親密關係與界線，不可包含色情連結、性交易或約炮宣傳。',
      };
    }
  }
  return { ok: true };
}
