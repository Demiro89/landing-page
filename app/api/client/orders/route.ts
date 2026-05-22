import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';
import { decrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/client/orders : commandes du client actuellement connecté.
 * L'identité provient exclusivement de la session — aucun paramètre email.
 */
export async function GET() {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    // Rattache rétroactivement les anciennes commandes passées avec ce même email.
    await prisma.order.updateMany({
      where: { clientEmail: customer.email, customerId: null },
      data: { customerId: customer.id },
    });

    const orders = await prisma.order.findMany({
      where: { customerId: customer.id, status: 'active' },
      include: {
        service: true,
        chats: {
          include: {
            messages: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Déchiffre les identifiants pour le client propriétaire.
    const safeOrders = orders.map((o) => ({ ...o, details: decrypt(o.details) }));

    return NextResponse.json({ success: true, orders: safeOrders });
  } catch (error) {
    console.error('Erreur GET client orders:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
