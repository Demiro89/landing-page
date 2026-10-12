import crypto from 'crypto';
import { prisma } from './prisma';
import { adminSessionId, verifyAdminSessionToken, createAdminSessionToken, ADMIN_SESSION_TTL_SEC } from './adminSession';

const PREFIX = 'admin_session:';

export async function issueAdminSession(): Promise<string | null> {
  const id = crypto.randomBytes(32).toString('hex');
  const token = createAdminSessionToken(id);
  if (!token) return null;
  const expiresAt = new Date(Number(token.split('.')[0]));
  if (process.env.REMEDIATION_SCHEMA_ENABLED === 'true') {
    await prisma.adminSession.create({ data: { id, expiresAt } });
  } else {
    await prisma.setting.create({ data: { key: `${PREFIX}${id}`, value: String(expiresAt.getTime()) } });
  }
  return token;
}

export async function authenticateAdminToken(token?: string): Promise<boolean> {
  if (!verifyAdminSessionToken(token)) return false;
  const id = adminSessionId(token!);
  if (!id) return false; // Old sessions require a fresh login after migration.
  try {
    if (process.env.REMEDIATION_SCHEMA_ENABLED !== 'true') {
      const session = await prisma.setting.findUnique({ where: { key: `${PREFIX}${id}` } });
      return Boolean(session && session.value === token!.split('.')[0] && Number(session.value) > Date.now());
    }
    const session = await prisma.adminSession.findUnique({ where: { id } });
    return Boolean(session && !session.revokedAt && session.expiresAt.getTime() > Date.now());
  } catch { return false; }
}

export async function revokeAdminToken(token?: string) {
  if (!token) return;
  const id = adminSessionId(token);
  if (!id) return;
  if (process.env.REMEDIATION_SCHEMA_ENABLED === 'true') await prisma.adminSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
  else await prisma.setting.deleteMany({ where: { key: `${PREFIX}${id}` } });
}

export async function listAdminSessions() {
  if (process.env.REMEDIATION_SCHEMA_ENABLED === 'true') return prisma.adminSession.findMany({
    where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { createdAt: true, expiresAt: true }, take: 100,
  });
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: PREFIX }, value: { gt: String(Date.now()) } }, take: 100 });
  return rows.filter(row => /^\d{13}$/.test(row.value)).map(row => ({
    createdAt: new Date(Number(row.value) - ADMIN_SESSION_TTL_SEC * 1000), expiresAt: new Date(Number(row.value)),
  }));
}

export async function revokeOtherAdminSessions(token: string) {
  const id = adminSessionId(token);
  if (!id) throw new Error('Invalid admin session');
  await prisma.$transaction(async tx => {
    if (process.env.REMEDIATION_SCHEMA_ENABLED === 'true') {
      await tx.adminSession.updateMany({ where: { id: { not: id }, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    // Also remove sessions from the fallback store after a schema rollout.
    await tx.setting.deleteMany({ where: { key: { startsWith: PREFIX, not: `${PREFIX}${id}` } } });
    await tx.auditLog.create({ data: { action: 'admin.sessions_revoke', entityType: 'session', description: 'Autres sessions administrateur révoquées.' } });
  });
}
