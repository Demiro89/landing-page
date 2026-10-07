import type Stripe from 'stripe';
import { processWebhookEvent } from './webhookTransaction';
import { consumePlace, AvailabilityError } from './stockReservations';
import { enqueueOrderJob, recordOrderPayment } from './durableOrders';

export async function fulfillReservedStripeOrder(event: Stripe.Event, session: Stripe.Checkout.Session, stripe: Stripe) {
  if (session.payment_status !== 'paid') return;
  if (!session.subscription || session.currency !== 'eur') throw new Error('Unexpected checkout currency or subscription');
  const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
  const sub = await stripe.subscriptions.retrieve(subId, { expand: ['default_payment_method'] });
  const pm = typeof sub.default_payment_method === 'object' ? sub.default_payment_method : null;
  const invoiceId = typeof session.invoice === 'string' ? session.invoice : session.invoice?.id;
  if (!invoiceId) throw new Error('Paid checkout missing invoice');
  await processWebhookEvent(event, async tx => {
    const orderId = session.metadata!.orderId;
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { service: true } });
    const reservation = await tx.stockReservation.findUnique({ where: { orderId } });
    if (!reservation || reservation.id !== session.metadata!.reservationId ||
        (reservation.checkoutSessionId && reservation.checkoutSessionId !== session.id) || session.amount_total !== Math.round(order.total * 100)) {
      throw new Error('Checkout proof mismatch');
    }
    if (order.stripeSubscriptionId === subId && order.status !== 'pending') return;
    // A different paid subscription must never overwrite this order.
    if (order.stripeSubscriptionId && order.stripeSubscriptionId !== subId) throw new Error('Subscription mismatch');
    let details = '';
    let canFulfill = order.status === 'pending';
    if (canFulfill) {
      try { details = (await consumePlace(tx, order.id, order.stockAccountId, order.serviceId)).details; }
      catch (error) { if (!(error instanceof AvailabilityError)) throw error; canFulfill = false; }
    }
    await tx.order.update({ where: { id: order.id }, data: {
      status: canFulfill ? 'active' : 'payment_review', details,
      stripeSubscriptionId: subId, stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      cardLast4: pm?.card?.last4, cardBrand: pm?.card?.brand,
      cardExpMonth: pm?.card?.exp_month, cardExpYear: pm?.card?.exp_year,
      nextBillingAt: new Date(sub.items.data[0].current_period_end * 1000),
    } });
    await tx.stockReservation.update({ where: { id: reservation.id }, data: {
      checkoutSessionId: session.id, ...(canFulfill ? {} : { status: 'released' }),
    } });
    await recordOrderPayment(tx, {
      orderId: order.id, provider: 'stripe', providerPaymentId: invoiceId,
      amountMinor: session.amount_total!, currency: 'eur', paidAt: new Date(event.created * 1000),
      clientEmail: order.clientEmail, serviceName: order.service.name, termsVersion: order.termsVersion,
      providerInvoiceId: invoiceId, status: canFulfill ? 'paid' : 'refund_needed',
      periodEnd: new Date(sub.items.data[0].current_period_end * 1000),
    });
    await enqueueOrderJob(tx, order.id, canFulfill ? 'delivery' : 'payment_review', `${canFulfill ? 'delivery' : 'payment_review'}:${invoiceId}`);
    if (canFulfill) await tx.chatThread.upsert({ where: { orderId: order.id }, create: {
      id: order.id, orderId: order.id, title: `Support ${order.service.name}`,
      messages: { create: { sender: 'Support StreamMalin', text: 'Paiement confirmé. La transmission des accès est suivie par notre support. Vous pouvez nous contacter ici.' } },
    }, update: {} });
  });
}
