import { cookies } from 'next/headers';
import { verifyAdminSessionToken } from './adminSession';

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
 * Vérifie que la requête courante porte un cookie de session admin valide
 * (jeton signé par HMAC, à temps constant, avec contrôle d'expiration).
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}
