/**
 * POST /api/stripe/webhook
 *
 * Gère les événements Stripe pour les abonnements récurrents.
 *
 * Événements traités :
 *  - checkout.session.completed  : création de commande (backup si success page rate)
 *  - invoice.paid                : renouvellement → prolonge expiresAt de +30 jours
 *  - invoice.payment_failed      : échec prélèvement → marque paymentFailed, notifie
 *  - customer.subscription.deleted : résiliation définitive → CANCELLED + libère slot
 *
 * Variable requise : STRIPE_WEBHOOK_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { sendPaymentFailed, sendAdminPaymentFailed } from '@/lib/email';
import { releaseSlot } from '@/lib/dispatch';
import { notifyOrderConfirmed } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe non configuré.' }, { status: 500 });
  }

  const stripe = new Stripe(stripeKey);

  // Verify webhook signature
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[webhook] Signature invalide:', err);
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 400 });
  }

  console.log(`[webhook] Événement reçu : ${event.type}`);

  try {
    switch (event.type) {
      // ── Checkout complété (backup — success page gère normalement la création) ──
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;

        const { email, service, gmail } = session.metadata ?? {};
        if (!email || !service) break;

        const stripeSubscriptionId =
          typeof session.subscription === 'string' ? session.subscription : null;
        const stripeCustomerId =
          typeof session.customer === 'string' ? session.customer : null;

        // Idempotency — si la commande existe déjà (créée par success page), mettre à jour les IDs
        const existing = await prisma.order.findFirst({
          where: { paymentTxId: session.id },
        });

        if (existing) {
          if (stripeSubscriptionId && !existing.stripeSubscriptionId) {
            await prisma.order.update({
              where: { id: existing.id },
              data: { stripeSubscriptionId, stripeCustomerId },
            });
          }
          break;
        }

        // Créer la commande si la success page n'a pas encore réussi
        const msPerMonth = 30 * 24 * 60 * 60 * 1000;
        const totalAmount = (session.amount_total ?? 0) / 100;

        const user = await prisma.user.upsert({
          where: { email: email.toLowerCase().trim() },
          update: {},
          create: { email: email.toLowerCase().trim() },
        });

        const newOrder = await prisma.order.create({
          data: {
            userId: user.id,
            service,
            amount: totalAmount,
            paymentMethod: 'STRIPE',
            paymentTxId: session.id,
            status: 'ACTIVE',
            durationMonths: 1,
            gmail: service === 'YOUTUBE' ? (gmail || null) : null,
            expiresAt: new Date(Date.now() + msPerMonth),
            stripeSubscriptionId,
            stripeCustomerId,
          },
        });

        // Notification Telegram : nouvelle commande Stripe activée
        await notifyOrderConfirmed({
          orderId: newOrder.id,
          email: email.toLowerCase().trim(),
          service: service as 'YOUTUBE' | 'DISNEY' | 'SURFSHARK',
          amount: totalAmount,
          durationMonths: 1,
        }).catch((e) => console.error('[webhook] notifyOrderConfirmed Telegram:', e));

        break;
      }

      // ── Facture payée = renouvellement mensuel réussi ──
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;

        // Ne traiter que les renouvellements cycliques (pas la première facture)
        if (invoice.billing_reason !== 'subscription_cycle') break;

        // Stripe v22: subscription ID is under invoice.parent.subscription_details.subscription
        const subDetails = invoice.parent?.subscription_details;
        const rawSub = subDetails?.subscription;
        const subscriptionId =
          typeof rawSub === 'string' ? rawSub : (rawSub as Stripe.Subscription | null)?.id;
        if (!subscriptionId) break;

        const order = await prisma.order.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
        });
        if (!order) break;

        const msPerMonth = 30 * 24 * 60 * 60 * 1000;
        const currentExpiry = order.expiresAt ?? new Date();
        // Prolonger depuis la date d'expiration actuelle (pas de now(), évite les décalages)
        const newExpiry = new Date(currentExpiry.getTime() + msPerMonth);

        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'ACTIVE',
            expiresAt: newExpiry,
            paymentFailed: false,
            cancelAtEnd: false,
          },
        });
        console.log(`[webhook] Renouvellement OK → commande ${order.id} → ${newExpiry.toISOString()}`);
        break;
      }

      // ── Échec de prélèvement ──
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;

        const subDetails2 = invoice.parent?.subscription_details;
        const rawSub2 = subDetails2?.subscription;
        const subscriptionId =
          typeof rawSub2 === 'string' ? rawSub2 : (rawSub2 as Stripe.Subscription | null)?.id;
        if (!subscriptionId) break;

        const order = await prisma.order.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
          include: { user: true },
        });
        if (!order) break;

        await prisma.order.update({
          where: { id: order.id },
          data: { paymentFailed: true },
        });

        // Email client
        await sendPaymentFailed({
          to: order.user.email,
          service: order.service as 'YOUTUBE' | 'DISNEY',
          orderId: order.id,
          stripeCustomerId: order.stripeCustomerId ?? undefined,
        }).catch((e) => console.error('[webhook] sendPaymentFailed:', e));

        // Email admin
        await sendAdminPaymentFailed({
          orderId: order.id,
          customerEmail: order.user.email,
          service: order.service as 'YOUTUBE' | 'DISNEY',
        }).catch((e) => console.error('[webhook] sendAdminPaymentFailed:', e));

        console.log(`[webhook] Échec paiement → commande ${order.id}`);
        break;
      }

      // ── Abonnement définitivement annulé par Stripe (après X tentatives échouées) ──
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        const order = await prisma.order.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
        });
        if (!order) break;

        // Libérer le slot si assigné
        if (order.slotId) {
          await releaseSlot(order.id).catch((e) =>
            console.error('[webhook] releaseSlot:', e)
          );
        }

        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED', cancelAtEnd: false, paymentFailed: false },
        });

        console.log(`[webhook] Abonnement annulé → commande ${order.id} → CANCELLED`);
        break;
      }

      default:
        // Ignorer les autres événements
        break;
    }
  } catch (err) {
    console.error(`[webhook] Erreur traitement ${event.type}:`, err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
