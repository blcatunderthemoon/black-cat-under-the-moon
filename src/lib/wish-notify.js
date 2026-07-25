/**
 * Inbox helpers for Moonlight Wishes.
 */

import { sendSystemInboxMessage } from './system-inbox.js';

export async function notifyWishOwnerCheered({ ownerId, wishId, wishTitle, cheererName }) {
  if (!ownerId || !wishId) return false;
  const title = wishTitle || '心願';
  const name = cheererName || '一位貓咪';
  return sendSystemInboxMessage({
    channel: 'wishes',
    userId: ownerId,
    content: `${name} 為你的心願「${title}」打氣。`,
    payload: { kind: 'wish_cheer', wish_id: wishId },
    sourceId: wishId,
  });
}

export async function notifyWishCheerersCompleted({ userIds, wishId, wishTitle, ownerName }) {
  if (!wishId || !userIds?.length) return;
  const title = wishTitle || '心願';
  const name = ownerName || '她';
  await Promise.allSettled(
    userIds.map((userId) => sendSystemInboxMessage({
      channel: 'wishes',
      userId,
      content: `${name} 完成咗心願「${title}」。`,
      payload: { kind: 'wish_completed', wish_id: wishId },
      sourceId: wishId,
    })),
  );
}
