import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };
let client: PrismaClient | undefined;

// Importing a route during compilation must not load the DB engine or open a connection.
function getClient(): PrismaClient {
  if (!client) {
    client = globalForPrisma.prisma || new PrismaClient({ log: [] });
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = getClient();
    const value = Reflect.get(instance, property, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
