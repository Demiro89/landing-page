/**
 * POST /api/stripe/portal
 *
 * Crée une session du Customer Portal Stripe pour mettre à jour la carte bancaire.
 *
 * Body : { orderId, email }
 * Returns : { url }
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { orderId, email } = body as { orderId?: string; email?: string };

  if (!orderId || !email?.includes('@')) {
    return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe non configuré.' }, { status: 500 });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId },
    include: { user: true },
  });

  if (!order) {
    return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
  }
  if (order.user.email.toLowerCase() !== email.toLowerCase().trim()) {
    return NextResponse.json({ error: 'Email non autorisé.' }, { status: 403 });
  }
  if (!order.stripeCustomerId) {
    return NextResponse.json({ error: 'Aucun compte Stripe associé.' }, { status: 400 });
  }

  const stripe = new Stripe(stripeKey);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://streammalin.fr';

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: order.stripeCustomerId,
      return_url: `${baseUrl}/track-order?email=${encodeURIComponent(order.user.email)}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/portal]', err);
    return NextResponse.json({ error: 'Erreur Stripe Portal.' }, { status: 500 });
  }
}
