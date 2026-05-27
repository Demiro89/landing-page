import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy (equivalent to middleware in this Next.js version).
 *
 * 1. Admin route protection — unauthenticated requests to /admin/* are
 *    redirected to /admin/login before any JS is served.
 *
 * 2. CSRF protection — mutating requests to /api/* must originate from
 *    the same host. Stripe webhooks are exempt (signed separately).
 */

const ADMIN_COOKIE = 'ADMIN_SECRET_TOKEN';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT = ['/api/stripe/webhook'];

function forbidden() {
  return NextResponse.json(
    { error: 'Requête bloquée : origine non autorisée.' },
    { status: 403 }
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* ── Admin route protection ── */
  if (pathname.startsWith('/admin')) {
    // The login page itself must be reachable without a cookie
    if (!pathname.startsWith('/admin/login')) {
      const token = request.cookies.get(ADMIN_COOKIE)?.value;
      const expected = process.env.ADMIN_SECRET_TOKEN;
      if (!expected || !token || token !== expected) {
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }
    }
    return NextResponse.next();
  }

  /* ── CSRF protection for API routes ── */
  if (SAFE_METHODS.has(request.method)) return NextResponse.next();
  if (CSRF_EXEMPT.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const host = request.headers.get('host');
  const source = request.headers.get('origin') || request.headers.get('referer');

  if (source && host) {
    let sourceHost: string;
    try {
      sourceHost = new URL(source).host;
    } catch {
      return forbidden();
    }
    if (sourceHost !== host) return forbidden();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};
