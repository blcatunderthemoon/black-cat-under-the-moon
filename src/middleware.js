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
 */

import { NextResponse } from 'next/server';

export function middleware(request) {
  const secret = process.env.DASHBOARD_SECRET;

  // Bypass in development when the env var is not configured
  if (!secret) return NextResponse.next();

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
