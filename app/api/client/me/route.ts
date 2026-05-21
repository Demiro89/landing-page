import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return NextResponse.json({ authenticated: false });
  }

  // Rattacher rétroactivement les commandes existantes avec cet email
  await prisma.order.updateMany({
    where: { clientEmail: customer.email, customerId: null },
    data: { customerId: customer.id },
  });

  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    include: { service: true },
    orderBy: { date: 'desc' },
  });

  return NextResponse.json({
    authenticated: true,
    customer: {
      id: customer.id,
      email: customer.email,
      emailVerified: customer.emailVerified,
    },
    orders,
  });
}
