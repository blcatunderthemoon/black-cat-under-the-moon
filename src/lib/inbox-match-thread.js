/**
 * Inbox list enrichment for match (連線) threads.
 */

export const MATCH_LIST_TITLE = '靈魂共鳴連線通知';
export const MATCH_LIST_META_UNREAD = '🎯 連線成功';

/**
 * @param {string} userId
 * @param {Array<{ thread_id: string, recipient_id: string, content?: string, payload?: { match_score?: number }, read_at?: string|null, created_at?: string }>} messages
 * @returns {Record<string, object>}
 */
export function indexMatchCardsByThread(userId, messages) {
  const byThread = {};
  for (const msg of messages || []) {
    if (!msg?.thread_id) continue;
    const existing = byThread[msg.thread_id];
    const isForViewer = msg.recipient_id === userId;
    if (!existing) {
      byThread[msg.thread_id] = msg;
      continue;
    }
    if (isForViewer && existing.recipient_id !== userId) {
      byThread[msg.thread_id] = msg;
      continue;
    }
    if (msg.created_at && existing.created_at && msg.created_at > existing.created_at) {
      byThread[msg.thread_id] = msg;
    }
  }
  return byThread;
}

/**
 * @param {{ unreadCount?: number, matchMessage?: { content?: string, payload?: { match_score?: number } }|null }} params
 */
export function enrichMatchThreadListItem({ unreadCount = 0, matchMessage = null }) {
  const score = matchMessage?.payload?.match_score;
  const hasUnread = unreadCount > 0;
  const scoreNum = Number.isFinite(Number(score)) ? Number(score) : null;
  const scoreLabel = scoreNum != null ? `${scoreNum}/100` : null;

  return {
    reply_opportunity: hasUnread,
    channel_open: false,
    can_compose: false,
    can_reply: false,
    list_meta: hasUnread
      ? (scoreLabel ? `${MATCH_LIST_META_UNREAD} · ${scoreLabel}` : MATCH_LIST_META_UNREAD)
      : (scoreLabel ? `同步率 ${scoreLabel}` : '連線紀錄'),
    match_subtitle: hasUnread
      ? (scoreLabel ? `心靈契合度 ${scoreLabel}` : '點擊查看連線詳情')
      : (scoreLabel ? `同步率 ${scoreLabel} · 已查看` : '已查看連線紀錄'),
    mysterious_title: hasUnread ? MATCH_LIST_TITLE : '連線紀錄',
    is_match_connection: true,
    match_score: scoreNum,
    match_highlight: hasUnread,
  };
}
