import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, setSession } from '@/lib/clientAuth';
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
    const limited = await enforceRateLimit(request, 'reset-password', 10, 3600, true);
    if (limited) return limited;

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const { token, password } = parsed.value;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !password) {
      return NextResponse.json({ error: 'Token et mot de passe requis' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre' },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findFirst({ where: { resetToken: token } });
    if (!customer || !customer.resetTokenExp || customer.resetTokenExp < new Date()) {
      return NextResponse.json({ error: 'Lien de réinitialisation invalide ou expiré' }, { status: 400 });
    }

    // Consommation atomique du token : empêche un double usage en cas de
    // requêtes parallèles avec le même lien.
    const updated = await prisma.$transaction(async tx => {
      const consumed = await tx.customer.updateMany({
        where: { id: customer.id, resetToken: token, resetTokenExp: { gt: new Date() } },
        data: {
          passwordHash: hashPassword(password),
          resetToken: null,
          resetTokenExp: null,
          emailVerified: true,
          verificationToken: null,
          loginAttempts: 0,
          lockedUntil: null,
          sessionVersion: { increment: 1 },
          pendingEmail: null, emailChangeToken: null, emailChangeTokenExp: null,
        },
      });
      if (consumed.count !== 1) return null;
      return tx.customer.findUniqueOrThrow({ where: { id: customer.id }, select: { sessionVersion: true } });
    });
    if (!updated) {
      return NextResponse.json({ error: 'Lien de réinitialisation invalide ou expiré' }, { status: 400 });
    }

    await setSession(customer.id, updated.sessionVersion);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[reset-password]', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
