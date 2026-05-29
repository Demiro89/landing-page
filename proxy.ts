import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSessionToken } from './lib/adminSession';

const ADMIN_COOKIE = 'ADMIN_SECRET_TOKEN';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT = ['/api/stripe/webhook'];

function forbidden() {
  return NextResponse.json(
    { error: 'Requête bloquée : origine non autorisée.' },
    { status: 403 }
  );
}

function withCsp(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isProd = process.env.NODE_ENV === 'production';

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https:${isProd ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' https://api.stripe.com${isProd ? '' : ' ws:'}`,
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProd ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* ── Admin route protection ── */
  if (pathname.startsWith('/admin')) {
    if (!pathname.startsWith('/admin/login')) {
      const token = request.cookies.get(ADMIN_COOKIE)?.value;
      if (!verifyAdminSessionToken(token)) {
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }
    }
    // Admin pages continue to withCsp below
  }

  /* ── CSRF protection for mutating API requests ── */
  if (pathname.startsWith('/api') && !SAFE_METHODS.has(request.method)) {
    if (!CSRF_EXEMPT.some((p) => pathname.startsWith(p))) {
      const host = request.headers.get('host');
      const source = request.headers.get('origin') || request.headers.get('referer');

      // Fail-closed: mutating requests without a verifiable origin are rejected.
      if (!host || !source) return forbidden();

      let sourceHost: string;
      try {
        sourceHost = new URL(source).host;
      } catch {
        return forbidden();
      }
      if (sourceHost !== host) return forbidden();
    }
  }

  return withCsp(request);
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
