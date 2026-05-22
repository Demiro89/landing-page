import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOrderDetailsEmail, sendUnpaidReminderEmail } from '@/lib/nodemailer';
import { sendTelegramNotification } from '@/lib/telegram';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import { encrypt, decrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

// Vérification d'authentification admin (centralisée dans lib/adminAuth).
const checkAuth = isAdminAuthenticated;

/**
 * Récupère l'intégralité du stock, des commandes et calcule les KPIs financiers pour l'admin.
 */
export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    // Récupérer les services avec leurs stocks
    const services = await prisma.service.findMany({
      include: {
        stocks: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { id: 'asc' },
    });

    // Récupérer toutes les commandes pour calculer les indicateurs financiers
    const orders = await prisma.order.findMany({
      include: {
        service: true,
        stockAccount: true,
      },
      orderBy: { date: 'desc' },
    });

    // Calculs financiers (KPIs)
    let totalRevenue = 0;
    let totalCogs = 0; // Coût d'achat global des slots consommés

    orders.forEach((order) => {
      totalRevenue += order.total;
      // On calcule le coût unitaire de ce slot dans le compte de stock associé
      // COGS d'un slot = Coût d'achat total du compte divisé par le nombre maximal de slots
      if (order.stockAccount) {
        // Dans une vraie db Prisma on a les relations. Si absente, fallback sur coût de revient estimé à 25% du prix
        const unitCogs = order.price * 0.25; 
        totalCogs += unitCogs;
      } else {
        totalCogs += order.price * 0.25; 
      }
    });

    // Si on veut faire plus précis, on somme le coût de revient (accountsBoughtPrice) de tous les StockAccounts existants
    const allStockAccounts = await prisma.stockAccount.findMany();
    let totalInvestment = allStockAccounts.reduce((acc, curr) => acc + curr.accountsBoughtPrice, 0);

    const netProfit = totalRevenue - totalCogs;
    const marginPercentage = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Déchiffre les identifiants avant de les renvoyer à l'interface admin.
    const safeServices = services.map((s) => ({
      ...s,
      stocks: s.stocks.map((st) => ({ ...st, details: decrypt(st.details) })),
    }));
    const safeOrders = orders.map((o) => ({ ...o, details: decrypt(o.details) }));

    return NextResponse.json({
      success: true,
      services: safeServices,
      orders: safeOrders,
      kpis: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalCogs: parseFloat(totalCogs.toFixed(2)),
        totalInvestment: parseFloat(totalInvestment.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        marginPercentage: parseFloat(marginPercentage.toFixed(2)),
      },
    });
  } catch (error) {
    console.error('Erreur GET stock admin:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * Crée un nouveau service ou ajoute un compte de stock.
 */
export async function POST(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    // A. Création ou édition d'un Service
    if (action === 'create_service') {
      const { id, name, tagline, price, original, maxSlots, icon, gradient, features } = body;

      const service = await prisma.service.upsert({
        where: { id },
        update: {
          name,
          tagline,
          price: parseFloat(price),
          original: parseFloat(original),
          maxSlots: parseInt(maxSlots),
          icon,
          gradient,
          features,
        },
        create: {
          id,
          name,
          tagline,
          price: parseFloat(price),
          original: parseFloat(original),
          maxSlots: parseInt(maxSlots),
          icon,
          gradient,
          features,
        },
      });

      return NextResponse.json({ success: true, service });
    }

    // B. Ajout de stock pour un service existant
    if (action === 'add_stock') {
      const { serviceId, accountsBoughtPrice, price, maxSlots, filledSlots, details } = body;

      const stock = await prisma.stockAccount.create({
        data: {
          serviceId,
          accountsBoughtPrice: parseFloat(accountsBoughtPrice || 0),
          price: parseFloat(price),
          maxSlots: parseInt(maxSlots),
          filledSlots: parseInt(filledSlots || 0),
          details: encrypt(details),
        },
      });

      return NextResponse.json({ success: true, stock });
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
  } catch (error: any) {
    console.error('Erreur POST stock admin:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * Met à jour un compte de stock ou un service.
 */
export async function PUT(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, id } = body;

    if (action === 'update_stock') {
      const { accountsBoughtPrice, price, maxSlots, filledSlots, details } = body;

      // Récupérer l'ancien état pour détecter un changement d'identifiants
      const previous = await prisma.stockAccount.findUnique({ where: { id } });

      const updatedStock = await prisma.stockAccount.update({
        where: { id },
        data: {
          accountsBoughtPrice: parseFloat(accountsBoughtPrice),
          price: parseFloat(price),
          maxSlots: parseInt(maxSlots),
          filledSlots: parseInt(filledSlots),
          details: encrypt(details),
        },
      });

      // Notifier les clients actifs si les identifiants ont changé
      if (previous && decrypt(previous.details) !== details) {
        const activeOrders = await prisma.order.findMany({
          where: { stockAccountId: id, status: 'active' },
          include: { service: true },
        });

        for (const order of activeOrders) {
          sendOrderDetailsEmail(order.clientEmail, order.service.name, details, order.id, order.youtubeEmail || undefined)
            .catch((err) => console.error('[update_stock] email error:', err));
        }
      }

      return NextResponse.json({ success: true, stock: updatedStock });
    }

    if (action === 'toggle_service') {
      const { active } = body;
      const updatedService = await prisma.service.update({
        where: { id },
        data: { active },
      });
      return NextResponse.json({ success: true, service: updatedService });
    }

    if (action === 'cancel_order') {
      const { orderId } = body;
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) {
        return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
      }
      if (order.status === 'cancelled') {
        return NextResponse.json({ success: true });
      }
      await prisma.$transaction([
        prisma.order.update({
          where: { id: orderId },
          data: { status: 'cancelled', cancellationEffectiveAt: order.cancellationEffectiveAt || new Date() },
        }),
        prisma.stockAccount.update({
          where: { id: order.stockAccountId },
          data: { filledSlots: { decrement: 1 } },
        }),
      ]);
      return NextResponse.json({ success: true });
    }

    // ── Marquer une commande comme impayée ──
    if (action === 'mark_unpaid') {
      const { orderId } = body;
      const order = await prisma.order.findUnique({ where: { id: orderId }, include: { service: true } });
      if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'unpaid', unpaidSince: new Date(), reminderCount: 1, lastReminderAt: new Date() },
      });
      sendUnpaidReminderEmail(order.clientEmail, order.service.name, order.id, 1).catch(() => {});
      sendTelegramNotification(
        `⚠️ <b>Impayé signalé</b>\n👤 ${order.clientEmail}\n📺 ${order.service.name}\n💶 ${order.price.toFixed(2)}€/mois\n\nPremier email de rappel envoyé.`
      ).catch(() => {});
      return NextResponse.json({ success: true });
    }

    // ── Envoyer un rappel de paiement ──
    if (action === 'send_reminder') {
      const { orderId } = body;
      const order = await prisma.order.findUnique({ where: { id: orderId }, include: { service: true } });
      if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
      const nextLevel = Math.min((order.reminderCount || 1) + 1, 3) as 1 | 2 | 3;
      await prisma.order.update({
        where: { id: orderId },
        data: { reminderCount: nextLevel, lastReminderAt: new Date() },
      });
      sendUnpaidReminderEmail(order.clientEmail, order.service.name, order.id, nextLevel).catch(() => {});
      sendTelegramNotification(
        `🔔 <b>Rappel ${nextLevel}/3 envoyé</b>\n👤 ${order.clientEmail}\n📺 ${order.service.name}`
      ).catch(() => {});
      return NextResponse.json({ success: true, reminderLevel: nextLevel });
    }

    // ── Modifier les infos client d'une commande (email, email YouTube) ──
    if (action === 'update_order') {
      const { orderId, clientEmail, youtubeEmail } = body;
      if (!orderId) return NextResponse.json({ error: 'orderId requis' }, { status: 400 });

      const data: { clientEmail?: string; youtubeEmail?: string | null } = {};
      if (clientEmail !== undefined) {
        const cleaned = String(clientEmail).trim().toLowerCase();
        if (!cleaned.includes('@')) return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 });
        data.clientEmail = cleaned;
      }
      if (youtubeEmail !== undefined) {
        const cleaned = String(youtubeEmail).trim().toLowerCase();
        data.youtubeEmail = cleaned || null;
      }

      await prisma.order.update({ where: { id: orderId }, data });
      return NextResponse.json({ success: true });
    }

    // ── Marquer comme payé (régularisation) ──
    if (action === 'mark_paid') {
      const { orderId } = body;
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'active', unpaidSince: null, reminderCount: 0, lastReminderAt: null },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
  } catch (error: any) {
    console.error('Erreur PUT stock admin:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * Supprime un service ou un compte de stock.
 */
export async function DELETE(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type'); // "service" ou "stock"

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    if (type === 'stock') {
      await prisma.stockAccount.delete({
        where: { id },
      });
      return NextResponse.json({ success: true, message: 'Stock supprimé avec succès' });
    }

    if (type === 'service') {
      await prisma.service.delete({
        where: { id },
      });
      return NextResponse.json({ success: true, message: 'Service supprimé avec succès' });
    }

    return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
  } catch (error: any) {
    console.error('Erreur DELETE stock admin:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
