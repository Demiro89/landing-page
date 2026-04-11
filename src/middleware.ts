/**
 * Middleware Next.js
 *
 * 1. /admin/* (sauf /admin/login) → vérifie le cookie sm_admin_auth
 * 2. Tout le reste           → si BETA_PASSWORD est défini dans l'env,
 *    vérifie le cookie sm_beta_access=1 (posé par /api/beta/verify).
 *    Sans cookie valide → redirect vers /beta-access.
 *    /beta-access et /api/* sont toujours laissés passer.
 */

import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Toujours laisser passer : Next internals, assets, API routes ──
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/')
  ) {
    return NextResponse.next();
  }

  // ── Protection admin (système existant) ──
  if (pathname.startsWith('/admin')) {
    if (pathname.startsWith('/admin/login')) return NextResponse.next();
    const cookie = req.cookies.get('sm_admin_auth');
    const expected = process.env.ADMIN_SECRET_TOKEN;
    if (!expected || !cookie || cookie.value !== expected) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── Barrière Bêta ──
  // Activer uniquement si BETA_PASSWORD est défini dans les variables d'env.
  const betaPassword = process.env.BETA_PASSWORD;
  if (betaPassword) {
    // La page d'accès bêta est toujours accessible (sinon boucle infinie)
    if (pathname.startsWith('/beta-access')) return NextResponse.next();

    const betaCookie = req.cookies.get('sm_beta_access');
    if (betaCookie?.value !== '1') {
      const url = req.nextUrl.clone();
      url.pathname = '/beta-access';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Intercepter toutes les routes sauf _next/static, _next/image et les
  // fichiers statiques à la racine (images, robots.txt, sitemap.xml…)
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)'],
};
