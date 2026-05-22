import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, setSession } from '@/lib/clientAuth';
import { enforceRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

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
    if (!customer || !verifyPassword(password, customer.passwordHash)) {
      return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 });
    }

    if (!customer.emailVerified) {
      return NextResponse.json({
        error: 'Compte non vérifié. Consultez votre boîte email pour activer votre compte.',
        needsVerification: true,
      }, { status: 403 });
    }

    await setSession(customer.id);
    return NextResponse.json({
      success: true,
      customer: { id: customer.id, email: customer.email },
    });
  } catch (error: any) {
    console.error('[login]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
