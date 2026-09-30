import { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { clientIp } from './clientIp';

/**
 * Limitation de débit adossée à la base (fonctionne en environnement serverless,
 * contrairement à un compteur en mémoire).
 *
 * Renvoie une réponse 429 si la limite est atteinte, sinon null (requête autorisée).
 *
 * @param name       nom logique de l'action (ex: "login")
 * @param max        nombre maximum de requêtes autorisées dans la fenêtre
 * @param windowSec  durée de la fenêtre en secondes
 * @param failClosed si true, une panne de la base bloque la requête (429) au lieu
 *                   de la laisser passer. À activer pour les endpoints sensibles
 *                   (login admin/client) afin d'empêcher tout contournement du
 *                   rate limit pendant une indisponibilité DB.
 */
export async function enforceRateLimit(
  request: Request,
  name: string,
  max: number,
  windowSec: number,
  failClosed = false
): Promise<NextResponse | null> {
  const key = `${name}:${clientIp(request)}`;
  const now = new Date();

  const windowEnd = new Date(now.getTime() + windowSec * 1000);

  try {
    // The conflict branch locks the row: parallel first requests cannot reset it.
    const [rec] = await prisma.$queryRaw<Array<{ count: number; windowEnd: Date }>>`
      INSERT INTO "RateLimit" ("key", "count", "windowEnd")
      VALUES (${key}, 1, ${windowEnd})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."windowEnd" <= ${now} THEN 1
                       ELSE LEAST("RateLimit"."count", 2147483646) + 1 END,
        "windowEnd" = CASE WHEN "RateLimit"."windowEnd" <= ${now} THEN ${windowEnd}
                           ELSE "RateLimit"."windowEnd" END
      RETURNING "count", "windowEnd"
    `;
    if (!rec) throw new Error('Rate limit counter unavailable');

    // Limite dépassée dans la fenêtre courante.
    if (rec.count > max) {
      const retryAfter = Math.max(1, Math.ceil((rec.windowEnd.getTime() - now.getTime()) / 1000));
      return NextResponse.json(
        { error: 'Trop de tentatives. Veuillez réessayer plus tard.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    return null;
  } catch (err) {
    console.error('[rateLimit] erreur:', (err as Error).message);
    // failClosed : sur un endpoint sensible, une panne DB ne doit pas ouvrir la
    // porte au brute-force. On répond 429 plutôt que d'autoriser la requête.
    if (failClosed) {
      return NextResponse.json(
        { error: 'Service temporairement indisponible. Veuillez réessayer.' },
        { status: 429, headers: { 'Retry-After': '30' } }
      );
    }
    // Sinon (endpoints non critiques), on laisse passer pour ne pas bloquer le service.
    return null;
  }
}
