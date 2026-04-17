/**
 * GET  /api/admin/inventory?token=XXX
 *   → Liste tous les comptes maîtres avec stats de slots
 *
 * POST /api/admin/inventory?token=XXX
 *   body: { service, email, password?, slots: [{ profileNumber, pinCode? }] }
 *   → Crée un nouveau compte maître + ses 5 slots
 *
 * DELETE /api/admin/inventory?token=XXX&id=MASTER_ID
 *   → Supprime un compte (bloqué si des slots sont occupés)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';


function unauthorized() {
  return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
}

function checkAuth(req: NextRequest): boolean {
  const token = new URL(req.url).searchParams.get('token');
  return !!process.env.ADMIN_SECRET_TOKEN && token === process.env.ADMIN_SECRET_TOKEN;
}

// ── GET : liste des comptes maîtres ──────────────────────────────
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const accounts = await prisma.masterAccount.findMany({
    include: {
      slots: {
        include: {
          order: { select: { id: true, status: true, user: { select: { email: true } } } },
        },
        orderBy: { profileNumber: 'asc' },
      },
    },
    orderBy: [{ service: 'asc' }, { createdAt: 'asc' }],
  });

  const result = accounts.map((acc) => ({
    id: acc.id,
    service: acc.service,
    email: acc.email,
    password: acc.password,
    active: acc.active,
    maxSlots: acc.maxSlots,
    createdAt: acc.createdAt,
    slots: acc.slots.map((s) => ({
      id: s.id,
      profileNumber: s.profileNumber,
      pinCode: s.pinCode,
      isAvailable: s.isAvailable,
      order: s.order
        ? { id: s.order.id, status: s.order.status, userEmail: s.order.user.email }
        : null,
    })),
    availableSlots: acc.slots.filter((s) => s.isAvailable).length,
    occupiedSlots: acc.slots.filter((s) => !s.isAvailable).length,
  }));

  return NextResponse.json({ accounts: result });
}

// ── POST : ajout d'un compte maître ──────────────────────────────
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const body = await req.json();
  const { service, email, password, slots } = body;

  if (!service || !['YOUTUBE', 'DISNEY'].includes(service)) {
    return NextResponse.json({ error: 'Service invalide (YOUTUBE ou DISNEY).' }, { status: 400 });
  }
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
  }

  // Slots par défaut si non fournis : 5 slots sans pinCode
  const slotData: { profileNumber: number; pinCode?: string }[] =
    slots && Array.isArray(slots) && slots.length > 0
      ? slots
      : Array.from({ length: 5 }, (_, i) => ({ profileNumber: i + 1 }));

  const master = await prisma.masterAccount.create({
    data: {
      service,
      email: email.trim().toLowerCase(),
      password: password?.trim() || null,
      maxSlots: slotData.length,
      active: true,
      slots: {
        create: slotData.map((s) => ({
          profileNumber: s.profileNumber,
          pinCode: s.pinCode?.trim() || null,
          isAvailable: true,
        })),
      },
    },
    include: { slots: true },
  });

  return NextResponse.json({ account: master }, { status: 201 });
}

// ── DELETE : suppression d'un compte maître ───────────────────────
export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const id = new URL(req.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id manquant.' }, { status: 400 });
  }

  // Vérifie qu'aucun slot n'est occupé par une commande active
  const occupiedSlots = await prisma.slot.count({
    where: {
      masterAccountId: id,
      isAvailable: false,
    },
  });

  if (occupiedSlots > 0) {
    return NextResponse.json(
      {
        error: `Impossible de supprimer : ${occupiedSlots} slot(s) sont actuellement occupés par des clients actifs.`,
      },
      { status: 409 }
    );
  }

  // Supprime les slots puis le compte
  await prisma.slot.deleteMany({ where: { masterAccountId: id } });
  await prisma.masterAccount.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

// ── PATCH : activer/désactiver un compte ──────────────────────────
export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const body = await req.json();
  const { id, active } = body;

  if (!id || typeof active !== 'boolean') {
    return NextResponse.json({ error: 'id et active requis.' }, { status: 400 });
  }

  const updated = await prisma.masterAccount.update({
    where: { id },
    data: { active },
  });

  return NextResponse.json({ account: updated });
}
