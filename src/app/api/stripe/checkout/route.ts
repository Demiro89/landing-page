/**
 * POST /api/stripe/checkout
 *
 * Crée une session Stripe Checkout en mode "subscription" (prélèvement mensuel automatique).
 * Variables requises : STRIPE_SECRET_KEY, NEXT_PUBLIC_BASE_URL
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAvailableStock } from '@/lib/dispatch';
import { getSetting } from '@/lib/settings';
export const dynamic = 'force-dynamic';


const LABELS: Record<string, string> = { YOUTUBE: 'YouTube Premium', DISNEY: 'Disney+ 4K', SURFSHARK: 'Surfshark VPN One' };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, service, gmail } = body as {
    email: string;
    service: string;
    gmail?: string;
  };

  if (!email?.includes('@')) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
  }
  if (!['YOUTUBE', 'DISNEY', 'SURFSHARK'].includes(service)) {
    return NextResponse.json({ error: 'Service invalide.' }, { status: 400 });
  }
  if (service === 'YOUTUBE' && !gmail?.includes('@')) {
    return NextResponse.json({ error: 'Gmail requis pour YouTube.' }, { status: 400 });
  }

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
  const priceKey = service === 'YOUTUBE' ? 'price_youtube' : service === 'DISNEY' ? 'price_disney' : 'price_surfshark';
  const fallbackPrice = service === 'YOUTUBE' ? 5.99 : service === 'DISNEY' ? 4.99 : 2.49;
  const unitPrice = parseFloat(await getSetting(priceKey)) || fallbackPrice;
  const unitAmountCents = Math.round(unitPrice * 100);
  const stripe = new Stripe(stripeKey);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${LABELS[service]} — Mensuel`,
              description: `Abonnement StreamMalin · ${unitPrice.toFixed(2).replace('.', ',')}€/mois · Résiliable à tout moment`,
            },
            unit_amount: unitAmountCents,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          email: email.toLowerCase().trim(),
          service,
          gmail: gmail ?? '',
        },
      },
      metadata: {
        email: email.toLowerCase().trim(),
        service,
        gmail: gmail ?? '',
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
