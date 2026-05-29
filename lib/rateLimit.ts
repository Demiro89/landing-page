import { NextResponse } from 'next/server';
import { prisma } from './prisma';

/**
 * Extrait l'IP cliente depuis les en-têtes du proxy.
 * Sur Vercel, `x-real-ip` est défini par l'edge et NON modifiable par le client.
 * On le privilégie car `x-forwarded-for` peut être préfixé de fausses entrées
 * par un client malveillant (contournement du rate limit / brute-force).
 */
function clientIp(request: Request): string {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  const xff = request.headers.get('x-forwarded-for') || '';
  const first = xff.split(',')[0].trim();
  return first || 'unknown';
}

/**
 * Limitation de débit adossée à la base (fonctionne en environnement serverless,
 * contrairement à un compteur en mémoire).
 *
 * Renvoie une réponse 429 si la limite est atteinte, sinon null (requête autorisée).
 *
 * @param name      nom logique de l'action (ex: "login")
 * @param max       nombre maximum de requêtes autorisées dans la fenêtre
 * @param windowSec durée de la fenêtre en secondes
 */
export async function enforceRateLimit(
  request: Request,
  name: string,
  max: number,
  windowSec: number
): Promise<NextResponse | null> {
  const key = `${name}:${clientIp(request)}`;
  const now = new Date();

  const windowEnd = new Date(now.getTime() + windowSec * 1000);

  try {
    // Transaction pour éviter la race condition : on vérifie la fenêtre AVANT d'incrémenter.
    // Si la fenêtre est expirée, on repart à 1 ; sinon on incrémente.
    const rec = await prisma.$transaction(async (tx) => {
      const existing = await tx.rateLimit.findUnique({ where: { key } });

      if (!existing || existing.windowEnd <= now) {
        // Fenêtre expirée ou première requête : créer/reset avec count=1.
        return tx.rateLimit.upsert({
          where: { key },
          create: { key, count: 1, windowEnd },
          update: { count: 1, windowEnd },
        });
      }

      // Dans la fenêtre courante : incrémenter.
      return tx.rateLimit.update({
        where: { key },
        data: { count: { increment: 1 } },
      });
    });

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
    // En cas d'erreur DB, on n'empêche pas la requête (fail-open) pour ne pas
    // bloquer le service, mais on journalise l'incident.
    console.error('[rateLimit] erreur:', (err as Error).message);
    return null;
  }
}
