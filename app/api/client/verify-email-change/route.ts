import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://streammalin.fr';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(`${APP_URL}/?emailChange=invalid`);
  }

  const customer = await prisma.customer.findFirst({
    where: { emailChangeToken: token },
  });

  if (!customer || !customer.pendingEmail || !customer.emailChangeTokenExp) {
    return NextResponse.redirect(`${APP_URL}/?emailChange=invalid`);
  }

  if (new Date() > customer.emailChangeTokenExp) {
    return NextResponse.redirect(`${APP_URL}/?emailChange=expired`);
  }

  const newEmail = customer.pendingEmail;

  // Vérifier que l'email n'a pas été pris entre-temps
  const conflict = await prisma.customer.findUnique({ where: { email: newEmail } });
  if (conflict && conflict.id !== customer.id) {
    return NextResponse.redirect(`${APP_URL}/?emailChange=conflict`);
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      email: newEmail,
      pendingEmail: null,
      emailChangeToken: null,
      emailChangeTokenExp: null,
    },
  });

  return NextResponse.redirect(`${APP_URL}/?emailChange=success`);
}
