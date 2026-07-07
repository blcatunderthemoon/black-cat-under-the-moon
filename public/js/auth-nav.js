/**
 * public/js/auth-nav.js
 * Auth-aware nav for public static pages — cyberpunk flex badge.
 *
 * On questionnaire pages (match / mirror): injected into .progress-label header row.
 * On other pages: fixed top-right floating badge.
 */
(function () {
  'use strict';

  var NAV_ID = 'auth-nav-badge';
  var MOONLIGHT_PASSPORT_BRAND = 'Moonlight Passport';

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

  function getStorageKey() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) return k;
      }
    } catch (e) {}
    return null;
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var AUTH_NAV_CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff·]/u;

  function renderAuthNavNameHtml(text) {
    var raw = String(text || '');
    if (!raw) return '';
    return raw
      .split(/([\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff·]+)/u)
      .filter(Boolean)
      .map(function (part) {
        var cls = AUTH_NAV_CJK_RE.test(part) ? 'auth-nav-badge__zh' : 'auth-nav-badge__en';
        return '<span class="' + cls + '">' + escHtml(part) + '</span>';
      })
      .join('');
  }

  function setAuthNavName(el, text) {
    if (!el) return;
    el.innerHTML = renderAuthNavNameHtml(text);
  }

  function doLogout() {
    var sbKey = getStorageKey();
    if (sbKey) { try { localStorage.removeItem(sbKey); } catch (e) {} }
    clearMeCache();
    try { localStorage.removeItem('bcutm_mirror_card_cache'); } catch (e) {}
    window.location.href = 'index.html';
  }

  function getHeaderSlot() {
    return document.querySelector('.mode-top-bar__nav-slot')
      || document.querySelector('.progress-label');
  }

  function clearAuthNav() {
    var slot = getHeaderSlot();
    if (slot) {
      slot.querySelectorAll('#' + NAV_ID + ', .app-header-logout-btn, .auth-nav-badge__item--logout').forEach(function (el) {
        el.remove();
      });
      return;
    }
    var el = document.getElementById(NAV_ID);
    if (el) el.remove();
  }

  function shellStart() {
    return '<div class="auth-nav-badge__inner">';
  }

  function shellEnd() {
    return '</div>';
  }

  function sep() {
    return '<span class="auth-nav-badge__sep" aria-hidden="true"></span>';
  }

  function currentReturnPath() {
    var path = window.location.pathname || '';
    var search = window.location.search || '';
    if (!path || path === '/') return '/index.html';
    return path + search;
  }

  function loginHref() {
    return '/login?redirect=' + encodeURIComponent(currentReturnPath());
  }

  function signupHref() {
    return '/signup?redirect=' + encodeURIComponent(currentReturnPath());
  }

  function bindAuthNavClicks(wrap) {
    if (!wrap) return;
    wrap.querySelectorAll('a[href^="/login"], a[href^="/signup"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var href = link.getAttribute('href');
        if (href) window.location.href = href;
      });
    });
  }

  function injectNav(innerHtml, logoutCb) {
    unmountIndexGreetingFromNav();
    clearAuthNav();
    var slot = getHeaderSlot();
    var wrap = document.createElement('div');
    wrap.id = NAV_ID;
    wrap.className = slot ? 'auth-nav-badge auth-nav-badge--in-header' : 'auth-nav-badge';
    wrap.innerHTML = innerHtml;
    bindAuthNavClicks(wrap);
    if (slot) {
      if (logoutCb) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'auth-nav-badge__item auth-nav-badge__item--logout app-header-logout-btn';
        btn.textContent = '登出';
        btn.addEventListener('click', logoutCb);
        slot.appendChild(wrap);
        slot.appendChild(btn);
      } else {
        slot.appendChild(wrap);
      }
    } else {
      if (logoutCb) {
        var logoutBtn = document.createElement('button');
        logoutBtn.type = 'button';
        logoutBtn.className = 'auth-nav-badge__item auth-nav-badge__item--logout app-header-logout-btn';
        logoutBtn.textContent = '登出';
        logoutBtn.addEventListener('click', logoutCb);
        wrap.querySelector('.auth-nav-badge__inner').appendChild(logoutBtn);
      }
      document.body.appendChild(wrap);
    }
  }

  function inboxLinkHtml(unreadCount) {
    if (unreadCount > 0) {
      return '<a href="/inbox" class="auth-nav-badge__item auth-nav-badge__item--icon auth-nav-badge__item--inbox-unread" title="收件箱">' +
        '<span data-unread class="auth-nav-badge__unread">' + unreadCount + '</span>' +
      '</a>';
    }
    return '<a href="/inbox" class="auth-nav-badge__item auth-nav-badge__item--icon" title="收件箱">' +
      '<span class="auth-nav-badge__icon" aria-hidden="true">✉</span>' +
    '</a>';
  }

  var meCache = null;
  var activeUserId = null;

  var meCacheApi = window.BcutmMeCache || {};
  var ME_CACHE_KEY = meCacheApi.CACHE_KEY || 'bcutm_me_cache';
  var PROFILE_UPDATED_EVENT = meCacheApi.EVENT || 'bcutm:profile-updated';

  function readMeCache(userId) {
    if (meCacheApi.read) return meCacheApi.read(userId);
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

  function writeMeCache(userId, data) {
    if (meCacheApi.write) {
      meCacheApi.write(userId, data);
      return;
    }
    if (!userId || !data) return;
    try {
      sessionStorage.setItem(ME_CACHE_KEY, JSON.stringify({ v: 1, userId: userId, data: data, at: Date.now() }));
    } catch (e) {}
  }

  function clearMeCache() {
    if (meCacheApi.clear) {
      meCacheApi.clear();
      return;
    }
    try { sessionStorage.removeItem(ME_CACHE_KEY); } catch (e) {}
  }

  function applyMeData(data) {
    if (!data || !activeUserId) return;
    meCache = data;
    var serverName = data.profile && data.profile.display_name;
    showLoggedIn(
      serverName,
      data.unread_inbox_count || 0,
      !!(data.profile && data.profile.subscription_tier === 'premium'),
      data
    );
  }

  function bindProfileSync() {
    if (document.documentElement.dataset.authNavProfileSync) return;
    document.documentElement.dataset.authNavProfileSync = '1';

    window.addEventListener(PROFILE_UPDATED_EVENT, function (e) {
      var detail = e.detail || {};
      if (!detail.userId || detail.userId !== activeUserId || !detail.data) return;
      applyMeData(detail.data);
    });

    window.addEventListener('storage', function (e) {
      if (e.key !== ME_CACHE_KEY || !e.newValue || !activeUserId) return;
      try {
        var parsed = JSON.parse(e.newValue);
        if (parsed && parsed.userId === activeUserId && parsed.data) applyMeData(parsed.data);
      } catch (err) {}
    });
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

  function getWelcomeGreetingPrefix() {
    var h = getHongKongHour();
    if (h >= 6 && h < 18) return '早上好';
    return '晚上好';
  }

  function mountIndexGreetingInNav() {
    var greeting = document.getElementById('welcome-greeting');
    if (!greeting || greeting.hidden || !isIndexLandingPage()) return;
    var nav = document.getElementById(NAV_ID);
    if (!nav) return;
    var inner = nav.querySelector('.auth-nav-badge__inner');
    if (!inner) return;
    var nameGroup = inner.querySelector('.auth-nav-badge__name-group');
    if (nameGroup) {
      inner.insertBefore(greeting, nameGroup);
    } else {
      inner.insertBefore(greeting, inner.firstChild);
    }
    greeting.classList.add('welcome-greeting--in-nav');
  }

  function unmountIndexGreetingFromNav() {
    var greeting = document.getElementById('welcome-greeting');
    var headerEnd = document.querySelector('.mode-top-bar--index .mode-top-bar__header-end');
    var navSlot = document.querySelector('.mode-top-bar--index .mode-top-bar__nav-slot');
    if (!greeting || !headerEnd || !navSlot) return;
    if (greeting.parentNode !== headerEnd) {
      headerEnd.insertBefore(greeting, navSlot);
    }
    greeting.classList.remove('welcome-greeting--in-nav');
  }

  function syncGreetingTopBar(active) {
    var topBar = document.querySelector('.mode-top-bar--index');
    if (topBar) topBar.classList.toggle('mode-top-bar--greeting', !!active);
  }

  function fitWelcomeGreeting(el) {
    if (!el || el.hidden) return;
    el.style.fontSize = '';
    var size = parseFloat(window.getComputedStyle(el).fontSize);
    var min = 6;
    var guard = 0;
    while (el.scrollWidth > el.clientWidth && size > min && guard < 48) {
      size -= 0.5;
      el.style.fontSize = size + 'px';
      guard += 1;
    }
  }

  function updateWelcomeGreeting(displayName, isPremium) {
    var el = document.getElementById('welcome-greeting');
    if (!el) return;
    var name = String(displayName || '').trim();
    if (!name) {
      el.hidden = true;
      el.textContent = '';
      el.style.fontSize = '';
      syncGreetingTopBar(false);
      return;
    }
    var moonSuffix = isPremium ? '' : ' 🌙';
    el.textContent = getWelcomeGreetingPrefix() + '。 ' + name + moonSuffix;
    el.hidden = false;
    syncGreetingTopBar(true);
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { fitWelcomeGreeting(el); });
    });
  }

  function getPremiumStatusMessage(data) {
    if (!data || !data.profile || data.profile.subscription_tier !== 'premium') return null;
    var end = data.subscription && data.subscription.current_period_end;
    if (!end) return MOONLIGHT_PASSPORT_BRAND + ' 會籍長期有效';
    var diff = new Date(end).getTime() - Date.now();
    if (diff <= 0) return MOONLIGHT_PASSPORT_BRAND + ' 會籍即將結束';
    var days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days === 1) return MOONLIGHT_PASSPORT_BRAND + ' 尚餘 1 日';
    return MOONLIGHT_PASSPORT_BRAND + ' 尚餘 ' + days + ' 日';
  }

  function getActiveLetterQuotaLine(data) {
    if (!data || !data.profile || data.profile.subscription_tier !== 'premium') return null;
    var q = data.active_letter_quota;
    if (!q) return null;
    return '本月剩餘主動投信：' + q.remaining + '/' + q.limit;
  }

  function buildPopoverInnerHtml(data) {
    var statusLine = getPremiumStatusMessage(data) || MOONLIGHT_PASSPORT_BRAND + ' 會籍有效';
    var quotaLine = getActiveLetterQuotaLine(data);
    var quotaHtml = quotaLine
      ? '<p class="premium-moon-popover__line premium-moon-popover__line--quota">' + escHtml(quotaLine) + '</p>'
      : '';
    return (
      '<p class="premium-moon-popover__line premium-moon-popover__line--status">' +
        '<span class="premium-moon-popover__glyph" aria-hidden="true">🌙</span> ' +
        escHtml(statusLine) +
      '</p>' +
      quotaHtml
    );
  }

  function premiumMoonHtml(data) {
    return (
      '<span class="header-premium-moon-wrap">' +
        '<button type="button" class="premium-moon-badge premium-moon-badge--interactive auth-nav-badge__moon" aria-label="' + MOONLIGHT_PASSPORT_BRAND + ' 狀態" title="' + MOONLIGHT_PASSPORT_BRAND + ' 狀態" aria-expanded="false">🌙</button>' +
        '<div class="premium-moon-popover" role="tooltip">' +
          buildPopoverInnerHtml(data || null) +
        '</div>' +
      '</span>'
    );
  }

  function computePremiumMoonPopoverPosition(badgeRect, popoverW, popoverH, preferAbove) {
    var gap = 6;
    var pad = 8;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var safeW = Math.min(popoverW, vw - pad * 2);
    var top = preferAbove ? badgeRect.top - popoverH - gap : badgeRect.bottom + gap;
    if (!preferAbove && top + popoverH > vh - pad) {
      var aboveTop = badgeRect.top - popoverH - gap;
      if (aboveTop >= pad) top = aboveTop;
    }
    top = Math.max(pad, Math.min(top, vh - popoverH - pad));
    var badgeCenter = badgeRect.left + badgeRect.width / 2;
    var left = badgeCenter < vw / 2 ? badgeRect.left : badgeRect.right - safeW;
    left = Math.max(pad, Math.min(left, vw - safeW - pad));
    return { top: top, left: left, width: safeW };
  }

  function attachPremiumMoonPopoverPortal(wrap, popover) {
    if (!wrap || !popover || popover.parentNode === document.body) return;
    popover._premiumMoonHome = wrap;
    document.body.appendChild(popover);
    popover.classList.add('premium-moon-popover--portal');
  }

  function detachPremiumMoonPopoverPortal(popover) {
    if (!popover) return;
    var home = popover._premiumMoonHome;
    popover.classList.remove('premium-moon-popover--portal');
    popover.style.position = '';
    popover.style.top = '';
    popover.style.right = '';
    popover.style.left = '';
    popover.style.width = '';
    popover.style.zIndex = '';
    if (home && popover.parentNode === document.body) {
      home.appendChild(popover);
    }
    popover._premiumMoonHome = null;
  }

  function closeAllPremiumMoonPopovers() {
    document.querySelectorAll('.header-premium-moon-wrap--open').forEach(function(wrap) {
      wrap.classList.remove('header-premium-moon-wrap--open');
      var btn = wrap.querySelector('.premium-moon-badge--interactive');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      var popover = document.querySelector('.premium-moon-popover--portal');
      if (popover && popover._premiumMoonHome === wrap) {
        detachPremiumMoonPopoverPortal(popover);
      }
    });
  }

  function getPremiumMoonPopover(wrap) {
    var inWrap = wrap.querySelector('.premium-moon-popover');
    if (inWrap) return inWrap;
    var portaled = document.querySelector('.premium-moon-popover--portal');
    if (portaled && portaled._premiumMoonHome === wrap) return portaled;
    return null;
  }

  function positionPremiumMoonPopover(wrap) {
    var badge = wrap.querySelector('.premium-moon-badge, .auth-nav-badge__moon');
    var popover = getPremiumMoonPopover(wrap);
    if (!badge || !popover) return;
    attachPremiumMoonPopoverPortal(wrap, popover);
    var rect = badge.getBoundingClientRect();
    var popoverW = popover.offsetWidth || 210;
    var popoverH = popover.offsetHeight || 72;
    var preferAbove = Boolean(wrap.closest('.auth-nav-badge--user-toolbar'));
    var pos = computePremiumMoonPopoverPosition(rect, popoverW, popoverH, preferAbove);
    popover.style.position = 'fixed';
    popover.style.top = pos.top + 'px';
    popover.style.left = pos.left + 'px';
    popover.style.width = pos.width + 'px';
    popover.style.right = 'auto';
    popover.style.zIndex = '10005';
  }

  function bindPremiumMoonInteractions() {
    if (document.documentElement.dataset.premiumMoonBound) return;
    /* Next.js pages use HeaderPremiumMoon React tap handler */
    if (document.getElementById('__next')) return;
    document.documentElement.dataset.premiumMoonBound = '1';

    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.header-premium-moon-wrap .premium-moon-badge--interactive');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        var wrap = btn.closest('.header-premium-moon-wrap');
        if (!wrap) return;
        var wasOpen = wrap.classList.contains('header-premium-moon-wrap--open');
        closeAllPremiumMoonPopovers();
        if (!wasOpen) {
          wrap.classList.add('header-premium-moon-wrap--open');
          btn.setAttribute('aria-expanded', 'true');
          positionPremiumMoonPopover(wrap);
          requestAnimationFrame(function() { positionPremiumMoonPopover(wrap); });
        }
        return;
      }
      if (!e.target.closest('.header-premium-moon-wrap')
        && !e.target.closest('.premium-moon-popover--portal')) {
        closeAllPremiumMoonPopovers();
      }
    }, true);

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeAllPremiumMoonPopovers();
    });

    window.addEventListener('resize', function() {
      document.querySelectorAll('.header-premium-moon-wrap--open').forEach(positionPremiumMoonPopover);
      var greeting = document.getElementById('welcome-greeting');
      if (greeting && !greeting.hidden) fitWelcomeGreeting(greeting);
    });
  }

  function updatePremiumMoonContent(data) {
    var popover = document.querySelector('#' + NAV_ID + ' .premium-moon-popover')
      || document.querySelector('.premium-moon-popover--portal');
    if (popover) popover.innerHTML = buildPopoverInnerHtml(data);
  }

  function ensurePremiumMoonButton(group, data) {
    if (!group) return null;
    var existingWrap = group.querySelector('.header-premium-moon-wrap');
    if (existingWrap) {
      updatePremiumMoonContent(data || meCache);
      return existingWrap.querySelector('.auth-nav-badge__moon');
    }
    group.insertAdjacentHTML('beforeend', premiumMoonHtml(data || meCache));
    return group.querySelector('.auth-nav-badge__moon');
  }

  function updatePremiumMoon(isPremium, data) {
    var el = document.getElementById(NAV_ID);
    if (!el) return;
    var group = el.querySelector('.auth-nav-badge__name-group');
    if (!group) return;
    if (isPremium) {
      ensurePremiumMoonButton(group, data);
    } else {
      var existing = group.querySelector('.header-premium-moon-wrap');
      if (existing) existing.remove();
    }
    if (isIndexLandingPage()) {
      var name = (data && data.profile && data.profile.display_name)
        || (meCache && meCache.profile && meCache.profile.display_name)
        || '';
      if (name) {
        updateWelcomeGreeting(name, isPremium);
        mountIndexGreetingInNav();
      }
    }
  }

  function isIndexLandingPage() {
    var path = window.location.pathname || '';
    return path === '/' || /index\.html$/i.test(path);
  }

  function showLoggedIn(displayName, unreadCount, isPremium, meData, options) {
    options = options || {};
    var profilePending = !!options.profilePending;
    var name = displayName || '貓咪';
    var moon = isPremium ? premiumMoonHtml(meData || meCache) : '';
    var hideNameOnIndex = isIndexLandingPage()
      && (profilePending || Boolean(String(displayName || '').trim()));
    var nameBlock = hideNameOnIndex
      ? (moon ? '<span class="auth-nav-badge__name-group">' + moon + '</span>' : '')
      : (
        '<span class="auth-nav-badge__name-group">' +
          '<a href="/mirror-card/me" class="auth-nav-badge__item auth-nav-badge__item--name" title="' + escHtml(name) + '">' + renderAuthNavNameHtml(name) + '</a>' +
          moon +
        '</span>'
      );
    var afterName = hideNameOnIndex && !moon ? '' : sep();
    var html =
      shellStart() +
      nameBlock +
      afterName +
      inboxLinkHtml(unreadCount) +
      sep() +
      '<a href="/account" class="auth-nav-badge__item auth-nav-badge__item--icon" title="設定">' +
        '<span class="auth-nav-badge__icon" aria-hidden="true">⚙</span>' +
      '</a>' +
      shellEnd();

    injectNav(html, doLogout);
    var greetingName = String(displayName || '').trim();
    if (greetingName) {
      updateWelcomeGreeting(greetingName, isPremium);
      mountIndexGreetingInNav();
    } else if (!profilePending) {
      updateWelcomeGreeting('', isPremium);
    }
  }

  function showLoggedOut() {
    unmountIndexGreetingFromNav();
    updateWelcomeGreeting('');
    var html =
      shellStart() +
      '<a href="' + loginHref() + '" class="auth-nav-badge__item auth-nav-badge__item--name">' + renderAuthNavNameHtml('登入') + '</a>' +
      sep() +
      '<a href="' + signupHref() + '" class="auth-nav-badge__item auth-nav-badge__item--signup">註冊</a>' +
      shellEnd();

    injectNav(html, null);
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
    } catch (e) { return null; }
  }

  function updateUnread(count) {
    var el = document.getElementById(NAV_ID);
    if (!el) return;
    var inbox = el.querySelector('a[href="/inbox"]');
    if (!inbox) return;
    if (count > 0) {
      inbox.className = 'auth-nav-badge__item auth-nav-badge__item--icon auth-nav-badge__item--inbox-unread';
      inbox.title = '收件箱';
      inbox.innerHTML = '<span data-unread class="auth-nav-badge__unread">' + count + '</span>';
    } else {
      inbox.className = 'auth-nav-badge__item auth-nav-badge__item--icon';
      inbox.title = '收件箱';
      inbox.innerHTML = '<span class="auth-nav-badge__icon" aria-hidden="true">✉</span>';
    }
  }

  function init() {
    bindPremiumMoonInteractions();
    bindProfileSync();
    if (document.body.hasAttribute('data-no-auth-nav')) return;
    var loggedInOnly = document.body.hasAttribute('data-auth-nav-logged-in-only');

    var token = getToken();
    if (!token) {
      if (!loggedInOnly) showLoggedOut();
      return;
    }

    var payload = decodeJwt(token);
    var immediateExpiry = payload && payload.exp ? payload.exp * 1000 : 0;
    if (immediateExpiry && Date.now() > immediateExpiry) {
      var sbKey = getStorageKey();
      if (sbKey) { try { localStorage.removeItem(sbKey); } catch (e) {} }
      if (!loggedInOnly) showLoggedOut();
      return;
    }
    var immediateName = (payload && (
      (payload.user_metadata && payload.user_metadata.display_name) ||
      payload.email
    )) || null;
    var userId = payload && payload.sub;
    activeUserId = userId;
    var cached = userId ? readMeCache(userId) : null;
    if (cached) meCache = cached;
    var cachedName = cached && cached.profile && cached.profile.display_name;
    var isPremium = !!(cached && cached.profile && cached.profile.subscription_tier === 'premium');
    var unread = (cached && cached.unread_inbox_count) || 0;
    showLoggedIn(cachedName || immediateName, unread, isPremium, cached, { profilePending: !cached });

    if (meCacheApi.isFresh && meCacheApi.isFresh(userId)) return;

    fetch('/api/me', {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
    })
      .then(function (r) {
        if (r.status === 401) {
          var sbKey = getStorageKey();
          if (sbKey) { try { localStorage.removeItem(sbKey); } catch (e) {} }
          clearMeCache();
          clearAuthNav();
          if (!loggedInOnly) showLoggedOut();
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (!data) {
          showLoggedIn(immediateName, unread, isPremium, cached);
          return;
        }
        meCache = data;
        if (userId) writeMeCache(userId, data);
        var serverName = data.profile && data.profile.display_name;
        showLoggedIn(
          serverName || immediateName,
          data.unread_inbox_count || 0,
          !!(data.profile && data.profile.subscription_tier === 'premium'),
          data
        );
      })
      .catch(function () {
        showLoggedIn(immediateName, unread, isPremium, cached);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
