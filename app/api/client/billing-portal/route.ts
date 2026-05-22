import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2023-10-16' as any,
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST() {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
    }

    // Récupérer le stripeCustomerId depuis le Customer ou la première commande active
    let stripeCustomerId = customer.stripeCustomerId;
    if (!stripeCustomerId) {
      const order = await prisma.order.findFirst({
        where: { clientEmail: customer.email, stripeCustomerId: { not: null } },
      });
      stripeCustomerId = order?.stripeCustomerId || null;
      if (stripeCustomerId) {
        await prisma.customer.update({ where: { id: customer.id }, data: { stripeCustomerId } });
      }
    }

    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'Aucun abonnement Stripe associé à ce compte. Veuillez d\'abord activer le prélèvement automatique sur l\'un de vos abonnements.' }, { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${APP_URL}/?from=portal`,
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error: any) {
    console.error('[billing-portal]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
