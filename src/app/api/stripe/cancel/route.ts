/**
 * POST /api/stripe/cancel
 *
 * Annule l'abonnement Stripe à la fin de la période courante.
 * Action : cancel_at_period_end = true  (l'accès reste actif jusqu'à expiresAt).
 *
 * Body : { orderId, email }
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

  // Trouver la commande et vérifier que l'email correspond
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
  if (!order.stripeSubscriptionId) {
    return NextResponse.json({ error: 'Pas d\'abonnement Stripe associé.' }, { status: 400 });
  }
  if (order.cancelAtEnd) {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }

  const stripe = new Stripe(stripeKey);

  try {
    await stripe.subscriptions.update(order.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { cancelAtEnd: true },
    });

    return NextResponse.json({ ok: true, expiresAt: order.expiresAt });
  } catch (err) {
    console.error('[stripe/cancel]', err);
    return NextResponse.json({ error: 'Erreur Stripe lors de la résiliation.' }, { status: 500 });
  }
}
