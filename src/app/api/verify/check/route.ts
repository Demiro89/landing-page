/**
 * POST /api/verify/check
 *
 * Valide le code OTP et, si correct, retourne les commandes de l'email.
 * Limite : 3 tentatives max avant invalidation du code.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
export const dynamic = 'force-dynamic';


export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, code } = body as { email?: string; code?: string };

  if (!email?.includes('@') || !code?.trim()) {
    return NextResponse.json({ error: 'Données invalides.' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const codeHash = createHash('sha256').update(code.trim()).digest('hex');

  // Cherche un code valide et non expiré
  const record = await prisma.verificationCode.findFirst({
    where: {
      email: normalizedEmail,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) {
    return NextResponse.json(
      { error: 'Code expiré ou introuvable. Demandez un nouveau code.' },
      { status: 401 }
    );
  }

  // Trop de tentatives
  if (record.attempts >= 3) {
    await prisma.verificationCode.delete({ where: { id: record.id } });
    return NextResponse.json(
      { error: 'Trop de tentatives. Demandez un nouveau code.' },
      { status: 429 }
    );
  }

  // Code incorrect
  if (record.codeHash !== codeHash) {
    const updated = await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = 3 - updated.attempts;
    if (remaining <= 0) {
      await prisma.verificationCode.delete({ where: { id: record.id } });
      return NextResponse.json(
        { error: 'Trop de tentatives. Demandez un nouveau code.' },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: `Code incorrect. ${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}.` },
      { status: 401 }
    );
  }

  // ── Code valide — on le supprime et on retourne les commandes ──
  await prisma.verificationCode.delete({ where: { id: record.id } });

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          service: true,
          status: true,
          amount: true,
          paymentMethod: true,
          paymentTxId: true,
          gmail: true,
          invitationSentAt: true,
          expiresAt: true,
          durationMonths: true,
          createdAt: true,
          cancelAtEnd: true,
          paymentFailed: true,
          stripeSubscriptionId: true,
          user: { select: { email: true } },
          slot: {
            select: {
              profileNumber: true,
              pinCode: true,
              masterAccount: { select: { email: true, password: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ orders: user?.orders ?? [] });
}
