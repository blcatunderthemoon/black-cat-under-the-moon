import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function ForumComposeOverlay({ onClose, children }) {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('body-scroll-locked');
    document.body.classList.add('body-scroll-locked');
    return () => {
      html.classList.remove('body-scroll-locked');
      document.body.classList.remove('body-scroll-locked');
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="forum-compose-overlay" onClick={onClose} role="presentation">
      <div
        className="pixel-card forum-compose-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="forum-compose-title"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
