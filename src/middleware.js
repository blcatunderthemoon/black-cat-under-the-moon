/**
 * Next.js Edge Middleware — Dashboard API first gate
 *
 * Defense-in-depth only. Every /api/dashboard/* handler MUST also call
 * authorizeDashboardAccess / authorizeStationOrForumAdmin / checkDashboardAuth.
 *
 * Auth paths:
 *   1. /api/dashboard/ping — always pass (key probe)
 *   2. Valid x-dashboard-key when DASHBOARD_SECRET is set — pass
 *   3. Authorization Bearer present — pass to Node (handler verifies JWT + forum admin)
 *   4. No secret configured — pass to Node (handlers fail-closed in production)
 *   5. Secret set, no valid key, no Bearer — 401
 *
 * IMPORTANT: A Bearer header alone is NOT proof of admin. Fake Bearer must be
 * rejected in the handler via resolveModerationActor / requireUser.
 */

import { NextResponse } from 'next/server';
import { getDashboardSecret } from './lib/dashboard-secret.js';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname === '/api/dashboard/ping') {
    return NextResponse.next();
  }

  const bearer = request.headers.get('authorization');
  if (bearer?.startsWith('Bearer ')) {
    // Handler must verify JWT + forum_role === admin.
    return NextResponse.next();
  }

  const secret = getDashboardSecret();

  if (!secret) {
    // Dev bypass / production forum-admin-only: handlers own fail-closed.
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
