import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOrderDetailsEmail, sendUnpaidReminderEmail } from '@/lib/nodemailer';
import { sendTelegramNotification } from '@/lib/telegram';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import { requireRecentAdmin } from '@/lib/adminFreshness';
import { encrypt, decrypt } from '@/lib/crypto';
import { createInvoiceForOrder } from '@/lib/invoice';
import { writeAuditLog, clientIpFromRequest } from '@/lib/auditLog';
import { enforceRateLimit } from '@/lib/rateLimit';
import Stripe from 'stripe';
import { activatePendingOrder, cancelOrderAndReleaseStock, OrderConflictError } from '@/lib/orderLifecycle';
import { normalizeEmail } from '@/lib/checkoutValidation';
import { remediationSchemaEnabled } from '@/lib/commerce';
import { lockStock, heldPlaces } from '@/lib/stockReservations';
import { recordOrderPayment, enqueueOrderJob } from '@/lib/durableOrders';
import { queueUnpaidReminder } from '@/lib/unpaidReminders';
import { isStripeOrder, hasValidatedInitialAmount } from '@/lib/adminPresentation';
import { logServerFailure } from '@/lib/securityLog';
import { readJsonObject } from '@/lib/requestJson';
import { scheduleDeliveryPass } from '@/lib/deliveryWorker';

const validId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);

export const dynamic = 'force-dynamic';

// Throttle commun aux mutations admin : limite les dégâts en cas de session
// volée et les opérations en masse involontaires (60 écritures / minute).
const writeRateLimit = async (request: Request) =>
  await requireRecentAdmin() || await enforceRateLimit(request, 'admin-write', 60, 60, true);

const checkAuth = isAdminAuthenticated;
const errorMessage = (error: unknown) => {
  logServerFailure('admin/stock', error);
  return 'Erreur serveur';
};

