/**
 * POST /api/stripe/checkout
 *
 * Crée une session Stripe Checkout.
 * Variables requises : STRIPE_SECRET_KEY, NEXT_PUBLIC_BASE_URL
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAvailableStock } from '@/lib/dispatch';

const PRICES: Record<string, number> = { YOUTUBE: 5.99, DISNEY: 4.99 };
const LABELS: Record<string, string> = { YOUTUBE: 'YouTube Premium', DISNEY: 'Disney+ 4K' };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, service, gmail, durationMonths = 1 } = body as {
    email: string;
    service: string;
    gmail?: string;
    durationMonths: number;
  };

  if (!email?.includes('@')) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
  }
  if (!['YOUTUBE', 'DISNEY'].includes(service)) {
    return NextResponse.json({ error: 'Service invalide.' }, { status: 400 });
  }
  if (![1, 3, 6, 12].includes(durationMonths)) {
    return NextResponse.json({ error: 'Durée invalide.' }, { status: 400 });
  }
  if (service === 'YOUTUBE' && !gmail?.includes('@')) {
    return NextResponse.json({ error: 'Gmail requis pour YouTube.' }, { status: 400 });
  }

  // Check stock for Disney+
  if (service === 'DISNEY') {
    const stock = await getAvailableStock('DISNEY');
    if (stock === 0) {
      return NextResponse.json(
        { error: 'Désolé, Disney+ est temporairement complet. Contactez le support.' },
        { status: 409 }
      );
    }
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe non configuré.' }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://streammalin.fr';
  const unitPrice = PRICES[service];
  const totalCents = Math.round(unitPrice * durationMonths * 100);

  const stripe = new Stripe(stripeKey);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      payment_method_types: ['card'],
      payment_intent_data: {
        statement_descriptor: 'STREAMMALIN',
      },
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${LABELS[service]} — ${durationMonths} mois`,
              description: `Abonnement StreamMalin ${durationMonths} mois · ${(unitPrice * durationMonths).toFixed(2).replace('.', ',')}€`,
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        email: email.toLowerCase().trim(),
        service,
        gmail: gmail ?? '',
        durationMonths: String(durationMonths),
      },
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?checkout=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/checkout]', err);
    return NextResponse.json({ error: 'Erreur Stripe.' }, { status: 500 });
  }
}
