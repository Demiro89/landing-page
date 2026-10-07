import crypto from 'crypto';
import { prisma } from './prisma';
import { adminSessionId, verifyAdminSessionToken, createAdminSessionToken, ADMIN_SESSION_TTL_SEC } from './adminSession';

export async function issueAdminSession(): Promise<string | null> {
  if (process.env.REMEDIATION_SCHEMA_ENABLED !== 'true') return createAdminSessionToken();
  const id = crypto.randomBytes(32).toString('hex');
  const token = createAdminSessionToken(id);
  if (!token) return null;
  await prisma.adminSession.create({ data: { id, expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_SEC * 1000) } });
  return token;
}

export async function authenticateAdminToken(token?: string): Promise<boolean> {
  if (!verifyAdminSessionToken(token)) return false;
  if (process.env.REMEDIATION_SCHEMA_ENABLED !== 'true') return true;
  const id = adminSessionId(token!);
  if (!id) return false; // Old sessions require a fresh login after migration.
  try {
    const session = await prisma.adminSession.findUnique({ where: { id } });
    return Boolean(session && !session.revokedAt && session.expiresAt.getTime() > Date.now());
  } catch { return false; }
}

export async function revokeAdminToken(token?: string) {
  if (process.env.REMEDIATION_SCHEMA_ENABLED !== 'true' || !token) return;
  const id = adminSessionId(token);
  if (id) await prisma.adminSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
}
