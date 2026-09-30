import { prisma } from './prisma';

export async function isGatewayEnabled(method: 'cb' | 'paypal' | 'crypto'): Promise<boolean> {
  const gateway = await prisma.setting.findUnique({ where: { key: `gateway_${method}` } });
  return gateway ? gateway.value === 'true' : true;
}
