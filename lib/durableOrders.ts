import type { Prisma } from '@prisma/client';

export async function enqueueOrderJob(tx: Prisma.TransactionClient, orderId: string, kind: string, dedupeKey: string) {
  return tx.deliveryJob.upsert({ where: { dedupeKey }, create: {
    orderId, kind, dedupeKey, status: ['payment_review', 'access_revocation'].includes(kind) ? 'needs_review' : 'pending',
  }, update: {} });
}

export async function recordOrderPayment(tx: Prisma.TransactionClient, params: {
  orderId: string; provider: string; providerPaymentId: string; amountMinor: number; currency: string;
  clientEmail: string; serviceName: string; termsVersion?: string | null; providerInvoiceId?: string | null;
  paidAt: Date; periodEnd?: Date | null; status?: string;
}) {
  if (!Number.isSafeInteger(params.amountMinor) || params.amountMinor <= 0 || params.currency !== 'eur') throw new Error('Unexpected payment');
  const payment = await tx.paymentRecord.upsert({
    where: { provider_providerPaymentId: { provider: params.provider, providerPaymentId: params.providerPaymentId } },
    create: params, update: {},
  });
  if (payment.orderId !== params.orderId || payment.amountMinor !== params.amountMinor || payment.currency !== params.currency) throw new Error('Payment reference already assigned or changed');
  return payment;
}
