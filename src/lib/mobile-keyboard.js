const MOBILE_MQ = '(max-width: 768px), (hover: none) and (pointer: coarse)';
const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"], [contenteditable=""]';

function isMobile() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches;
}

function isInComposeOverlay(el) {
  return !!el?.closest?.('.forum-compose-overlay');
}

/** Innermost ancestor that actually scrolls (avoid treating overlay shell as scroller). */
function findScrollParent(el) {
  let node = el?.parentElement;
  while (node && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node);
    const scrollable = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    if (scrollable && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function getFocusTarget(target) {
  return target?.closest?.('.ProseMirror')
    || target?.closest?.('.forum-tiptap__editor-wrap')
    || target;
}

function resolveScrollParent(focusTarget) {
  const inner = findScrollParent(focusTarget);
  if (inner) return inner;

  if (!focusTarget) return null;

  // Prefer the compose modal (then overlay) even before overflow kicks in,
  // so iOS keyboard open can scroll the field into the visual viewport.
  if (isInComposeOverlay(focusTarget)) {
    return focusTarget.closest?.('.forum-compose-modal')
      || focusTarget.closest?.('.forum-compose-overlay')
      || null;
  }

  return focusTarget.closest?.('.pixel-form')
    || focusTarget.closest?.('.forum-story-add-chapter')
    || focusTarget.closest?.('.forum-story-synopsis-modal')
    || null;
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

  const focusTarget = getFocusTarget(target);
  return focusTarget?.getBoundingClientRect?.() || null;
}

function desiredCaretViewportTop(vv) {
  if (!vv) return 100;
  return vv.offsetTop + Math.min(108, Math.max(72, Math.round(vv.height * 0.24)));
}

let focusTimer = null;
let keyboardCloseTimer = null;
let anchorCaptureTimer = null;
let lastKeyboardInset = 0;
let scrollAnchor = null;

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

function captureScrollAnchor(target) {
  if (!target) return null;

  const focusTarget = getFocusTarget(target);
  const scrollParent = resolveScrollParent(focusTarget);
  if (!scrollParent) return null;

  const rect = getFocusVisibleRect(target);
  if (!rect) return null;

  const parentRect = scrollParent.getBoundingClientRect();
  const vv = window.visualViewport;

  return {
    scrollParent,
    scrollTop: scrollParent.scrollTop,
    caretTopInParent: rect.top - parentRect.top + scrollParent.scrollTop,
    desiredTop: desiredCaretViewportTop(vv),
  };
}

function restoreScrollAnchor(target, anchor) {
  if (!anchor?.scrollParent?.isConnected) return false;

  const rect = getFocusVisibleRect(target);
  if (!rect) return false;

  const vv = window.visualViewport;
  const desiredTop = desiredCaretViewportTop(vv);
  const delta = rect.top - desiredTop;

  if (Math.abs(delta) < 2) return true;

  anchor.scrollParent.scrollTop += delta;
  return true;
}

function ensureVisible(target, options = {}) {
  if (!isMobile() || !target?.getBoundingClientRect) return;

  const run = () => {
    const vv = window.visualViewport;
    if (!vv) return;

    const focusTarget = getFocusTarget(target);
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

    const scrollParent = resolveScrollParent(focusTarget);
    const overlay = focusTarget.closest?.('.forum-compose-overlay');

    const applyScroll = (delta) => {
      if (!delta) return;
      if (scrollParent) {
        const before = scrollParent.scrollTop;
        scrollParent.scrollTop += delta;
        const moved = scrollParent.scrollTop - before;
        const remain = delta - moved;
        // Modal may not overflow yet; finish the move on the overlay shell.
        if (Math.abs(remain) > 1 && overlay && overlay !== scrollParent) {
          overlay.scrollTop += remain;
        }
      } else if (overlay) {
        overlay.scrollTop += delta;
      } else {
        window.scrollBy({ top: delta, behavior: 'auto' });
      }
    };

    if (rect.bottom > bottomLimit) {
      applyScroll(rect.bottom - bottomLimit);
    } else if (rect.top < visibleTop) {
      applyScroll(-(visibleTop - rect.top));
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

function scheduleAnchorCapture(target) {
  clearTimeout(anchorCaptureTimer);
  anchorCaptureTimer = setTimeout(() => {
    if (lastKeyboardInset > 50) {
      scrollAnchor = captureScrollAnchor(target);
    }
  }, 280);
}

function onKeyboardClose(active) {
  const anchor = scrollAnchor || captureScrollAnchor(active);
  scrollAnchor = null;

  const restore = () => {
    if (anchor) restoreScrollAnchor(active, anchor);
    ensureVisible(active, { singlePass: true });
  };

  clearTimeout(keyboardCloseTimer);
  requestAnimationFrame(() => {
    restore();
    keyboardCloseTimer = setTimeout(restore, 180);
    setTimeout(restore, 380);
    setTimeout(restore, 620);
  });
}

function onFocusIn(e) {
  const target = e.target;
  if (!target?.matches?.(FOCUSABLE)) return;
  clearTimeout(focusTimer);
  focusTimer = setTimeout(() => {
    ensureVisible(target);
    if (lastKeyboardInset > 50) scheduleAnchorCapture(target);
  }, 80);
}

function onSelectionChange() {
  if (lastKeyboardInset <= 50) return;
  const active = document.activeElement;
  if (!active?.matches?.(FOCUSABLE)) return;
  scheduleAnchorCapture(active);
}

function onViewportChange() {
  const prevInset = lastKeyboardInset;
  updateViewportVars();
  const keyboardInset = lastKeyboardInset;
  const keyboardClosing = prevInset > 50 && keyboardInset <= 50;

  const active = document.activeElement;
  if (!active?.matches?.(FOCUSABLE)) {
    if (keyboardClosing) scrollAnchor = null;
    return;
  }

  if (keyboardClosing) {
    onKeyboardClose(active);
    return;
  }

  clearTimeout(keyboardCloseTimer);
  if (keyboardInset > 50) {
    scheduleAnchorCapture(active);
  }
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
  document.addEventListener('selectionchange', onSelectionChange);

  return () => {
    vv?.removeEventListener('resize', onViewportChange);
    vv?.removeEventListener('scroll', onViewportChange);
    window.removeEventListener('resize', updateViewportVars);
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('selectionchange', onSelectionChange);
    clearTimeout(focusTimer);
    clearTimeout(keyboardCloseTimer);
    clearTimeout(anchorCaptureTimer);
    scrollAnchor = null;
    window.__mobileKeyboardInit = false;
  };
}
