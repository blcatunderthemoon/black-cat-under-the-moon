import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function ForumComposeOverlay({ children, modalClassName = '', ariaLabelledBy = 'forum-compose-title' }) {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('body-scroll-locked');
    document.body.classList.add('body-scroll-locked');
    html.classList.add('forum-compose-overlay-open');
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.dispatchEvent(new Event('resize'));
    }
    return () => {
      html.classList.remove('body-scroll-locked');
      document.body.classList.remove('body-scroll-locked');
      html.classList.remove('forum-compose-overlay-open');
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="forum-compose-overlay" role="presentation">
      <div
        className={['pixel-card', 'forum-compose-modal', modalClassName].filter(Boolean).join(' ')}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
