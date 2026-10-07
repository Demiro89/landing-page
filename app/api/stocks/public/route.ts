import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { commerceEnabled, getCommercialReviews } from '@/lib/commerce';
import { prudentCommercialCopy } from '@/lib/offerPresentation';
import { publicReservations } from '@/lib/stockReservations';

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
    if (!commerceEnabled()) return NextResponse.json({ success: true, stocks: [] });
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

    const reviews = await getCommercialReviews([...new Set(stocks.map(stock => stock.serviceId))]);
    const held = await publicReservations(stocks.map(stock => stock.id));
    return NextResponse.json({ success: true, stocks: stocks.filter(stock => reviews.get(stock.serviceId)?.status === 'approved' && stock.price > 0 && stock.filledSlots + (held.get(stock.id) || 0) < stock.maxSlots).map(stock => ({
      ...stock, filledSlots: stock.filledSlots + (held.get(stock.id) || 0), service: { ...stock.service, tagline: prudentCommercialCopy(stock.service.tagline) },
    })) });
  } catch (error: unknown) {
    console.error('Erreur GET stocks/public:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
