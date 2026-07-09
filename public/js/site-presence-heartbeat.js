/**
 * Site-wide anonymous presence heartbeat — registers this browser tab
 * in the shared Redis pool (all pages count toward the same total).
 */
(function initSitePresenceHeartbeat(global) {
  if (global.__BCUTM_SITE_PRESENCE_HEARTBEAT) return;
  global.__BCUTM_SITE_PRESENCE_HEARTBEAT = true;

  var SESSION_KEY = 'bcutm_presence_id';
  var HEARTBEAT_MS = 25000;

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

  function heartbeat() {
    var sessionId = getSessionId();
    if (!sessionId) return Promise.resolve();
    return fetch('/api/public/presence', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    }).catch(function () {});
  }

  heartbeat();
  global.setInterval(heartbeat, HEARTBEAT_MS);

  global.document.addEventListener('visibilitychange', function () {
    if (!global.document.hidden) heartbeat();
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
})(typeof window !== 'undefined' ? window : globalThis);
