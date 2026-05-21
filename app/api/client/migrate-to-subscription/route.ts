import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Migre une commande existante (PayPal/manuel) vers un abonnement Stripe.
 * Crée une session Stripe Checkout en mode subscription avec trial_end aligné sur la prochaine échéance,
 * pour ne pas refacturer le client avant la fin de sa période payée.
 */
export async function POST(request: Request) {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
    }

    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId requis' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { service: true },
    });
    if (!order || order.clientEmail.toLowerCase() !== customer.email.toLowerCase()) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    if (order.stripeSubscriptionId) {
      return NextResponse.json({ error: 'Cet abonnement est déjà géré par Stripe' }, { status: 400 });
    }

    // Calculer la fin de période payée (date + 30 jours)
    const trialEndDate = new Date(order.date);
    trialEndDate.setDate(trialEndDate.getDate() + 30);
    const now = new Date();
    // Si déjà passé, on facture immédiatement le mois suivant
    const trialEnd = trialEndDate > now ? Math.floor(trialEndDate.getTime() / 1000) : Math.floor(Date.now() / 1000) + 60;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'link'] as any,
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
  } catch (error: any) {
    console.error('[migrate-to-subscription]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
