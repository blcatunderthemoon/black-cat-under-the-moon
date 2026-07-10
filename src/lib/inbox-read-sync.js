/**
 * Optimistic inbox read state — instant list + header badge updates.
 */

import { readInboxThreadsCache, writeInboxThreadsCache } from './inbox-threads-cache.js';
import { readMeCache, writeMeCache } from './me-cache.js';

export const INBOX_THREADS_UPDATED_EVENT = 'bcutm:inbox-threads-updated';

function notifyThreadsUpdated(userId, threads) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(INBOX_THREADS_UPDATED_EVENT, {
      detail: { userId, threads },
    }));
  } catch {
    /* ignore */
  }
}

export function patchMeCacheUnreadInboxCount(userId, decrementBy = 1) {
  if (typeof window === 'undefined' || !userId || decrementBy <= 0) return;
  const cached = readMeCache(userId);
  if (!cached) return;
  const next = Math.max(0, Number(cached.unread_inbox_count ?? 0) - decrementBy);
  writeMeCache(userId, { ...cached, unread_inbox_count: next });
}

function patchThreadAsRead(thread) {
  const isMatch = thread.source_type === 'match';
  const scoreLabel = thread.match_score != null
    ? `同步率 ${thread.match_score}/100`
    : '連線紀錄';
  const preview = thread.latest_message?.content?.slice(0, 48) || '連線紀錄';

  return {
    ...thread,
    unread_count: 0,
    reply_opportunity: false,
    match_highlight: false,
    list_meta: isMatch ? scoreLabel : thread.list_meta,
    mysterious_title: isMatch ? preview : thread.mysterious_title,
  };
}

/**
 * Mark a thread read in session cache and decrement header unread count.
 * @param {string} userId
 * @param {string} threadId
 * @param {{ fallbackUnread?: number }} [opts]
 * @returns {{ decremented: number }}
 */
export function markInboxThreadReadLocally(userId, threadId, opts = {}) {
  if (typeof window === 'undefined' || !userId || !threadId) {
    return { decremented: 0 };
  }

  const threads = readInboxThreadsCache(userId);
  if (!threads?.length) {
    const fallback = Math.max(0, Number(opts.fallbackUnread) || 0);
    if (fallback > 0) patchMeCacheUnreadInboxCount(userId, fallback);
    return { decremented: fallback };
  }

  const idx = threads.findIndex((t) => t.id === threadId);
  if (idx < 0) {
    const fallback = Math.max(0, Number(opts.fallbackUnread) || 0);
    if (fallback > 0) patchMeCacheUnreadInboxCount(userId, fallback);
    return { decremented: fallback };
  }

  const thread = threads[idx];
  const prevUnread = Number(thread.unread_count) || 0;
  const hadUnreadState = prevUnread > 0 || thread.match_highlight || thread.reply_opportunity;
  if (!hadUnreadState) return { decremented: 0 };

  const next = [...threads];
  next[idx] = patchThreadAsRead(thread);
  writeInboxThreadsCache(userId, next);
  notifyThreadsUpdated(userId, next);

  const decrement = prevUnread > 0 ? prevUnread : 1;
  patchMeCacheUnreadInboxCount(userId, decrement);
  return { decremented: decrement };
}
