/**
 * POST /api/admin/login  — vérifie ADMIN_PASSWORD, pose le cookie d'auth
 * DELETE /api/admin/login — efface le cookie (logout)
 */

import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'sm_admin_auth';
const COOKIE_OPTIONS = {
  httpOnly: false,          // doit être lisible par le JS de la page admin
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 24 * 7, // 7 jours
  path: '/',
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { password } = body as { password?: string };

  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminToken    = process.env.ADMIN_SECRET_TOKEN;

  // ── LOGS DIAGNOSTIC TEMPORAIRES ──────────────────────────────────────────
  console.log('[login] ADMIN_PASSWORD     présent :', Boolean(adminPassword),
    '| longueur :', adminPassword?.length ?? 0);
  console.log('[login] ADMIN_SECRET_TOKEN présent :', Boolean(adminToken),
    '| longueur :', adminToken?.length ?? 0);
  console.log('[login] Mot de passe reçu  présent :', Boolean(password),
    '| longueur :', password?.length ?? 0);
  console.log('[login] Match password :', password === adminPassword);
  // ─────────────────────────────────────────────────────────────────────────

  if (!adminPassword) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD non configuré.' }, { status: 500 });
  }
  if (!adminToken) {
    return NextResponse.json({ error: 'ADMIN_SECRET_TOKEN non configuré.' }, { status: 500 });
  }
  if (!password || password !== adminPassword) {
    // Délai minimal pour limiter le brute-force
    await new Promise((r) => setTimeout(r, 300));
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
