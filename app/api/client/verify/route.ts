import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { setSession } from '@/lib/clientAuth';

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

    await prisma.customer.update({
      where: { id: customer.id },
      data: { emailVerified: true, verificationToken: null },
    });

    // Connecter automatiquement
    await setSession(customer.id);

    return NextResponse.redirect(new URL('/?verify=success', request.url));
  } catch (error: any) {
    console.error('[verify]', error);
    return NextResponse.redirect(new URL('/?verify=error', request.url));
  }
}
