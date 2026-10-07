import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { remediationSchemaEnabled } from './commerce';

export class AvailabilityError extends Error {}

export async function lockStock(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "StockAccount" WHERE "id" = ${id} FOR UPDATE`;
  return tx.stockAccount.findUniqueOrThrow({ where: { id }, include: { service: true } });
}

export async function heldPlaces(tx: Prisma.TransactionClient, stockAccountId: string, excludeOrderId?: string) {
  return tx.stockReservation.count({ where: {
    stockAccountId, status: 'held', expiresAt: { gt: new Date() },
    ...(excludeOrderId ? { orderId: { not: excludeOrderId } } : {}),
  } });
}

export async function publicReservations(stockIds: string[]): Promise<Map<string, number>> {
  if (!remediationSchemaEnabled() || stockIds.length === 0) return new Map();
  const rows = await prisma.stockReservation.groupBy({
    by: ['stockAccountId'], where: { stockAccountId: { in: stockIds }, status: 'held', expiresAt: { gt: new Date() } },
    _count: { _all: true },
  });
  return new Map(rows.map(row => [row.stockAccountId, row._count._all]));
}

// Call with the order row locked first. All allocation paths take the same stock lock.
export async function consumePlace(tx: Prisma.TransactionClient, orderId: string, stockId: string, serviceId: string) {
  const stock = await lockStock(tx, stockId);
  const held = await heldPlaces(tx, stockId, orderId);
  if (!stock.service.active || stock.serviceId !== serviceId || stock.filledSlots + held >= stock.maxSlots) {
    throw new AvailabilityError('Aucune place disponible pour cette commande.');
  }
  await tx.stockAccount.update({ where: { id: stockId }, data: { filledSlots: { increment: 1 } } });
  await tx.stockReservation.updateMany({ where: { orderId, status: 'held' }, data: { status: 'consumed', consumedAt: new Date() } });
  return stock;
}
