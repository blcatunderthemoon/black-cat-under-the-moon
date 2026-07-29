/**
 * Inbox list enrichment for match (連線) threads.
 */

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
 * @param {{
 *   unreadCount?: number,
 *   matchMessage?: { content?: string, payload?: { match_score?: number } }|null,
 *   whisper?: object|null,
 *   viewerTier?: string,
 * }} params
 */
export function enrichMatchThreadListItem({
  unreadCount = 0,
  matchMessage = null,
  whisper = null,
  viewerTier = 'free',
}) {
  const score = matchMessage?.payload?.match_score;
  const hasUnread = unreadCount > 0;
  const scoreNum = Number.isFinite(Number(score)) ? Number(score) : null;
  const scoreLabel = scoreNum != null ? `${scoreNum}/100` : null;
  const whisperUnlocked = Boolean(whisper?.whisper_unlocked);

  const base = {
    reply_opportunity: hasUnread,
    channel_open: false,
    can_compose: false,
    can_reply: false,
    list_meta: hasUnread
      ? (scoreLabel ? `連線成功 · ${scoreLabel}` : '連線成功')
      : (scoreLabel ? `同步率 ${scoreLabel}` : '連線紀錄'),
    match_subtitle: hasUnread
      ? (scoreLabel ? `心靈契合度 ${scoreLabel}` : '點擊查看連線詳情')
      : (scoreLabel ? `同步率 ${scoreLabel} · 已查看` : '已查看連線紀錄'),
    mysterious_title: hasUnread ? '靈魂共鳴連線通知' : '連線紀錄',
    is_match_connection: true,
    match_score: scoreNum,
    match_highlight: hasUnread,
    viewer_tier: viewerTier,
  };

  if (!whisperUnlocked) {
    return {
      ...base,
      is_match_whisper: false,
      whisper_unlocked: false,
    };
  }

  const listMeta = whisper.list_meta_whisper || base.list_meta;

  return {
    ...base,
    reply_opportunity: Boolean(whisper.reply_opportunity)
      || (hasUnread && whisper.can_compose && whisper.whisper_messages_used === 0),
    channel_open: Boolean(whisper.channel_open),
    can_compose: Boolean(whisper.can_compose),
    can_reply: Boolean(whisper.can_reply),
    compose_mode: whisper.compose_mode || null,
    compose_title: whisper.compose_title || null,
    compose_hint: whisper.compose_hint || null,
    status_banner: whisper.status_banner || null,
    status_footer: whisper.status_footer || null,
    channel_state: whisper.channel_state || base.channel_state,
    channel_round_trips: whisper.channel_round_trips ?? 0,
    channel_round_trips_remaining: whisper.channel_round_trips_remaining ?? 0,
    whisper_messages_used: whisper.whisper_messages_used ?? 0,
    whisper_messages_remaining: whisper.whisper_messages_remaining ?? 0,
    whisper_messages_max: whisper.whisper_messages_max ?? 0,
    list_meta: listMeta || base.list_meta,
    match_subtitle: whisper.list_meta_whisper || base.match_subtitle,
    mysterious_title: whisper.can_compose
      ? (whisper.whisper_messages_used === 0 ? '月光低語 · 連線後嘅第一句' : '月光低語')
      : (whisper.channel_state === 'whisper_closed' ? '月光低語已結束' : base.mysterious_title),
    is_match_whisper: true,
    whisper_unlocked: true,
    source_kind: whisper.source_kind || 'match_whisper',
    show_openers: Boolean(whisper.show_openers),
  };
}
