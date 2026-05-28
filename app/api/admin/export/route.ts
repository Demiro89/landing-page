import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsv).join(',');
}

function fmtDate(d: Date | string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get('type');

  if (type === 'orders') {
    const orders = await prisma.order.findMany({
      include: { service: true },
      orderBy: { date: 'desc' },
    });

    const header = row(['ID', 'Date', 'Service', 'Client', 'Moyen de paiement', 'Net (€)', 'Total (€)', 'Statut', 'Facturation suivante']);
    const lines = orders.map((o) =>
      row([
        o.id,
        fmtDate(o.date),
        o.service.name,
        o.clientEmail,
        o.paymentMethod ?? '',
        o.price,
        o.total,
        o.status,
        o.nextBillingAt ? fmtDate(o.nextBillingAt) : '',
      ])
    );

    const csv = [header, ...lines].join('\r\n');
    const filename = `streammalin-commandes-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse('﻿' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  if (type === 'clients') {
    const orders = await prisma.order.findMany({
      select: {
        clientEmail: true,
        date: true,
        total: true,
        status: true,
      },
      orderBy: { date: 'asc' },
    });

    const map: Record<string, { firstDate: string; count: number; spent: number; active: number }> = {};
    for (const o of orders) {
      const email = o.clientEmail.toLowerCase();
      if (!map[email]) map[email] = { firstDate: fmtDate(o.date), count: 0, spent: 0, active: 0 };
      map[email].count += 1;
      map[email].spent += o.total;
      if (o.status === 'active') map[email].active += 1;
    }

    const header = row(['Email', '1ère commande', 'Nb commandes', 'Commandes actives', 'Total dépensé (€)']);
    const lines = Object.entries(map)
      .sort((a, b) => b[1].spent - a[1].spent)
      .map(([email, d]) =>
        row([email, d.firstDate, d.count, d.active, d.spent.toFixed(2)])
      );

    const csv = [header, ...lines].join('\r\n');
    const filename = `streammalin-clients-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse('﻿' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ error: 'Paramètre type manquant (orders | clients)' }, { status: 400 });
}
