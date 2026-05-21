import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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
  } catch (error: any) {
    console.error('Erreur GET stocks/public:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
