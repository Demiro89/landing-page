import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// Vérifie si l'utilisateur est authentifié en tant qu'admin
async function checkIsAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('ADMIN_SECRET_TOKEN')?.value;
  const secretToken = process.env.ADMIN_SECRET_TOKEN || 'SM_SUPER_SECRET_TOKEN_2026';
  return token === secretToken;
}

/**
 * GET /api/chat : Récupère les messages d'un fil ou la liste des fils (pour l'admin).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const isAdmin = await checkIsAdmin();

    // 1. Si admin veut l'historique complet de tous les chats
    if (isAdmin && !orderId) {
      const threads = await prisma.chatThread.findMany({
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
          order: {
            include: {
              service: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ success: true, threads });
    }

    // 2. Si client ou admin demande les messages d'un ticket spécifique
    if (!orderId) {
      return NextResponse.json({ error: 'orderId requis' }, { status: 400 });
    }

    const thread = await prisma.chatThread.findUnique({
      where: { orderId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        order: {
          include: {
            service: true,
          },
        },
      },
    });

    if (!thread) {
      return NextResponse.json({ error: 'Fil de discussion introuvable' }, { status: 404 });
    }

    return NextResponse.json({ success: true, thread });
  } catch (error: any) {
    console.error('Erreur GET chat route:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

/**
 * POST /api/chat : Envoie un message dans un fil.
 */
export async function POST(request: Request) {
  try {
    const { orderId, text, sender } = await request.json();

    if (!orderId || !text || !sender) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    const isAdmin = await checkIsAdmin();

    // Protection de sécurité cruciale : Seul l'admin connecté peut signer un message "Support StreamMalin"
    if (sender.includes('Support') && !isAdmin) {
      return NextResponse.json({ error: 'Non autorisé à envoyer ce type de message' }, { status: 403 });
    }

    // S'assurer que le thread existe
    let thread = await prisma.chatThread.findUnique({
      where: { orderId },
    });

    if (!thread) {
      // Si absent, on essaie de le lier à une commande existante
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { service: true },
      });

      if (!order) {
        return NextResponse.json({ error: 'Commande correspondante introuvable' }, { status: 404 });
      }

      thread = await prisma.chatThread.create({
        data: {
          id: orderId,
          orderId,
          title: `Support ${order.service.name}`,
        },
      });
    }

    // Créer le message
    const message = await prisma.message.create({
      data: {
        threadId: thread.id,
        sender,
        text,
      },
    });

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error('Erreur POST chat route:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
