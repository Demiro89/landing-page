/**
 * POST /api/beta/verify
 *
 * Valide le code d'accès bêta. Deux modes (essayés dans l'ordre) :
 *  1. Code maître : compare avec BETA_PASSWORD (env var)
 *  2. Code individuel : cherche un InviteCode actif et non utilisé en DB
 *
 * En cas de succès → cookie HttpOnly sm_beta_access=1 (30 jours)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { code } = body as { code?: string };
  const trimmed = code?.trim() ?? '';

  if (!trimmed) {
    return NextResponse.json({ error: 'Code requis.' }, { status: 400 });
  }

  let valid = false;

  // ── Mode 1 : code maître (BETA_PASSWORD) ──────────────────────────────────
  const masterPassword = process.env.BETA_PASSWORD;
  if (masterPassword && trimmed === masterPassword) {
    valid = true;
  }

  // ── Mode 2 : code individuel en DB (InviteCode) ───────────────────────────
  if (!valid) {
    const invite = await prisma.inviteCode.findUnique({
      where: { code: trimmed },
    }).catch(() => null);

    if (invite && invite.active && !invite.usedAt) {
      // Marque le code comme utilisé
      await prisma.inviteCode.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      }).catch(() => {});
      valid = true;
    }
  }

  if (!valid) {
    return NextResponse.json({ error: 'Code d\'accès incorrect.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('sm_beta_access', '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
