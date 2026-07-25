/**
 * Best-effort anti-save for sensitive photos (mirror card / photo exchange).
 * Cannot block OS screenshots; softens right-click, drag, and long-press save.
 */

import { useEffect } from 'react';

const PROTECTED_IMG =
  'img.photo-exchange-panel__photo, img.photo-exchange-pair__img, img.photo-exchange-upload__preview, img.pcard-cat-img, .media-capture-guard img';

function isProtectedTarget(target) {
  if (!target || !(target instanceof Element)) return false;
  if (target.matches?.(PROTECTED_IMG)) return true;
  if (target.closest?.('.media-capture-guard__shield, .photo-exchange-panel__photo-wrap, .photo-exchange-pair__frame')) {
    return true;
  }
  return false;
}

function block(e) {
  if (!isProtectedTarget(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
}

/**
 * @param {{ active?: boolean, className?: string }} props
 */
export default function MediaCaptureGuard({ active = true, className = '' }) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    root.classList.add('media-capture-guard-active');

    const opts = { capture: true };
    document.addEventListener('contextmenu', block, opts);
    document.addEventListener('dragstart', block, opts);
    document.addEventListener('selectstart', block, opts);

    return () => {
      root.classList.remove('media-capture-guard-active');
      document.removeEventListener('contextmenu', block, opts);
      document.removeEventListener('dragstart', block, opts);
      document.removeEventListener('selectstart', block, opts);
    };
  }, [active]);

  if (!active) return null;
  return <div className={`media-capture-guard-marker${className ? ` ${className}` : ''}`} hidden aria-hidden="true" />;
}
