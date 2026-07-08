/**
 * Local dashboard (localhost) vs production dashboard (admin account required).
 */

export function isLocalDashboardHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export function isLocalDashboardClient() {
  if (typeof window === 'undefined') return false;
  return isLocalDashboardHost(window.location.hostname);
}
