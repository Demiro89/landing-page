import { NextResponse } from 'next/server';
import { getCurrentCustomer, verifyPassword, hashPassword } from '@/lib/clientAuth';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, 'change-password', 5, 900);
  if (limited) return limited;

  const customer = await getCurrentCustomer();
  if (!customer) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  }

  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Mot de passe actuel et nouveau mot de passe requis' }, { status: 400 });
  }

  if (!verifyPassword(currentPassword, customer.passwordHash)) {
    return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 401 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: 'Le nouveau mot de passe doit être différent de l\'actuel' }, { status: 400 });
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { passwordHash: hashPassword(newPassword) },
  });

  return NextResponse.json({ success: true });
}
