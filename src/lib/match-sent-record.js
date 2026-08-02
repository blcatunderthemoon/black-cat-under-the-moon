/**
 * Helpers for sent_matches notes — distinguish real delivery vs failed attempts.
 * Default to keeping records; only explicit failure notes are excluded.
 */

export function isFailedSentMatchNote(notes) {
  const n = String(notes || '').trim();
  if (!n) return false;
  return n.includes('發送失敗') || n.includes('通知發送失敗');
}

export function isSuccessfulSentMatchNote(notes) {
  return !isFailedSentMatchNote(notes);
}

export function filterSuccessfulSentRows(rows) {
  return (rows || []).filter((row) => isSuccessfulSentMatchNote(row.notes));
}

/**
 * Inbox match cards need BOTH sides registered (auth user linked).
 * Solo / one-sided registration: email can still send; Inbox is skipped.
 */
export function shouldDeliverInboxForPair(authUserA, authUserB) {
  return !!(authUserA && authUserB);
}

/**
 * Whether this send pass should push an Inbox match card.
 * Requires: dashboard manual send (deliverInbox) AND both users registered.
 * Passport echo discovery / live score never opens Inbox.
 */
export function shouldPushInboxOnManualSend(deliverInbox, authUserA, authUserB) {
  return !!deliverInbox && shouldDeliverInboxForPair(authUserA, authUserB);
}

