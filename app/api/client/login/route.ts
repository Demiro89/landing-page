import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, setSession } from '@/lib/clientAuth';
import { enforceRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Erreur serveur';

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, 'login', 8, 900);
    if (limited) return limited;

    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
    }

    const normalized = email.toLowerCase().trim();
    const customer = await prisma.customer.findUnique({ where: { email: normalized } });

    if (!customer) {
      return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 });
    }

    // Vérifier si le compte est verrouillé
    if (customer.lockedUntil && customer.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((customer.lockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json({
        error: `Compte temporairement verrouillé suite à trop de tentatives. Réessayez dans ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`,
        locked: true,
      }, { status: 429 });
    }

    if (!verifyPassword(password, customer.passwordHash)) {
      const newAttempts = customer.loginAttempts + 1;
      const shouldLock = newAttempts >= MAX_ATTEMPTS;

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          // On NE réinitialise PAS le compteur au verrouillage : sinon l'attaquant
          // récupérerait 5 essais neufs à chaque fenêtre de 15 min. Le compteur n'est
          // remis à zéro qu'après une connexion réussie ou une réinitialisation du mot de passe.
          loginAttempts: newAttempts,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : customer.lockedUntil,
        },
      });

      if (shouldLock) {
        return NextResponse.json({
          error: 'Compte verrouillé 15 minutes suite à 5 tentatives échouées.',
          locked: true,
        }, { status: 429 });
      }

      const remaining = MAX_ATTEMPTS - newAttempts;
      return NextResponse.json({
        error: `Identifiants incorrects. ${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''} avant verrouillage.`,
      }, { status: 401 });
    }

    if (!customer.emailVerified) {
      return NextResponse.json({
        error: 'Compte non vérifié. Consultez votre boîte email pour activer votre compte.',
        needsVerification: true,
      }, { status: 403 });
    }

    // Connexion réussie : réinitialiser le compteur
    await prisma.customer.update({
      where: { id: customer.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });

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
