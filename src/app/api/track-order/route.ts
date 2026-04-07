/**
 * GET /api/track-order?email=xxx
 *
 * Retourne les commandes récentes d'un client par email.
 * Données retournées : id, service, status, amount, paymentMethod,
 *                      createdAt, expiresAt — pas de credentials.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email')?.toLowerCase().trim();

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    // Ne pas révéler si l'email existe ou non
    return NextResponse.json({ orders: [] });
  }

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      service: true,
      status: true,
      amount: true,
      paymentMethod: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  return NextResponse.json({ orders });
}
