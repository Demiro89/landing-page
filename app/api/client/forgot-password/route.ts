import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAccountToken } from '@/lib/accountTokens';
import { scheduleAccountEmail } from '@/lib/accountEmail';
import { enforceRateLimit } from '@/lib/rateLimit';
import { normalizeEmail } from '@/lib/checkoutValidation';
import { readJsonObject } from '@/lib/requestJson';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const response = () => NextResponse.json({ success: true, message: 'Si cette adresse est associée à un compte, consultez votre boîte e-mail et les indésirables. Vous pouvez renouveler la demande si aucun message n’arrive.' });
const errorMessage = (error: unknown) => {
  // Journalise l'erreur réelle côté serveur ; n'expose jamais les détails au client
  // (les messages Prisma révèlent le schéma : tables, colonnes, contraintes).
  console.error('[api]', error);
  return 'Erreur serveur';
};

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, 'forgot-password', 5, 3600, true);
    if (limited) return limited;

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const { email } = parsed.value;
    const normalized = normalizeEmail(email);
    if (!normalized) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({ where: { email: normalized } });

    // Toujours répondre succès pour ne pas révéler si l'email existe
    if (!customer) {
      return response();
    }

    const reset = createAccountToken('reset');

    // Do not send a new credential to an address superseded by a concurrent change.
    const issued = await prisma.customer.updateMany({
      where: { id: customer.id, email: normalized, passwordHash: customer.passwordHash, sessionVersion: customer.sessionVersion },
      data: { resetToken: reset.storedToken, resetTokenExp: reset.expiresAt },
    });

    if (issued.count === 1) scheduleAccountEmail('reset', normalized, reset.token);

    return response();
  } catch (error: unknown) {
    console.error('[forgot-password]', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
