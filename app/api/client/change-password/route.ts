import { NextResponse } from 'next/server';
import { getCurrentCustomer, verifyPassword, hashPassword, setSession } from '@/lib/clientAuth';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/rateLimit';
import { readJsonObject } from '@/lib/requestJson';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, 'change-password', 5, 900, true);
  if (limited) return limited;

  const customer = await getCurrentCustomer();
  if (!customer) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const { currentPassword, newPassword } = parsed.value;

  if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 128 || !newPassword) {
    return NextResponse.json({ error: 'Mot de passe actuel et nouveau mot de passe requis' }, { status: 400 });
  }

  if (!verifyPassword(currentPassword, customer.passwordHash)) {
    return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 401 });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return NextResponse.json(
      { error: 'Le nouveau mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre' },
      { status: 400 }
    );
  }

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: 'Le nouveau mot de passe doit être différent de l\'actuel' }, { status: 400 });
  }

  const updated = await prisma.$transaction(async tx => {
    const changed = await tx.customer.updateMany({
      where: { id: customer.id, passwordHash: customer.passwordHash, sessionVersion: customer.sessionVersion },
      data: {
        passwordHash: hashPassword(newPassword), sessionVersion: { increment: 1 },
        verificationToken: null,
        resetToken: null, resetTokenExp: null, pendingEmail: null, emailChangeToken: null, emailChangeTokenExp: null,
      },
    });
    if (changed.count !== 1) return null;
    return tx.customer.findUniqueOrThrow({ where: { id: customer.id }, select: { sessionVersion: true } });
  });
  if (!updated) return NextResponse.json({ error: 'Le compte a changé. Reconnectez-vous avant de réessayer.' }, { status: 409 });
  await setSession(customer.id, updated.sessionVersion);

  return NextResponse.json({ success: true });
}
