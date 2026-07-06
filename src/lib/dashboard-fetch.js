/**
 * Client-side fetch helper for station dashboard (x-dashboard-key from sessionStorage).
 */

export function getDashboardKey() {
  if (typeof sessionStorage === 'undefined') return '';
  return sessionStorage.getItem('dashKey') || '';
}

export function dashboardHeaders(extra = {}) {
  const key = getDashboardKey();
  return {
    ...extra,
    ...(key ? { 'x-dashboard-key': key } : {}),
  };
}

export async function dashboardFetch(url, options = {}) {
  const headers = dashboardHeaders(options.headers || {});
  return fetch(url, { ...options, headers });
}

/** @deprecated Use dashboardFetch */
export const dashFetch = dashboardFetch;

export function handleDashboardUnauthorized() {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('dashKey');
  }
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}
