import { NextResponse } from 'next/server';
import { logServerFailure } from '@/lib/securityLog';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';
import { ownsOrder } from '@/lib/orderAccess';
import { commerceEnabled } from '@/lib/commerce';
import { readJsonObject } from '@/lib/requestJson';
import { enforceRateLimit } from '@/lib/rateLimit';
import { APP_URL } from '@/lib/appUrl';

export const dynamic = 'force-dynamic';

/**
 * Migre une commande existante (PayPal/manuel) vers un abonnement Stripe.
 * Crée une session Stripe Checkout en mode subscription avec trial_end aligné sur la prochaine échéance,
 * pour ne pas refacturer le client avant la fin de sa période payée.
 */
export async function POST(request: Request) {
  // This legacy migration flow requires a separate verified recurring-payment rollout.
  if (!commerceEnabled() || process.env.LEGACY_SUBSCRIPTION_MIGRATION_ENABLED !== 'true') return NextResponse.json({ error: 'Le passage au prélèvement automatique est temporairement indisponible.' }, { status: 503 });
  try {
    const limited = await enforceRateLimit(request, 'migrate-subscription', 10, 600, true);
    if (limited) return limited;

    const customer = await getCurrentCustomer();
    if (!customer) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
    }

    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key === 'sk_test_mock') {
      return NextResponse.json({ error: 'Stripe est temporairement indisponible.' }, { status: 503 });
    }
    const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });

    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const { orderId } = parsed.value;
    if (typeof orderId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(orderId)) {
      return NextResponse.json({ error: 'orderId requis' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { service: true },
    });
    if (!order || !ownsOrder(order, customer)) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    if (order.stripeSubscriptionId) {
      return NextResponse.json({ error: 'Cet abonnement est déjà géré par Stripe' }, { status: 400 });
    }
    if (order.status !== 'active') {
      return NextResponse.json({ error: 'Seul un abonnement actif peut être migré.' }, { status: 409 });
    }

    // Calculer la fin de période payée (date + 30 jours)
    const trialEndDate = new Date(order.date);
    trialEndDate.setDate(trialEndDate.getDate() + 30);
    const now = new Date();
    // Si déjà passé, on facture immédiatement le mois suivant
    const trialEnd = trialEndDate > now ? Math.floor(trialEndDate.getTime() / 1000) : Math.floor(Date.now() / 1000) + 60;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'link'],
      customer_email: customer.email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `StreamMalin - ${order.service.name}`,
              description: `Abonnement mensuel à ${order.service.name} (prélèvement automatique CB)`,
            },
            unit_amount: Math.round(order.price * 100),
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_end: trialEnd,
        metadata: {
          migrateOrderId: order.id,
          serviceId: order.serviceId,
          clientEmail: customer.email,
        },
      },
      metadata: {
        migrateOrderId: order.id,
        serviceId: order.serviceId,
        clientEmail: customer.email,
        price: order.price.toString(),
      },
      success_url: `${APP_URL}/?migrated=true`,
      cancel_url: `${APP_URL}/?migrated=cancelled`,
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error: unknown) {
    logServerFailure('client/migrate-to-subscription', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
