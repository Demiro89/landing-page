import { prisma } from './prisma';
import { invoiceLineLabel } from './legalConfig';

/**
 * Génère le prochain numéro de facture au format SM-YYYY-0001.
 * La numérotation est unique, chronologique et continue (sans réutilisation),
 * via un compteur atomique par année stocké en base.
 */
export async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const counterId = `invoice-${year}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const counter = await prisma.counter.upsert({
        where: { id: counterId },
        create: { id: counterId, value: 1 },
        update: { value: { increment: 1 } },
      });
      return `SM-${year}-${String(counter.value).padStart(4, '0')}`;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
  throw new Error('Impossible de générer le numéro de facture');
}

/**
 * Crée la facture associée à une commande payée (idempotent : ne crée pas
 * de doublon si une facture existe déjà pour la commande).
 */
export async function createInvoiceForOrder(params: {
  orderId: string;
  clientEmail: string;
  clientName?: string | null;
  serviceName: string;
  amount: number;
  paymentMethod: string;
  durationLabel?: string;
}) {
  const existing = await prisma.invoice.findUnique({ where: { orderId: params.orderId } });
  if (existing) return existing;

  const number = await nextInvoiceNumber();
  const durationLabel = params.durationLabel || '1 mois';

  return prisma.invoice.create({
    data: {
      number,
      orderId: params.orderId,
      paidAt: new Date(),
      clientEmail: params.clientEmail,
      clientName: params.clientName || null,
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
}
