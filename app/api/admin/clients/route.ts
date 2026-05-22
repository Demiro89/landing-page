import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function checkAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('ADMIN_SECRET_TOKEN')?.value;
  const secretToken = process.env.ADMIN_SECRET_TOKEN || 'SM_SUPER_SECRET_TOKEN_2026';
  return token === secretToken;
}

/**
 * GET /api/admin/clients : Liste des clients uniques dérivés des commandes.
 */
export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const orders = await prisma.order.findMany({
      select: {
        id: true,
        clientEmail: true,
        date: true,
        total: true,
        status: true,
        service: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    });

    // Grouper par email pour créer des profils clients
    const clientMap: Record<string, {
      email: string;
      firstOrderDate: string;
      orderCount: number;
      totalSpent: number;
      activeOrders: number;
    }> = {};

    orders.forEach((order) => {
      const email = order.clientEmail.toLowerCase();
      if (!clientMap[email]) {
        clientMap[email] = {
          email,
          firstOrderDate: new Date(order.date).toLocaleDateString('fr-FR'),
          orderCount: 0,
          totalSpent: 0,
          activeOrders: 0,
        };
      }
      clientMap[email].orderCount += 1;
      clientMap[email].totalSpent += order.total;
      if (order.status === 'active') clientMap[email].activeOrders += 1;
    });

    const clients = Object.values(clientMap).sort((a, b) =>
      b.totalSpent - a.totalSpent
    );

    return NextResponse.json({ success: true, clients });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
