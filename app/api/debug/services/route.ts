import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Endpoint de diagnostic — liste TOUS les services et leurs stocks bruts.
 * À supprimer une fois le bug "Rupture de stock" résolu.
 */
export async function GET() {
  try {
    const services = await prisma.service.findMany({
      include: { stocks: true },
      orderBy: { id: 'asc' },
    });

    const summary = services.map(s => ({
      id: s.id,
      name: s.name,
      active: s.active,
      stocksCount: s.stocks.length,
      stocks: s.stocks.map(st => ({
        id: st.id,
        serviceId: st.serviceId,
        maxSlots: st.maxSlots,
        filledSlots: st.filledSlots,
        availableSlots: st.maxSlots - st.filledSlots,
        details: st.details,
      })),
      totalAvailable: s.stocks.reduce(
        (acc, st) => acc + Math.max(0, st.maxSlots - st.filledSlots),
        0
      ),
    }));

    return NextResponse.json({ success: true, services: summary });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
