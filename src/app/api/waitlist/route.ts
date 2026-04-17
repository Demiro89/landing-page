/**
 * POST /api/waitlist
 *
 * Inscrit un email sur la liste d'attente et envoie un email de confirmation
 * via Resend. Anti-doublon : retourne 200 si l'email est déjà inscrit
 * (évite l'énumération d'adresses).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
export const dynamic = 'force-dynamic';


const schema = z.object({
  email: z.string().email('Adresse email invalide.'),
  name: z.string().max(80).optional(),
});

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 });
  }

  const { email, name } = parsed.data;
  const normalized = email.toLowerCase().trim();

  // Upsert — idempotent, pas de doublon
  const entry = await prisma.waitlist.upsert({
    where:  { email: normalized },
    update: {},           // déjà inscrit : on ne change rien
    create: { email: normalized, name: name?.trim() ?? null },
  });

  // Envoi de l'email de confirmation uniquement lors de la première inscription
  // (createdAt ≈ updatedAt → nouvel enregistrement)
  if (entry.status === 'PENDING' && !entry.invitedAt) {
    const fromName = 'StreamMalin';
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'hello@streammalin.fr';

    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: normalized,
      subject: '✅ Tu es sur la liste d\'attente StreamMalin',
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0a0f;color:#f0f0f5;padding:40px 32px;border-radius:16px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px">
            <div style="width:34px;height:34px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center">
              <span style="color:#000;font-weight:800;font-size:1rem">⚡</span>
            </div>
            <span style="font-weight:800;font-size:1.1rem">StreamMalin</span>
          </div>
          <h1 style="font-size:1.4rem;font-weight:800;margin:0 0 12px">Tu es inscrit·e sur la liste d'attente !</h1>
          <p style="color:#8888aa;line-height:1.7;margin:0 0 20px">
            Merci ${name ? name.trim() : ''} — ton adresse <strong style="color:#f0f0f5">${normalized}</strong>
            est bien enregistrée. Tu seras parmi les premiers prévenus quand une place se libère.
          </p>
          <p style="color:#8888aa;font-size:0.85rem;margin:0">
            — L'équipe StreamMalin
          </p>
        </div>
      `,
    }).catch((e) => console.error('[waitlist] Resend error:', e));
  }

  return NextResponse.json({ ok: true });
}
