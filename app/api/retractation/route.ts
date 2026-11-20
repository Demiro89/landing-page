import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';
import { normalizeEmail } from '@/lib/checkoutValidation';
import { enforceRateLimit } from '@/lib/rateLimit';
import { readJsonObject } from '@/lib/requestJson';

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, 'withdrawal', 5, 3600, true);
  if (limited) return limited;
  try {
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.value;
    if (body.website !== undefined && (typeof body.website !== 'string' || body.website.trim() !== '')) {
      return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
    }
    const email = normalizeEmail(body.email);
    const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
    const name = text(body.name, 150);
    const orderId = text(body.orderId, 100);
    if (!email || !name || !/^[A-Za-z0-9_-]{1,100}$/.test(orderId) || body.confirmed !== true) return NextResponse.json({ error: 'Nom, e-mail, référence de commande et confirmation sont requis.' }, { status: 400 });
    const id = crypto.randomUUID();
    const receivedAt = new Date().toISOString();
    const declaration = `Je déclare me rétracter du contrat relatif à la commande ${orderId}.\nNom : ${name}\nE-mail : ${email}\nRéception : ${receivedAt}\nRéférence de la demande : ${id}`;
    // Persist the declaration before notifying support. No access, cancellation, refund, or third-party email is triggered by this public form.
    await prisma.setting.create({ data: { key: `withdrawal:${receivedAt}:${id}`, value: encrypt(JSON.stringify({ id, email, name, orderId, receivedAt, declaration, status: 'received' })) } });
    let supportNotified = false;
    if (process.env.RESEND_API_KEY) {
      try {
        const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
          from: 'StreamMalin <noreply@streammalin.fr>',
          to: 'hello@streammalin.fr',
          replyTo: email,
          subject: 'StreamMalin : nouvelle déclaration de rétractation',
          text: declaration,
        }, { idempotencyKey: `withdrawal:${id}` });
        supportNotified = Boolean(!result.error && result.data?.id);
      } catch { /* The saved declaration remains available to support. */ }
    }
    return NextResponse.json({ success: true, id, receivedAt, declaration, emailed: false, supportNotified }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ error: 'La demande n’a pas pu être enregistrée. Réessayez ou écrivez à hello@streammalin.fr.' }, { status: 503 }); }
}
