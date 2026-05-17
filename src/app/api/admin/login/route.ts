/**
 * POST /api/admin/login  — vérifie ADMIN_PASSWORD, pose le cookie d'auth
 * DELETE /api/admin/login — efface le cookie (logout)
 */

import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'sm_admin_auth';
const COOKIE_OPTIONS = {
  // TODO: migrer les routes /api/admin/* pour lire le cookie server-side
  // afin de pouvoir passer httpOnly: true ici
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 8, // 8 heures (réduit depuis 7 jours)
  path: '/',
};

// Comparaison en temps constant pour éviter les timing attacks
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { password } = body as { password?: string };

  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminToken = process.env.ADMIN_SECRET_TOKEN;

  if (!adminPassword) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD non configuré.' }, { status: 500 });
  }
  if (!adminToken) {
    return NextResponse.json({ error: 'ADMIN_SECRET_TOKEN non configuré.' }, { status: 500 });
  }

  // Délai fixe + comparaison temps constant = protection timing attack + brute-force
  await new Promise((r) => setTimeout(r, 300));

  if (!password || !safeCompare(password, adminPassword)) {
    return NextResponse.json({ error: 'Mot de passe incorrect.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, adminToken, COOKIE_OPTIONS);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
