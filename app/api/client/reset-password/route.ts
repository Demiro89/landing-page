import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, setSession, bumpSessionVersion } from '@/lib/clientAuth';
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
    const limited = await enforceRateLimit(request, 'reset-password', 10, 3600, true);
    if (limited) return limited;

    const { token, password } = await request.json();
    if (!token || !password) {
      return NextResponse.json({ error: 'Token et mot de passe requis' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères' }, { status: 400 });
    }

    const customer = await prisma.customer.findFirst({ where: { resetToken: token } });
    if (!customer || !customer.resetTokenExp || customer.resetTokenExp < new Date()) {
      return NextResponse.json({ error: 'Lien de réinitialisation invalide ou expiré' }, { status: 400 });
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        passwordHash: hashPassword(password),
        resetToken: null,
        resetTokenExp: null,
        emailVerified: true, // si le mdp est réinitialisé via email, l'email est de fait vérifié
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    const newVersion = await bumpSessionVersion(customer.id);
    await setSession(customer.id, newVersion);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[reset-password]', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
