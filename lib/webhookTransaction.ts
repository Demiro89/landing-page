import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export function processWebhookEvent<T>(
  event: { id: string; type: string },
  process: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Marker and business changes commit together, including after a crash/retry.
    await tx.processedWebhookEvent.create({ data: { id: event.id, type: event.type } });
    return process(tx);
  });
}
