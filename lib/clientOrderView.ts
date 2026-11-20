import 'server-only';
import type { Prisma } from '@prisma/client';
import { decrypt } from '@/lib/crypto';
import { canReadAccess } from '@/lib/orderAccess';

export const clientOrderSelect = {
  id: true, date: true, price: true, details: true, status: true,
  cancellationEffectiveAt: true, stripeSubscriptionId: true, nextBillingAt: true,
  cardLast4: true, cardBrand: true, cardExpMonth: true, cardExpYear: true,
  service: { select: { name: true, icon: true, gradient: true } },
  chats: { select: { messages: { select: { text: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 } } },
} satisfies Prisma.OrderSelect;

export function clientOrderView(order: Prisma.OrderGetPayload<{ select: typeof clientOrderSelect }>) {
  const { name, icon, gradient } = order.service;
  return {
    id: order.id, date: order.date, price: order.price, status: order.status,
    details: canReadAccess(order.status, order.cancellationEffectiveAt) ? decrypt(order.details) : '',
    cancellationEffectiveAt: order.cancellationEffectiveAt,
    stripeManaged: Boolean(order.stripeSubscriptionId), nextBillingAt: order.nextBillingAt,
    cardLast4: order.cardLast4, cardBrand: order.cardBrand,
    cardExpMonth: order.cardExpMonth, cardExpYear: order.cardExpYear,
    service: { name, icon, gradient },
    chats: order.chats ? { messages: order.chats.messages.map(({ text, createdAt }) => ({ text, createdAt })) } : null,
  };
}
