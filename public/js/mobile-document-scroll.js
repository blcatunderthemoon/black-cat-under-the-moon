/**
 * Mobile / in-app WebView scroll helpers.
 *
 * Strategy: natural document scroll on mobile — html/body stay at overflow-y: visible
 * and height: auto so the viewport scrolls the full document. Landing panels
 * (#welcome / #mode-select / #home-landing) must be in document flow (position: relative).
 *
 * Do NOT measure scroll height or add spacers — see docs/ops/MOBILE-WEBVIEW-SCROLL.md.
 */
(function (global) {
  var SCREENS = ['welcome-active', 'mode-select-active', 'home-landing-active'];
  var LANDING_PANEL_IDS = ['welcome', 'mode-select', 'home-landing'];
  var MOBILE_MQ = '(max-width: 768px), (hover: none) and (pointer: coarse)';

  function isMobileCoarse() {
    return window.matchMedia(MOBILE_MQ).matches;
  }

  /** Threads / IG / LINE in-app browsers often inflate env(safe-area-inset-top). */
  function isInAppBrowser() {
    var ua = navigator.userAgent || '';
    if (/\b(FBAN|FBAV|Instagram|Threads|Barcelona|Line\/|MicroMessenger|TikTok|Snapchat|Twitter)\b/i.test(ua)) {
      return true;
    }
    if (/Android/i.test(ua) && /\bwv\b/i.test(ua)) return true;
    if (/iPhone|iPad|iPod/i.test(ua) && /AppleWebKit/i.test(ua) && !/Version\/|CriOS|FxiOS|EdgiOS/i.test(ua)) {
      if (!/Safari/i.test(ua)) return true;
    }
    return false;
  }

  function readSafeAreaInsetTop() {
    if (!document.body) return 0;
    var probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top,0px);';
    document.body.appendChild(probe);
    var px = parseFloat(window.getComputedStyle(probe).paddingTop) || 0;
    probe.parentNode.removeChild(probe);
    return px;
  }

  function initSiteSafeTop() {
    var root = document.documentElement;
    var raw = readSafeAreaInsetTop();
    var inApp = isInAppBrowser();
    var top = raw;

    if (inApp) {
      top = 0;
      root.classList.add('in-app-webview');
    } else if (isMobileCoarse() && raw > 50) {
      /* Unrecognized WebView with bogus safe-area (common from social in-app browsers). */
      top = 0;
      root.classList.add('in-app-webview');
    } else {
      top = Math.min(raw, 47);
    }

    root.style.setProperty('--site-safe-top', top + 'px');
  }

  function removeLegacyScrollArtifacts() {
    var root = document.documentElement;
    root.style.removeProperty('--landing-scroll-h');
    root.style.removeProperty('min-height');
    document.body.style.removeProperty('min-height');
    var spacer = document.getElementById('mobile-doc-scroll-spacer');
    if (spacer && spacer.parentNode) spacer.parentNode.removeChild(spacer);
  }

  function clearLandingClasses() {
    SCREENS.forEach(function (cls) {
      document.documentElement.classList.remove(cls);
      document.body.classList.remove(cls);
    });
    document.documentElement.classList.remove('landing-document-scroll');
    document.body.classList.remove('landing-document-scroll');
    removeLegacyScrollArtifacts();
  }

  /* Force landing panels into normal document flow on mobile
     so the scrolling <body> grows to include them (and their footer). */
  function applyMobileLandingInFlow() {
    if (!isMobileCoarse()) return;
    LANDING_PANEL_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.style.display === 'none' || el.classList.contains('hiding')) return;
      if (id === 'mode-select' && !el.classList.contains('active')) return;
      el.style.setProperty('position', 'relative', 'important');
      el.style.setProperty('inset', 'auto', 'important');
      el.style.setProperty('top', 'auto', 'important');
      el.style.setProperty('left', 'auto', 'important');
      el.style.setProperty('right', 'auto', 'important');
      el.style.setProperty('bottom', 'auto', 'important');
      el.style.setProperty('width', '100%', 'important');
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('min-height', 'auto', 'important');
      el.style.setProperty('max-height', 'none', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
    });
  }

  /* Kept for API compatibility — the body sizes to its content automatically,
     so all we do is make sure the landing panels are in flow. */
  function refreshLandingScrollExtent() {
    applyMobileLandingInFlow();
    removeLegacyScrollArtifacts();
  }

  function refreshAppPageScrollExtent() {
    removeLegacyScrollArtifacts();
  }

  function setLandingScrollScreen(screen) {
    clearLandingClasses();
    document.documentElement.classList.add('landing-document-scroll');
    document.body.classList.add('landing-document-scroll');
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
    document.documentElement.style.overflow = '';
    document.documentElement.style.height = '';
    if (screen === 'welcome') {
      document.documentElement.classList.add('welcome-active');
      document.body.classList.add('welcome-active');
      applyMobileLandingInFlow();
    } else if (screen === 'mode-select') {
      document.documentElement.classList.add('mode-select-active');
      document.body.classList.add('mode-select-active');
      var welcome = document.getElementById('welcome');
      if (welcome) {
        welcome.style.display = 'none';
        welcome.style.pointerEvents = 'none';
      }
      applyMobileLandingInFlow();
    } else if (screen === 'home' || screen === 'home-landing') {
      document.documentElement.classList.add('home-landing-active');
      document.body.classList.add('home-landing-active');
      applyMobileLandingInFlow();
    }
    if (isMobileCoarse()) window.scrollTo(0, 0);
  }

  function setMirrorResultScrollActive(active) {
    clearLandingClasses();
    document.documentElement.classList.toggle('mirror-result-active', !!active);
    document.body.classList.toggle('mirror-result-active', !!active);
    if (active) {
      document.body.classList.remove('quiz-viewport');
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      var loading = document.getElementById('loading-screen');
      if (loading) loading.classList.remove('active');
    }
  }

  function setBodyScrollLocked(locked) {
    document.documentElement.classList.toggle('body-scroll-locked', !!locked);
    document.body.classList.toggle('body-scroll-locked', !!locked);
    if (!locked) {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
  }

  var FOCUSABLE =
    'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"], [contenteditable=""]';

  function findScrollParent(el) {
    var node = el && el.parentElement;
    while (node && node !== document.documentElement) {
      var oy = window.getComputedStyle(node).overflowY;
      if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && node.scrollHeight > node.clientHeight + 1) {
        return node;
      }
      node = node.parentElement;
    }
    return document.scrollingElement || document.body;
  }

  function isContentEditableTarget(target) {
    if (!target) return false;
    if (target.isContentEditable) return true;
    return !!(target.closest && target.closest('.ProseMirror'));
  }

  function getCaretRect(target) {
    var root = (target.closest && target.closest('.ProseMirror')) || (target.isContentEditable ? target : null);
    var selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    var range = selection.getRangeAt(0);
    if (root && !root.contains(range.commonAncestorContainer)) return null;

    var rects = range.getClientRects();
    if (rects.length > 0) {
      var rect = rects[rects.length - 1];
      var lineHeight = rect.height > 0 ? rect.height : 20;
      return {
        top: rect.top,
        bottom: rect.top + lineHeight,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: lineHeight,
      };
    }

    var box = range.getBoundingClientRect();
    if (box.width > 0 || box.height > 0) return box;
    if (box.top !== 0 || box.left !== 0) {
      return {
        top: box.top,
        bottom: box.top + 20,
        left: box.left,
        right: box.right,
        width: 0,
        height: 20,
      };
    }
    return null;
  }

  function getFocusVisibleRect(target) {
    if (isContentEditableTarget(target)) {
      var caretRect = getCaretRect(target);
      if (caretRect) return caretRect;
    }
    return target.getBoundingClientRect();
  }

  var lastKeyboardInset = 0;
  var keyboardCloseTimer = null;

  function updateViewportVars() {
    var root = document.documentElement;
    var vv = window.visualViewport;
    if (!vv) {
      root.style.setProperty('--mobile-vvh', window.innerHeight + 'px');
      root.style.setProperty('--mobile-keyboard-inset', '0px');
      root.style.setProperty('--mobile-vv-offset-top', '0px');
      root.classList.remove('mobile-keyboard-open');
      lastKeyboardInset = 0;
      return;
    }
    var keyboardInset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    root.style.setProperty('--mobile-vvh', Math.round(vv.height) + 'px');
    root.style.setProperty('--mobile-keyboard-inset', keyboardInset + 'px');
    root.style.setProperty('--mobile-vv-offset-top', Math.round(vv.offsetTop) + 'px');
    root.classList.toggle('mobile-keyboard-open', keyboardInset > 50);
    lastKeyboardInset = keyboardInset;
  }

  function ensureFieldVisible(target, options) {
    if (!isMobileCoarse() || !target || !target.getBoundingClientRect) return;
    var singlePass = options && options.singlePass;
    var run = function () {
      var vv = window.visualViewport;
      if (!vv) return;
      var rect = getFocusVisibleRect(target);
      if (!rect) return;
      var visibleTop = vv.offsetTop + 12;
      var visibleBottom = vv.offsetTop + vv.height;
      var bottomLimit = visibleBottom - 80;
      var scroller = findScrollParent(target);
      if (rect.bottom > bottomLimit) {
        var delta = rect.bottom - bottomLimit;
        if (scroller && scroller !== document.body && scroller !== document.documentElement) scroller.scrollTop += delta;
        else window.scrollBy(0, delta);
      } else if (rect.top < visibleTop) {
        var up = visibleTop - rect.top;
        if (scroller && scroller !== document.body && scroller !== document.documentElement) scroller.scrollTop -= up;
        else window.scrollBy(0, -up);
      }
    };
    if (singlePass) {
      requestAnimationFrame(function () { setTimeout(run, 80); });
      return;
    }
    requestAnimationFrame(function () {
      setTimeout(run, 60);
      setTimeout(run, 320);
    });
  }

  function initMobileKeyboard() {
    if (global.__mobileKeyboardInit) return;
    global.__mobileKeyboardInit = true;
    updateViewportVars();
    var vv = window.visualViewport;
    var onVv = function () {
      var prevInset = lastKeyboardInset;
      updateViewportVars();
      var keyboardInset = lastKeyboardInset;
      var keyboardClosing = prevInset > 50 && keyboardInset <= 50;
      var active = document.activeElement;
      if (!active || !active.matches || !active.matches(FOCUSABLE)) return;
      if (keyboardClosing) {
        clearTimeout(keyboardCloseTimer);
        keyboardCloseTimer = setTimeout(function () {
          ensureFieldVisible(active, { singlePass: true });
        }, 160);
        return;
      }
      clearTimeout(keyboardCloseTimer);
      ensureFieldVisible(active);
    };
    if (vv) {
      vv.addEventListener('resize', onVv);
      vv.addEventListener('scroll', onVv);
    }
    window.addEventListener('resize', updateViewportVars);
    document.addEventListener(
      'focusin',
      function (e) {
        var t = e.target;
        if (t && t.matches && t.matches(FOCUSABLE)) {
          setTimeout(function () { ensureFieldVisible(t); }, 80);
        }
      },
      true,
    );
  }

  global.MobileDocumentScroll = {
    setLandingScrollScreen: setLandingScrollScreen,
    setMirrorResultScrollActive: setMirrorResultScrollActive,
    setBodyScrollLocked: setBodyScrollLocked,
    initMobileKeyboard: initMobileKeyboard,
    initMobileWebviewScroll: initMobileWebviewScroll,
    applyMobileLandingInFlow: applyMobileLandingInFlow,
    refreshLandingScrollExtent: refreshLandingScrollExtent,
    refreshAppPageScrollExtent: refreshAppPageScrollExtent,
  };

  function syncLandingScrollFromDom() {
    if (document.getElementById('home-landing')) {
      setLandingScrollScreen('home');
      return;
    }
    if (document.querySelector('.mode-select-screen.active')) {
      setLandingScrollScreen('mode-select');
      return;
    }
    var mirrorResult = document.getElementById('mirror-result');
    if (mirrorResult && mirrorResult.classList.contains('active')) {
      setMirrorResultScrollActive(true);
      return;
    }
    var welcome = document.getElementById('welcome');
    if (welcome && welcome.style.display !== 'none' && !welcome.classList.contains('hiding')) {
      setLandingScrollScreen('welcome');
    }
  }

  function clearMobileScrollInlineStyles() {
    document.documentElement.style.overflow = '';
    document.documentElement.style.height = '';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
    removeLegacyScrollArtifacts();
  }

  function initMobileWebviewScroll() {
    if (!isMobileCoarse()) {
      removeLegacyScrollArtifacts();
      return;
    }
    clearMobileScrollInlineStyles();
    initMobileKeyboard();
    syncLandingScrollFromDom();
    applyMobileLandingInFlow();
  }

  function observeLandingScreens() {
    var modeSelect = document.getElementById('mode-select');
    if (!modeSelect || modeSelect.__landingScrollObserved) return;
    modeSelect.__landingScrollObserved = true;
    var observer = new MutationObserver(function () {
      if (modeSelect.classList.contains('active')) {
        setLandingScrollScreen('mode-select');
      }
    });
    observer.observe(modeSelect, { attributes: true, attributeFilter: ['class'] });
  }

  function observeLandingPanels() {
    var welcome = document.getElementById('welcome');
    var modeSelect = document.getElementById('mode-select');
    var homeLanding = document.getElementById('home-landing');
    if (welcome && !welcome.__landingPanelObserved) {
      welcome.__landingPanelObserved = true;
      if (typeof ResizeObserver !== 'undefined') {
        var roWelcome = new ResizeObserver(applyMobileLandingInFlow);
        roWelcome.observe(welcome);
      }
    }
    if (modeSelect && !modeSelect.__landingPanelObserved) {
      modeSelect.__landingPanelObserved = true;
      if (typeof ResizeObserver !== 'undefined') {
        var roMode = new ResizeObserver(function () {
          if (modeSelect.classList.contains('active')) applyMobileLandingInFlow();
        });
        roMode.observe(modeSelect);
      }
    }
    if (homeLanding && !homeLanding.__landingPanelObserved) {
      homeLanding.__landingPanelObserved = true;
      if (typeof ResizeObserver !== 'undefined') {
        var roHome = new ResizeObserver(applyMobileLandingInFlow);
        roHome.observe(homeLanding);
      }
    }
    observeLandingScreens();
  }

  function bootMobileScroll() {
    initSiteSafeTop();
    initMobileWebviewScroll();
    observeLandingPanels();
    window.addEventListener('orientationchange', function () {
      setTimeout(initSiteSafeTop, 120);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootMobileScroll);
  } else {
    bootMobileScroll();
  }
})(typeof window !== 'undefined' ? window : this);
