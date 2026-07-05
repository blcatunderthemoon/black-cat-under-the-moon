const MOBILE_MQ = '(max-width: 768px), (hover: none) and (pointer: coarse)';
const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"], [contenteditable=""]';

function isMobile() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches;
}

function findScrollParent(el) {
  let node = el?.parentElement;
  while (node && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function updateViewportVars() {
  const root = document.documentElement;
  const vv = window.visualViewport;

  if (!vv) {
    root.style.setProperty('--mobile-vvh', `${window.innerHeight}px`);
    root.style.setProperty('--mobile-keyboard-inset', '0px');
    root.style.setProperty('--mobile-vv-offset-top', '0px');
    root.classList.remove('mobile-keyboard-open');
    return;
  }

  const keyboardInset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  root.style.setProperty('--mobile-vvh', `${Math.round(vv.height)}px`);
  root.style.setProperty('--mobile-keyboard-inset', `${keyboardInset}px`);
  root.style.setProperty('--mobile-vv-offset-top', `${Math.round(vv.offsetTop)}px`);
  root.classList.toggle('mobile-keyboard-open', keyboardInset > 50);
}

function ensureVisible(target) {
  if (!isMobile() || !target?.getBoundingClientRect) return;

  const run = () => {
    const vv = window.visualViewport;
    if (!vv) return;

    const rect = target.getBoundingClientRect();
    const visibleTop = vv.offsetTop + 12;
    const visibleBottom = vv.offsetTop + vv.height;
    const actions = target.closest(
      '.forum-compose-actions, .forum-comment-form__footer, .letter-compose__footer, .thread-reply-bar, .thread-compose-dock, .mirror-letter-overlay__btns, .mirror-letter-overlay__footer',
    );
    const actionsRect = actions?.getBoundingClientRect?.();
    const bottomLimit = visibleBottom - (actionsRect ? Math.max(0, actionsRect.height + 16) : 80);

    if (rect.bottom > bottomLimit) {
      const delta = rect.bottom - bottomLimit;
      const scrollParent = findScrollParent(target) || findScrollParent(actions);
      if (scrollParent) {
        scrollParent.scrollTop += delta;
      } else {
        window.scrollBy({ top: delta, behavior: 'smooth' });
      }
    } else if (rect.top < visibleTop) {
      const delta = visibleTop - rect.top;
      const scrollParent = findScrollParent(target);
      if (scrollParent) {
        scrollParent.scrollTop -= delta;
      } else {
        window.scrollBy({ top: -delta, behavior: 'smooth' });
      }
    }
  };

  requestAnimationFrame(() => {
    setTimeout(run, 60);
    setTimeout(run, 320);
  });
}

let focusTimer = null;

function onFocusIn(e) {
  const target = e.target;
  if (!target?.matches?.(FOCUSABLE)) return;
  clearTimeout(focusTimer);
  focusTimer = setTimeout(() => ensureVisible(target), 80);
}

function onViewportChange() {
  updateViewportVars();
  const active = document.activeElement;
  if (active?.matches?.(FOCUSABLE)) {
    ensureVisible(active);
  }
}

export function initMobileKeyboard() {
  if (typeof window === 'undefined' || window.__mobileKeyboardInit) {
    return () => {};
  }
  window.__mobileKeyboardInit = true;

  updateViewportVars();

  const vv = window.visualViewport;
  vv?.addEventListener('resize', onViewportChange);
  vv?.addEventListener('scroll', onViewportChange);
  window.addEventListener('resize', updateViewportVars);
  document.addEventListener('focusin', onFocusIn, true);

  return () => {
    vv?.removeEventListener('resize', onViewportChange);
    vv?.removeEventListener('scroll', onViewportChange);
    window.removeEventListener('resize', updateViewportVars);
    document.removeEventListener('focusin', onFocusIn, true);
    clearTimeout(focusTimer);
    window.__mobileKeyboardInit = false;
  };
}
