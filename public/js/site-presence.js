/**
 * Index landing — polls /api/public/presence and updates the on-page counter chip.
 * Heartbeat registration is handled by site-presence-heartbeat.js (site-wide).
 */
(function initSitePresenceDisplay(global) {
  if (global.__BCUTM_SITE_PRESENCE_DISPLAY) return;
  global.__BCUTM_SITE_PRESENCE_DISPLAY = true;

  var POLL_MS = 12000;
  var box = null;

  function setVisible(show) {
    if (!box) return;
    box.hidden = !show;
  }

  function updateCount(count) {
    if (!box) return;
    var el = box.querySelector('[data-presence-count]');
    if (!el) return;
    if (count == null || count < 0) {
      setVisible(false);
      return;
    }
    var next = String(count);
    if (el.textContent !== next) {
      el.textContent = next;
      el.classList.remove('site-presence__count--pulse');
      void el.offsetWidth;
      el.classList.add('site-presence__count--pulse');
    }
    box.setAttribute('aria-label', next + ' 隻黑貓在夜空');
    setVisible(true);
  }

  function fetchCount() {
    return fetch('/api/public/presence', { credentials: 'same-origin' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !data.enabled) {
          updateCount(null);
          return;
        }
        updateCount(data.count);
      })
      .catch(function () {});
  }

  function boot() {
    box = global.document.getElementById('site-presence');
    if (!box) return;

    fetchCount();
    global.setInterval(fetchCount, POLL_MS);
    global.document.addEventListener('visibilitychange', function () {
      if (!global.document.hidden) fetchCount();
    });
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
