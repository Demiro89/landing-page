import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateVerificationToken } from '@/lib/clientAuth';
import { sendResetPasswordEmail } from '@/lib/nodemailer';
import { enforceRateLimit } from '@/lib/rateLimit';
import { normalizeEmail } from '@/lib/checkoutValidation';
import { readJsonObject } from '@/lib/requestJson';

export const dynamic = 'force-dynamic';
const errorMessage = (error: unknown) => {
  // Journalise l'erreur réelle côté serveur ; n'expose jamais les détails au client
  // (les messages Prisma révèlent le schéma : tables, colonnes, contraintes).
  console.error('[api]', error);
  return 'Erreur serveur';
};

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, 'forgot-password', 5, 3600, true);
    if (limited) return limited;

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const { email } = parsed.value;
    const normalized = normalizeEmail(email);
    if (!normalized) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({ where: { email: normalized } });

    // Toujours répondre succès pour ne pas révéler si l'email existe
    if (!customer) {
      return NextResponse.json({ success: true, message: 'Si cet email est associé à un compte, un lien de réinitialisation vient d\'être envoyé.' });
    }

    const resetToken = generateVerificationToken();
    const resetTokenExp = new Date(Date.now() + 60 * 60 * 1000); // 1h

    // Do not send a new credential to an address superseded by a concurrent change.
    const issued = await prisma.customer.updateMany({
      where: { id: customer.id, email: normalized, passwordHash: customer.passwordHash, sessionVersion: customer.sessionVersion },
      data: { resetToken, resetTokenExp },
    });

    if (issued.count === 1) sendResetPasswordEmail(normalized, resetToken).catch(err =>
      console.error('[forgot-password] email error:', err)
    );

    return NextResponse.json({ success: true, message: 'Si cet email est associé à un compte, un lien de réinitialisation vient d\'être envoyé.' });
  } catch (error: unknown) {
    console.error('[forgot-password]', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
