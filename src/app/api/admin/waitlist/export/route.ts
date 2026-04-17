// 📄 FILE: src/app/api/admin/waitlist/export/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface WaitlistRow {
  id: string;
  email: string;
  name: string | null;
  service?: string | null;
  status: string;
  invitedAt: Date | null;
  createdAt: Date;
}

function auth(req: NextRequest): boolean {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  return !!token && token === process.env.ADMIN_SECRET_TOKEN;
}

function esc(v: string | null | undefined): string {
  if (!v) return '';
  return `"${String(v).replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  try {
    let entries: WaitlistRow[];
    try {
      entries = await prisma.waitlist.findMany({
        orderBy: { createdAt: 'desc' },
        take: 1000,
      });
    } catch {
      entries = await prisma.waitlist.findMany({
        orderBy: { createdAt: 'desc' },
        take: 1000,
        select: { id: true, email: true, name: true, status: true, invitedAt: true, createdAt: true },
      }) as WaitlistRow[];
    }

    const header = 'id,email,name,service,status,invitedAt,createdAt\n';
    const rows = entries.map((e) =>
      [
        e.id,
        esc(e.email),
        esc(e.name),
        esc(e.service),
        e.status,
        e.invitedAt ? e.invitedAt.toISOString() : '',
        e.createdAt.toISOString(),
      ].join(',')
    );

    const csv = header + rows.join('\n');
    const filename = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin/waitlist/export]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
