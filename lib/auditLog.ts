import { prisma } from './prisma';
import { clientIp } from './clientIp';

export interface AuditEntry {
  action: string;
  entityType: 'order' | 'service' | 'stock' | 'settings';
  entityId?: string;
  description: string;
  ip?: string;
}

export function clientIpFromRequest(request: Request): string {
  return clientIp(request);
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({ data: entry });
  } catch (err) {
    console.error('[auditLog] write error:', (err as Error).message);
  }
}
