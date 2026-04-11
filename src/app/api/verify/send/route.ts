/**
 * POST /api/verify/send
 *
 * Génère un code OTP à 6 chiffres, le stocke hashé en DB (SHA-256),
 * et l'envoie par email au client.
 *
 * Retourne toujours { ok: true } même si l'email n'a pas de commande,
 * pour éviter l'énumération d'emails (anti-phishing).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendVerificationCode } from '@/lib/email';
import { createHash, randomInt } from 'crypto';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email } = body as { email?: string };

  if (!email?.includes('@')) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Vérifie si cet email a des commandes (sans révéler le résultat)
  const hasOrders = await prisma.order.findFirst({
    where: { user: { email: normalizedEmail } },
    select: { id: true },
  });

  if (hasOrders) {
    const code = String(randomInt(100000, 999999));
    const codeHash = createHash('sha256').update(code).digest('hex');

    // Supprime les anciens codes pour cet email
    await prisma.verificationCode.deleteMany({ where: { email: normalizedEmail } });

    // Crée le nouveau code (expire dans 15 min)
    await prisma.verificationCode.create({
      data: {
        email: normalizedEmail,
        codeHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    // Envoi email en fire-and-forget
    sendVerificationCode({ to: normalizedEmail, code }).catch((err) =>
      console.error('[verify/send] Email error:', err)
    );
  }

  // Réponse identique dans tous les cas
  return NextResponse.json({ ok: true });
}
