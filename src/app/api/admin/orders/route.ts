/**
 * GET /api/admin/orders?token=XXX
 * Retourne toutes les commandes pour le dashboard admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const adminToken = process.env.ADMIN_SECRET_TOKEN;

  if (!adminToken || token !== adminToken) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  try {
    const orders = await prisma.order.findMany({
      include: {
        user: { select: { email: true } },
        slot: {
          include: {
            masterAccount: {
              select: { email: true, password: true },
            },
          },
        },
      },
      orderBy: [
        // Active orders expiring soonest first, then by creation date
        { status: 'asc' },
        { expiresAt: 'asc' },
        { createdAt: 'desc' },
      ],
      take: 200,
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('[GET /api/admin/orders]', error);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
