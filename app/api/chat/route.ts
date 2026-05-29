import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramNotification } from '@/lib/telegram';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import { getCurrentCustomer } from '@/lib/clientAuth';
import { enforceRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const MAX_MESSAGE_LENGTH = 2000;

/** Un client ne peut accéder qu'aux fils liés à ses propres commandes. */
function ownsOrder(
  order: { clientEmail: string; customerId: string | null },
  customer: { id: string; email: string }
): boolean {
  if (order.customerId && order.customerId === customer.id) return true;
  return order.clientEmail.toLowerCase() === customer.email.toLowerCase();
}

/** Échappe les caractères HTML pour les notifications Telegram (mode HTML). */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * GET /api/chat : Récupère les messages d'un fil ou la liste des fils (pour l'admin).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const isAdmin = await isAdminAuthenticated();

    // 1. Admin : historique complet de tous les fils
    if (isAdmin && !orderId) {
      const threads = await prisma.chatThread.findMany({
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          order: { include: { service: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ success: true, threads });
    }

    if (!orderId) {
      return NextResponse.json({ error: 'orderId requis' }, { status: 400 });
    }

    // 2. Fil spécifique — auth vérifiée AVANT la query DB pour éviter l'oracle d'existence.
    if (!isAdmin) {
      const customer = await getCurrentCustomer();
      if (!customer) {
        return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
      }
      const thread = await prisma.chatThread.findUnique({
        where: { orderId },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          order: { include: { service: true } },
        },
      });
      if (!thread) {
        return NextResponse.json({ error: 'Fil de discussion introuvable' }, { status: 404 });
      }
      if (!thread.order || !ownsOrder(thread.order, customer)) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
      }
      return NextResponse.json({ success: true, thread });
    }

    // 3. Admin avec orderId
    const thread = await prisma.chatThread.findUnique({
      where: { orderId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        order: { include: { service: true } },
      },
    });
    if (!thread) {
      return NextResponse.json({ error: 'Fil de discussion introuvable' }, { status: 404 });
    }
    return NextResponse.json({ success: true, thread });
  } catch (error) {
    console.error('Erreur GET chat route:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

/**
 * POST /api/chat : Envoie un message dans un fil.
 */
export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, 'chat', 30, 300);
    if (limited) return limited;

    const { orderId, text, sender } = await request.json();

    if (!orderId || !text || !sender) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    if (typeof text !== 'string' || text.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message trop long (maximum ${MAX_MESSAGE_LENGTH} caractères)` },
        { status: 400 }
      );
    }

    const isAdmin = await isAdminAuthenticated();

    // Seul l'admin connecté peut signer un message "Support StreamMalin" (vérification insensible à la casse).
    if (String(sender).toLowerCase().includes('support') && !isAdmin) {
      return NextResponse.json({ error: 'Non autorisé à envoyer ce type de message' }, { status: 403 });
    }

    // La commande correspondante doit exister.
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { service: true },
    });
    if (!order) {
      return NextResponse.json({ error: 'Commande correspondante introuvable' }, { status: 404 });
    }

    // Contrôle de propriété : un client ne peut écrire que dans ses propres fils.
    if (!isAdmin) {
      const customer = await getCurrentCustomer();
      if (!customer) {
        return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
      }
      if (!ownsOrder(order, customer)) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
      }
    }

    // S'assurer que le fil existe.
    let thread = await prisma.chatThread.findUnique({ where: { orderId } });
    if (!thread) {
      thread = await prisma.chatThread.create({
        data: { id: orderId, orderId, title: `Support ${order.service.name}` },
      });
    }

    const message = await prisma.message.create({
      data: { threadId: thread.id, sender, text },
    });

    // Notification Telegram uniquement quand c'est le client qui écrit.
    if (!isAdmin) {
      const rawPreview = text.length > 200 ? text.slice(0, 200) + '…' : text;
      // Les balises HTML sont échappées pour éviter l'injection dans le template Telegram.
      const preview = escapeHtml(rawPreview);
      sendTelegramNotification(
        `💬 <b>Nouveau message client</b>\n` +
        `👤 <b>${escapeHtml(order.clientEmail)}</b>\n` +
        `📺 Service : ${escapeHtml(order.service?.name || orderId)}\n` +
        `📝 ${preview}\n\n` +
        `🔗 Répondre : https://streammalin.fr/admin`
      ).catch(() => {});
    }

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error('Erreur POST chat route:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
