import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';
import { clientOrderSelect, clientOrderView } from '@/lib/clientOrderView';
import { logServerFailure } from '@/lib/securityLog';

export const dynamic = 'force-dynamic';

const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) return NextResponse.json({ authenticated: false }, { headers: privateHeaders });
    const profile = { id: customer.id, email: customer.email, emailVerified: customer.emailVerified };
    if (new URL(request.url).searchParams.get('profile') === '1') {
      return NextResponse.json({ authenticated: true, customer: profile }, { headers: privateHeaders });
    }

    // Attach legacy purchases only when the account view needs them.
    await prisma.order.updateMany({
      where: { clientEmail: customer.email, customerId: null },
      data: { customerId: customer.id },
    });
    const orders = await prisma.order.findMany({
      where: { customerId: customer.id },
      select: clientOrderSelect,
      orderBy: { date: 'desc' },
    });
    return NextResponse.json({ authenticated: true, customer: profile, orders: orders.map(clientOrderView) }, { headers: privateHeaders });
  } catch (error) {
    logServerFailure('client/me', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500, headers: privateHeaders });
  }
}
