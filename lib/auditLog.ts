import { prisma } from './prisma';

export interface AuditEntry {
  action: string;
  entityType: 'order' | 'service' | 'stock' | 'settings';
  entityId?: string;
  description: string;
  ip?: string;
}

export function clientIpFromRequest(request: Request): string {
  const xff = request.headers.get('x-forwarded-for') || '';
  const first = xff.split(',')[0].trim();
  return first || request.headers.get('x-real-ip') || 'unknown';
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({ data: entry });
  } catch (err) {
    console.error('[auditLog] write error:', (err as Error).message);
  }
}
