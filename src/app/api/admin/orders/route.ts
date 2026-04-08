/**
 * GET  /api/admin/orders?token=XXX          — liste toutes les commandes
 * PATCH /api/admin/orders                   — change le statut d'une commande
 * DELETE /api/admin/orders?orderId=XXX      — supprime une commande
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { dispatchSlot } from '@/lib/dispatch';
import { sendYouTubeInvitationSent, sendAccessUpdated } from '@/lib/email';

function auth(req: NextRequest): boolean {
  const token = new URL(req.url).searchParams.get('token')
    ?? (req.headers.get('content-type')?.includes('json') ? null : null);
  // For PATCH/DELETE the token is in the JSON body — checked inside the handlers
  return true; // placeholder, real check done per-handler
}

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
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('[GET /api/admin/orders]', error);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

// ── PATCH : changer le statut d'une commande ─────────────────────────────
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token, orderId, action } = body as {
    token: string;
    orderId: string;
    action: 'activate' | 'cancel' | 'send_youtube_invite' | 'notify_access';
  };
  const adminToken = process.env.ADMIN_SECRET_TOKEN;

  if (!adminToken || token !== adminToken) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  if (!orderId || !['activate', 'cancel', 'send_youtube_invite', 'notify_access'].includes(action)) {
    return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        slot: { include: { masterAccount: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
    }

    if (action === 'cancel') {
      // Libérer le slot Disney+ si assigné
      if (order.slotId) {
        await prisma.slot.update({
          where: { id: order.slotId },
          data: { isAvailable: true },
        });
      }
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', slotId: null },
      });
      return NextResponse.json({ ok: true, status: 'CANCELLED' });
    }

    if (action === 'send_youtube_invite') {
      if (order.service !== 'YOUTUBE') {
        return NextResponse.json({ error: 'Action réservée aux commandes YouTube.' }, { status: 400 });
      }
      if (!order.gmail) {
        return NextResponse.json({ error: 'Aucun Gmail renseigné pour cette commande.' }, { status: 400 });
      }
      const sent = await sendYouTubeInvitationSent({
        to: order.user.email,
        orderId: order.id,
        gmail: order.gmail,
      });
      if (!sent) {
        return NextResponse.json({ error: 'Échec envoi email — vérifiez les logs Vercel.' }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'notify_access') {
      if (order.service !== 'DISNEY') {
        return NextResponse.json({ error: 'Action réservée aux commandes Disney+.' }, { status: 400 });
      }
      if (!order.slot) {
        return NextResponse.json({ error: 'Aucun slot assigné à cette commande.' }, { status: 400 });
      }
      const sent = await sendAccessUpdated({
        to: order.user.email,
        orderId: order.id,
        service: 'DISNEY',
        disneyAccess: {
          email: order.slot.masterAccount.email,
          password: order.slot.masterAccount.password ?? '',
          profileNumber: order.slot.profileNumber,
          pinCode: order.slot.pinCode ?? undefined,
        },
      });
      if (!sent) {
        return NextResponse.json({ error: 'Échec envoi email.' }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'activate') {
      // Si pas encore de slot → dispatch pour n'importe quel service
      let slotId = order.slotId;
      if (!slotId) {
        const slot = await dispatchSlot(orderId, order.service);
        if (!slot) {
          return NextResponse.json(
            { error: `Stock ${order.service} épuisé — ajoutez des comptes maîtres.` },
            { status: 409 }
          );
        }
        slotId = slot.id;
      }
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'ACTIVE', slotId: slotId ?? undefined },
      });
      return NextResponse.json({ ok: true, status: 'ACTIVE' });
    }
  } catch (error) {
    console.error('[PATCH /api/admin/orders]', error);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

// ── DELETE : supprimer définitivement une commande ───────────────────────
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const orderId = searchParams.get('orderId');
  const adminToken = process.env.ADMIN_SECRET_TOKEN;

  if (!adminToken || token !== adminToken) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  if (!orderId) {
    return NextResponse.json({ error: 'orderId manquant.' }, { status: 400 });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
    }

    // Libérer le slot Disney+ avant suppression
    if (order.slotId) {
      await prisma.slot.update({
        where: { id: order.slotId },
        data: { isAvailable: true },
      });
    }

    await prisma.order.delete({ where: { id: orderId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/admin/orders]', error);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

