import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateVerificationToken } from '@/lib/clientAuth';
import { sendVerificationEmail } from '@/lib/nodemailer';
import { enforceRateLimit } from '@/lib/rateLimit';
import { normalizeEmail } from '@/lib/checkoutValidation';
import { readJsonObject } from '@/lib/requestJson';

export const dynamic = 'force-dynamic';
const registrationResponse = () => NextResponse.json({ success: true, message: 'Consultez votre boîte e-mail pour la suite. Si vous avez déjà un compte, connectez-vous ou réinitialisez votre mot de passe.' });
const errorMessage = (error: unknown) => {
  // Journalise l'erreur réelle côté serveur ; n'expose jamais les détails au client
  // (les messages Prisma révèlent le schéma : tables, colonnes, contraintes).
  console.error('[api]', error);
  return 'Erreur serveur';
};

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, 'register', 5, 3600, true);
    if (limited) return limited;

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const { email, password } = parsed.value;
    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre' },
        { status: 400 }
      );
    }

    const normalized = normalizeEmail(email);
    if (!normalized) return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 });
    const passwordHash = hashPassword(password);
    const existing = await prisma.customer.findUnique({ where: { email: normalized } });
    if (existing) {
      return registrationResponse();
    }

    const verificationToken = generateVerificationToken();

    await prisma.customer.create({
      data: {
        email: normalized,
        passwordHash,
        verificationToken,
      },
    });

    // Envoyer l'email de vérification (non bloquant)
    sendVerificationEmail(normalized, verificationToken).catch(err =>
      console.error('[register] verification email error:', err)
    );

    return registrationResponse();
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return registrationResponse();
    console.error('[register]', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
