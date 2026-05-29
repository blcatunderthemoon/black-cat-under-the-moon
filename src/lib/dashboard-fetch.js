/**
 * Dashboard authenticated fetch utility.
 *
 * Reads the session key from sessionStorage and adds it to every request.
 * The server-side middleware checks this against DASHBOARD_SECRET.
 */

export function dashFetch(url, opts = {}) {
  const key =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('dashKey') || ''
      : '';
  return fetch(url, {
    ...opts,
    headers: {
      'x-dashboard-key': key,
      ...(opts.headers || {}),
    },
  });
}
