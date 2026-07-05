/**
 * Next.js Edge Middleware — Dashboard API authentication
 *
 * Protects all /api/dashboard/* routes.
 *
 * Setup:
 *   1. Set DASHBOARD_SECRET in Vercel environment variables (any strong random string).
 *   2. Each dashboard page/client must send header: x-dashboard-key: <DASHBOARD_SECRET>
 *
 * Local dev: if DASHBOARD_SECRET is not set, all requests pass through.
 * Production: returns 503 when DASHBOARD_SECRET is missing.
 */

import { NextResponse } from 'next/server';

function isProduction() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow key verification before the client has a stored key
  if (pathname === '/api/dashboard/ping') {
    return NextResponse.next();
  }

  const secret = process.env.DASHBOARD_SECRET;

  if (!secret) {
    if (isProduction()) {
      return new NextResponse(JSON.stringify({
        error: 'Dashboard authentication is not configured',
        code: 'DASHBOARD_SECRET_MISSING',
      }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    }
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
