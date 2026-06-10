import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bumpSessionVersion } from '@/lib/clientAuth';

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

  // Consommation atomique du token : empêche un double usage en cas de
  // requêtes parallèles avec le même lien.
  const consumed = await prisma.customer.updateMany({
    where: { id: customer.id, emailChangeToken: token },
    data: {
      email: newEmail,
      pendingEmail: null,
      emailChangeToken: null,
      emailChangeTokenExp: null,
    },
  });
  if (consumed.count === 0) {
    return NextResponse.redirect(`${APP_URL}/?emailChange=invalid`);
  }

  await bumpSessionVersion(customer.id);

  return NextResponse.redirect(`${APP_URL}/?emailChange=success`);
}
