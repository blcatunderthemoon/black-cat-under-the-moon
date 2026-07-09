/**
 * Resolve dashboard key from env (canonical + legacy alias).
 */
export function getDashboardSecret() {
  return (process.env.DASHBOARD_SECRET || process.env.DASHBOARD_PASSWORD || '').trim();
}
