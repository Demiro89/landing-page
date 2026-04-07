/**
 * POST /api/gmail
 *
 * Enregistre ou met à jour le Gmail d'un client pour une commande YouTube.
 * Envoie une notification Telegram à l'admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyPaymentDeclared } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, gmail } = body;

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'orderId requis.' }, { status: 400 });
    }

    if (!gmail || typeof gmail !== 'string' || !gmail.includes('@')) {
      return NextResponse.json({ error: 'Adresse Gmail invalide.' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
    }

    if (order.service !== 'YOUTUBE') {
      return NextResponse.json(
        { error: 'Cette commande n\'est pas pour YouTube.' },
        { status: 400 }
      );
    }

    // Update Gmail
    await prisma.order.update({
      where: { id: orderId },
      data: { gmail: gmail.toLowerCase().trim() },
    });

    // Notify admin that Gmail was updated/added
    const message = `📧 <b>Gmail mis à jour</b>\n\nOrder: <code>${orderId}</code>\nEmail: <code>${order.user.email}</code>\nGmail YouTube: <code>${gmail.toLowerCase().trim()}</code>\n\n⚠️ Envoyez l'invitation YouTube Premium maintenant.`;

    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    ).catch(() => {}); // non-blocking

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/gmail]', error);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
