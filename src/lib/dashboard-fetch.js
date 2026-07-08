/**
 * Client-side fetch helper for station dashboard.
 * Localhost: x-dashboard-key from sessionStorage.
 * Production: Bearer token (forum admin session).
 */

import { isLocalDashboardClient } from './dashboard-access.js';

let bearerToken = '';

export function setDashboardBearerToken(token) {
  bearerToken = token || '';
}

export function getDashboardKey() {
  if (typeof sessionStorage === 'undefined') return '';
  return sessionStorage.getItem('dashKey') || '';
}

export function dashboardHeaders(extra = {}) {
  if (isLocalDashboardClient()) {
    const key = getDashboardKey();
    return {
      ...extra,
      ...(key ? { 'x-dashboard-key': key } : {}),
    };
  }

  return {
    ...extra,
    ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
  };
}

export async function dashboardFetch(url, options = {}) {
  const headers = dashboardHeaders(options.headers || {});
  return fetch(url, { ...options, headers });
}

/** @deprecated Use dashboardFetch */
export const dashFetch = dashboardFetch;

export function handleDashboardUnauthorized() {
  if (typeof window !== 'undefined' && !isLocalDashboardClient()) {
    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return;
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('dashKey');
  }
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}
