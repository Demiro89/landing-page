import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, setSession } from '@/lib/clientAuth';
import { enforceRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, 'reset-password', 10, 3600);
    if (limited) return limited;

    const { token, password } = await request.json();
    if (!token || !password) {
      return NextResponse.json({ error: 'Token et mot de passe requis' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, { status: 400 });
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
      },
    });

    await setSession(customer.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[reset-password]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
