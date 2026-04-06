/**
 * StreamMalin V2 — Algorithme de Dispatch Disney+
 *
 * Logique : remplir les comptes de 1 à 5 places avant de passer au suivant.
 * → Trouve le premier slot libre sur le premier compte non plein.
 */

import { prisma } from './prisma';
import { notifyLowStock } from './telegram';

/**
 * Trouve et réserve le prochain slot Disney+ disponible.
 * Stratégie FIFO : slot 1 → 5 sur compte 1, puis slot 1 → 5 sur compte 2, etc.
 *
 * @returns Le slot assigné, ou null si aucun slot disponible
 */
export async function dispatchDisneySlot(orderId: string) {
  // Transaction pour éviter les race conditions
  return prisma.$transaction(async (tx) => {
    // Cherche le premier slot disponible sur un compte actif
    // Ordonnancement : par compte (createdAt ASC), puis par numéro de profil (ASC)
    const availableSlot = await tx.slot.findFirst({
      where: {
        isAvailable: true,
        masterAccount: {
          service: 'DISNEY',
          active: true,
        },
      },
      include: {
        masterAccount: true,
      },
      orderBy: [
        {
          masterAccount: {
            createdAt: 'asc', // Premier compte créé en premier
          },
        },
        {
          profileNumber: 'asc', // Profil 1 avant profil 2, etc.
        },
      ],
    });

    if (!availableSlot) {
      return null; // Plus de stock
    }

    // Marque le slot comme occupé et lie à la commande
    const updatedSlot = await tx.slot.update({
      where: { id: availableSlot.id },
      data: { isAvailable: false },
      include: { masterAccount: true },
    });

    // Lie la commande au slot
    await tx.order.update({
      where: { id: orderId },
      data: { slotId: availableSlot.id },
    });

    // Vérifie le stock restant (alerte si < 5 slots)
    const remainingSlots = await tx.slot.count({
      where: {
        isAvailable: true,
        masterAccount: { service: 'DISNEY', active: true },
      },
    });

    if (remainingSlots < 5) {
      // Notifie l'admin en arrière-plan (ne bloque pas la transaction)
      notifyLowStock('Disney+', remainingSlots).catch(console.error);
    }

    return updatedSlot;
  });
}

/**
 * Vérifie les stocks disponibles pour un service donné
 */
export async function getAvailableStock(service: 'YOUTUBE' | 'DISNEY') {
  const count = await prisma.slot.count({
    where: {
      isAvailable: true,
      masterAccount: {
        service,
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
      data: { isAvailable: true },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { slotId: null, status: 'CANCELLED' },
    }),
  ]);
}
