/**
 * GET    /api/admin/master-accounts?token=XXX           — liste tous les comptes maîtres
 * POST   /api/admin/master-accounts                     — créer un nouveau compte maître + slots
 * DELETE /api/admin/master-accounts?token=XXX&id=XXX   — désactiver un compte maître
 * PATCH  /api/admin/master-accounts                     — mettre à jour email/mdp d'un compte
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function checkAuth(token: string | null): boolean {
  const adminToken = process.env.ADMIN_SECRET_TOKEN;
  return Boolean(adminToken && token === adminToken);
}

// ── GET : liste des comptes maîtres avec stats slots ────────────────────────
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token');
  if (!checkAuth(token)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  try {
    const accounts = await prisma.masterAccount.findMany({
      include: {
        slots: {
          select: { id: true, profileNumber: true, isAvailable: true, pinCode: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = accounts.map((acc) => ({
      id: acc.id,
      service: acc.service,
      email: acc.email,
      password: acc.password,
      maxSlots: acc.maxSlots,
      active: acc.active,
      createdAt: acc.createdAt,
      slotsTotal: acc.slots.length,
      slotsAvailable: acc.slots.filter((s) => s.isAvailable).length,
      slots: acc.slots,
    }));

    return NextResponse.json({ accounts: enriched });
  } catch (err) {
    console.error('[GET /api/admin/master-accounts]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

// ── POST : créer un compte maître + ses slots ────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token, service, email, password, maxSlots = 5 } = body as {
    token: string;
    service: string;
    email: string;
    password?: string;
    maxSlots: number;
  };

  if (!checkAuth(token)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }
  if (!['YOUTUBE', 'DISNEY'].includes(service)) {
    return NextResponse.json({ error: 'Service invalide.' }, { status: 400 });
  }
  if (!email?.includes('@')) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
  }
  const slots = Math.max(1, Math.min(20, Number(maxSlots) || 5));

  try {
    const account = await prisma.masterAccount.create({
      data: {
        service,
        email: email.trim(),
        password: password?.trim() || null,
        maxSlots: slots,
        active: true,
        slots: {
          create: Array.from({ length: slots }, (_, i) => ({
            profileNumber: i + 1,
            isAvailable: true,
          })),
        },
      },
      include: { slots: true },
    });

    return NextResponse.json({ ok: true, account }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/admin/master-accounts]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

// ── PATCH : mettre à jour email/mdp d'un compte maître ──────────────────────
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token, id, email, password } = body as {
    token: string;
    id: string;
    email?: string;
    password?: string;
  };

  if (!checkAuth(token)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }
  if (!id) {
    return NextResponse.json({ error: 'id manquant.' }, { status: 400 });
  }

  try {
    const updated = await prisma.masterAccount.update({
      where: { id },
      data: {
        ...(email ? { email: email.trim() } : {}),
        ...(password !== undefined ? { password: password.trim() || null } : {}),
      },
    });
    return NextResponse.json({ ok: true, account: updated });
  } catch (err) {
    console.error('[PATCH /api/admin/master-accounts]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

// ── DELETE : désactiver (soft delete) un compte maître ──────────────────────
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const id = searchParams.get('id');

  if (!checkAuth(token)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }
  if (!id) {
    return NextResponse.json({ error: 'id manquant.' }, { status: 400 });
  }

  try {
    await prisma.masterAccount.update({
      where: { id },
      data: { active: false },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/admin/master-accounts]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
