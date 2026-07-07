import { useEffect, useId } from 'react';

/**
 * Styled moderation confirm dialog (replaces window.confirm).
 */
export default function ForumModConfirmOverlay({
  open,
  title,
  sub,
  icon = '🛡️',
  confirmLabel = '確認',
  cancelLabel = '取消',
  variant = 'default',
  busy = false,
  showNote = false,
  note = '',
  onNoteChange,
  notePlaceholder = '可選：記錄此次治理原因（僅版主可見）',
  onConfirm,
  onCancel,
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onCancel?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmClass = variant === 'danger'
    ? 'forum-mod-confirm__confirm forum-mod-confirm__confirm--danger'
    : variant === 'success'
      ? 'forum-mod-confirm__confirm forum-mod-confirm__confirm--success'
      : 'forum-mod-confirm__confirm';

  return (
    <div
      className="forum-mod-confirm show"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.();
      }}
    >
      <div className="forum-mod-confirm__box">
        <span className="forum-mod-confirm__icon" aria-hidden="true">{icon}</span>
        <h2 className="forum-mod-confirm__title" id={titleId}>{title}</h2>
        {sub && <p className="forum-mod-confirm__sub">{sub}</p>}

        {showNote && (
          <label className="forum-mod-confirm__note-wrap">
            <span className="forum-mod-confirm__note-label">版主備註</span>
            <textarea
              className="forum-mod-confirm__note"
              value={note}
              onChange={(e) => onNoteChange?.(e.target.value)}
              placeholder={notePlaceholder}
              maxLength={500}
              rows={3}
              disabled={busy}
            />
          </label>
        )}

        <div className="forum-mod-confirm__actions">
          <button
            type="button"
            className={confirmClass}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? '處理中…' : confirmLabel}
          </button>
          <button
            type="button"
            className="forum-mod-confirm__cancel"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
