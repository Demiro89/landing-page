import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer, generateVerificationToken } from '@/lib/clientAuth';
import { sendVerificationEmail } from '@/lib/nodemailer';
import { enforceRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, 'resend-verification', 3, 3600);
  if (limited) return limited;

  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (customer.emailVerified) return NextResponse.json({ error: 'Email déjà vérifié' }, { status: 400 });

  const token = generateVerificationToken();
  await prisma.customer.update({
    where: { id: customer.id },
    data: { verificationToken: token },
  });

  await sendVerificationEmail(customer.email, token);
  return NextResponse.json({ success: true });
}
