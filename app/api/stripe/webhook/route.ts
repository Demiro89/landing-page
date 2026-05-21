import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { sendOrderDetailsEmail, sendUnpaidReminderEmail } from '@/lib/nodemailer';
import { sendTelegramNotification } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const sig = request.headers.get('stripe-signature') || '';

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
    } catch (err: any) {
      console.error('❌ Erreur signature Webhook:', err.message);
      return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    switch (event.type) {
      /* ─── Création initiale de l'abonnement (premier paiement réussi) ─── */
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata;
        if (!metadata) break;

        const { serviceId, stockAccountId, clientEmail, price, migrateOrderId } = metadata as any;

        // Cas 1 : migration d'une commande existante vers Stripe Subscription
        if (migrateOrderId && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string, { expand: ['default_payment_method'] });
          const pm = sub.default_payment_method as Stripe.PaymentMethod | null;
          await prisma.order.update({
            where: { id: migrateOrderId },
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
        const parsedPrice = parseFloat(price);
        const service = await prisma.service.findUnique({ where: { id: serviceId } });
        const stockAccount = await prisma.stockAccount.findUnique({ where: { id: stockAccountId } });
        if (!service || !stockAccount) break;

        const sub = session.subscription
          ? await stripe.subscriptions.retrieve(session.subscription as string, { expand: ['default_payment_method'] })
          : null;
        const pm = sub?.default_payment_method as Stripe.PaymentMethod | null;
        const stripeCustomerId = sub && typeof sub.customer === 'string' ? sub.customer : (sub?.customer as any)?.id || null;

        const order = await prisma.$transaction(async (tx) => {
          const updatedStock = await tx.stockAccount.update({
            where: { id: stockAccountId },
            data: { filledSlots: { increment: 1 } },
          });
          const createdOrder = await tx.order.create({
            data: {
              serviceId,
              stockAccountId,
              price: parsedPrice,
              total: parsedPrice,
              details: updatedStock.details,
              clientEmail,
              status: 'active',
              stripeSubscriptionId: sub?.id || null,
              stripeCustomerId,
              cardLast4: pm?.card?.last4 || null,
              cardBrand: pm?.card?.brand || null,
              cardExpMonth: pm?.card?.exp_month || null,
              cardExpYear: pm?.card?.exp_year || null,
              nextBillingAt: sub ? new Date((sub.items.data[0]?.current_period_end || 0) * 1000) : new Date(Date.now() + 30 * 86400000),
            },
          });
          await tx.chatThread.create({
            data: {
              id: createdOrder.id,
              orderId: createdOrder.id,
              title: `Support ${service.name}`,
              messages: { create: [{ sender: 'Support StreamMalin', text: `Bonjour ! Merci pour votre abonnement à ${service.name}. Vos accès sont prêts :\n\n${updatedStock.details}\n\nÉcrivez-nous ici en cas de problème.` }] },
            },
          });
          return createdOrder;
        });
        await sendOrderDetailsEmail(clientEmail, service.name, stockAccount.details, order.id);
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
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;
        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string, { expand: ['default_payment_method'] });
        const pm = sub.default_payment_method as Stripe.PaymentMethod | null;
        await prisma.order.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            status: 'active',
            unpaidSince: null,
            reminderCount: 0,
            lastReminderAt: null,
            nextBillingAt: new Date((sub.items.data[0]?.current_period_end || 0) * 1000),
            cardLast4: pm?.card?.last4 || undefined,
            cardBrand: pm?.card?.brand || undefined,
            cardExpMonth: pm?.card?.exp_month || undefined,
            cardExpYear: pm?.card?.exp_year || undefined,
          },
        });
        break;
      }

      /* ─── Paiement échoué (CB expirée, fonds insuffisants, etc.) ─── */
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;
        const order = await prisma.order.findFirst({
          where: { stripeSubscriptionId: invoice.subscription as string },
          include: { service: true },
        });
        if (!order) break;
        const nextLevel = Math.min((order.reminderCount || 0) + 1, 3) as 1 | 2 | 3;
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'unpaid',
            unpaidSince: order.unpaidSince || new Date(),
            reminderCount: nextLevel,
            lastReminderAt: new Date(),
          },
        });
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
        await prisma.order.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            nextBillingAt: new Date((sub.items.data[0]?.current_period_end || 0) * 1000),
            cardLast4: pm?.card?.last4 || undefined,
            cardBrand: pm?.card?.brand || undefined,
            cardExpMonth: pm?.card?.exp_month || undefined,
            cardExpYear: pm?.card?.exp_year || undefined,
          },
        });
        break;
      }

      /* ─── Annulation de l'abonnement chez Stripe ─── */
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const order = await prisma.order.findFirst({ where: { stripeSubscriptionId: sub.id } });
        if (!order || order.status === 'cancelled') break;
        await prisma.$transaction([
          prisma.order.update({ where: { id: order.id }, data: { status: 'cancelled', cancellationEffectiveAt: new Date() } }),
          prisma.stockAccount.update({ where: { id: order.stockAccountId }, data: { filledSlots: { decrement: 1 } } }),
        ]);
        sendTelegramNotification(`🔴 <b>Abonnement Stripe annulé</b>\n👤 ${order.clientEmail}\n📺 ${order.serviceId}`).catch(() => {});
        break;
      }

      /* ─── Méthode de paiement attachée (mise à jour CB via portail) ─── */
      case 'payment_method.attached': {
        const pm = event.data.object as Stripe.PaymentMethod;
        if (!pm.customer) break;
        await prisma.order.updateMany({
          where: { stripeCustomerId: pm.customer as string, status: { in: ['active', 'unpaid'] } },
          data: {
            cardLast4: pm.card?.last4 || undefined,
            cardBrand: pm.card?.brand || undefined,
            cardExpMonth: pm.card?.exp_month || undefined,
            cardExpYear: pm.card?.exp_year || undefined,
          },
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Erreur Webhook Stripe:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
