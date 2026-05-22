import { NextRequest, NextResponse } from 'next/server';

/**
 * Protection CSRF : sur toute requête mutante vers l'API, on vérifie que
 * l'en-tête Origin (ou Referer) correspond bien à l'hôte du site.
 * Un site tiers ne peut donc pas déclencher d'action authentifiée à l'insu
 * de l'utilisateur.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Routes appelées par des services externes (pas un navigateur) : exemptées.
// Le webhook Stripe est déjà protégé par la vérification de signature.
const CSRF_EXEMPT = ['/api/stripe/webhook'];

function forbidden() {
  return NextResponse.json(
    { error: 'Requête bloquée : origine non autorisée.' },
    { status: 403 }
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  // Ni Origin ni Referer (client non navigateur) : on laisse passer —
  // l'authentification propre à chaque route reste de toute façon exigée.

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
