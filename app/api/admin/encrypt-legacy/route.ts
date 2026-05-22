import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import { encrypt, isEncrypted } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/encrypt-legacy : chiffre les identifiants encore en clair
 * (StockAccount.details et Order.details). Idempotent — peut être relancé
 * sans risque, les valeurs déjà chiffrées sont ignorées.
 */
export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    let stocksDone = 0;
    let ordersDone = 0;

    const stocks = await prisma.stockAccount.findMany();
    for (const s of stocks) {
      if (s.details && !isEncrypted(s.details)) {
        await prisma.stockAccount.update({ where: { id: s.id }, data: { details: encrypt(s.details) } });
        stocksDone++;
      }
    }

    const orders = await prisma.order.findMany();
    for (const o of orders) {
      if (o.details && !isEncrypted(o.details)) {
        await prisma.order.update({ where: { id: o.id }, data: { details: encrypt(o.details) } });
        ordersDone++;
      }
    }

    return NextResponse.json({ success: true, stocksDone, ordersDone });
  } catch (error) {
    console.error('Erreur encrypt-legacy:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
