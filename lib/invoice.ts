import { prisma } from './prisma';
import { invoiceLineLabel } from './legalConfig';
import type { Prisma } from '@prisma/client';

/**
 * Génère le prochain numéro de facture au format SM-YYYY-0001.
 * La numérotation est unique, chronologique et continue (sans réutilisation),
 * via un compteur atomique par année stocké en base.
 */
async function nextInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const counterId = `invoice-${year}`;

  const counter = await tx.counter.upsert({
    where: { id: counterId },
    create: { id: counterId, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `SM-${year}-${String(counter.value).padStart(4, '0')}`;
}

/**
 * Crée la facture associée à une commande payée (idempotent : ne crée pas
 * de doublon si une facture existe déjà pour la commande).
 */
export async function createInvoiceForOrder(params: {
  orderId: string;
  clientEmail: string;
  clientName?: string | null;
  clientAddress?: string | null;
  serviceName: string;
  amount: number;
  paymentMethod: string;
  durationLabel?: string;
  paidAt?: Date;
}) {
  return prisma.$transaction(async tx => {
    // The order lock serializes duplicate jobs; rollback also restores the counter.
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${params.orderId} FOR UPDATE`;
    const existing = await tx.invoice.findUnique({ where: { orderId: params.orderId } });
    if (existing) return existing;

    const number = await nextInvoiceNumber(tx);
    const durationLabel = params.durationLabel || '1 mois';

    return tx.invoice.create({
      data: {
        number,
        orderId: params.orderId,
        paidAt: params.paidAt || new Date(),
        clientEmail: params.clientEmail,
        clientName: params.clientName || null,
        clientAddress: params.clientAddress || null,
        serviceName: params.serviceName,
        description: invoiceLineLabel(params.serviceName, durationLabel),
        durationLabel,
        quantity: 1,
        unitPriceHT: params.amount,
        totalHT: params.amount,
        vatAmount: 0,
        totalTTC: params.amount,
        paymentMethod: params.paymentMethod,
        status: 'Payée',
      },
    });
  });
}
