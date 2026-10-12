import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { createAccountToken } from '@/lib/accountTokens';
import { scheduleAccountEmail } from '@/lib/accountEmail';
import { enforceRateLimit, enforceKeyRateLimit } from '@/lib/rateLimit';
import { normalizeEmail } from '@/lib/checkoutValidation';
import { readJsonObject } from '@/lib/requestJson';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, 'resend-verification', 3, 3600, true);
  if (limited) return limited;
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const email = normalizeEmail(parsed.value.email);
  if (!email) return NextResponse.json({ error: 'Adresse e-mail invalide.' }, { status: 400 });
  const recipient = crypto.createHash('sha256').update(email).digest('hex');
  const recipientLimit = await enforceKeyRateLimit(`verification-email:${recipient}`, 3, 3600, true);
  if (recipientLimit) return recipientLimit;
  try {
    const customer = await prisma.customer.findUnique({ where: { email } });
    if (customer && !customer.emailVerified) {
      const verification = createAccountToken('verification');
      const changed = await prisma.customer.updateMany({
        where: { id: customer.id, email, emailVerified: false, sessionVersion: customer.sessionVersion, verificationToken: customer.verificationToken },
        data: { verificationToken: verification.storedToken },
      });
      if (changed.count === 1) scheduleAccountEmail('verification', email, verification.token);
    }
    return NextResponse.json({ success: true, message: 'Si ce compte attend une confirmation, consultez votre boîte e-mail et les indésirables. Vous pouvez renouveler la demande si aucun message n’arrive.' });
  } catch {
    return NextResponse.json({ error: 'Demande indisponible. Réessayez dans quelques instants.' }, { status: 503 });
  }
}
