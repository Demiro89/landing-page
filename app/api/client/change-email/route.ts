import { NextResponse } from 'next/server';
import { getCurrentCustomer, verifyPassword, generateVerificationToken } from '@/lib/clientAuth';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/rateLimit';
import { sendEmailChangeVerificationEmail } from '@/lib/nodemailer';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, 'change-email', 3, 3600);
  if (limited) return limited;

  const customer = await getCurrentCustomer();
  if (!customer) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  }

  const { newEmail, currentPassword } = await request.json();

  if (!newEmail || !currentPassword) {
    return NextResponse.json({ error: 'Nouvel email et mot de passe actuel requis' }, { status: 400 });
  }

  const normalized = newEmail.toLowerCase().trim();

  if (normalized === customer.email.toLowerCase()) {
    return NextResponse.json({ error: 'Le nouvel email est identique à l\'adresse actuelle' }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 });
  }

  if (!verifyPassword(currentPassword, customer.passwordHash)) {
    return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 });
  }

  const alreadyExists = await prisma.customer.findUnique({ where: { email: normalized } });
  if (alreadyExists) {
    return NextResponse.json({ error: 'Cette adresse email est déjà utilisée par un autre compte' }, { status: 409 });
  }

  const token = generateVerificationToken();
  const exp = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      pendingEmail: normalized,
      emailChangeToken: token,
      emailChangeTokenExp: exp,
    },
  });

  sendEmailChangeVerificationEmail(normalized, token).catch((err) =>
    console.error('[change-email] send error:', err)
  );

  return NextResponse.json({ success: true, message: 'Un email de confirmation a été envoyé à votre nouvelle adresse.' });
}
