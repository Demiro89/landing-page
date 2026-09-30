import type { Prisma } from '@prisma/client';
import { STOCK_CONSUMING_STATUSES } from './orderAccess';

export class OrderConflictError extends Error {}

export async function cancelOrderAndReleaseStock(tx: Prisma.TransactionClient, orderId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  // Claim the current state in the database, not from an earlier snapshot.
  const consumed = await tx.order.updateMany({
    where: { id: orderId, status: { in: STOCK_CONSUMING_STATUSES } },
    data: { status: 'cancelled', cancellationEffectiveAt: new Date() },
  });
  if (consumed.count === 1) {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    await tx.stockAccount.updateMany({
      where: { id: order.stockAccountId, filledSlots: { gt: 0 } },
      data: { filledSlots: { decrement: 1 } },
    });
  } else {
    await tx.order.updateMany({
      where: { id: orderId, status: 'pending' },
      data: { status: 'cancelled', cancellationEffectiveAt: new Date() },
    });
  }
}

export async function activatePendingOrder(tx: Prisma.TransactionClient, orderId: string) {
  const claimed = await tx.order.updateMany({
    where: { id: orderId, status: 'pending' },
    data: { status: 'active', nextBillingAt: new Date(Date.now() + 30 * 86400000) },
  });
  if (claimed.count !== 1) throw new OrderConflictError("Cette commande n'est plus en attente.");
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  const reserved = await tx.stockAccount.updateMany({
    where: { id: order.stockAccountId, filledSlots: { lt: tx.stockAccount.fields.maxSlots }, service: { active: true } },
    data: { filledSlots: { increment: 1 } },
  });
  if (reserved.count !== 1) throw new OrderConflictError('Plus de place disponible dans ce compte de stock.');
  const stock = await tx.stockAccount.findUniqueOrThrow({ where: { id: order.stockAccountId } });
  await tx.order.update({ where: { id: orderId }, data: { details: stock.details } });
  return stock.details;
}
