import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';
import { ACCESS_STATUSES } from '@/lib/orderAccess';
import { clientOrderSelect, clientOrderView } from '@/lib/clientOrderView';
import { logServerFailure } from '@/lib/securityLog';

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
      where: { customerId: customer.id, status: { in: [...ACCESS_STATUSES] } },
      select: clientOrderSelect,
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ success: true, orders: orders.map(clientOrderView) }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    logServerFailure('client/orders', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
