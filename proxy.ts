import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminToken } from './lib/revocableAdminSession';
import { verifySiteAccessToken, SITE_ACCESS_COOKIE } from './lib/siteAccess';

const ADMIN_COOKIE = 'ADMIN_SECRET_TOKEN';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT = ['/api/stripe/webhook'];
// These endpoints authenticate the provider themselves, without browser cookies.
const GATE_EXEMPT = new Set(['/api/stripe/webhook', '/api/cron/cleanup', '/api/cron/deliveries']);
const PUBLIC_LEGAL_PATHS = new Set(['/cgv', '/mentions-legales', '/politique-confidentialite', '/cookies', '/reclamation', '/mediation', '/non-affiliation', '/retractation', '/remboursements', '/api/retractation']);

function forbidden() {
  return NextResponse.json(
    { error: 'Requête bloquée : origine non autorisée.' },
    { status: 403 }
  );
}

function withCsp(request: NextRequest, earlyResponse?: NextResponse): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isProd = process.env.NODE_ENV === 'production';

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https:${isProd ? '' : " 'unsafe-eval'"}`,
    // 'unsafe-inline' est requis pour style-src : l'app utilise ~550 attributs JSX
    // style={{…}} qui génèrent des attributs HTML style="" — les nonces CSP ne
    // couvrent que les balises <style>/<script>, pas les attributs. Le retirer
    // casserait toute l'interface. Aucun impact XSS direct (pas d'exécution de JS).
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' https://api.stripe.com https://api.coingecko.com${isProd ? '' : ' ws:'}`,
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "worker-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProd ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = earlyResponse ?? NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  if (earlyResponse || request.nextUrl.pathname.startsWith('/commande/') || request.nextUrl.pathname.startsWith('/api/') ||
      ['token', 'reset', 'resetToken', 'session_id'].some(key => request.nextUrl.searchParams.has(key))) {
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Cache-Control', 'private, no-store');
  }
  if (request.nextUrl.pathname.startsWith('/api/') || request.nextUrl.pathname.startsWith('/facture/') || request.nextUrl.pathname.startsWith('/admin')) {
    response.headers.set('Cache-Control', 'private, no-store');
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* ── Porte d'accès au site (mode « accès restreint ») ──
   * Active uniquement si SITE_ACCESS_CODE est défini. Tant que le visiteur n'a
   * pas saisi le bon code (cookie SITE_ACCESS valide), tout est redirigé vers
   * /acces. La page /acces et son API /api/acces restent toujours joignables. */
  if (process.env.SITE_ACCESS_CODE) {
    const isGatePath = pathname === '/acces' || pathname === '/api/acces' || GATE_EXEMPT.has(pathname) || PUBLIC_LEGAL_PATHS.has(pathname) || pathname.startsWith('/cgv/versions/');
    const hasAccess = verifySiteAccessToken(request.cookies.get(SITE_ACCESS_COOKIE)?.value);

    if (!isGatePath && !hasAccess) {
      // Les appels API renvoient un 403 JSON ; les pages sont redirigées vers /acces.
      if (pathname.startsWith('/api')) {
        return withCsp(request, NextResponse.json({ error: 'Accès restreint.' }, { status: 403 }));
      }
      return withCsp(request, NextResponse.redirect(new URL('/acces', request.url)));
    }

    // Déjà autorisé mais encore sur la page d'accès → renvoyer à l'accueil.
    if (pathname === '/acces' && hasAccess) {
      return withCsp(request, NextResponse.redirect(new URL('/', request.url)));
    }
  }

  /* ── Admin route protection ── */
  if (pathname.startsWith('/admin')) {
    if (pathname !== '/admin/login') {
      const token = request.cookies.get(ADMIN_COOKIE)?.value;
      if (!(await authenticateAdminToken(token))) {
        return withCsp(request, NextResponse.redirect(new URL('/admin/login', request.url)));
      }
    }
    // Admin pages continue to withCsp below
  }

  /* ── CSRF protection for mutating API requests ── */
  if (pathname.startsWith('/api') && !SAFE_METHODS.has(request.method)) {
    if (!CSRF_EXEMPT.includes(pathname)) {
      const source = request.headers.get('origin') || request.headers.get('referer');

      // Fail-closed: mutating requests without a verifiable origin are rejected.
      if (!source) return withCsp(request, forbidden());

      let sourceOrigin: string;
      try {
        sourceOrigin = new URL(source).origin;
      } catch {
        return withCsp(request, forbidden());
      }
      if (sourceOrigin !== request.nextUrl.origin) return withCsp(request, forbidden());
    }
  }

  return withCsp(request);
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf les assets statiques. On NE saute PAS les requêtes
     * de prefetch (next-router-prefetch / Purpose: prefetch) : le proxy assure
     * la sécurité (porte d'accès, protection admin, CSRF) et doit s'exécuter sur
     * toutes les requêtes, sinon un client peut contourner ces gardes en
     * ajoutant simplement un en-tête de prefetch.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
