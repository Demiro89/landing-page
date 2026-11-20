import { NextResponse } from 'next/server';
import { clearSession, getCurrentCustomer } from '@/lib/clientAuth';
import { prisma } from '@/lib/prisma';
import { logServerFailure } from '@/lib/securityLog';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const customer = await getCurrentCustomer();
    if (customer) {
      await prisma.customer.updateMany({
        where: { id: customer.id, sessionVersion: customer.sessionVersion },
        data: { sessionVersion: { increment: 1 } },
      });
    }
    await clearSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    logServerFailure('client/logout', error);
    return NextResponse.json({ error: 'Déconnexion indisponible. Réessayez.' }, { status: 503 });
  }
}
