import { NextResponse } from 'next/server';
import { prisma } from './prisma';

/**
 * Extrait l'IP cliente de façon robuste quelle que soit la plateforme.
 *
 * Stratégie (ordre de priorité) :
 * 1. `x-real-ip` — posé par l'edge Vercel / Nginx (non falsifiable si configuré).
 * 2. Dernière entrée de `x-forwarded-for` — quand un reverse-proxy de confiance
 *    est déclaré via TRUSTED_PROXY_IPS, c'est lui qui a ajouté la dernière entrée ;
 *    le client ne peut pas la contrôler (il ne peut qu'en préfixer de fausses).
 * 3. Fallback 'unknown' — ne jamais planter, mais le rate limit s'applique à 'unknown'
 *    (toutes les requêtes sans IP partagent le même compteur, ce qui est conservateur).
 *
 * Pour activer le mode reverse-proxy hors Vercel, définir dans les variables d'env :
 *   TRUSTED_PROXY_IPS=10.0.0.1,10.0.0.2   (IPs de vos proxies Nginx/HAProxy)
 */
function clientIp(request: Request): string {
  // Vercel ou tout proxy qui pose x-real-ip de façon fiable.
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const xff = (request.headers.get('x-forwarded-for') || '').trim();
  if (!xff) return 'unknown';

  const trustedProxies = (process.env.TRUSTED_PROXY_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  if (trustedProxies.length > 0) {
    // Derrière un reverse-proxy connu : la dernière IP de x-forwarded-for est
    // celle ajoutée par le proxy — le client ne peut pas la falsifier.
    const parts = xff.split(',').map((p) => p.trim());
    return parts[parts.length - 1] || 'unknown';
  }

  // Aucune configuration proxy : on prend la première entrée (comportement Vercel-like).
  // Risque de spoofing si pas de proxy de confiance en amont — documenter le déploiement.
  return xff.split(',')[0].trim() || 'unknown';
}

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
