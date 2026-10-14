import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, setSession, DUMMY_PASSWORD_HASH } from '@/lib/clientAuth';
import { enforceRateLimit } from '@/lib/rateLimit';
import { normalizeEmail } from '@/lib/checkoutValidation';
import { readJsonObject } from '@/lib/requestJson';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const rejected = () => NextResponse.json({ error: 'Identifiants incorrects ou connexion temporairement indisponible. Réessayez plus tard ou réinitialisez votre mot de passe.' }, { status: 401 });

const errorMessage = (error: unknown) => {
  // Journalise l'erreur réelle côté serveur ; n'expose jamais les détails au client
  // (les messages Prisma révèlent le schéma : tables, colonnes, contraintes).
  console.error('[api]', error);
  return 'Erreur serveur';
};

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, 'login', 8, 900, true);
    if (limited) return limited;

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const { email, password } = parsed.value;
    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
    }

    const normalized = normalizeEmail(email);
    if (!normalized || typeof password !== 'string' || password.length > 128) {
      return NextResponse.json({ error: 'Identifiants invalides' }, { status: 400 });
    }
    const customer = await prisma.customer.findUnique({ where: { email: normalized } });
    const passwordValid = verifyPassword(password, customer?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!customer) {
      return rejected();
    }

    // Vérifier si le compte est verrouillé
    if (customer.lockedUntil && customer.lockedUntil > new Date()) {
      return rejected();
    }

    if (!passwordValid) {
      await prisma.$transaction(async tx => {
        // The atomic increment also locks the row until the lockout decision is committed.
        const changed = await tx.customer.updateMany({
          where: { id: customer.id, passwordHash: customer.passwordHash, sessionVersion: customer.sessionVersion, loginAttempts: { lt: 2147483647 } },
          data: { loginAttempts: { increment: 1 } },
        });
        if (changed.count !== 1) return null;
        const current = await tx.customer.findUniqueOrThrow({ where: { id: customer.id }, select: { loginAttempts: true } });
        if (current.loginAttempts >= MAX_ATTEMPTS) await tx.customer.update({
          where: { id: customer.id }, data: { lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) },
        });
        return current.loginAttempts;
      });
      return rejected();
    }

    if (!customer.emailVerified) {
      return NextResponse.json({
        error: 'Compte non vérifié. Consultez votre boîte email pour activer votre compte.',
        needsVerification: true,
      }, { status: 403 });
    }

    // Connexion réussie : réinitialiser le compteur
    const authenticated = await prisma.customer.updateMany({
      where: { id: customer.id, passwordHash: customer.passwordHash, sessionVersion: customer.sessionVersion, emailVerified: true },
      data: { loginAttempts: 0, lockedUntil: null },
    });
    if (authenticated.count !== 1) return rejected();

    await setSession(customer.id, customer.sessionVersion);
    return NextResponse.json({
      success: true,
      customer: { id: customer.id, email: customer.email },
    });
  } catch (error: unknown) {
    console.error('[login]', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
