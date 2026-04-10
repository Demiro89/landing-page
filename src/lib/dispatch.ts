/**
 * StreamMalin V2 — Algorithme de Dispatch des slots
 *
 * dispatchSlot  : réserve le premier slot disponible pour n'importe quel service
 * dispatchDisneySlot : alias rétro-compat
 * getAvailableStock  : compte les slots libres (comparaison insensible à la casse)
 */

import { prisma } from './prisma';
import { notifyLowStock } from './telegram';

/**
 * Dispatche le premier slot disponible pour un service donné.
 * La correspondance se fait sur le DÉBUT du nom de service (insensible à la casse).
 * Ex : service='DISNEY' matche 'DISNEY', 'Disney+', 'DISNEY+ 4K', etc.
 *
 * @returns Le slot assigné (avec masterAccount inclus) ou null si stock épuisé
 */
export async function dispatchSlot(orderId: string, service: string) {
  return prisma.$transaction(async (tx) => {
    // Récupère l'email à assigner au slot
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { email: true } } },
    });
    if (!order) return null;

    // YouTube → on stocke le gmail ; sinon l'email du compte client
    const assignedEmail = order.gmail || order.user.email;
    const serviceUpper = service.toUpperCase();

    // Premier slot libre sur un compte actif dont le service commence par serviceUpper
    const availableSlot = await tx.slot.findFirst({
      where: {
        isAvailable: true,
        masterAccount: {
          service: { startsWith: serviceUpper, mode: 'insensitive' },
          active: true,
        },
      },
      include: { masterAccount: true },
      orderBy: [
        { masterAccount: { createdAt: 'asc' } },
        { profileNumber: 'asc' },
      ],
    });

    if (!availableSlot) return null;

    // Marque le slot comme occupé et enregistre l'email du client
    const updatedSlot = await tx.slot.update({
      where: { id: availableSlot.id },
      data: { isAvailable: false, assignedEmail },
      include: { masterAccount: true },
    });

    // Lie la commande au slot
    await tx.order.update({
      where: { id: orderId },
      data: { slotId: availableSlot.id },
    });

    // Alerte stock faible (< 5 slots restants)
    const remaining = await tx.slot.count({
      where: {
        isAvailable: true,
        masterAccount: {
          service: { startsWith: serviceUpper, mode: 'insensitive' },
          active: true,
        },
      },
    });

    if (remaining < 5) {
      notifyLowStock(service, remaining).catch(console.error);
    }

    return updatedSlot;
  });
}

/** Alias rétro-compatible pour Disney+ */
export const dispatchDisneySlot = (orderId: string) => dispatchSlot(orderId, 'DISNEY');

/**
 * Compte les slots libres pour un service.
 * Correspondance insensible à la casse sur le début du nom de service.
 */
export async function getAvailableStock(service: string): Promise<number> {
  const count = await prisma.slot.count({
    where: {
      isAvailable: true,
      masterAccount: {
        service: { startsWith: service.toUpperCase(), mode: 'insensitive' },
        active: true,
      },
    },
  });
  return count;
}

/**
 * Libère un slot (en cas d'annulation ou expiration)
 */
export async function releaseSlot(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { slot: true },
  });

  if (!order?.slotId) return;

  await prisma.$transaction([
    prisma.slot.update({
      where: { id: order.slotId },
      data: { isAvailable: true, assignedEmail: null },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { slotId: null, status: 'CANCELLED' },
    }),
  ]);
}
