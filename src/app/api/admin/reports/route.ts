/**
 * GET  /api/admin/reports?token=XXX              — liste tous les signalements
 * PATCH /api/admin/reports                       — marque un signalement résolu
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function checkAuth(token: string | null): boolean {
  const adminToken = process.env.ADMIN_SECRET_TOKEN;
  return Boolean(adminToken && token === adminToken);
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token');
  if (!checkAuth(token)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  try {
    const reports = await prisma.orderReport.findMany({
      orderBy: [{ resolved: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('[GET /api/admin/reports]', error);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token, reportId } = body as { token?: string; reportId?: string };

  if (!checkAuth(token ?? null)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }
  if (!reportId) {
    return NextResponse.json({ error: 'reportId manquant.' }, { status: 400 });
  }

  try {
    await prisma.orderReport.update({
      where: { id: reportId },
      data: { resolved: true },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[PATCH /api/admin/reports]', error);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
