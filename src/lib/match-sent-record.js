/**
 * Helpers for sent_matches notes — distinguish real delivery vs failed attempts.
 */

export function isSuccessfulSentMatchNote(notes) {
  const n = String(notes || '').trim();
  if (!n) return true;
  if (n.includes('發送失敗') || n.includes('通知發送失敗')) return false;
  return n.includes('郵件已送出') || n.includes('Inbox 已投送') || n.includes('通知已發送');
}

export function filterSuccessfulSentRows(rows) {
  return (rows || []).filter((row) => isSuccessfulSentMatchNote(row.notes));
}
