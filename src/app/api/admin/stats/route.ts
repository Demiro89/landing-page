/**
 * GET /api/admin/stats?token=XXX
 *
 * Retourne les statistiques de ventes pour le tableau de bord admin :
 *  - CA total (commandes ACTIVE + EXPIRED)
 *  - CA des 30 derniers jours
 *  - Nombre de commandes par service
 *  - 10 dernières ventes
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const adminToken = process.env.ADMIN_SECRET_TOKEN;

  if (!adminToken || token !== adminToken) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  try {
    const PAID_STATUSES = ['ACTIVE', 'EXPIRED', 'CANCELLED', 'CONFIRMED'];

    // Toutes les commandes payées (tous statuts considérés comme encaissés)
    const allPaid = await prisma.order.findMany({
      where: { status: { in: PAID_STATUSES } },
      select: {
        id: true,
        service: true,
        amount: true,
        status: true,
        paymentMethod: true,
        createdAt: true,
        user: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // CA total
    const caTotal = allPaid.reduce((sum, o) => sum + o.amount, 0);

    // CA 30 derniers jours
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const last30 = allPaid.filter((o) => new Date(o.createdAt) >= since30);
    const ca30j = last30.reduce((sum, o) => sum + o.amount, 0);

    // Commandes actives en ce moment
    const activeOrders = await prisma.order.findMany({
      where: { status: 'ACTIVE' },
      select: { service: true, amount: true },
    });

    // Stats par service
    const services = ['YOUTUBE', 'DISNEY', 'SURFSHARK'] as const;
    const byService = services.map((svc) => {
      const total = allPaid.filter((o) => o.service === svc);
      const active = activeOrders.filter((o) => o.service === svc);
      const ca = total.reduce((sum, o) => sum + o.amount, 0);
      return {
        service: svc,
        totalOrders: total.length,
        activeOrders: active.length,
        ca,
      };
    });

    // Nombre de commandes par méthode de paiement
    const byMethod: Record<string, number> = {};
    for (const o of allPaid) {
      byMethod[o.paymentMethod] = (byMethod[o.paymentMethod] ?? 0) + 1;
    }

    // 10 dernières ventes
    const recentSales = allPaid.slice(0, 10).map((o) => ({
      id: o.id,
      service: o.service,
      amount: o.amount,
      status: o.status,
      paymentMethod: o.paymentMethod,
      email: o.user.email,
      createdAt: o.createdAt,
    }));

    return NextResponse.json({
      caTotal,
      ca30j,
      totalPaidOrders: allPaid.length,
      activeOrdersCount: activeOrders.length,
      byService,
      byMethod,
      recentSales,
    });
  } catch (error) {
    console.error('[GET /api/admin/stats]', error);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
