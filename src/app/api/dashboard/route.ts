/**
 * GET /api/dashboard?email=xxx&orderId=yyy
 *
 * Retourne les commandes d'un utilisateur.
 * Pour Disney+ actif : inclut les accès (email/pass/profil/pin).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  const orderId = searchParams.get('orderId');

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return NextResponse.json({ orders: [] });
    }

    const where = orderId
      ? { userId: user.id, id: orderId }
      : { userId: user.id };

    const orders = await prisma.order.findMany({
      where,
      include: {
        slot: {
          include: {
            masterAccount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sanitizedOrders = orders.map((order) => {
      const isActive = order.status === 'ACTIVE' || order.status === 'CONFIRMED';

      // Disney+ : reveal credentials only if active
      let disneyAccess = undefined;
      if (
        order.service === 'DISNEY' &&
        isActive &&
        order.slot?.masterAccount
      ) {
        disneyAccess = {
          masterEmail: order.slot.masterAccount.email,
          masterPassword: order.slot.masterAccount.password ?? '',
          profileNumber: order.slot.profileNumber,
          pinCode: order.slot.pinCode ?? undefined,
        };
      }

      return {
        id: order.id,
        service: order.service,
        status: order.status,
        amount: order.amount,
        paymentMethod: order.paymentMethod,
        paymentTxId: order.paymentTxId,
        gmail: order.gmail,
        createdAt: order.createdAt.toISOString(),
        expiresAt: order.expiresAt?.toISOString(),
        disneyAccess,
      };
    });

    return NextResponse.json({ orders: sanitizedOrders });
  } catch (error) {
    console.error('[GET /api/dashboard]', error);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
