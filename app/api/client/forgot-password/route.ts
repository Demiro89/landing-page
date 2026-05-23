import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateVerificationToken } from '@/lib/clientAuth';
import { sendResetPasswordEmail } from '@/lib/nodemailer';
import { enforceRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Erreur serveur';

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, 'forgot-password', 5, 3600);
    if (limited) return limited;

    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 });
    }

    const normalized = email.toLowerCase().trim();
    const customer = await prisma.customer.findUnique({ where: { email: normalized } });

    // Toujours répondre succès pour ne pas révéler si l'email existe
    if (!customer) {
      return NextResponse.json({ success: true, message: 'Si cet email est associé à un compte, un lien de réinitialisation vient d\'être envoyé.' });
    }

    const resetToken = generateVerificationToken();
    const resetTokenExp = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await prisma.customer.update({
      where: { id: customer.id },
      data: { resetToken, resetTokenExp },
    });

    sendResetPasswordEmail(normalized, resetToken).catch(err =>
      console.error('[forgot-password] email error:', err)
    );

    return NextResponse.json({ success: true, message: 'Si cet email est associé à un compte, un lien de réinitialisation vient d\'être envoyé.' });
  } catch (error: unknown) {
    console.error('[forgot-password]', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
