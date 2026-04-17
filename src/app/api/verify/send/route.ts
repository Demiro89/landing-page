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
export const dynamic = 'force-dynamic';


export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email } = body as { email?: string };

  console.log('[verify/send] Requête reçue pour:', email ?? '(vide)');

  if (!email?.includes('@')) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Vérifie si cet email a des commandes (sans révéler le résultat)
  const hasOrders = await prisma.order.findFirst({
    where: { user: { email: normalizedEmail } },
    select: { id: true },
  });

  console.log('[verify/send] Commandes trouvées pour', normalizedEmail, ':', Boolean(hasOrders));

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

    console.log('[verify/send] Code créé en DB, tentative envoi email...');

    // ⚠️  DOIT être awaité — les fonctions serverless (Vercel) terminent dès le return,
    //    tuant toute requête HTTP non résolue si on utilise fire-and-forget.
    try {
      const sent = await sendVerificationCode({ to: normalizedEmail, code });
      console.log('[verify/send] Résultat envoi email:', sent ? '✅ envoyé' : '❌ échec (voir logs Email ci-dessus)');
    } catch (err) {
      console.error('[verify/send] ❌ Exception lors de l\'envoi email:', err);
    }
  }

  // Réponse identique dans tous les cas (anti-énumération)
  return NextResponse.json({ ok: true });
}
