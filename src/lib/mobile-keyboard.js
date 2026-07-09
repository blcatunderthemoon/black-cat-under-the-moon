const MOBILE_MQ = '(max-width: 768px), (hover: none) and (pointer: coarse)';
const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"], [contenteditable=""]';

function isMobile() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches;
}

function isInComposeOverlay(el) {
  return !!el?.closest?.('.forum-compose-overlay');
}

function findScrollParent(el) {
  let node = el?.parentElement;
  while (node && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node);
    const scrollable = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    const isModalShell = node.classList?.contains('forum-compose-overlay')
      || node.classList?.contains('forum-compose-modal')
      || node.classList?.contains('forum-story-synopsis-modal')
      || node.classList?.contains('forum-story-add-chapter')
      || node.classList?.contains('forum-tiptap__editor-wrap');
    if (scrollable && (node.scrollHeight > node.clientHeight + 1 || isModalShell)) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function isContentEditableTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  return !!target.closest?.('.ProseMirror');
}

/** Caret/selection rect — avoid scrolling to the bottom of a tall ProseMirror. */
function getCaretRect(target) {
  const root = target.closest?.('.ProseMirror') || (target.isContentEditable ? target : null);
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (root && !root.contains(range.commonAncestorContainer)) return null;

  const rects = range.getClientRects();
  if (rects.length > 0) {
    const rect = rects[rects.length - 1];
    const lineHeight = rect.height > 0 ? rect.height : 20;
    return {
      top: rect.top,
      bottom: rect.top + lineHeight,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: lineHeight,
    };
  }

  const rect = range.getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) return rect;
  if (rect.top !== 0 || rect.left !== 0) {
    return {
      top: rect.top,
      bottom: rect.top + 20,
      left: rect.left,
      right: rect.right,
      width: 0,
      height: 20,
    };
  }
  return null;
}

function getFocusVisibleRect(target) {
  if (isContentEditableTarget(target)) {
    const caretRect = getCaretRect(target);
    if (caretRect) return caretRect;
  }

  const focusTarget = target.closest?.('.ProseMirror')
    || target.closest?.('.forum-tiptap__editor-wrap')
    || target;
  return focusTarget.getBoundingClientRect();
}

let focusTimer = null;
let keyboardCloseTimer = null;
let lastKeyboardInset = 0;

function updateViewportVars() {
  const root = document.documentElement;
  const vv = window.visualViewport;

  if (!vv) {
    root.style.setProperty('--mobile-vvh', `${window.innerHeight}px`);
    root.style.setProperty('--mobile-keyboard-inset', '0px');
    root.style.setProperty('--mobile-vv-offset-top', '0px');
    root.classList.remove('mobile-keyboard-open');
    lastKeyboardInset = 0;
    return;
  }

  const keyboardInset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  root.style.setProperty('--mobile-vvh', `${Math.round(vv.height)}px`);
  root.style.setProperty('--mobile-keyboard-inset', `${keyboardInset}px`);
  root.style.setProperty('--mobile-vv-offset-top', `${Math.round(vv.offsetTop)}px`);
  root.classList.toggle('mobile-keyboard-open', keyboardInset > 50);
  lastKeyboardInset = keyboardInset;
}

function ensureVisible(target, options = {}) {
  if (!isMobile() || !target?.getBoundingClientRect) return;

  const run = () => {
    const vv = window.visualViewport;
    if (!vv) return;

    const focusTarget = target.closest?.('.ProseMirror')
      || target.closest?.('.forum-tiptap__editor-wrap')
      || target;
    const rect = getFocusVisibleRect(target);
    if (!rect) return;

    const visibleTop = vv.offsetTop + 12;
    const visibleBottom = vv.offsetTop + vv.height;
    const inOverlay = isInComposeOverlay(focusTarget);
    const actions = focusTarget.closest(
      '.forum-compose-actions, .forum-story-add-chapter__actions, .forum-comment-form__footer, .letter-compose__footer, .thread-reply-bar, .thread-compose-dock, .mirror-letter-overlay__btns, .mirror-letter-overlay__footer',
    );
    const actionsRect = actions?.getBoundingClientRect?.();
    const actionPad = inOverlay ? 8 : 16;
    const defaultPad = inOverlay ? 12 : 80;
    const bottomLimit = visibleBottom - (actionsRect ? Math.max(0, actionsRect.height + actionPad) : defaultPad);

    if (rect.bottom > bottomLimit) {
      const delta = rect.bottom - bottomLimit;
      const scrollParent = findScrollParent(focusTarget)
        || findScrollParent(actions)
        || focusTarget.closest?.('.forum-compose-overlay');
      if (scrollParent) {
        scrollParent.scrollTop += delta;
      } else {
        window.scrollBy({ top: delta, behavior: 'auto' });
      }
    } else if (rect.top < visibleTop) {
      const delta = visibleTop - rect.top;
      const scrollParent = findScrollParent(focusTarget)
        || focusTarget.closest?.('.forum-compose-overlay');
      if (scrollParent) {
        scrollParent.scrollTop -= delta;
      } else {
        window.scrollBy({ top: -delta, behavior: 'auto' });
      }
    }
  };

  if (options.singlePass) {
    requestAnimationFrame(() => setTimeout(run, 80));
    return;
  }

  requestAnimationFrame(() => {
    setTimeout(run, 60);
    setTimeout(run, 320);
    setTimeout(run, 520);
  });
}

function onFocusIn(e) {
  const target = e.target;
  if (!target?.matches?.(FOCUSABLE)) return;
  clearTimeout(focusTimer);
  focusTimer = setTimeout(() => ensureVisible(target), 80);
}

function onViewportChange() {
  const prevInset = lastKeyboardInset;
  updateViewportVars();
  const keyboardInset = lastKeyboardInset;
  const keyboardClosing = prevInset > 50 && keyboardInset <= 50;

  const active = document.activeElement;
  if (!active?.matches?.(FOCUSABLE)) return;

  if (keyboardClosing) {
    clearTimeout(keyboardCloseTimer);
    keyboardCloseTimer = setTimeout(() => ensureVisible(active, { singlePass: true }), 160);
    return;
  }

  clearTimeout(keyboardCloseTimer);
  ensureVisible(active);
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
    clearTimeout(keyboardCloseTimer);
    window.__mobileKeyboardInit = false;
  };
}
