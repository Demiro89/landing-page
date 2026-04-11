/**
 * GET /api/stock
 *
 * Retourne le nombre de slots disponibles et le total configuré
 * pour chaque service. Utilisé par la homepage pour les badges "X PLACES DISPO".
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const SERVICES = ['YOUTUBE', 'DISNEY', 'SURFSHARK'] as const;

export async function GET() {
  const results: Record<string, { available: number; total: number }> = {};

  await Promise.all(
    SERVICES.map(async (service) => {
      const [available, total] = await Promise.all([
        prisma.slot.count({
          where: {
            isAvailable: true,
            masterAccount: {
              service: { startsWith: service, mode: 'insensitive' },
              active: true,
            },
          },
        }),
        prisma.slot.count({
          where: {
            masterAccount: {
              service: { startsWith: service, mode: 'insensitive' },
              active: true,
            },
          },
        }),
      ]);
      results[service] = { available, total };
    })
  );

  return NextResponse.json(results);
}
