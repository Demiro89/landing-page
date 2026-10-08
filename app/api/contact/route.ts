import 'server-only';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { enforceRateLimit } from '@/lib/rateLimit';
import { CONTACT_TOPICS, validateContact } from '@/lib/contactValidation';

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, 'contact', 5, 3600, true);
  if (limited) return limited;
  if (!request.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'Format de message invalide.' }, { status: 415 });
  const declaredLength = Number(request.headers.get('content-length'));
  if (declaredLength > 16000) return NextResponse.json({ error: 'Message trop volumineux.' }, { status: 413 });
  let body: unknown;
  try {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (!reader) throw new Error('Empty body');
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 16000) {
        await reader.cancel();
        return NextResponse.json({ error: 'Message trop volumineux.' }, { status: 413 });
      }
      chunks.push(chunk.value);
    }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { return NextResponse.json({ error: 'Format de message invalide.' }, { status: 400 }); }
  const contact = validateContact(body);
  if (!contact) return NextResponse.json({ error: 'Vérifiez votre e-mail, le sujet et votre message (10 à 3 000 caractères).' }, { status: 400 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'L’envoi est temporairement indisponible. Écrivez à hello@streammalin.fr.' }, { status: 503 });
  try {
    // The public form can only send plain text to our fixed support inbox, never to an arbitrary recipient.
    const digest = createHash('sha256').update(JSON.stringify(contact)).digest('hex');
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'StreamMalin <noreply@streammalin.fr>',
      to: 'hello@streammalin.fr',
      replyTo: contact.email,
      subject: `StreamMalin : ${CONTACT_TOPICS[contact.topic]}`,
      text: `Sujet : ${CONTACT_TOPICS[contact.topic]}\nE-mail de réponse : ${contact.email}\nRéférence : ${contact.attemptId}\n\n${contact.message}`,
    }, { idempotencyKey: `contact:${digest}` });
    if (result.error || !result.data?.id) throw new Error('Support transport unavailable');
    return NextResponse.json({ success: true, reference: contact.attemptId }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Votre message n’a pas pu être transmis. Réessayez ou écrivez à hello@streammalin.fr.' }, { status: 503 }); }
}