function parseFiniteNumber(v: unknown): number | null {
  if (typeof v !== 'number' && (typeof v !== 'string' || !v.trim())) return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function parsePositiveNumber(v: unknown): number | null {
  const n = parseFiniteNumber(v);
  return n !== null && n > 0 ? n : null;
}

function parseNonNegativeNumber(v: unknown): number | null {
  const n = parseFiniteNumber(v);
  return n !== null && n >= 0 ? n : null;
}

function parseInteger(v: unknown): number | null {
  const n = parseFiniteNumber(v);
  return n !== null && Number.isSafeInteger(n) && n <= 100000 ? n : null;
}

function parseNonNegativeInt(v: unknown): number | null {
  const n = parseInteger(v);
  return n !== null && n >= 0 ? n : null;
}

function parsePositiveInt(v: unknown): number | null {
  const n = parseInteger(v);
  return n !== null && n >= 1 ? n : null;
}

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
      if (!hasValidatedInitialAmount(order.status)) return;
      totalRevenue += order.total;
      // On calcule le coût unitaire de ce slot dans le compte de stock associé
      // COGS d'un slot = Coût d'achat total du compte divisé par le nombre maximal de slots
      if (order.stockAccount) {
        const unitCogs = order.stockAccount.maxSlots > 0 ? order.stockAccount.accountsBoughtPrice / order.stockAccount.maxSlots : 0;
        totalCogs += unitCogs;
      } else {
        totalCogs += 0;
      }
    });

    // Si on veut faire plus précis, on somme le coût de revient (accountsBoughtPrice) de tous les StockAccounts existants
    const allStockAccounts = await prisma.stockAccount.findMany();
    const totalInvestment = allStockAccounts.reduce((acc, curr) => acc + curr.accountsBoughtPrice, 0);

    const netProfit = totalRevenue - totalCogs;
    const marginPercentage = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Bulk lists never carry stock or order credentials, including nested relations.
    const safeServices = services.map((s) => ({
      ...s,
      stocks: s.stocks.map((st) => ({ ...st, details: '' })),
    }));
    const safeOrders = orders.map((o) => ({ ...o, details: '', stockAccount: o.stockAccount ? { ...o.stockAccount, details: '' } : null }));

    return NextResponse.json({
      success: true,
      services: safeServices,
      orders: safeOrders,
      schemaEnabled: remediationSchemaEnabled(),
      kpis: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalCogs: parseFloat(totalCogs.toFixed(2)),
        totalInvestment: parseFloat(totalInvestment.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        marginPercentage: parseFloat(marginPercentage.toFixed(2)),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

/**
 * Crée un nouveau service ou ajoute un compte de stock.
 */
export async function POST(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const limited = await writeRateLimit(request);
  if (limited) return limited;

  try {
    const parsed = await readJsonObject(request, 32768);
    if (!parsed.ok) return parsed.response;
    const body = parsed.value;
    const { action } = body;

    // A. Création ou édition d'un Service
    if (action === 'create_service') {
      const { id, name, tagline, price, original, maxSlots, icon, gradient, features } = body;

      const cleanId = typeof id === 'string' ? id.trim() : '';
      if (!/^[a-z0-9_-]{1,64}$/.test(cleanId)) return NextResponse.json({ error: 'id invalide (minuscules, chiffres, _ ou - uniquement)' }, { status: 400 });
      const cleanName = typeof name === 'string' ? name.trim() : '';
      if (!cleanName || cleanName.length > 120) return NextResponse.json({ error: 'name invalide (1 à 120 caractères)' }, { status: 400 });
      const cleanTagline = typeof tagline === 'string' ? tagline.trim() : '';
      if (typeof tagline !== 'string' || cleanTagline.length > 240) return NextResponse.json({ error: 'tagline invalide' }, { status: 400 });
      const cleanIcon = typeof icon === 'string' ? icon.trim() : '';
      if (typeof icon !== 'string' || cleanIcon.length > 16) return NextResponse.json({ error: 'icon invalide' }, { status: 400 });
      const cleanGradient = typeof gradient === 'string' ? gradient.trim() : '';
      if (typeof gradient !== 'string' || cleanGradient.length > 240 || /url\(|expression\(|[;{}<>]/i.test(cleanGradient)) {
        return NextResponse.json({ error: 'gradient invalide' }, { status: 400 });
      }
      const parsedPrice = parsePositiveNumber(price);
      const parsedOriginal = parsePositiveNumber(original);
      const parsedMaxSlots = parsePositiveInt(maxSlots);
      if (parsedPrice === null) return NextResponse.json({ error: 'price doit être un nombre positif' }, { status: 400 });
      if (parsedOriginal === null) return NextResponse.json({ error: 'original doit être un nombre positif' }, { status: 400 });
      if (parsedMaxSlots === null) return NextResponse.json({ error: 'maxSlots doit être un entier >= 1' }, { status: 400 });
      if (!Array.isArray(features) || features.length === 0 || features.length > 20 || features.some((f) => typeof f !== 'string' || !f.trim() || f.trim().length > 240)) {
        return NextResponse.json({ error: 'features doit contenir entre 1 et 20 libellés valides' }, { status: 400 });
      }
      const cleanFeatures = features.map((f) => (f as string).trim());

      const service = await prisma.service.upsert({
        where: { id: cleanId },
        update: {
          name: cleanName,
          tagline: cleanTagline,
          price: parsedPrice,
          original: parsedOriginal,
          maxSlots: parsedMaxSlots,
          icon: cleanIcon,
          gradient: cleanGradient,
          features: cleanFeatures,
        },
        create: {
          id: cleanId,
          name: cleanName,
          tagline: cleanTagline,
          price: parsedPrice,
          original: parsedOriginal,
          maxSlots: parsedMaxSlots,
          icon: cleanIcon,
          gradient: cleanGradient,
          features: cleanFeatures,
        },
      });

      void writeAuditLog({ action: 'service.upsert', entityType: 'service', entityId: cleanId, description: `Service "${cleanName}" créé ou mis à jour`, ip: clientIpFromRequest(request) });
      return NextResponse.json({ success: true, service });
    }

    // B. Ajout de stock pour un service existant
    if (action === 'add_stock') {
      const { serviceId, accountsBoughtPrice, price, maxSlots, filledSlots, details } = body;

      if (!validId(serviceId)) return NextResponse.json({ error: 'serviceId invalide' }, { status: 400 });
      const parsedPrice = parsePositiveNumber(price);
      const parsedAccountsBoughtPrice = parseNonNegativeNumber(accountsBoughtPrice || 0);
      const parsedMaxSlots = parsePositiveInt(maxSlots);
      const parsedFilled = parseNonNegativeInt(filledSlots ?? 0);
      if (parsedPrice === null) return NextResponse.json({ error: 'price doit être un nombre positif' }, { status: 400 });
      if (parsedAccountsBoughtPrice === null) return NextResponse.json({ error: 'accountsBoughtPrice doit être un nombre >= 0' }, { status: 400 });
      if (parsedMaxSlots === null) return NextResponse.json({ error: 'maxSlots doit être un entier >= 1' }, { status: 400 });
      if (parsedFilled === null || parsedFilled > parsedMaxSlots) {
        return NextResponse.json({ error: 'filledSlots invalide ou supérieur à maxSlots' }, { status: 400 });
      }
      if (typeof details !== 'string' || !details.trim() || details.length > 4000) return NextResponse.json({ error: 'details invalides ou trop longs' }, { status: 400 });
      const existingService = await prisma.service.findUnique({ where: { id: serviceId } });
      if (!existingService) return NextResponse.json({ error: 'Service introuvable' }, { status: 400 });

      const stock = await prisma.stockAccount.create({
        data: {
          serviceId,
          accountsBoughtPrice: parsedAccountsBoughtPrice,
          price: parsedPrice,
          maxSlots: parsedMaxSlots,
          filledSlots: parsedFilled,
          details: encrypt(details),
        },
      });

      void writeAuditLog({ action: 'stock.create', entityType: 'stock', entityId: stock.id, description: `Stock ajouté pour "${existingService.name}" (${parsedMaxSlots} slots, ${parsedPrice}€)`, ip: clientIpFromRequest(request) });
      return NextResponse.json({ success: true, stock: { ...stock, details: '' } });
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

/**
 * Met à jour un compte de stock ou un service.
 */
export async function PUT(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const limited = await writeRateLimit(request);
  if (limited) return limited;

  try {
    const parsed = await readJsonObject(request, 32768);
    if (!parsed.ok) return parsed.response;
    const body = parsed.value;
    const { action, id } = body;

    if (action === 'update_stock') {
      const { accountsBoughtPrice, price, maxSlots, filledSlots, details } = body;
      if (!validId(id)) return NextResponse.json({ error: 'id invalide' }, { status: 400 });

      const parsedPrice = parsePositiveNumber(price);
      const parsedAccountsBoughtPrice = parseNonNegativeNumber(accountsBoughtPrice);
      const parsedMaxSlots = parsePositiveInt(maxSlots);
      const parsedFilled = parseNonNegativeInt(filledSlots);
      if (parsedPrice === null) return NextResponse.json({ error: 'price doit être un nombre positif' }, { status: 400 });
      if (parsedAccountsBoughtPrice === null) return NextResponse.json({ error: 'accountsBoughtPrice doit être un nombre >= 0' }, { status: 400 });
      if (parsedMaxSlots === null) return NextResponse.json({ error: 'maxSlots doit être un entier >= 1' }, { status: 400 });
      if (parsedFilled === null) return NextResponse.json({ error: 'filledSlots doit être un entier >= 0' }, { status: 400 });
      if (parsedFilled > parsedMaxSlots) return NextResponse.json({ error: 'filledSlots ne peut pas dépasser maxSlots' }, { status: 400 });
      if (typeof details !== 'string' || !details.trim() || details.length > 4000) return NextResponse.json({ error: 'details invalides ou trop longs' }, { status: 400 });

      // Récupérer l'ancien état pour détecter un changement d'identifiants
      const previous = await prisma.stockAccount.findUnique({ where: { id } });
      if (!previous) return NextResponse.json({ error: 'Stock introuvable' }, { status: 404 });
      if (body.expectedUpdatedAt !== previous.updatedAt.toISOString()) {
        return NextResponse.json({ error: 'Ce stock a changé. Rechargez la page avant de modifier.' }, { status: 409 });
      }
      const encryptedDetails = encrypt(details);
      const credentialsChanged = decrypt(previous.details) !== details;
      const now = new Date();
      const updatedStock = await prisma.$transaction(async (tx) => {
        if (remediationSchemaEnabled()) {
          const current = await lockStock(tx, id);
          const held = await heldPlaces(tx, id);
          if (parsedMaxSlots < current.filledSlots + held || parsedFilled !== current.filledSlots) throw new OrderConflictError('Des places sont attribuées ou réservées. Le compteur occupé ne peut pas être modifié manuellement.');
        }
        const updated = await tx.stockAccount.updateMany({
          where: { id, updatedAt: previous.updatedAt },
          data: {
            accountsBoughtPrice: parsedAccountsBoughtPrice,
            price: parsedPrice,
            maxSlots: parsedMaxSlots,
            filledSlots: parsedFilled,
            details: encryptedDetails,
          },
        });
        if (updated.count !== 1) throw new OrderConflictError('Le stock a changé pendant la modification. Rechargez la page.');
        await tx.order.updateMany({
          where: {
            stockAccountId: id,
            OR: [
              { status: { in: ['active', 'unpaid'] } },
              { status: 'cancelled_pending', OR: [{ cancellationEffectiveAt: null }, { cancellationEffectiveAt: { gt: now } }] },
            ],
          },
          data: { details: encryptedDetails },
        });
        if (remediationSchemaEnabled() && credentialsChanged) {
          const affected = await tx.order.findMany({ where: { stockAccountId: id, status: 'active' } });
          for (const order of affected) await enqueueOrderJob(tx, order.id, 'credentials', `credentials:${order.id}:${previous.updatedAt.toISOString()}`);
        }
        return tx.stockAccount.findUniqueOrThrow({ where: { id } });
      });

      if (remediationSchemaEnabled() && credentialsChanged) {
        scheduleDeliveryPass(5);
      }

      // Notifier les clients actifs si les identifiants ont changé
      if (!remediationSchemaEnabled() && credentialsChanged) {
        const activeOrders = await prisma.order.findMany({
          where: { stockAccountId: id, status: 'active' },
          include: { service: true },
        });

        for (const order of activeOrders) {
          sendOrderDetailsEmail(order.clientEmail, order.service.name, details, order.id, order.youtubeEmail || undefined)
            .catch(err => logServerFailure('admin/stock/update-email', err));
        }
      }

      return NextResponse.json({ success: true, stock: { ...updatedStock, details: '' } });
    }

    if (action === 'toggle_service') {
      const { active } = body;
      if (!validId(id) || typeof active !== 'boolean') return NextResponse.json({ error: 'Service ou état invalide.' }, { status: 400 });
      const updatedService = await prisma.service.update({
        where: { id },
        data: { active },
      });
      void writeAuditLog({ action: 'service.toggle', entityType: 'service', entityId: id, description: `Service "${updatedService.name}" ${active ? 'activé' : 'désactivé'}`, ip: clientIpFromRequest(request) });
      return NextResponse.json({ success: true, service: updatedService });
    }

    if (action === 'cancel_order') {
      const { orderId } = body;
      if (!validId(orderId)) return NextResponse.json({ error: 'orderId invalide' }, { status: 400 });
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) {
        return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
      }
      if (order.status === 'cancelled') {
        return NextResponse.json({ success: true });
      }
      if (order.stripeSubscriptionId) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key || key === 'sk_test_mock') return NextResponse.json({ error: 'Stripe indisponible : annulation refusée.' }, { status: 503 });
        const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
        const sub = await stripe.subscriptions.retrieve(order.stripeSubscriptionId);
        if (sub.status !== 'canceled') await stripe.subscriptions.cancel(sub.id);
      }
      await prisma.$transaction((tx) => cancelOrderAndReleaseStock(tx, orderId));
      void writeAuditLog({ action: 'order.cancel', entityType: 'order', entityId: orderId, description: `Commande annulée (client : ${order.clientEmail})`, ip: clientIpFromRequest(request) });
      return NextResponse.json({ success: true });
    }

    // ── Marquer une commande comme impayée ──
    if (action === 'mark_unpaid') {
      const { orderId } = body;
      if (!validId(orderId)) return NextResponse.json({ error: 'orderId invalide' }, { status: 400 });
      const order = await prisma.order.findUnique({ where: { id: orderId }, include: { service: true } });
      if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
      const unpaidSince = new Date();
      const durable = remediationSchemaEnabled();
      const changed = await prisma.$transaction(async tx => {
        const result = await tx.order.updateMany({
          where: { id: orderId, status: 'active' },
          data: { status: 'unpaid', unpaidSince, reminderCount: 1, lastReminderAt: unpaidSince },
        });
        if (result.count === 1 && durable) await queueUnpaidReminder(tx, order.id, unpaidSince, 1);
        return result;
      });
      if (changed.count !== 1) return NextResponse.json({ error: 'Seule une commande active peut être marquée impayée.' }, { status: 409 });
      if (durable) scheduleDeliveryPass(5);
      else await sendUnpaidReminderEmail(order.clientEmail, order.service.name, order.id, 1);
      sendTelegramNotification(
        `⚠️ <b>Impayé signalé</b>\n🔖 Réf. ${order.id.slice(0, 8).toUpperCase()}\nPremière relance enregistrée.`
      ).catch(() => {});
      void writeAuditLog({ action: 'order.mark_unpaid', entityType: 'order', entityId: orderId, description: `Commande marquée impayée — ${order.clientEmail} / ${order.service.name}`, ip: clientIpFromRequest(request) });
      return NextResponse.json({ success: true });
    }

    // ── Envoyer un rappel de paiement ──
    if (action === 'send_reminder') {
      const { orderId } = body;
      if (!validId(orderId)) return NextResponse.json({ error: 'orderId invalide' }, { status: 400 });
      const order = await prisma.order.findUnique({ where: { id: orderId }, include: { service: true } });
      if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
      if (order.reminderCount >= 3) return NextResponse.json({ error: 'Trois relances ont déjà été enregistrées. Vérifiez le suivi et contactez le client avant une nouvelle action.' }, { status: 409 });
      const nextLevel = Math.min(order.reminderCount + 1, 3) as 1 | 2 | 3;
      const unpaidSince = order.unpaidSince || new Date();
      const durable = remediationSchemaEnabled();
      const reminded = await prisma.$transaction(async tx => {
        const result = await tx.order.updateMany({
          where: { id: orderId, status: 'unpaid', reminderCount: order.reminderCount, lastReminderAt: order.lastReminderAt, unpaidSince: order.unpaidSince },
          data: { reminderCount: nextLevel, unpaidSince, lastReminderAt: new Date() },
        });
        if (result.count === 1 && durable) await queueUnpaidReminder(tx, order.id, unpaidSince, nextLevel);
        return result;
      });
      if (reminded.count !== 1) return NextResponse.json({ error: 'La commande a changé entre-temps. Actualisez son suivi.' }, { status: 409 });
      if (durable) scheduleDeliveryPass(5);
      else await sendUnpaidReminderEmail(order.clientEmail, order.service.name, order.id, nextLevel);
      sendTelegramNotification(
        `🔔 <b>Relance ${nextLevel}/3 enregistrée</b>\n🔖 Réf. ${order.id.slice(0, 8).toUpperCase()}`
      ).catch(() => {});
      void writeAuditLog({ action: 'order.send_reminder', entityType: 'order', entityId: orderId, description: `Relance ${nextLevel}/3 enregistrée — ${order.clientEmail} / ${order.service.name}`, ip: clientIpFromRequest(request) });
      return NextResponse.json({ success: true, reminderLevel: nextLevel });
    }

    // ── Modifier les infos client d'une commande (email, email YouTube) ──
    if (action === 'update_order') {
      const { orderId, clientEmail, youtubeEmail } = body;
      if (!validId(orderId)) return NextResponse.json({ error: 'orderId requis' }, { status: 400 });

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const data: { clientEmail?: string; customerId?: string | null; youtubeEmail?: string | null } = {};
      if (clientEmail !== undefined) {
        const cleaned = normalizeEmail(clientEmail);
        if (!cleaned) return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 });
        data.clientEmail = cleaned;
        const owner = await prisma.customer.findUnique({ where: { email: cleaned } });
        data.customerId = owner?.emailVerified ? owner.id : null;
      }
      if (youtubeEmail !== undefined) {
        const cleaned = String(youtubeEmail).trim().toLowerCase();
        if (cleaned && !emailRegex.test(cleaned)) return NextResponse.json({ error: 'Adresse email YouTube invalide' }, { status: 400 });
        data.youtubeEmail = cleaned || null;
      }

      await prisma.order.update({ where: { id: orderId }, data });
      return NextResponse.json({ success: true });
    }

    // ── Marquer comme payé (régularisation) ──
    if (action === 'mark_paid') {
      const { orderId } = body;
      if (!validId(orderId)) return NextResponse.json({ error: 'orderId invalide' }, { status: 400 });
      const before = await prisma.order.findUnique({ where: { id: orderId }, include: { service: true } });
      if (!before) return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
      if (isStripeOrder(before)) return NextResponse.json({ error: 'Un paiement Stripe doit être régularisé et confirmé chez Stripe.' }, { status: 409 });
      const durable = remediationSchemaEnabled();
      const paymentRef = typeof body.paymentReference === 'string' ? body.paymentReference : '';
      if (durable && !/^[A-Za-z0-9_-]{6,120}$/.test(paymentRef)) return NextResponse.json({ error: 'La référence du nouveau paiement vérifié est requise.' }, { status: 400 });
      const changed = await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
        if (durable) {
          const provider = before.paymentMethod === 'PayPal' ? 'paypal_manual' : before.paymentMethod === 'Cryptomonnaie' ? 'crypto_manual' : null;
          if (!provider) throw new OrderConflictError('Moyen de paiement non reconnu : vérifiez la commande.');
          const previousPayment = await tx.paymentRecord.findUnique({ where: { provider_providerPaymentId: { provider, providerPaymentId: paymentRef } } });
          if (previousPayment) throw new OrderConflictError('Cette référence de paiement est déjà enregistrée.');
        }
        const result = await tx.order.updateMany({
          where: { id: orderId, status: 'unpaid' },
          data: { status: 'active', unpaidSince: null, reminderCount: 0, lastReminderAt: null },
        });
        if (result.count === 1 && durable) await recordOrderPayment(tx, {
          orderId, provider: before.paymentMethod === 'PayPal' ? 'paypal_manual' : 'crypto_manual', providerPaymentId: paymentRef,
          amountMinor: Math.round(before.price * 100), currency: 'eur', clientEmail: before.clientEmail, serviceName: before.service.name,
          termsVersion: before.termsVersion, paidAt: new Date(),
        });
        return result;
      });
      if (changed.count !== 1) return NextResponse.json({ error: 'Seule une commande impayée peut être régularisée.' }, { status: 409 });
      void writeAuditLog({ action: 'order.mark_paid', entityType: 'order', entityId: orderId, description: `Commande régularisée (marquée payée)`, ip: clientIpFromRequest(request) });
      return NextResponse.json({ success: true });
    }

    // ── Valider une commande manuelle en attente (PayPal / crypto) ──
    if (action === 'validate_order') {
      const { orderId } = body;
      if (!validId(orderId)) return NextResponse.json({ error: 'orderId invalide' }, { status: 400 });
      const paymentRef = typeof body.paymentReference === 'string' ? body.paymentReference : '';
      if (remediationSchemaEnabled() && !/^[A-Za-z0-9_-]{6,120}$/.test(paymentRef)) return NextResponse.json({ error: 'La référence vérifiée du paiement est requise.' }, { status: 400 });
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { service: true, stockAccount: true },
      });
      if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
      if (isStripeOrder(order)) return NextResponse.json({ error: 'Un paiement Stripe doit être confirmé par Stripe.' }, { status: 409 });
      if (order.status !== 'pending') {
        return NextResponse.json({ error: "Cette commande n'est pas en attente de validation." }, { status: 400 });
      }
      if (order.stockAccount.filledSlots >= order.stockAccount.maxSlots) {
        return NextResponse.json({ error: 'Plus de place disponible dans ce compte de stock.' }, { status: 400 });
      }

      const stockDetails = await prisma.$transaction(async (tx) => {
        const details = await activatePendingOrder(tx, orderId);
        if (remediationSchemaEnabled()) await recordOrderPayment(tx, { orderId, provider: order.paymentMethod === 'PayPal' ? 'paypal_manual' : 'crypto_manual', providerPaymentId: paymentRef,
          amountMinor: Math.round(order.total * 100), currency: 'eur', clientEmail: order.clientEmail, serviceName: order.service.name, termsVersion: order.termsVersion, paidAt: new Date() });
        const existingThread = await tx.chatThread.findUnique({ where: { orderId } });
        if (!existingThread) {
          await tx.chatThread.create({
            data: {
              id: orderId,
              orderId,
              title: `Support ${order.service.name}`,
              messages: { create: [{ sender: 'Support StreamMalin', text: `Bonjour ! Votre paiement pour ${order.service.name} a été validé. Retrouvez le suivi de votre accès dans votre espace client. Une question ? Écrivez-nous ici.` }] },
            },
          });
        }
        return details;
      });

      if (remediationSchemaEnabled()) {
        scheduleDeliveryPass(5);
        void writeAuditLog({ action: 'order.validate', entityType: 'order', entityId: orderId, description: 'Paiement manuel vérifié ; transmission enregistrée dans la file de suivi.', ip: clientIpFromRequest(request) });
        return NextResponse.json({ success: true, deliveryQueued: true });
      }
      const invoice = await createInvoiceForOrder({
        orderId: order.id,
        clientEmail: order.clientEmail,
        serviceName: order.service.name,
        amount: order.total,
        paymentMethod: order.paymentMethod || 'Paiement manuel',
      }).catch(err => { logServerFailure('admin/stock/invoice', err); return null; });

      await sendOrderDetailsEmail(
        order.clientEmail, order.service.name, decrypt(stockDetails), order.id,
        order.youtubeEmail || undefined,
        { amount: order.total, invoiceId: invoice?.id, invoiceNumber: invoice?.number }
      ).catch(err => logServerFailure('admin/stock/validate-email', err));

      void writeAuditLog({ action: 'order.validate', entityType: 'order', entityId: orderId, description: `Commande validée — ${order.clientEmail} / ${order.service.name} (${order.total.toFixed(2)}€)`, ip: clientIpFromRequest(request) });
      return NextResponse.json({ success: true });
    }

    // ── Refuser une commande manuelle en attente ──
    if (action === 'reject_order') {
      const { orderId } = body;
      if (!validId(orderId)) return NextResponse.json({ error: 'orderId invalide' }, { status: 400 });
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
      if (order.status !== 'pending') {
        return NextResponse.json({ error: "Cette commande n'est pas en attente." }, { status: 400 });
      }
      await prisma.$transaction(tx => cancelOrderAndReleaseStock(tx, orderId));
      void writeAuditLog({ action: 'order.reject', entityType: 'order', entityId: orderId, description: `Commande rejetée — ${order.clientEmail}`, ip: clientIpFromRequest(request) });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
  } catch (error: unknown) {
    if (error instanceof OrderConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

/**
 * Supprime un service ou un compte de stock.
 */
export async function DELETE(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const limited = await writeRateLimit(request);
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type'); // "service" ou "stock"

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    if (type === 'stock') {
      await prisma.stockAccount.delete({ where: { id } });
      void writeAuditLog({ action: 'stock.delete', entityType: 'stock', entityId: id, description: `Stock supprimé (id: ${id})`, ip: clientIpFromRequest(request) });
      return NextResponse.json({ success: true, message: 'Stock supprimé avec succès' });
    }

    if (type === 'service') {
      const svc = await prisma.service.findUnique({ where: { id }, select: { name: true } });
      await prisma.service.delete({ where: { id } });
      void writeAuditLog({ action: 'service.delete', entityType: 'service', entityId: id, description: `Service "${svc?.name ?? id}" supprimé`, ip: clientIpFromRequest(request) });
      return NextResponse.json({ success: true, message: 'Service supprimé avec succès' });
    }

    return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
