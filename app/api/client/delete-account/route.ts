import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer, clearSession } from '@/lib/clientAuth';

export const dynamic = 'force-dynamic';
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Erreur serveur';

export async function POST(request: Request) {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
    }

    const { confirmation } = await request.json();
    if (typeof confirmation !== 'string' || confirmation.trim().toLowerCase() !== 'supprimer') {
      return NextResponse.json({ error: 'Confirmation invalide. Tapez exactement "supprimer".' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.order.updateMany({
        where: { customerId: customer.id },
        data: { customerId: null },
      }),
      prisma.customer.delete({ where: { id: customer.id } }),
    ]);

    await clearSession();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[delete-account]', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
