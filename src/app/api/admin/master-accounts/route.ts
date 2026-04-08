/**
 * GET    /api/admin/master-accounts?token=XXX           — liste tous les comptes maîtres
 * POST   /api/admin/master-accounts                     — créer un nouveau compte maître + slots
 * PATCH  /api/admin/master-accounts                     — modifier email/mdp OU ajuster les slots
 * DELETE /api/admin/master-accounts?token=XXX&id=XXX   — supprimer définitivement un compte
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
  if (!service?.trim()) {
    return NextResponse.json({ error: 'Nom de service requis.' }, { status: 400 });
  }
  if (!email?.includes('@')) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
  }
  const slots = Math.max(1, Math.min(50, Number(maxSlots) || 5));

  try {
    const account = await prisma.masterAccount.create({
      data: {
        service: service.trim().toUpperCase(),
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

// ── PATCH : modifier credentials OU ajuster le nombre de slots ───────────────
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    token,
    id,
    action = 'update_credentials',
    email,
    password,
    delta,
  } = body as {
    token: string;
    id: string;
    action?: 'update_credentials' | 'adjust_slots';
    email?: string;
    password?: string;
    delta?: number; // +1 ou -1 (ou ±N)
  };

  if (!checkAuth(token)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }
  if (!id) {
    return NextResponse.json({ error: 'id manquant.' }, { status: 400 });
  }

  try {
    // ── Ajustement du nombre de slots ──────────────────────────────────────
    if (action === 'adjust_slots') {
      const d = Number(delta);
      if (!d || isNaN(d)) {
        return NextResponse.json({ error: 'delta invalide.' }, { status: 400 });
      }

      if (d > 0) {
        // Ajout de slots : on prend le prochain numéro de profil disponible
        const existing = await prisma.slot.findMany({
          where: { masterAccountId: id },
          orderBy: { profileNumber: 'desc' },
          take: 1,
        });
        const nextNumber = (existing[0]?.profileNumber ?? 0) + 1;

        await prisma.$transaction([
          prisma.slot.create({
            data: { masterAccountId: id, profileNumber: nextNumber, isAvailable: true },
          }),
          prisma.masterAccount.update({
            where: { id },
            data: { maxSlots: { increment: 1 } },
          }),
        ]);
      } else {
        // Suppression du slot libre le plus récent (numéro le plus élevé)
        const freeSlot = await prisma.slot.findFirst({
          where: { masterAccountId: id, isAvailable: true },
          orderBy: { profileNumber: 'desc' },
        });
        if (!freeSlot) {
          return NextResponse.json(
            { error: 'Aucun slot libre à supprimer. Tous les slots sont occupés.' },
            { status: 409 }
          );
        }
        await prisma.$transaction([
          prisma.slot.delete({ where: { id: freeSlot.id } }),
          prisma.masterAccount.update({
            where: { id },
            data: { maxSlots: { decrement: 1 } },
          }),
        ]);
      }

      // Retourner l'état mis à jour
      const updated = await prisma.masterAccount.findUnique({
        where: { id },
        include: {
          slots: { select: { id: true, profileNumber: true, isAvailable: true, pinCode: true } },
        },
      });
      if (!updated) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });

      return NextResponse.json({
        ok: true,
        account: {
          ...updated,
          slotsTotal: updated.slots.length,
          slotsAvailable: updated.slots.filter((s) => s.isAvailable).length,
        },
      });
    }

    // ── Mise à jour email / mot de passe ───────────────────────────────────
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

// ── DELETE : suppression définitive (hard delete) ────────────────────────────
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
    // Récupérer les slots du compte
    const slots = await prisma.slot.findMany({ where: { masterAccountId: id } });
    const occupiedSlotIds = slots.filter((s) => !s.isAvailable).map((s) => s.id);

    // Détacher les commandes actives liées aux slots occupés
    // (ne pas supprimer les commandes, juste retirer le slot assigné)
    if (occupiedSlotIds.length > 0) {
      await prisma.order.updateMany({
        where: { slotId: { in: occupiedSlotIds } },
        data: { slotId: null },
      });
    }

    // Supprimer les slots puis le compte
    await prisma.slot.deleteMany({ where: { masterAccountId: id } });
    await prisma.masterAccount.delete({ where: { id } });

    return NextResponse.json({
      ok: true,
      affectedOrders: occupiedSlotIds.length,
    });
  } catch (err) {
    console.error('[DELETE /api/admin/master-accounts]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
