/**
 * Canonical public site URL for static pages (match / mirror questionnaires).
 * QR codes and card footers read this when window.location is localhost.
 */
(function initSiteConfig(global) {
  var origin = 'https://www.blackcatunderthemoon.com';
  var host = 'www.blackcatunderthemoon.com';

  if (typeof global.location === 'object' && global.location.origin) {
    var pageHost = global.location.hostname || '';
    if (pageHost && pageHost !== 'localhost' && pageHost !== '127.0.0.1') {
      origin = global.location.origin;
      host = global.location.host || pageHost;
    }
  }

  global.BCUTM_SITE = {
    origin: origin,
    host: host,
  };
})(typeof window !== 'undefined' ? window : globalThis);
