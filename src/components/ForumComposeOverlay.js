import { useEffect } from 'react';
import { createPortal } from 'react-dom';

function syncMobileViewportVars() {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const vv = window.visualViewport;
  if (!vv) {
    root.style.setProperty('--mobile-vvh', `${window.innerHeight}px`);
    root.style.setProperty('--mobile-keyboard-inset', '0px');
    root.style.setProperty('--mobile-vv-offset-top', '0px');
    return;
  }
  const keyboardInset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  root.style.setProperty('--mobile-vvh', `${Math.round(vv.height)}px`);
  root.style.setProperty('--mobile-keyboard-inset', `${keyboardInset}px`);
  root.style.setProperty('--mobile-vv-offset-top', `${Math.round(vv.offsetTop)}px`);
  root.classList.toggle('mobile-keyboard-open', keyboardInset > 50);
}

export default function ForumComposeOverlay({ children, modalClassName = '', ariaLabelledBy = 'forum-compose-title' }) {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('body-scroll-locked');
    document.body.classList.add('body-scroll-locked');
    html.classList.add('forum-compose-overlay-open');
    syncMobileViewportVars();
    window.dispatchEvent(new Event('resize'));

    const vv = window.visualViewport;
    const onVv = () => syncMobileViewportVars();
    vv?.addEventListener('resize', onVv);
    vv?.addEventListener('scroll', onVv);

    return () => {
      vv?.removeEventListener('resize', onVv);
      vv?.removeEventListener('scroll', onVv);
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
