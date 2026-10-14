import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer, clearSession, verifyPassword } from '@/lib/clientAuth';
import { enforceRateLimit } from '@/lib/rateLimit';
import { readJsonObject } from '@/lib/requestJson';

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

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const { confirmation, currentPassword } = parsed.value;
    if (typeof confirmation !== 'string' || confirmation.trim().toLowerCase() !== 'supprimer') {
      return NextResponse.json({ error: 'Confirmation invalide. Tapez exactement "supprimer".' }, { status: 400 });
    }

    if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 128) {
      return NextResponse.json({ error: 'Mot de passe actuel requis.' }, { status: 400 });
    }
    if (!verifyPassword(currentPassword, customer.passwordHash)) {
      return NextResponse.json({ error: 'Mot de passe incorrect.' }, { status: 401 });
    }

    const deleted = await prisma.$transaction(async tx => {
      // Claim the current credentials and lock the account before detaching any order.
      const claimed = await tx.customer.updateMany({
        where: { id: customer.id, passwordHash: customer.passwordHash, sessionVersion: customer.sessionVersion },
        data: { sessionVersion: { increment: 1 } },
      });
      if (claimed.count !== 1) return false;
      await tx.order.updateMany({
        where: { customerId: customer.id },
        data: { customerId: null },
      });
      await tx.customer.delete({ where: { id: customer.id } });
      return true;
    });
    if (!deleted) return NextResponse.json({ error: 'Le compte a changé. Reconnectez-vous avant de réessayer.' }, { status: 409 });

    await clearSession();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[delete-account]', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
