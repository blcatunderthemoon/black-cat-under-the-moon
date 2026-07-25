/**
 * Index Live Activity Feed — two-row mini card + toast.
 * Top: label + 1/N + ▲▼ · Bottom: tag + title
 * Hover/focus pauses; swipe up/down cycles; click opens href.
 */
(function initLiveActivity(global) {
  if (global.__BCUTM_LIVE_ACTIVITY) return;
  global.__BCUTM_LIVE_ACTIVITY = true;

  var POLL_MS = 45000;
  var FLIP_MS = 4000;
  var TOAST_MS = 5200;
  var MAX_TOASTS = 3;
  var SWIPE_MIN = 28;
  var SEEN_KEY = 'bcutm_activity_seen_at';
  var TOASTED_KEY = 'bcutm_activity_toasted_at';
  var REDUCED = false;

  try {
    REDUCED = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) { /* ignore */ }

  var root = null;
  var rail = null;
  var flipEl = null;
  var metaEl = null;
  var countEl = null;
  var prevBtn = null;
  var nextBtn = null;
  var emptyEl = null;
  var toastHost = null;
  var items = [];
  var flipIndex = 0;
  var flipTimer = null;
  var pollTimer = null;
  var paused = false;
  var touchStartY = null;
  var knownIds = Object.create(null);

  function typeClass(type) {
    if (type === 'gathering') return 'live-activity__tag--gathering';
    if (type === 'member') return 'live-activity__tag--member';
    return 'live-activity__tag--post';
  }

  /* Keep paths in sync with HeaderNavIcons / ForumIcons (stroke icons sitewide). */
  var LIVE_ICON = {
    gathering:
      '<svg class="live-activity__tag-ico" width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">'
      + '<rect x="4" y="5.5" width="16" height="14" rx="1.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<path d="M4 10h16" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>'
      + '<path d="M9 3.5v3.5M15 3.5v3.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>'
      + '<path d="M8 14h2.5M13.5 14H16" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>'
      + '</svg>',
    member:
      '<svg class="live-activity__tag-ico" width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">'
      + '<ellipse cx="12" cy="15.2" rx="4.2" ry="3.4" stroke="currentColor" stroke-width="1.75"/>'
      + '<circle cx="7.2" cy="10.2" r="1.7" stroke="currentColor" stroke-width="1.75"/>'
      + '<circle cx="10.2" cy="8.2" r="1.7" stroke="currentColor" stroke-width="1.75"/>'
      + '<circle cx="13.8" cy="8.2" r="1.7" stroke="currentColor" stroke-width="1.75"/>'
      + '<circle cx="16.8" cy="10.2" r="1.7" stroke="currentColor" stroke-width="1.75"/>'
      + '</svg>',
    post:
      '<svg class="live-activity__tag-ico" width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">'
      + '<path d="M5 6.5h14v9.5H11l-3.5 3v-3H5V6.5z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>'
      + '</svg>',
  };

  function tagLabel(type, tag) {
    if (type === 'gathering') return tag || '活動';
    if (type === 'member') return tag || '新會員';
    return tag || '論壇';
  }

  function typeIconHtml(type) {
    if (type === 'gathering') return LIVE_ICON.gathering;
    if (type === 'member') return LIVE_ICON.member;
    return LIVE_ICON.post;
  }

  function fillTag(el, item) {
    el.className = 'live-activity__tag ' + typeClass(item.type);
    el.textContent = '';
    var ico = global.document.createElement('span');
    ico.className = 'live-activity__tag-ico-wrap';
    ico.setAttribute('aria-hidden', 'true');
    ico.innerHTML = typeIconHtml(item.type);
    var label = global.document.createElement('span');
    label.className = 'live-activity__tag-text';
    label.textContent = tagLabel(item.type, item.tag);
    el.appendChild(ico);
    el.appendChild(label);
  }

  function readIsoMs(key) {
    try {
      var raw = global.localStorage.getItem(key);
      var n = raw ? Date.parse(raw) : NaN;
      return Number.isFinite(n) ? n : 0;
    } catch (e) {
      return 0;
    }
  }

  function writeIsoNow(key) {
    try {
      global.localStorage.setItem(key, new Date().toISOString());
    } catch (e) { /* ignore */ }
  }

  function getSeenAt() {
    return readIsoMs(SEEN_KEY);
  }

  function setSeenNow() {
    writeIsoNow(SEEN_KEY);
  }

  function getToastedAt() {
    return readIsoMs(TOASTED_KEY);
  }

  function setToastedNow() {
    writeIsoNow(TOASTED_KEY);
  }

  function currentItem() {
    return items.length ? items[flipIndex] : null;
  }

  function syncRailLink() {
    if (!rail) return;
    var item = currentItem();
    var href = item && item.href ? item.href : '';
    if (href) {
      rail.classList.add('live-activity__rail--link');
      rail.setAttribute('role', 'link');
      rail.setAttribute('tabindex', '0');
      rail.setAttribute('data-href', href);
      rail.setAttribute('aria-label', '查看動態：' + (item.text || ''));
    } else {
      rail.classList.remove('live-activity__rail--link');
      rail.removeAttribute('role');
      rail.removeAttribute('tabindex');
      rail.removeAttribute('data-href');
      rail.setAttribute('aria-label', '最新動態');
    }
  }

  function buildRow(item) {
    var tag = global.document.createElement('span');
    fillTag(tag, item);

    var text = global.document.createElement('span');
    text.className = 'live-activity__text';
    text.textContent = item.text || '';

    var inner = global.document.createElement('span');
    inner.className = 'live-activity__row-inner';
    inner.appendChild(tag);
    inner.appendChild(text);

    var el = global.document.createElement('div');
    el.className = 'live-activity__row';
    el.appendChild(inner);
    return el;
  }

  function renderMeta() {
    if (!metaEl || !countEl) return;
    if (items.length < 2) {
      metaEl.hidden = true;
      return;
    }
    metaEl.hidden = false;
    countEl.textContent = (flipIndex + 1) + '/' + items.length;
    if (prevBtn) prevBtn.disabled = false;
    if (nextBtn) nextBtn.disabled = false;
  }

  function renderEmpty() {
    if (!root) return;
    if (!items.length) {
      // No news — hide the whole block so socials/footer sit up with no blank gap.
      root.hidden = true;
      if (emptyEl) emptyEl.hidden = true;
      if (flipEl) flipEl.hidden = true;
      if (rail) rail.hidden = true;
      if (metaEl) metaEl.hidden = true;
      return;
    }
    root.hidden = false;
    if (emptyEl) emptyEl.hidden = true;
    if (flipEl) flipEl.hidden = false;
    if (rail) rail.hidden = false;
  }

  function showFlip(index, animate) {
    if (!flipEl || !items.length) return;
    flipIndex = ((index % items.length) + items.length) % items.length;
    var item = items[flipIndex];
    var next = buildRow(item);
    next.className += ' live-activity__flip-item';
    if (animate !== false && !REDUCED) {
      next.className += ' live-activity__flip-item--enter';
    }
    flipEl.innerHTML = '';
    flipEl.appendChild(next);
    syncRailLink();
    renderMeta();
  }

  function clearFlipTimer() {
    if (flipTimer) {
      global.clearInterval(flipTimer);
      flipTimer = null;
    }
  }

  function startFlip() {
    clearFlipTimer();
    if (!items.length) return;
    showFlip(flipIndex, false);
    if (items.length < 2 || REDUCED || paused) return;
    flipTimer = global.setInterval(function () {
      if (paused) return;
      showFlip(flipIndex + 1, true);
    }, FLIP_MS);
  }

  function setPaused(next) {
    paused = !!next;
    if (rail) rail.classList.toggle('live-activity__rail--paused', paused);
    if (paused) {
      clearFlipTimer();
    } else if (items.length > 1 && !REDUCED) {
      clearFlipTimer();
      flipTimer = global.setInterval(function () {
        if (paused) return;
        showFlip(flipIndex + 1, true);
      }, FLIP_MS);
    }
  }

  function step(delta) {
    if (items.length < 2) return;
    setPaused(true);
    showFlip(flipIndex + delta, true);
  }

  function openCurrent() {
    var href = rail && rail.getAttribute('data-href');
    if (href) global.location.href = href;
  }

  function showToast(item) {
    if (!toastHost || !item) return;
    while (toastHost.children.length >= MAX_TOASTS) {
      toastHost.removeChild(toastHost.firstChild);
    }
    var toast = global.document.createElement(item.href ? 'a' : 'div');
    if (item.href) toast.href = item.href;
    toast.className = 'live-activity-toast live-activity-toast--' + (item.type || 'post');
    toast.setAttribute('role', 'status');

    var tag = global.document.createElement('span');
    fillTag(tag, item);

    var text = global.document.createElement('span');
    text.className = 'live-activity-toast__text';
    text.textContent = item.text || '';

    toast.appendChild(tag);
    toast.appendChild(text);
    toastHost.appendChild(toast);

    global.setTimeout(function () {
      toast.classList.add('live-activity-toast--out');
      global.setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 320);
    }, TOAST_MS);
  }

  function applyItems(nextItems, opts) {
    opts = opts || {};
    items = Array.isArray(nextItems) ? nextItems : [];
    flipIndex = 0;

    renderEmpty();
    if (items.length) startFlip();
    else clearFlipTimer();

    var seenAt = getSeenAt();
    var toastedAt = getToastedAt();
    var toastables = [];

    items.forEach(function (item) {
      var t = new Date(item.created_at).getTime();
      var isUnread = Number.isFinite(t) && t > seenAt;
      var isToastable = Number.isFinite(t) && t > Math.max(toastedAt, seenAt);
      // New members stay in the feed only — no popup toast.
      var canToast = item.type !== 'member';

      if (canToast) {
        if (opts.firstLoad) {
          if (isToastable) toastables.push(item);
        } else if (!knownIds[item.id] && isUnread) {
          toastables.push(item);
        }
      }
      knownIds[item.id] = true;
    });

    if (opts.firstLoad && !seenAt) {
      setSeenNow();
      setToastedNow();
      return;
    }

    if (toastables.length) {
      toastables.slice(0, MAX_TOASTS).forEach(function (item, i) {
        global.setTimeout(function () { showToast(item); }, i * 380);
      });
      setToastedNow();
    }
  }

  function fetchFeed(firstLoad) {
    return fetch('/api/public/activity', { credentials: 'same-origin' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.items)) {
          if (firstLoad) applyItems([], { firstLoad: true });
          return;
        }
        applyItems(data.items, { firstLoad: !!firstLoad });
      })
      .catch(function () {
        if (firstLoad) applyItems([], { firstLoad: true });
      });
  }

  function bindRail() {
    if (!rail) return;

    rail.addEventListener('mouseenter', function () { setPaused(true); });
    rail.addEventListener('mouseleave', function () { setPaused(false); });
    rail.addEventListener('focusin', function () { setPaused(true); });
    rail.addEventListener('focusout', function (e) {
      if (rail.contains(e.relatedTarget)) return;
      setPaused(false);
    });

    rail.addEventListener('click', function (e) {
      if (e.target.closest('.live-activity__nav-btn')) return;
      openCurrent();
    });

    rail.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('.live-activity__nav-btn')) return;
        e.preventDefault();
        openCurrent();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        step(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        step(1);
      }
    });

    rail.addEventListener('touchstart', function (e) {
      if (!e.touches || !e.touches[0]) return;
      touchStartY = e.touches[0].clientY;
      setPaused(true);
    }, { passive: true });

    rail.addEventListener('touchend', function (e) {
      if (touchStartY == null || !e.changedTouches || !e.changedTouches[0]) {
        touchStartY = null;
        return;
      }
      var dy = e.changedTouches[0].clientY - touchStartY;
      touchStartY = null;
      if (Math.abs(dy) < SWIPE_MIN) return;
      // swipe up → next, swipe down → prev
      step(dy < 0 ? 1 : -1);
    }, { passive: true });

    if (prevBtn) {
      prevBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        step(-1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        step(1);
      });
    }
  }

  function boot() {
    root = global.document.getElementById('live-activity');
    rail = global.document.getElementById('live-activity-rail');
    flipEl = global.document.getElementById('live-activity-flip');
    metaEl = global.document.getElementById('live-activity-meta');
    countEl = global.document.getElementById('live-activity-count');
    prevBtn = global.document.getElementById('live-activity-prev');
    nextBtn = global.document.getElementById('live-activity-next');
    emptyEl = global.document.getElementById('live-activity-empty');
    toastHost = global.document.getElementById('live-activity-toasts');

    if (!root) return;

    /* Stay collapsed until feed has items — avoid empty "最新動態" blank. */
    root.hidden = true;
    if (rail) rail.hidden = true;
    if (emptyEl) emptyEl.hidden = true;

    bindRail();
    fetchFeed(true);
    pollTimer = global.setInterval(function () { fetchFeed(false); }, POLL_MS);

    global.document.addEventListener('visibilitychange', function () {
      if (global.document.visibilityState === 'visible') fetchFeed(false);
    });
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
