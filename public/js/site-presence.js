/**
 * Index landing — live visitor count via /api/public/presence (heartbeat + poll).
 */
(function initSitePresence(global) {
  if (global.__BCUTM_SITE_PRESENCE_BOOTED) return;
  global.__BCUTM_SITE_PRESENCE_BOOTED = true;

  var SESSION_KEY = 'bcutm_presence_id';
  var HEARTBEAT_MS = 25000;
  var POLL_MS = 12000;
  var box = null;
  var timers = [];

  function getSessionId() {
    try {
      var existing = sessionStorage.getItem(SESSION_KEY);
      if (existing) return existing;
      var id = (global.crypto && global.crypto.randomUUID)
        ? global.crypto.randomUUID()
        : ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0;
          var v = c === 'x' ? r : ((r & 0x3) | 0x8);
          return v.toString(16);
        }));
      sessionStorage.setItem(SESSION_KEY, id);
      return id;
    } catch (e) {
      return null;
    }
  }

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

  function heartbeat() {
    var sessionId = getSessionId();
    if (!sessionId) return fetchCount();
    return fetch('/api/public/presence', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (data && data.enabled) updateCount(data.count);
        else updateCount(null);
      })
      .catch(function () {});
  }

  function schedule(fn, ms) {
    var id = global.setInterval(fn, ms);
    timers.push(id);
    return id;
  }

  function boot() {
    box = global.document.getElementById('site-presence');
    if (!box) return;

    heartbeat().then(fetchCount);
    schedule(heartbeat, HEARTBEAT_MS);
    schedule(fetchCount, POLL_MS);

    global.document.addEventListener('visibilitychange', function () {
      if (!global.document.hidden) heartbeat().then(fetchCount);
    });

    global.addEventListener('pagehide', function () {
      var sessionId = getSessionId();
      if (!sessionId || !global.navigator.sendBeacon) return;
      try {
        global.navigator.sendBeacon(
          '/api/public/presence',
          new Blob([JSON.stringify({ session_id: sessionId })], { type: 'application/json' }),
        );
      } catch (e) {}
    });
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
