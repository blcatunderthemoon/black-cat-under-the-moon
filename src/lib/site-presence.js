/**
 * Anonymous site-wide presence — DISABLED.
 *
 * Previously used Upstash sorted set heartbeats every ~25s per visitor,
 * which burned Redis command quota quickly. Kept as stubs so old clients
 * / imports do not crash.
 */

export function isSitePresenceEnabled() {
  return false;
}

export async function touchSitePresence() {
  return 0;
}

export async function getSitePresenceCount() {
  return 0;
}
