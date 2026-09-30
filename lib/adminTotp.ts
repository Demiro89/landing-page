import type { Prisma } from '@prisma/client';

export async function lockAdminTotp(tx: Prisma.TransactionClient) {
  // All TOTP changes and counter consumption share this transaction-level lock.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('streammalin:admin-totp'))::text`;
}
