import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { setSession, bumpSessionVersion } from '@/lib/clientAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    if (!token) {
      return NextResponse.redirect(new URL('/?verify=missing', request.url));
    }

    const customer = await prisma.customer.findFirst({ where: { verificationToken: token } });
    if (!customer) {
      return NextResponse.redirect(new URL('/?verify=invalid', request.url));
    }

    // Consommation atomique du token : si deux requêtes arrivent en parallèle
    // avec le même token, une seule passe (count = 1), l'autre est rejetée.
    const consumed = await prisma.customer.updateMany({
      where: { id: customer.id, verificationToken: token },
      data: { emailVerified: true, verificationToken: null },
    });
    if (consumed.count === 0) {
      return NextResponse.redirect(new URL('/?verify=invalid', request.url));
    }

    // Connecter automatiquement
    const version = await bumpSessionVersion(customer.id);
    await setSession(customer.id, version);

    return NextResponse.redirect(new URL('/?verify=success', request.url));
  } catch (error: unknown) {
    console.error('[verify]', error);
    return NextResponse.redirect(new URL('/?verify=error', request.url));
  }
}
