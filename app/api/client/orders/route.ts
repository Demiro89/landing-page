import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/client/orders : Récupère les abonnements d'un client par son adresse email.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Adresse email requise' }, { status: 400 });
    }

    const cleanedEmail = email.trim().toLowerCase();

    const orders = await prisma.order.findMany({
      where: {
        clientEmail: cleanedEmail,
        status: 'active',
      },
      include: {
        service: true,
        chats: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ success: true, orders });
  } catch (error: any) {
    console.error('Erreur GET client orders:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
