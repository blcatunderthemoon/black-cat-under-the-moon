/**
 * Gaming-style confirm dialog for Moonlight Gatherings (replaces window.confirm / prompt).
 */

import { useEffect, useId } from 'react';

export default function GatheringConfirmOverlay({
  open,
  title,
  sub,
  confirmLabel = '確認',
  cancelLabel = '取消',
  variant = 'default',
  busy = false,
  showNote = false,
  note = '',
  onNoteChange,
  notePlaceholder = '可留空',
  noteLabel = '備註',
  onConfirm,
  onCancel,
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onCancel?.();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmClass = variant === 'danger'
    ? 'gathering-confirm__btn gathering-confirm__btn--danger'
    : 'gathering-confirm__btn gathering-confirm__btn--primary';

  return (
    <div
      className="gathering-confirm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.();
      }}
    >
      <div className="gathering-confirm__box gathering-hud">
        <div className="gathering-hud__corners" aria-hidden="true" />
        <p className="gathering-confirm__eyebrow">SYSTEM CHECK</p>
        <h2 className="gathering-confirm__title" id={titleId}>{title}</h2>
        {sub ? <div className="gathering-confirm__sub">{sub}</div> : null}

        {showNote && (
          <label className="gathering-confirm__note-wrap">
            <span className="gathering-confirm__note-label">{noteLabel}</span>
            <textarea
              className="gathering-confirm__note"
              value={note}
              onChange={(e) => onNoteChange?.(e.target.value)}
              placeholder={notePlaceholder}
              maxLength={200}
              rows={3}
              disabled={busy}
            />
          </label>
        )}

        <div className="gathering-confirm__actions">
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
            className="gathering-confirm__btn gathering-confirm__btn--ghost"
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
