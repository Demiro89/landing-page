import { NextRequest, NextResponse } from 'next/server';

// ── Rate limiter in-memory (Edge Runtime) ────────────────────────────────────
// Fonctionnel sur une seule instance Edge — suffit pour protéger contre les
// attaques par force brute sur un petit site. Pour du multi-instance, utiliser
// Vercel KV ou Upstash Redis.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 min
const LOGIN_MAX = 10;

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const rec = loginAttempts.get(ip);

  if (!rec || now > rec.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return { allowed: true, remaining: LOGIN_MAX - 1 };
  }
  if (rec.count >= LOGIN_MAX) {
    return { allowed: false, remaining: 0 };
  }
  rec.count++;
  return { allowed: true, remaining: LOGIN_MAX - rec.count };
}

// ── Content Security Policy ──────────────────────────────────────────────────
// - next/font : polices auto-hébergées sur domaine Vercel → pas de CDN externe
// - Font Awesome : SVG bundlé → pas de CDN externe
// - Google Analytics : scripts autorisés explicitement
// - 'unsafe-inline' scripts : requis par Next.js 14 App Router (hydratation)
// - 'unsafe-inline' styles  : requis par les inline styles React
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com",
  "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://stats.g.doubleclick.net",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ');

const SECURITY_HEADERS: [string, string][] = [
  ['Content-Security-Policy', CSP_DIRECTIVES],
  ['X-Frame-Options', 'DENY'],
  ['X-Content-Type-Options', 'nosniff'],
  ['X-DNS-Prefetch-Control', 'on'],
  ['X-Permitted-Cross-Domain-Policies', 'none'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  [
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  ],
  // HSTS : 2 ans, sous-domaines inclus, eligible au preload
  ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'],
];

function applySecurityHeaders(res: NextResponse): NextResponse {
  for (const [key, value] of SECURITY_HEADERS) {
    res.headers.set(key, value);
  }
  return res;
}

// ── Middleware principal ──────────────────────────────────────────────────────
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Rate limiting sur la route de login admin
  if (pathname === '/api/admin/login' && req.method === 'POST') {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'unknown';
    const { allowed, remaining } = checkRateLimit(ip);

    if (!allowed) {
      const res = NextResponse.json(
        { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
        { status: 429 }
      );
      res.headers.set('Retry-After', '900');
      return applySecurityHeaders(res);
    }

    const res = NextResponse.next();
    res.headers.set('X-RateLimit-Limit', String(LOGIN_MAX));
    res.headers.set('X-RateLimit-Remaining', String(remaining));
    return applySecurityHeaders(res);
  }

  // 2. Protection de la zone /admin (sauf /admin/login)
  if (
    pathname.startsWith('/admin') &&
    !pathname.startsWith('/admin/login') &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/favicon')
  ) {
    const cookie = req.cookies.get('sm_admin_auth');
    const expected = process.env.ADMIN_SECRET_TOKEN;

    if (!expected || !cookie || cookie.value !== expected) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      return applySecurityHeaders(NextResponse.redirect(url));
    }
  }

  // 3. Appliquer les en-têtes de sécurité sur toutes les autres réponses
  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  // Exclure les fichiers statiques Next.js (inutile d'y appliquer le middleware)
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
