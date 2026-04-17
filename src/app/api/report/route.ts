/**
 * POST /api/report
 *
 * Permet à un client de signaler un problème sur sa commande.
 * Stocke le signalement en DB et envoie une notification Telegram à l'admin.
 *
 * Body : { orderId, email, issue, message? }
 * issue : "ACCESS" | "BILLING" | "OTHER"
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyOrderReport } from '@/lib/telegram';
export const dynamic = 'force-dynamic';


const VALID_ISSUES = ['ACCESS', 'BILLING', 'OTHER'] as const;
type IssueType = typeof VALID_ISSUES[number];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { orderId, email, issue, message } = body as {
    orderId?: string;
    email?: string;
    issue?: string;
    message?: string;
  };

  if (!orderId?.trim() || !email?.includes('@') || !issue?.trim()) {
    return NextResponse.json({ error: 'Données invalides.' }, { status: 400 });
  }

  if (!VALID_ISSUES.includes(issue as IssueType)) {
    return NextResponse.json({ error: 'Type de problème invalide.' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Vérifie que la commande appartient bien à cet email (sécurité)
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      user: { email: normalizedEmail },
    },
    select: { id: true, service: true },
  });

  if (!order) {
    // Réponse identique même si commande introuvable (anti-énumération)
    return NextResponse.json({ ok: true });
  }

  // Limite anti-spam : max 3 signalements par commande
  const existingCount = await prisma.orderReport.count({
    where: { orderId, email: normalizedEmail },
  });

  if (existingCount >= 3) {
    return NextResponse.json(
      { error: 'Vous avez déjà signalé plusieurs problèmes pour cette commande.' },
      { status: 429 }
    );
  }

  // Enregistre le signalement
  await prisma.orderReport.create({
    data: {
      orderId,
      email: normalizedEmail,
      issue,
      message: message?.trim() || null,
    },
  });

  // Notification Telegram admin
  const serviceLabel =
    order.service === 'YOUTUBE' ? '🔴 YouTube Premium' :
    order.service === 'DISNEY'  ? '🟣 Disney+ 4K'      :
                                  '🔵 Surfshark VPN One';

  await notifyOrderReport({
    orderId,
    email: normalizedEmail,
    service: serviceLabel,
    issue,
    message: message?.trim(),
  }).catch((e) => console.error('[report] Telegram notif failed:', e));

  return NextResponse.json({ ok: true });
}
