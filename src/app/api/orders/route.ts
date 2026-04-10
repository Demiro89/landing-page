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

const VALID_SERVICES = ['YOUTUBE', 'DISNEY', 'SURFSHARK'] as const;
const VALID_METHODS = ['PAYPAL', 'SOL', 'XRP', 'USDT_TRC20'] as const;
const VALID_DURATIONS = [1, 3, 6, 12] as const;

type Service = (typeof VALID_SERVICES)[number];
type PaymentMethod = (typeof VALID_METHODS)[number];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, service, amount, paymentMethod, paymentTxId, gmail, durationMonths = 1 } = body;

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

    if (!VALID_DURATIONS.includes(durationMonths)) {
      return NextResponse.json({ error: 'Durée invalide (1, 3, 6 ou 12 mois).' }, { status: 400 });
    }

    if (!paymentTxId || typeof paymentTxId !== 'string' || paymentTxId.length < 3) {
      return NextResponse.json({ error: 'ID de transaction requis.' }, { status: 400 });
    }

    const basePrice = service === 'YOUTUBE' ? 5.99 : service === 'DISNEY' ? 4.99 : 2.49;
    const expectedAmount = Math.round(basePrice * durationMonths * 100) / 100;
    if (typeof amount !== 'number' || Math.abs(amount - expectedAmount) > 0.05) {
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
    const msPerMonth = 30.5 * 24 * 60 * 60 * 1000;
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        service: service as Service,
        amount: expectedAmount,
        paymentMethod: paymentMethod as PaymentMethod,
        paymentTxId: paymentTxId.trim(),
        status: 'PAYMENT_DECLARED',
        durationMonths,
        gmail: service === 'YOUTUBE' ? gmail?.toLowerCase().trim() : null,
        expiresAt: new Date(Date.now() + durationMonths * msPerMonth),
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

    // ── Emails — séquentiels, chacun dans son propre try/catch ──
    // NE PAS utiliser Promise.all : si un email lève une exception,
    // il annule l'autre et remonte dans le catch global (→ 500 sans email).
    console.log('[orders] Début envoi emails pour commande', order.id);

    try {
      console.log('[orders] → Email admin en cours...');
      const adminOk = await sendAdminNewOrder({
        orderId: order.id,
        customerEmail: email.toLowerCase().trim(),
        service: service as Service,
        amount: expectedAmount,
        durationMonths,
        paymentMethod,
        paymentTxId: paymentTxId.trim(),
        gmail: service === 'YOUTUBE' ? gmail : undefined,
      });
      console.log('[orders] Email admin :', adminOk ? '✅ envoyé' : '❌ échec');
    } catch (err) {
      console.error('[orders] Exception email admin :', err);
    }

    try {
      console.log('[orders] → Email client en cours...');
      const clientOk = await sendOrderReceived({
        to: email.toLowerCase().trim(),
        orderId: order.id,
        service: service as Service,
        amount: expectedAmount,
        durationMonths,
        paymentMethod,
      });
      console.log('[orders] Email client :', clientOk ? '✅ envoyé' : '❌ échec');
    } catch (err) {
      console.error('[orders] Exception email client :', err);
    }

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
