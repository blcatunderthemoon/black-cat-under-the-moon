/**
 * Gaming-style confirm dialog for Moonlight Gatherings (replaces window.confirm / prompt).
 */

import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

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
  choices = null,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const html = document.documentElement;
    const prevBody = document.body.style.overflow;
    const prevHtml = html.style.overflow;
    document.body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    html.classList.add('gathering-confirm-open');
    document.body.classList.add('gathering-confirm-open');

    function onKey(e) {
      if (e.key === 'Escape' && !busy) onCancel?.();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
      html.classList.remove('gathering-confirm-open');
      document.body.classList.remove('gathering-confirm-open');
      document.removeEventListener('keydown', onKey);
    };
  }, [open, busy, onCancel]);

  if (!open || typeof document === 'undefined') return null;

  const confirmClass = variant === 'danger'
    ? 'gathering-confirm__btn gathering-confirm__btn--danger'
    : 'gathering-confirm__btn gathering-confirm__btn--primary';
  const hasChoices = Array.isArray(choices) && choices.length > 0;

  return createPortal(
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
        <div className="gathering-confirm__body">
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
        </div>

        <div className={`gathering-confirm__actions${hasChoices ? ' gathering-confirm__actions--stack' : ''}`}>
          {hasChoices ? (
            choices.map((choice) => {
              const choiceClass = choice.variant === 'danger'
                ? 'gathering-confirm__btn gathering-confirm__btn--danger'
                : choice.variant === 'ghost'
                  ? 'gathering-confirm__btn gathering-confirm__btn--ghost'
                  : 'gathering-confirm__btn gathering-confirm__btn--primary';
              return (
                <button
                  key={choice.id || choice.label}
                  type="button"
                  className={choiceClass}
                  onClick={choice.onClick}
                  disabled={busy || choice.disabled}
                >
                  {choice.label}
                </button>
              );
            })
          ) : (
            <button
              type="button"
              className={confirmClass}
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? '處理中…' : confirmLabel}
            </button>
          )}
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
    </div>,
    document.body,
  );
}
