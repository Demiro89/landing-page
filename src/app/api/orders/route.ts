/**
 * POST /api/orders
 *
 * Crée une nouvelle commande après déclaration de paiement.
 * - Crée ou récupère l'utilisateur par email
 * - Crée la commande avec status PAYMENT_DECLARED
 * - Envoie une notification Telegram à l'admin
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyPaymentDeclared } from '@/lib/telegram';
import { getAvailableStock } from '@/lib/dispatch';
import { sendAdminNewOrder, sendOrderReceived } from '@/lib/email';

const VALID_SERVICES = ['YOUTUBE', 'DISNEY'] as const;
const VALID_METHODS = ['PAYPAL', 'SOL', 'XRP', 'USDT_TRC20'] as const;

type Service = (typeof VALID_SERVICES)[number];
type PaymentMethod = (typeof VALID_METHODS)[number];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, service, amount, paymentMethod, paymentTxId, gmail } = body;

    // ── Validation ──
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
    }

    if (!VALID_SERVICES.includes(service)) {
      return NextResponse.json({ error: 'Service invalide.' }, { status: 400 });
    }

    if (!VALID_METHODS.includes(paymentMethod)) {
      return NextResponse.json({ error: 'Méthode de paiement invalide.' }, { status: 400 });
    }

    if (!paymentTxId || typeof paymentTxId !== 'string' || paymentTxId.length < 3) {
      return NextResponse.json({ error: 'ID de transaction requis.' }, { status: 400 });
    }

    const expectedAmount = service === 'YOUTUBE' ? 5.99 : 4.99;
    if (typeof amount !== 'number' || Math.abs(amount - expectedAmount) > 0.01) {
      return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 });
    }

    // YouTube requires Gmail
    if (service === 'YOUTUBE' && (!gmail || !gmail.includes('@'))) {
      return NextResponse.json(
        { error: 'Adresse Gmail requise pour YouTube Premium.' },
        { status: 400 }
      );
    }

    // ── Check stock ──
    const availableSlots = await getAvailableStock(service as Service);
    if (availableSlots === 0) {
      return NextResponse.json(
        {
          error:
            'Désolé, ce service est temporairement complet. Contactez le support sur Telegram.',
        },
        { status: 409 }
      );
    }

    // ── Upsert user ──
    const user = await prisma.user.upsert({
      where: { email: email.toLowerCase().trim() },
      update: {},
      create: {
        email: email.toLowerCase().trim(),
      },
    });

    // ── Create order ──
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        service: service as Service,
        amount: expectedAmount,
        paymentMethod: paymentMethod as PaymentMethod,
        paymentTxId: paymentTxId.trim(),
        status: 'PAYMENT_DECLARED',
        gmail: service === 'YOUTUBE' ? gmail?.toLowerCase().trim() : null,
        // Expire dans 31 jours
        expiresAt: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
      },
    });

    // ── Telegram notification ──
    await notifyPaymentDeclared({
      orderId: order.id,
      email: email.toLowerCase().trim(),
      service: service as Service,
      amount: expectedAmount,
      paymentMethod: paymentMethod as PaymentMethod,
      paymentTxId: paymentTxId.trim(),
      gmail: service === 'YOUTUBE' ? gmail : undefined,
    });

    // ── Emails (admin + client) — en parallèle, sans bloquer la réponse ──
    Promise.all([
      sendAdminNewOrder({
        orderId: order.id,
        customerEmail: email.toLowerCase().trim(),
        service: service as Service,
        amount: expectedAmount,
        paymentMethod,
        paymentTxId: paymentTxId.trim(),
        gmail: service === 'YOUTUBE' ? gmail : undefined,
      }),
      sendOrderReceived({
        to: email.toLowerCase().trim(),
        orderId: order.id,
        service: service as Service,
        amount: expectedAmount,
        paymentMethod,
      }),
    ]).catch((err) => console.error('[orders] email error:', err));

    return NextResponse.json(
      { orderId: order.id, status: order.status },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/orders]', error);
    return NextResponse.json(
      { error: 'Une erreur interne est survenue. Veuillez réessayer.' },
      { status: 500 }
    );
  }
}
