import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramNotification } from '@/lib/telegram';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import { getCurrentCustomer } from '@/lib/clientAuth';
import { enforceRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/** Un client ne peut accéder qu'aux fils liés à ses propres commandes. */
function ownsOrder(
  order: { clientEmail: string; customerId: string | null },
  customer: { id: string; email: string }
): boolean {
  if (order.customerId && order.customerId === customer.id) return true;
  return order.clientEmail.toLowerCase() === customer.email.toLowerCase();
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

    // 2. Messages d'un ticket spécifique
    if (!orderId) {
      return NextResponse.json({ error: 'orderId requis' }, { status: 400 });
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

    // Contrôle de propriété : un client ne peut consulter que ses propres fils.
    if (!isAdmin) {
      const customer = await getCurrentCustomer();
      if (!customer) {
        return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
      }
      if (!thread.order || !ownsOrder(thread.order, customer)) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
      }
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

    const isAdmin = await isAdminAuthenticated();

    // Seul l'admin connecté peut signer un message "Support StreamMalin".
    if (String(sender).includes('Support') && !isAdmin) {
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
      const preview = text.length > 200 ? text.slice(0, 200) + '…' : text;
      sendTelegramNotification(
        `💬 <b>Nouveau message client</b>\n` +
        `👤 <b>${order.clientEmail}</b>\n` +
        `📺 Service : ${order.service?.name || orderId}\n` +
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
