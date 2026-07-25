/**
 * Index landing — polls /api/public/presence and updates the on-page counter chip.
 * Visible only to Moonlight Passport (premium) and forum admin accounts.
 * Heartbeat registration is handled by site-presence-heartbeat.js (site-wide).
 */
(function initSitePresenceDisplay(global) {
  if (global.__BCUTM_SITE_PRESENCE_DISPLAY) return;
  global.__BCUTM_SITE_PRESENCE_DISPLAY = true;

  var POLL_MS = 12000;
  var PROFILE_EVENT = (global.BcutmMeCache && global.BcutmMeCache.EVENT) || 'bcutm:profile-updated';
  var box = null;
  var eligible = false;
  var pollTimer = null;
  var lastCount = null;

  function getToken() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
          var v = JSON.parse(localStorage.getItem(k) || 'null');
          if (v && v.access_token) return v.access_token;
        }
      }
    } catch (e) {}
    return null;
  }

  function decodeJwtSub(token) {
    try {
      var part = String(token || '').split('.')[1];
      if (!part) return null;
      var json = part.replace(/-/g, '+').replace(/_/g, '/');
      while (json.length % 4) json += '=';
      var payload = JSON.parse(atob(json));
      return payload && payload.sub ? payload.sub : null;
    } catch (e) {
      return null;
    }
  }

  function canSeePresence(data) {
    var profile = data && data.profile;
    if (!profile) return false;
    if (profile.subscription_tier === 'premium') return true;
    if (profile.can_admin_forum) return true;
    if (profile.forum_role === 'admin') return true;
    return false;
  }

  function setVisible(show) {
    if (!box) return;
    box.hidden = !show;
  }

  function setEligible(next) {
    var was = eligible;
    eligible = !!next;
    if (!eligible) {
      setVisible(false);
      return;
    }
    if (!was || lastCount == null) {
      fetchCount();
    } else {
      setVisible(true);
    }
  }

  function refreshEligibilityFromCache() {
    var token = getToken();
    if (!token) {
      setEligible(false);
      return;
    }
    var userId = decodeJwtSub(token);
    var cacheApi = global.BcutmMeCache;
    var cached = cacheApi && userId && cacheApi.read ? cacheApi.read(userId) : null;
    if (cached) {
      setEligible(canSeePresence(cached));
      return;
    }
    // Wait for auth-nav /api/me → profile-updated; stay hidden until then.
    setEligible(false);
  }

  function updateCount(count) {
    if (!box) return;
    if (!eligible) {
      setVisible(false);
      return;
    }
    var el = box.querySelector('[data-presence-count]');
    if (!el) return;
    if (count == null || count < 0) {
      setVisible(false);
      return;
    }
    lastCount = count;
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
    if (!eligible) {
      setVisible(false);
      return Promise.resolve();
    }
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

    // Guests / free members never see the chip.
    setVisible(false);
    refreshEligibilityFromCache();

    global.addEventListener(PROFILE_EVENT, function (e) {
      var detail = e && e.detail;
      if (!detail || !detail.data) {
        setEligible(false);
        return;
      }
      setEligible(canSeePresence(detail.data));
    });

    pollTimer = global.setInterval(function () {
      refreshEligibilityFromCache();
      if (eligible) fetchCount();
    }, POLL_MS);

    global.document.addEventListener('visibilitychange', function () {
      if (global.document.hidden) return;
      refreshEligibilityFromCache();
      if (eligible) fetchCount();
    });

    global.addEventListener('storage', function () {
      refreshEligibilityFromCache();
    });
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
