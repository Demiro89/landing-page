/**
 * GET  /api/admin/waitlist           — liste toutes les entrées
 * PATCH /api/admin/waitlist          — marque comme "INVITED" et envoie un code d'invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
export const dynamic = 'force-dynamic';


function auth(req: NextRequest): boolean {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  return !!token && token === process.env.ADMIN_SECRET_TOKEN;
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });

  try {
    const entries = await prisma.waitlist.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ entries });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });

  try {
    const { waitlistId, inviteCode } = await req.json().catch(() => ({}));
    if (!waitlistId) return NextResponse.json({ error: 'waitlistId requis.' }, { status: 400 });

    const entry = await prisma.waitlist.findUnique({ where: { id: waitlistId } });
    if (!entry) return NextResponse.json({ error: 'Entrée introuvable.' }, { status: 404 });

    await prisma.waitlist.update({
      where: { id: waitlistId },
      data: { status: 'INVITED', invitedAt: new Date() },
    });

    // Envoi de l'invitation par email
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'hello@streammalin.fr';
    const siteUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://streammalin.fr';

    await resend.emails.send({
      from: `StreamMalin <${fromEmail}>`,
      to: entry.email,
      subject: '🎉 Tu es invité·e à rejoindre StreamMalin',
      html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0a0f;color:#f0f0f5;padding:40px 32px;border-radius:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px">
          <div style="width:34px;height:34px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center">
            <span style="color:#000;font-weight:800;font-size:1rem">⚡</span>
          </div>
          <span style="font-weight:800;font-size:1.1rem">StreamMalin</span>
        </div>
        <h1 style="font-size:1.4rem;font-weight:800;margin:0 0 12px">Ton invitation est arrivée !</h1>
        <p style="color:#8888aa;line-height:1.7;margin:0 0 20px">
          Une place vient de se libérer. Utilise le code ci-dessous pour accéder au site.
        </p>
        ${inviteCode ? `
        <div style="background:#1a1a2e;border:1px solid rgba(167,139,250,0.3);border-radius:12px;padding:20px 24px;text-align:center;margin-bottom:24px">
          <p style="color:#8888aa;font-size:0.8rem;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.08em">Ton code d'accès</p>
          <p style="font-family:monospace;font-size:1.6rem;font-weight:800;color:#a78bfa;margin:0;letter-spacing:0.15em">${inviteCode}</p>
        </div>
        ` : ''}
        <a href="${siteUrl}/beta-access" style="display:block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:700;margin-bottom:20px">
          Accéder à StreamMalin →
        </a>
        <p style="color:#8888aa;font-size:0.82rem;margin:0">
          Ce code est personnel et à usage unique. Ne le partage pas.<br/>
          — L'équipe StreamMalin
        </p>
      </div>
    `,
    }).catch((e) => console.error('[admin/waitlist] Resend error:', e));

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
