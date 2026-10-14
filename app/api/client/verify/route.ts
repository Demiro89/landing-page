import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { setSession } from '@/lib/clientAuth';
import { readAccountToken } from '@/lib/accountTokens';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const credential = readAccountToken(token, 'verification');
    if (!credential) {
      return NextResponse.redirect(new URL('/?verify=missing', request.url));
    }

    const customer = await prisma.customer.findFirst({ where: { verificationToken: credential.storedToken } });
    if (!customer) {
      return NextResponse.redirect(new URL('/?verify=invalid', request.url));
    }

    // Consommation atomique du token : si deux requêtes arrivent en parallèle
    // avec le même token, une seule passe (count = 1), l'autre est rejetée.
    const verified = await prisma.$transaction(async tx => {
      const consumed = await tx.customer.updateMany({
        where: {
          id: customer.id, verificationToken: credential.storedToken, emailVerified: false,
          ...(credential.legacy ? { createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } : {}),
        },
        data: {
          emailVerified: true, verificationToken: null, sessionVersion: { increment: 1 },
          resetToken: null, resetTokenExp: null,
        },
      });
      if (consumed.count !== 1) return null;
      return tx.customer.findUniqueOrThrow({ where: { id: customer.id }, select: { sessionVersion: true } });
    });
    if (!verified) {
      return NextResponse.redirect(new URL('/?verify=invalid', request.url));
    }

    // Connecter automatiquement
    await setSession(customer.id, verified.sessionVersion);

    return NextResponse.redirect(new URL('/?verify=success', request.url));
  } catch (error: unknown) {
    console.error('[verify]', error);
    return NextResponse.redirect(new URL('/?verify=error', request.url));
  }
}
