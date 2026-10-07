import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';
import { normalizeEmail } from '@/lib/checkoutValidation';
import { enforceRateLimit } from '@/lib/rateLimit';

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, 'withdrawal', 5, 3600, true);
  if (limited) return limited;
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
    const name = text(body.name, 150);
    const orderId = text(body.orderId, 100);
    if (!email || !name || !/^[A-Za-z0-9_-]{1,100}$/.test(orderId) || body.confirmed !== true) return NextResponse.json({ error: 'Nom, e-mail, référence de commande et confirmation sont requis.' }, { status: 400 });
    const id = crypto.randomUUID();
    const receivedAt = new Date().toISOString();
    const declaration = `Je déclare me rétracter du contrat relatif à la commande ${orderId}.\nNom : ${name}\nE-mail : ${email}\nRéception : ${receivedAt}\nRéférence de la demande : ${id}`;
    // Persist the declaration before sending. No access, cancellation or refund is granted by a public form.
    await prisma.setting.create({ data: { key: `withdrawal:${receivedAt}:${id}`, value: encrypt(JSON.stringify({ id, email, name, orderId, receivedAt, declaration, status: 'received' })) } });
    let emailed = false;
    if (process.env.RESEND_API_KEY) {
      try {
        const result = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: 'StreamMalin <noreply@streammalin.fr>', to: email,
          subject: 'StreamMalin : accusé de réception de votre demande de rétractation',
          text: `${declaration}\n\nVotre déclaration est enregistrée. Le support vérifiera votre commande et les droits applicables. Cet accusé ne confirme pas encore un remboursement. Contact : hello@streammalin.fr.`,
        }, { idempotencyKey: `withdrawal:${id}` });
        emailed = Boolean(!result.error && result.data?.id);
      } catch { /* The saved declaration remains available to support. */ }
    }
    return NextResponse.json({ success: true, id, receivedAt, declaration, emailed }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'La demande n’a pas pu être enregistrée. Réessayez ou écrivez à hello@streammalin.fr.' }, { status: 503 }); }
}
