import crypto from 'crypto';

/**
 * Porte d'accès au site entier (mode « accès restreint / coming soon »).
 *
 * Tant que la variable d'environnement SITE_ACCESS_CODE est définie, le `proxy`
 * exige un code avant de laisser accéder à n'importe quelle page. Une fois le
 * bon code saisi, on pose un cookie httpOnly portant un jeton `${exp}.${hmac}`
 * signé — le cookie ne contient jamais le code lui-même.
 *
 * Le jeton est signé avec ADMIN_SECRET_TOKEN (déjà obligatoire pour l'admin,
 * ≥ 16 caractères). Faire tourner ce secret invalide instantanément tous les
 * accès déjà accordés.
 *
 * Pour DÉSACTIVER la porte (ouvrir le site à tous) : retirer SITE_ACCESS_CODE
 * des variables d'environnement et redéployer.
 */

export const SITE_ACCESS_COOKIE = 'SITE_ACCESS';
export const SITE_ACCESS_TTL_SEC = 60 * 60 * 24 * 7; // 7 jours

function getSecret(): string | null {
  const token = process.env.ADMIN_SECRET_TOKEN;
  if (!token || token.length < 16) return null;
  return token;
}

export function createSiteAccessToken(): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const payload = String(Date.now() + SITE_ACCESS_TTL_SEC * 1000);
  const sig = crypto.createHmac('sha256', secret).update(`site:${payload}`).digest('hex');
  return `${payload}.${sig}`;
}

export function verifySiteAccessToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;

  const idx = token.lastIndexOf('.');
  if (idx <= 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);

  const expected = crypto.createHmac('sha256', secret).update(`site:${payload}`).digest('hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  const exp = parseInt(payload, 10);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return true;
}
