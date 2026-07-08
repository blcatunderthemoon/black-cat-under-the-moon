/**
 * Map forum API error payloads to user-facing Chinese messages.
 */

export function forumSubmitErrorMessage(payload, fallback = '操作失敗，請稍後再試。') {
  if (!payload || typeof payload !== 'object') return fallback;
  if (payload.crisis || payload.error === 'crisis') {
    return '系統偵測到可能與情緒危機相關的內容。如需協助，請聯絡專業支援；若為虛構故事，請改用較具體用詞後再試。';
  }
  if (payload.error === 'blocked_content') {
    return '內容包含不允許的詞語。';
  }
  const err = String(payload.error || '').trim();
  return err || fallback;
}
