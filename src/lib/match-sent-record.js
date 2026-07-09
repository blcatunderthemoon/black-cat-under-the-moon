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

/** Inbox delivery only applies when at least one questionnaire user has registered. */
export function shouldDeliverInboxForPair(authUserA, authUserB) {
  return !!(authUserA || authUserB);
}
