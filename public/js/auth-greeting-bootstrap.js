/**
 * Index greeting — paint immediately from session cache / JWT (before auth-nav.js).
 */
(function () {
  'use strict';

  var ME_CACHE_KEY = 'bcutm_me_cache';

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

  function decodeJwt(token) {
    try {
      var parts = token.split('.');
      if (parts.length !== 3) return null;
      var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      var json = decodeURIComponent(
        atob(b64).split('').map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join('')
      );
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function readMeCache(userId) {
    if (!userId) return null;
    try {
      var raw = sessionStorage.getItem(ME_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.userId !== userId || !parsed.data) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function getHongKongHour() {
    try {
      var parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Hong_Kong',
        hour: 'numeric',
        hour12: false,
      }).formatToParts(new Date());
      var hourPart = parts.find(function (p) { return p.type === 'hour'; });
      if (hourPart) return parseInt(hourPart.value, 10);
    } catch (e) {}
    return new Date().getHours();
  }

  function greetingPrefix() {
    var h = getHongKongHour();
    return (h >= 6 && h < 18) ? '早上好' : '晚上好';
  }

  var token = getToken();
  if (!token) return;

  var payload = decodeJwt(token);
  if (!payload || !payload.sub) return;

  if (payload.exp && Date.now() > payload.exp * 1000) return;

  var cached = readMeCache(payload.sub);
  var name = String(
    (cached && cached.profile && cached.profile.display_name) ||
    (payload.user_metadata && payload.user_metadata.display_name) ||
    payload.email ||
    ''
  ).trim();
  if (!name) return;

  var el = document.getElementById('welcome-greeting');
  if (!el) return;

  var isPremium = !!(cached && cached.profile && cached.profile.subscription_tier === 'premium');
  el.textContent = greetingPrefix() + '。 ' + name + (isPremium ? '' : ' 🌙');
  el.hidden = false;

  var topBar = document.querySelector('.mode-top-bar--index');
  if (topBar) topBar.classList.add('mode-top-bar--greeting');
})();
