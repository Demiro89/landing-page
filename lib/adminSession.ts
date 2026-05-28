import crypto from 'crypto';

/**
 * Jeton de session admin signé par HMAC.
 *
 * Le cookie ne contient PLUS le secret admin lui-même : il porte un jeton
 * `${exp}.${hmac}` signé avec ADMIN_SECRET_TOKEN. Avantages :
 *  - le secret maître ne transite jamais dans un cookie ;
 *  - la session expire (exp embarqué) ;
 *  - faire tourner ADMIN_SECRET_TOKEN invalide instantanément toutes les sessions.
 */

export const ADMIN_SESSION_TTL_SEC = 60 * 60 * 24; // 24 heures

function getSecret(): string | null {
  const token = process.env.ADMIN_SECRET_TOKEN;
  if (!token || token.length < 16) return null;
  return token;
}

export function createAdminSessionToken(): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const payload = String(Date.now() + ADMIN_SESSION_TTL_SEC * 1000);
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyAdminSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;

  const idx = token.lastIndexOf('.');
  if (idx <= 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  const exp = parseInt(payload, 10);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return true;
}
