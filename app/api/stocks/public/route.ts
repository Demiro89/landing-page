import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
const errorMessage = (error: unknown) => {
  // Journalise l'erreur réelle côté serveur ; n'expose jamais les détails au client
  // (les messages Prisma révèlent le schéma : tables, colonnes, contraintes).
  console.error('[api]', error);
  return 'Erreur serveur';
};

/**
 * GET /api/stocks/public : Retourne les comptes de stock disponibles SANS les identifiants sensibles.
 * Utilisé par le storefront pour afficher la marketplace avec les slot-dots.
 */
export async function GET() {
  try {
    const stocks = await prisma.stockAccount.findMany({
      where: {
        filledSlots: { lt: prisma.stockAccount.fields.maxSlots },
        service: { active: true },
      },
      select: {
        id: true,
        serviceId: true,
        price: true,
        maxSlots: true,
        filledSlots: true,
        service: {
          select: {
            name: true,
            icon: true,
            gradient: true,
            tagline: true,
            original: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, stocks });
  } catch (error: unknown) {
    console.error('Erreur GET stocks/public:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
