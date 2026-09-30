import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { sendOrderDetailsEmail, sendUnpaidReminderEmail, sendRenewalEmail } from '@/lib/nodemailer';
import { sendTelegramNotification } from '@/lib/telegram';
import { createInvoiceForOrder } from '@/lib/invoice';
import { decrypt } from '@/lib/crypto';
import { processWebhookEvent } from '@/lib/webhookTransaction';
import { cancelOrderAndReleaseStock } from '@/lib/orderLifecycle';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2026-04-22.dahlia',
});

export async function POST(request: Request) {
  let processedEventId: string | null = null;

  // Fail-closed : sans clé Stripe ET secret webhook, on rejette l'évènement
  // au lieu de le traiter avec une signature non vérifiée.
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_mock') {
    console.error('[stripe webhook] Stripe non configuré — évènement rejeté');
    return NextResponse.json({ error: 'Webhook non configuré' }, { status: 500 });
  }

  try {
    const body = await request.text();
    const sig = request.headers.get('stripe-signature') || '';

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Signature invalide';
      console.error('❌ Erreur signature Webhook:', message);
      return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
    }

    // Idempotence : ne jamais retraiter un évènement déjà reçu (Stripe rejoue les évènements).
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({ where: { id: event.id } });
    if (alreadyProcessed) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    processedEventId = event.id;

    switch (event.type) {
      /* ─── Création initiale de l'abonnement (premier paiement réussi) ─── */
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata;
        if (!metadata) break;

        const {
          serviceId,
          stockAccountId,
          clientEmail,
          price,
          migrateOrderId,
          youtubeEmail,
          acceptedAt,
          acceptedTermsAt,
          acceptedWithdrawalWaiverAt,
          acceptedEligibilityAt,
          termsVersion,
          acceptanceUserAgent,
          acceptanceIp,
        } = metadata as Record<string, string | undefined>;
        if (session.payment_status === 'unpaid') break;

        // Cas 1 : migration d'une commande existante vers Stripe Subscription
        if (migrateOrderId && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string, { expand: ['default_payment_method'] });
          const pm = sub.default_payment_method as Stripe.PaymentMethod | null;
          await processWebhookEvent(event, async (tx) => {
            const previous = await tx.order.findUnique({ where: { id: migrateOrderId } });
            if (previous?.stripeSubscriptionId === sub.id) return;
            const migrated = await tx.order.updateMany({
              where: { id: migrateOrderId, status: 'active', stripeSubscriptionId: null, clientEmail },
              data: {
                stripeSubscriptionId: sub.id,
                stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
                cardLast4: pm?.card?.last4 || null,
                cardBrand: pm?.card?.brand || null,
                cardExpMonth: pm?.card?.exp_month || null,
                cardExpYear: pm?.card?.exp_year || null,
                nextBillingAt: new Date((sub.items.data[0]?.current_period_end || 0) * 1000),
                status: 'active',
              },
            });
            if (migrated.count !== 1) throw new Error('Migration Stripe refusée : commande modifiée');
          });
          // Lier le customer Stripe au compte client
          if (clientEmail) {
            const customer = await prisma.customer.findUnique({ where: { email: clientEmail.toLowerCase() } });
            if (customer && typeof sub.customer === 'string') {
              await prisma.customer.update({
                where: { id: customer.id },
                data: { stripeCustomerId: sub.customer },
              }).catch(() => {});
            }
          }
          sendTelegramNotification(`✅ <b>Migration Stripe réussie</b>\n👤 ${clientEmail}\n💳 •••• ${pm?.card?.last4 || '----'}`).catch(() => {});
          break;
        }

        // Cas 2 : nouveau checkout
        if (!serviceId || !stockAccountId || !clientEmail || !price) {
          throw new Error(`Stripe checkout sans métadonnées complètes: ${session.id}`);
        }
        if (session.payment_status !== 'paid' || !session.subscription || session.currency !== 'eur') {
          throw new Error(`Checkout non payé ou sans abonnement: ${session.id}`);
        }
        const parsedPrice = Number(price);
        if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
          throw new Error(`Stripe checkout avec prix invalide: ${session.id}`);
        }
        if (session.amount_total !== Math.round(parsedPrice * 100)) throw new Error('Montant Stripe inattendu');
        const existingOrder = await prisma.order.findUnique({ where: { stripeSubscriptionId: session.subscription as string } });
        if (existingOrder) {
          await processWebhookEvent(event, async () => existingOrder);
          break;
        }
        const service = await prisma.service.findUnique({ where: { id: serviceId } });
        const stockAccount = await prisma.stockAccount.findUnique({ where: { id: stockAccountId } });
        if (!service || !stockAccount) {
          throw new Error(`Stripe checkout avec service ou stock introuvable: ${session.id}`);
        }
        if (stockAccount.serviceId !== serviceId || stockAccount.filledSlots >= stockAccount.maxSlots) {
          sendTelegramNotification(
            `⚠️ <b>Paiement Stripe reçu sans stock disponible</b>\n👤 ${clientEmail}\n📺 ${service.name}\n💶 ${parsedPrice.toFixed(2)}€\n🔖 Session ${session.id}`
          ).catch(() => {});
          throw new Error(`Stock indisponible après paiement Stripe: ${session.id}`);
        }

        const sub = session.subscription
          ? await stripe.subscriptions.retrieve(session.subscription as string, { expand: ['default_payment_method'] })
          : null;
        const pm = sub?.default_payment_method as Stripe.PaymentMethod | null;
        const stripeCustomerId = sub ? (typeof sub.customer === 'string' ? sub.customer : sub.customer.id) : null;

        const order = await processWebhookEvent(event, async (tx) => {
          const existing = await tx.order.findUnique({ where: { stripeSubscriptionId: sub!.id } });
          if (existing) return existing;
          const currentStock = await tx.stockAccount.findUnique({ where: { id: stockAccountId } });
          if (!currentStock || currentStock.serviceId !== serviceId || currentStock.filledSlots >= currentStock.maxSlots) {
            throw new Error('Stock indisponible pour cette commande Stripe');
          }
          const stockIncrement = await tx.stockAccount.updateMany({
            where: { id: stockAccountId, serviceId, filledSlots: { lt: tx.stockAccount.fields.maxSlots } },
            data: { filledSlots: { increment: 1 } },
          });
          if (stockIncrement.count === 0) {
            throw new Error('Stock indisponible pour cette commande Stripe');
          }
          // Read credentials after acquiring the stock row lock through the update.
          const allocatedStock = await tx.stockAccount.findUniqueOrThrow({ where: { id: stockAccountId } });
          const createdOrder = await tx.order.create({
            data: {
              serviceId,
              stockAccountId,
              price: parsedPrice,
              total: parsedPrice,
              details: allocatedStock.details,
              clientEmail,
              youtubeEmail: youtubeEmail || null,
              paymentMethod: 'Carte bancaire (Stripe)',
              status: 'active',
              stripeSubscriptionId: sub?.id || null,
              stripeCustomerId,
              cardLast4: pm?.card?.last4 || null,
              cardBrand: pm?.card?.brand || null,
              cardExpMonth: pm?.card?.exp_month || null,
              cardExpYear: pm?.card?.exp_year || null,
              nextBillingAt: sub ? new Date((sub.items.data[0]?.current_period_end || 0) * 1000) : new Date(Date.now() + 30 * 86400000),
              acceptedCgv: Boolean(acceptedTermsAt || acceptedAt),
              acceptedImmediateExecution: Boolean(acceptedWithdrawalWaiverAt || acceptedAt),
              acceptedAt: acceptedAt ? new Date(acceptedAt) : null,
              acceptedTermsAt: acceptedTermsAt ? new Date(acceptedTermsAt) : acceptedAt ? new Date(acceptedAt) : null,
              acceptedWithdrawalWaiverAt: acceptedWithdrawalWaiverAt ? new Date(acceptedWithdrawalWaiverAt) : acceptedAt ? new Date(acceptedAt) : null,
              acceptedEligibilityAt: acceptedEligibilityAt ? new Date(acceptedEligibilityAt) : null,
              termsVersion: termsVersion || null,
              acceptanceUserAgent: acceptanceUserAgent || null,
              acceptanceIp: acceptanceIp || null,
            },
          });
          await tx.chatThread.create({
            data: {
              id: createdOrder.id,
              orderId: createdOrder.id,
              title: `Support ${service.name}`,
              messages: { create: [{ sender: 'Support StreamMalin', text: `Bonjour ! Merci pour votre abonnement à ${service.name}. Vos identifiants de connexion sont disponibles sur votre commande dans votre espace client et vous ont été envoyés par e-mail. Une question ? Écrivez-nous ici.` }] },
            },
          });
          return createdOrder;
        });
        const invoice = await createInvoiceForOrder({
          orderId: order.id,
          clientEmail,
          serviceName: service.name,
          amount: order.total,
          paymentMethod: 'Carte bancaire (Stripe)',
        }).catch((err) => { console.error('[invoice] webhook error:', err); return null; });
        await sendOrderDetailsEmail(clientEmail, service.name, decrypt(order.details), order.id, youtubeEmail || undefined, {
          amount: order.total,
          invoiceId: invoice?.id,
          invoiceNumber: invoice?.number,
        }).catch((err) => console.error('[webhook] delivery email failed', err));
        if (serviceId === 'youtube' && youtubeEmail) {
          sendTelegramNotification(
            `▶️ <b>Nouvelle commande YouTube Premium</b>\n👤 ${clientEmail}\n📧 <b>Email YouTube à inviter :</b> <code>${youtubeEmail}</code>\n💶 ${parsedPrice.toFixed(2)}€`
          ).catch(() => {});
        } else {
          sendTelegramNotification(
            `✅ <b>Nouvelle commande Stripe</b>\n👤 ${clientEmail}\n📺 ${service.name}\n💶 ${parsedPrice.toFixed(2)}€/mois`
          ).catch(() => {});
        }
        // Lier le customer Stripe au compte client si existant
        if (stripeCustomerId && clientEmail) {
          const customer = await prisma.customer.findUnique({ where: { email: clientEmail.toLowerCase() } });
          if (customer) {
            await prisma.customer.update({
              where: { id: customer.id },
              data: { stripeCustomerId },
            }).catch(() => {});
          }
        }
        break;
      }

      /* ─── Renouvellement automatique réussi ─── */
      case 'invoice.payment_succeeded': {
        const inv = event.data.object as Stripe.Invoice;
        const subscriptionId = inv.parent?.subscription_details?.subscription;
        if (!subscriptionId) break;
        const sub = await stripe.subscriptions.retrieve(typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id, { expand: ['default_payment_method'] });
        const pm = sub.default_payment_method as Stripe.PaymentMethod | null;
        const nextBillingAt = new Date((sub.items.data[0]?.current_period_end || 0) * 1000);
        const renewed = await processWebhookEvent(event, (tx) => tx.order.updateMany({
          where: { stripeSubscriptionId: sub.id, status: { in: ['active', 'unpaid'] } },
          data: {
            status: 'active',
            unpaidSince: null,
            reminderCount: 0,
            lastReminderAt: null,
            nextBillingAt,
            cardLast4: pm?.card?.last4 || undefined,
            cardBrand: pm?.card?.brand || undefined,
            cardExpMonth: pm?.card?.exp_month || undefined,
            cardExpYear: pm?.card?.exp_year || undefined,
          },
        }));
        // Envoyer un email de confirmation uniquement pour les renouvellements (pas le premier paiement)
        if (renewed.count > 0 && inv.billing_reason === 'subscription_cycle') {
          const order = await prisma.order.findFirst({
            where: { stripeSubscriptionId: sub.id },
            include: { service: true },
          });
          if (order) {
            const amount = (inv.amount_paid ?? 0) / 100;
            sendRenewalEmail(order.clientEmail, order.service.name, order.id, amount, nextBillingAt).catch(() => {});
          }
        }
        break;
      }

      /* ─── Paiement échoué (CB expirée, fonds insuffisants, etc.) ─── */
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.parent?.subscription_details?.subscription;
        if (!subscriptionId) break;
        const order = await prisma.order.findFirst({
          where: { stripeSubscriptionId: typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id },
          include: { service: true },
        });
        if (!order) break;
        const nextLevel = Math.min((order.reminderCount || 0) + 1, 3) as 1 | 2 | 3;
        const failed = await processWebhookEvent(event, (tx) => tx.order.updateMany({
          where: { id: order.id, status: { in: ['active', 'unpaid'] } },
          data: {
            status: 'unpaid',
            unpaidSince: order.unpaidSince || new Date(),
            reminderCount: nextLevel,
            lastReminderAt: new Date(),
          },
        }));
        if (failed.count === 0) break;
        sendUnpaidReminderEmail(order.clientEmail, order.service.name, order.id, nextLevel).catch(() => {});
        sendTelegramNotification(
          `❌ <b>Paiement Stripe échoué</b>\n👤 ${order.clientEmail}\n📺 ${order.service.name}\n💶 ${order.price.toFixed(2)}€\n🔔 Rappel ${nextLevel}/3 envoyé`
        ).catch(() => {});
        break;
      }

      /* ─── Mise à jour de l'abonnement (carte changée, période modifiée) ─── */
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const pm = sub.default_payment_method
          ? await stripe.paymentMethods.retrieve(sub.default_payment_method as string).catch(() => null)
          : null;
        await processWebhookEvent(event, (tx) => tx.order.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            nextBillingAt: new Date((sub.items.data[0]?.current_period_end || 0) * 1000),
            cardLast4: pm?.card?.last4 || undefined,
            cardBrand: pm?.card?.brand || undefined,
            cardExpMonth: pm?.card?.exp_month || undefined,
            cardExpYear: pm?.card?.exp_year || undefined,
          },
        }));
        break;
      }

      /* ─── Annulation de l'abonnement chez Stripe ─── */
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const order = await prisma.order.findFirst({ where: { stripeSubscriptionId: sub.id } });
        if (!order || order.status === 'cancelled') break;
        await processWebhookEvent(event, (tx) => cancelOrderAndReleaseStock(tx, order.id));
        sendTelegramNotification(`🔴 <b>Abonnement Stripe annulé</b>\n👤 ${order.clientEmail}\n📺 ${order.serviceId}`).catch(() => {});
        break;
      }

      /* ─── Méthode de paiement attachée (mise à jour CB via portail) ─── */
      case 'payment_method.attached': {
        const pm = event.data.object as Stripe.PaymentMethod;
        if (!pm.customer) break;
        await processWebhookEvent(event, (tx) => tx.order.updateMany({
          where: { stripeCustomerId: pm.customer as string, status: { in: ['active', 'unpaid'] } },
          data: {
            cardLast4: pm.card?.last4 || undefined,
            cardBrand: pm.card?.brand || undefined,
            cardExpMonth: pm.card?.exp_month || undefined,
            cardExpYear: pm.card?.exp_year || undefined,
          },
        }));
        break;
      }
    }

    await prisma.processedWebhookEvent.upsert({ where: { id: event.id }, create: { id: event.id, type: event.type }, update: {} });
    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    // A committed marker proves the business transaction completed. Never delete it.
    if (processedEventId) {
      const processed = await prisma.processedWebhookEvent.findUnique({ where: { id: processedEventId } }).catch(() => null);
      if (processed) return NextResponse.json({ received: true, duplicate: true });
    }
    console.error('Erreur Webhook Stripe:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
