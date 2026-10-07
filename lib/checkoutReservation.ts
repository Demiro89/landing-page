import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { lockStock, heldPlaces, AvailabilityError } from './stockReservations';
import { encrypt } from './crypto';

export async function reserveCheckout(attemptId: string, data: Prisma.OrderUncheckedCreateInput) {
  if (typeof attemptId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(attemptId)) throw new AvailabilityError('Rechargez la page avant de commander.');
  return prisma.$transaction(async tx => {
    const stock = await lockStock(tx, data.stockAccountId);
    const existing = await tx.stockReservation.findUnique({ where: { id: attemptId }, include: { order: true } });
    if (existing) {
      if (existing.order.serviceId !== data.serviceId || existing.stockAccountId !== data.stockAccountId ||
          existing.order.clientEmail !== data.clientEmail || existing.order.youtubeEmail !== (data.youtubeEmail || null) ||
          existing.order.paymentMethod !== data.paymentMethod || existing.order.termsVersion !== data.termsVersion ||
          existing.order.price !== stock.price || existing.status !== 'held' || existing.expiresAt.getTime() <= Date.now()) {
        throw new AvailabilityError('Cette réservation a changé ou a expiré. Rechargez la page.');
      }
      return { reservation: existing, order: existing.order, stock };
    }
    if (!stock.service.active || stock.serviceId !== data.serviceId || !Number.isFinite(stock.price) || stock.price <= 0 ||
        stock.filledSlots + await heldPlaces(tx, stock.id) >= stock.maxSlots) {
      throw new AvailabilityError('Aucune place disponible actuellement. Contactez-nous pour connaître les prochaines disponibilités.');
    }
    const order = await tx.order.create({ data: { ...data, price: stock.price, total: stock.price, details: '', status: 'pending' } });
    await tx.setting.create({ data: { key: `contract:${order.id}`, value: encrypt(JSON.stringify({
      orderId: order.id, email: order.clientEmail, offerId: order.serviceId, offerName: stock.service.name,
      price: order.price, total: order.total, paymentMethod: order.paymentMethod, termsVersion: order.termsVersion,
      acceptedTermsAt: order.acceptedTermsAt, acceptedWithdrawalWaiverAt: order.acceptedWithdrawalWaiverAt,
      acceptedEligibilityAt: order.acceptedEligibilityAt, ip: order.acceptanceIp, userAgent: order.acceptanceUserAgent,
    })) } });
    const reservation = await tx.stockReservation.create({ data: {
      id: attemptId, orderId: order.id, stockAccountId: stock.id,
      // Stripe requires at least 30 minutes at session creation. Leave a small margin.
      expiresAt: new Date(Math.floor(Date.now() / 1000 + 31 * 60) * 1000),
    } });
    return { reservation, order, stock };
  });
}
