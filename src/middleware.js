/**
 * Next.js Edge Middleware — Dashboard API authentication
 *
 * Protects all /api/dashboard/* routes.
 *
 * Auth paths (first match wins):
 *   1. Bearer — production forum-admin session (API verifies role)
 *   2. x-dashboard-key — when DASHBOARD_SECRET / DASHBOARD_PASSWORD is set
 *   3. No secret — pass through; Node API handlers enforce (dev bypass / 503 / Bearer)
 *
 * Note: Edge middleware may not see the same env as Node API routes after a
 * stale `next build`. Do not fail-closed here when the secret is missing —
 * `checkDashboardAuth` / `authorizeStationOrForumAdmin` own that decision.
 */

import { NextResponse } from 'next/server';
import { getDashboardSecret } from './lib/dashboard-secret.js';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow key verification before the client has a stored key
  if (pathname === '/api/dashboard/ping') {
    return NextResponse.next();
  }

  // Production dashboard uses forum admin Bearer; never block on missing secret.
  const bearer = request.headers.get('authorization');
  if (bearer?.startsWith('Bearer ')) {
    return NextResponse.next();
  }

  const secret = getDashboardSecret();

  // No station key configured — let API routes decide.
  if (!secret) {
    return NextResponse.next();
  }

  const provided = request.headers.get('x-dashboard-key');
  if (!provided || provided !== secret) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorised.' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/dashboard/:path*',
};
