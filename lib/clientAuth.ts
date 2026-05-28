import crypto from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

const SESSION_COOKIE = 'sm_client_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

// Le secret de session est obligatoire : aucune valeur par défaut.
// Sans lui, n'importe qui pourrait forger un cookie de session valide.
const RAW_SECRET = process.env.CLIENT_SESSION_SECRET;
if (!RAW_SECRET || RAW_SECRET.length < 16) {
  throw new Error(
    'CLIENT_SESSION_SECRET manquant ou trop court : définissez une valeur secrète aléatoire ' +
    "d'au moins 16 caractères dans vos variables d'environnement."
  );
}
const SECRET: string = RAW_SECRET;

/* ─── Mots de passe (scrypt) ─────────────────────────────────────────────── */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, derived] = stored.split(':');
  if (!salt || !derived) return false;
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(test, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ─── Sessions (HMAC cookie) ──────────────────────────────────────────────── */
function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

// Token format: ${customerId}.${sessionVersion}.${exp}.${hmac}
// The sessionVersion is stored in the DB; incrementing it invalidates all existing tokens.
function createToken(customerId: string, version: number): string {
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${customerId}.${version}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string): { customerId: string; version: number } | null {
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [customerId, versionStr, expStr, sig] = parts;
  const payload = `${customerId}.${versionStr}.${expStr}`;
  // Comparaison à temps constant pour empêcher toute attaque temporelle sur la signature.
  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(sign(payload), 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  if (Date.now() > parseInt(expStr, 10)) return null;
  const version = parseInt(versionStr, 10);
  if (!Number.isFinite(version)) return null;
  return { customerId, version };
}

export async function setSession(customerId: string, version: number) {
  const token = createToken(customerId, version);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentCustomer() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const parsed = verifyToken(token);
  if (!parsed) return null;
  const customer = await prisma.customer.findUnique({ where: { id: parsed.customerId } });
  if (!customer) return null;
  // Reject tokens whose version no longer matches (password/email changed, explicit revocation).
  if (customer.sessionVersion !== parsed.version) return null;
  return customer;
}

export async function bumpSessionVersion(customerId: string): Promise<number> {
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  return updated.sessionVersion;
}

/* ─── Tokens de vérification email ────────────────────────────────────────── */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
