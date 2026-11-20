import { NextResponse } from 'next/server';
import { logServerFailure } from '@/lib/securityLog';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';
import { enforceRateLimit } from '@/lib/rateLimit';
import { APP_URL } from '@/lib/appUrl';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, 'billing-portal', 10, 600, true);
    if (limited) return limited;

    const customer = await getCurrentCustomer();
    if (!customer) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
    }

    // Récupérer le stripeCustomerId depuis le Customer ou la première commande active
    let stripeCustomerId = customer.stripeCustomerId;
    if (!stripeCustomerId) {
      const order = await prisma.order.findFirst({
        where: {
          OR: [{ customerId: customer.id }, { customerId: null, clientEmail: customer.email }],
          stripeCustomerId: { not: null },
        },
      });
      stripeCustomerId = order?.stripeCustomerId || null;
      if (stripeCustomerId) {
        await prisma.customer.update({ where: { id: customer.id }, data: { stripeCustomerId } }).catch(() => {});
      }
    }

    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'Aucun abonnement Stripe associé à ce compte. Veuillez d\'abord activer le prélèvement automatique sur l\'un de vos abonnements.' }, { status: 400 });
    }

    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key === 'sk_test_mock') {
      return NextResponse.json({ error: 'Stripe est temporairement indisponible.' }, { status: 503 });
    }
    const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${APP_URL}/?from=portal`,
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error: unknown) {
    logServerFailure('client/billing-portal', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
