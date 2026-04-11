/**
 * POST /api/beta/verify
 *
 * Reçoit { code } et le compare à BETA_PASSWORD.
 * Si correct → pose le cookie sm_beta_access=1 (HttpOnly, 30j) et retourne { ok: true }.
 * Si incorrect → 401 { error }.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { code } = body as { code?: string };

  const expected = process.env.BETA_PASSWORD;
  if (!expected) {
    // BETA_PASSWORD non configuré → barrière désactivée, accès libre
    const res = NextResponse.json({ ok: true });
    res.cookies.set('sm_beta_access', '1', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    return res;
  }

  if (!code || code.trim() !== expected) {
    return NextResponse.json({ error: 'Code d\'accès incorrect.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('sm_beta_access', '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 jours
  });
  return res;
}
