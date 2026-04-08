/**
 * Middleware Next.js — Protection de la section /admin
 *
 * Toute requête vers /admin/* (sauf /admin/login) vérifie la présence
 * du cookie sm_admin_auth dont la valeur doit correspondre à ADMIN_SECRET_TOKEN.
 * Si absent ou invalide → redirection vers /admin/login.
 */

import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Laisser passer la page de login et les assets
  if (
    pathname.startsWith('/admin/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin')) {
    const cookie = req.cookies.get('sm_admin_auth');
    const expected = process.env.ADMIN_SECRET_TOKEN;

    if (!expected || !cookie || cookie.value !== expected) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
