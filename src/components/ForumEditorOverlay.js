import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function ForumEditorOverlay({
  open,
  onClose,
  title,
  titleId,
  children,
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="forum-editor-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="forum-editor-overlay__backdrop"
        onClick={onClose}
        aria-label="關閉"
      />
      <div className="forum-editor-overlay__box">
        {title && (
          <h3 id={titleId} className="forum-editor-overlay__title">{title}</h3>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
