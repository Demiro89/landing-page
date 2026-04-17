/**
 * GET    /api/admin/invite-codes        — liste tous les codes
 * POST   /api/admin/invite-codes        — génère un nouveau code
 * DELETE /api/admin/invite-codes        — révoque un code { codeId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function auth(req: NextRequest): boolean {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  return !!token && token === process.env.ADMIN_SECRET_TOKEN;
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `SM-${seg(4)}-${seg(4)}`;
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });

  const codes = await prisma.inviteCode.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ codes });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });

  const { note } = await req.json().catch(() => ({}));

  // Génère un code unique (retry si collision)
  let code: string;
  let attempts = 0;
  do {
    code = generateCode();
    attempts++;
    if (attempts > 20) return NextResponse.json({ error: 'Impossible de générer un code unique.' }, { status: 500 });
  } while (await prisma.inviteCode.findUnique({ where: { code } }));

  const created = await prisma.inviteCode.create({
    data: { code, note: note?.trim() ?? null },
  });
  return NextResponse.json({ code: created });
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });

  const { codeId } = await req.json().catch(() => ({}));
  if (!codeId) return NextResponse.json({ error: 'codeId requis.' }, { status: 400 });

  await prisma.inviteCode.update({
    where: { id: codeId },
    data: { active: false },
  });
  return NextResponse.json({ ok: true });
}
