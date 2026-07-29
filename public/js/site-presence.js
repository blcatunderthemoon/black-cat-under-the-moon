/**
 * Index landing presence counter — DISABLED (Upstash quota).
 * Kept as a no-op stub so cached script tags do nothing.
 */
(function initSitePresence(global) {
  if (global.__BCUTM_SITE_PRESENCE) return;
  global.__BCUTM_SITE_PRESENCE = true;
})(typeof window !== 'undefined' ? window : globalThis);
