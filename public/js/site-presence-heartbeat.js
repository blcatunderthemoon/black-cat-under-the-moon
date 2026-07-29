/**
 * Site-wide presence heartbeat — DISABLED (was burning Upstash Redis quota).
 * Kept as a no-op stub so cached script tags do nothing harmful.
 */
(function initSitePresenceHeartbeat(global) {
  if (global.__BCUTM_SITE_PRESENCE_HEARTBEAT) return;
  global.__BCUTM_SITE_PRESENCE_HEARTBEAT = true;
})(typeof window !== 'undefined' ? window : globalThis);
