/**
 * Browser helper for static HTML pages — keep in sync with src/lib/posthog-page-context.js
 */
(function initPostHogPageContext(global) {
  var STATIC_PAGE_KEYS = {
    '/': 'home',
    '/index.html': 'home',
    '/echo.html': 'echo',
    '/mirror.html': 'mirror',
    '/drift-bottle.html': 'drift_bottle',
    '/forum.html': 'forum',
    '/about.html': 'about',
    '/contact.html': 'contact',
    '/privacy.html': 'privacy',
    '/tos.html': 'tos',
    '/refund.html': 'refund',
    '/match.html': 'match',
    '/inbox.html': 'inbox',
  };

  var PAGE_META = {
    home: { page_name: 'Home', page_group: 'marketing' },
    echo: { page_name: 'Echo Questionnaire', page_group: 'echo' },
    mirror: { page_name: 'Mirror Questionnaire', page_group: 'mirror' },
    drift_bottle: { page_name: 'Drift Bottle', page_group: 'drift_bottle' },
    forum: { page_name: 'Forum', page_group: 'forum' },
    forum_post: { page_name: 'Forum Post', page_group: 'forum' },
    forum_guardian: { page_name: 'Forum Guardian', page_group: 'forum_admin' },
    about: { page_name: 'About', page_group: 'marketing' },
    contact: { page_name: 'Contact', page_group: 'marketing' },
    privacy: { page_name: 'Privacy Policy', page_group: 'legal' },
    tos: { page_name: 'Terms of Service', page_group: 'legal' },
    refund: { page_name: 'Refund Policy', page_group: 'legal' },
    match: { page_name: 'Match (legacy)', page_group: 'echo' },
    inbox: { page_name: 'Inbox', page_group: 'inbox' },
    inbox_thread: { page_name: 'Inbox Thread', page_group: 'inbox' },
    matches: { page_name: 'Matches', page_group: 'matches' },
    mirror_card: { page_name: 'Mirror Card', page_group: 'mirror' },
    mirror_card_me: { page_name: 'My Mirror Card', page_group: 'mirror' },
    moon_journey: { page_name: 'Moon Journey', page_group: 'forum' },
    cat_families: { page_name: 'Cat Families', page_group: 'marketing' },
    premium: { page_name: 'Premium', page_group: 'billing' },
    account: { page_name: 'Account', page_group: 'account' },
    exchange_photo: { page_name: 'Photo Exchange', page_group: 'inbox' },
    billing_success: { page_name: 'Billing Success', page_group: 'billing' },
    login: { page_name: 'Login', page_group: 'auth' },
    signup: { page_name: 'Sign Up', page_group: 'auth' },
    forgot_password: { page_name: 'Forgot Password', page_group: 'auth' },
    auth_confirm: { page_name: 'Email Confirm', page_group: 'auth' },
    auth_reset: { page_name: 'Reset Password', page_group: 'auth' },
    wishes: { page_name: 'Wishes Wall', page_group: 'wishes' },
    wishes_my: { page_name: 'My Wishes', page_group: 'wishes' },
    wishes_new: { page_name: 'New Wish', page_group: 'wishes' },
    wish_detail: { page_name: 'Wish Detail', page_group: 'wishes' },
    gatherings: { page_name: 'Gatherings', page_group: 'gatherings' },
    gatherings_my: { page_name: 'My Gatherings', page_group: 'gatherings' },
    gatherings_new: { page_name: 'New Gathering', page_group: 'gatherings' },
    gathering_detail: { page_name: 'Gathering Detail', page_group: 'gatherings' },
    moonlight_interest: { page_name: 'Moonlight Interest', page_group: 'marketing' },
    my_cat: { page_name: 'My Cat', page_group: 'my_cat' },
    my_cat_guide: { page_name: 'My Cat Guide', page_group: 'my_cat' },
    guides: { page_name: 'Guides', page_group: 'guides' },
    guide_article: { page_name: 'Guide Article', page_group: 'guides' },
    dashboard: { page_name: 'Dashboard', page_group: 'admin' },
    admin: { page_name: 'Admin', page_group: 'admin' },
    admin_moonlight_interest: { page_name: 'Admin Moonlight Interest', page_group: 'forum_admin' },
    other: { page_name: 'Other', page_group: 'other' },
  };

  var ROUTE_RULES = [
    { test: /^\/forum\/guardian/, key: 'forum_guardian' },
    { test: /^\/forum\/[^/]+/, key: 'forum_post' },
    { test: /^\/forum\/?$/, key: 'forum' },
    { test: /^\/inbox\/[^/]+/, key: 'inbox_thread' },
    { test: /^\/inbox\/?$/, key: 'inbox' },
    { test: /^\/mirror-card\/me\/?$/, key: 'mirror_card_me' },
    { test: /^\/mirror-card\/[^/]+/, key: 'mirror_card' },
    { test: /^\/matches\/?$/, key: 'matches' },
    { test: /^\/moon-journey\/?$/, key: 'moon_journey' },
    { test: /^\/cat-families\/?$/, key: 'cat_families' },
    { test: /^\/wishes\/new\/?$/, key: 'wishes_new' },
    { test: /^\/wishes\/my\/?$/, key: 'wishes_my' },
    { test: /^\/wishes\/[^/]+/, key: 'wish_detail' },
    { test: /^\/wishes\/?$/, key: 'wishes' },
    { test: /^\/gatherings\/new\/?$/, key: 'gatherings_new' },
    { test: /^\/gatherings\/my\/?$/, key: 'gatherings_my' },
    { test: /^\/gatherings\/[^/]+/, key: 'gathering_detail' },
    { test: /^\/gatherings\/?$/, key: 'gatherings' },
    { test: /^\/moonlight-interest\/?$/, key: 'moonlight_interest' },
    { test: /^\/my-cat\/guide\/?$/, key: 'my_cat_guide' },
    { test: /^\/my-cat\/?$/, key: 'my_cat' },
    { test: /^\/guides\/[^/]+/, key: 'guide_article' },
    { test: /^\/guides\/?$/, key: 'guides' },
    { test: /^\/premium\/?$/, key: 'premium' },
    { test: /^\/account\/?$/, key: 'account' },
    { test: /^\/exchange-photo\/?$/, key: 'exchange_photo' },
    { test: /^\/billing\/success\/?$/, key: 'billing_success' },
    { test: /^\/login\/?$/, key: 'login' },
    { test: /^\/signup\/?$/, key: 'signup' },
    { test: /^\/forgot-password\/?$/, key: 'forgot_password' },
    { test: /^\/auth\/confirm\/?$/, key: 'auth_confirm' },
    { test: /^\/auth\/reset-password\/?$/, key: 'auth_reset' },
    { test: /^\/dashboard/, key: 'dashboard' },
    { test: /^\/admin\/moonlight-interest\/?$/, key: 'admin_moonlight_interest' },
    { test: /^\/admin/, key: 'admin' },
  ];

  function normalizePath(pathname) {
    var raw = String(pathname || '/').split('?')[0].split('#')[0] || '/';
    if (raw.length > 1 && raw.charAt(raw.length - 1) === '/') return raw.slice(0, -1);
    return raw || '/';
  }

  function resolvePageKey(pathname, explicitPageKey) {
    if (explicitPageKey) return explicitPageKey;
    var path = normalizePath(pathname);
    if (STATIC_PAGE_KEYS[path]) return STATIC_PAGE_KEYS[path];
    for (var i = 0; i < ROUTE_RULES.length; i++) {
      if (ROUTE_RULES[i].test.test(path)) return ROUTE_RULES[i].key;
    }
    return 'other';
  }

  global.__BCUTM_resolvePageContext = function resolvePageContext(pathname, opts) {
    opts = opts || {};
    var path = normalizePath(pathname);
    var surface = opts.surface || 'unknown';
    var pageKey = resolvePageKey(path, opts.pageKey);
    var meta = PAGE_META[pageKey] || PAGE_META.other;
    return {
      path: path,
      surface: surface,
      page_key: pageKey,
      page_name: meta.page_name,
      page_group: meta.page_group,
    };
  };

  global.__BCUTM_pageviewEventProperties = function pageviewEventProperties(pathname, opts) {
    var ctx = global.__BCUTM_resolvePageContext(pathname, opts);
    var currentUrl;
    try {
      if (global.location) {
        var u = new URL(global.location.href);
        var secretKeys = [
          'token_hash', 'token', 'code', 'access_token', 'refresh_token',
          'provider_token', 'provider_refresh_token', 'confirmation_url',
        ];
        for (var i = 0; i < secretKeys.length; i++) u.searchParams.delete(secretKeys[i]);
        if (u.hash && /access_token|refresh_token|token_hash|provider_token/i.test(u.hash)) {
          u.hash = '';
        }
        currentUrl = u.origin + u.pathname + u.search + u.hash;
      }
    } catch (e) {
      currentUrl = global.location ? (global.location.origin + (ctx.path || '/')) : undefined;
    }
    return {
      $current_url: currentUrl,
      path: ctx.path,
      surface: ctx.surface,
      page_key: ctx.page_key,
      page_name: ctx.page_name,
      page_group: ctx.page_group,
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
