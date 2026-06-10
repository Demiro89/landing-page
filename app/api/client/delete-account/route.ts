import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer, clearSession } from '@/lib/clientAuth';
import { enforceRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
const errorMessage = (error: unknown) => {
  // Journalise l'erreur réelle côté serveur ; n'expose jamais les détails au client
  // (les messages Prisma révèlent le schéma : tables, colonnes, contraintes).
  console.error('[api]', error);
  return 'Erreur serveur';
};

export async function POST(request: Request) {
  try {
    // Opération destructrice : throttle par IP, fail-closed.
    const limited = await enforceRateLimit(request, 'delete-account', 5, 900, true);
    if (limited) return limited;

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
