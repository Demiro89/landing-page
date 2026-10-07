import { prisma } from './prisma';

export async function isGatewayEnabled(method: 'cb' | 'paypal' | 'crypto'): Promise<boolean> {
  const gateway = await prisma.setting.findUnique({ where: { key: `gateway_${method}` } });
  if (method !== 'cb' && process.env.MANUAL_PAYMENTS_ENABLED !== 'true') return false;
  return gateway?.value === 'true';
}
