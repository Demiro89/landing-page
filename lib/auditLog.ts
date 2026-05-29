import { prisma } from './prisma';

export interface AuditEntry {
  action: string;
  entityType: 'order' | 'service' | 'stock' | 'settings';
  entityId?: string;
  description: string;
  ip?: string;
}

export function clientIpFromRequest(request: Request): string {
  // x-real-ip est défini par l'edge Vercel (non falsifiable).
  // x-forwarded-for peut être préfixé de fausses entrées par le client.
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  const xff = request.headers.get('x-forwarded-for') || '';
  return xff.split(',')[0].trim() || 'unknown';
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({ data: entry });
  } catch (err) {
    console.error('[auditLog] write error:', (err as Error).message);
  }
}
