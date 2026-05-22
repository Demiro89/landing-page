import { cookies } from 'next/headers';
import crypto from 'crypto';

export const ADMIN_COOKIE_NAME = 'ADMIN_SECRET_TOKEN';

/**
 * Lit le secret admin depuis l'environnement.
 * Renvoie null (et journalise) si la variable est absente ou trop faible :
 * l'accès admin est alors refusé par défaut (fail-closed).
 */
export function readAdminSecret(): string | null {
  const token = process.env.ADMIN_SECRET_TOKEN;
  if (!token || token.length < 16) {
    console.error(
      '[adminAuth] ADMIN_SECRET_TOKEN absent ou trop court (16 caractères minimum requis) — accès admin désactivé.'
    );
    return null;
  }
  return token;
}

/**
 * Vérifie que la requête courante porte un cookie admin valide.
 * Comparaison à temps constant pour éviter toute fuite par timing.
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  const expected = readAdminSecret();
  if (!expected) return false;

  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;

  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
