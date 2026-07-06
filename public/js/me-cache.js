/**
 * Session-scoped /api/me cache + cross-page profile sync (static HTML pages).
 */
(function () {
  'use strict';

  var CACHE_KEY = 'bcutm_me_cache';
  var EVENT = 'bcutm:profile-updated';

  function readMeCache(userId) {
    if (!userId) return null;
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.userId !== userId || !parsed.data) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function notifyProfileUpdated(userId, data) {
    try {
      window.dispatchEvent(new CustomEvent(EVENT, { detail: { userId: userId, data: data } }));
    } catch (e) {}
  }

  function writeMeCache(userId, data) {
    if (!userId || !data) return;
    try {
      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ v: 1, userId: userId, data: data, at: Date.now() })
      );
      notifyProfileUpdated(userId, data);
    } catch (e) {}
  }

  function clearMeCache() {
    try {
      sessionStorage.removeItem(CACHE_KEY);
    } catch (e) {}
  }

  function patchMeCacheDisplayName(userId, displayName) {
    if (!userId) return;
    var cached = readMeCache(userId);
    if (!cached || !cached.profile) return;
    cached.profile.display_name = displayName;
    writeMeCache(userId, cached);
  }

  window.BcutmMeCache = {
    CACHE_KEY: CACHE_KEY,
    EVENT: EVENT,
    read: readMeCache,
    write: writeMeCache,
    clear: clearMeCache,
    patchDisplayName: patchMeCacheDisplayName,
  };
})();
