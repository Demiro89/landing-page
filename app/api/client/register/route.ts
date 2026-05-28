import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateVerificationToken } from '@/lib/clientAuth';
import { sendVerificationEmail } from '@/lib/nodemailer';
import { enforceRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Erreur serveur';

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, 'register', 5, 3600);
    if (limited) return limited;

    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères' }, { status: 400 });
    }

    const normalized = email.toLowerCase().trim();
    const existing = await prisma.customer.findUnique({ where: { email: normalized } });
    if (existing) {
      return NextResponse.json({ error: 'Un compte existe déjà avec cet email' }, { status: 409 });
    }

    const passwordHash = hashPassword(password);
    const verificationToken = generateVerificationToken();

    const customer = await prisma.customer.create({
      data: {
        email: normalized,
        passwordHash,
        verificationToken,
      },
    });

    // Rattacher automatiquement toutes les commandes existantes avec cet email
    await prisma.order.updateMany({
      where: { clientEmail: normalized, customerId: null },
      data: { customerId: customer.id },
    });

    // Envoyer l'email de vérification (non bloquant)
    sendVerificationEmail(normalized, verificationToken).catch(err =>
      console.error('[register] verification email error:', err)
    );

    return NextResponse.json({ success: true, message: 'Compte créé. Vérifiez votre email pour activer votre compte.' });
  } catch (error: unknown) {
    console.error('[register]', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
