import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';
import { sendCancellationEmail } from '@/lib/nodemailer';
import { sendTelegramNotification } from '@/lib/telegram';
import { enforceRateLimit } from '@/lib/rateLimit';
import { ownsOrder } from '@/lib/orderAccess';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Limite le spam de résiliations (et l'envoi d'emails associé).
    const limited = await enforceRateLimit(request, 'cancel-order', 10, 600);
    if (limited) return limited;

    const customer = await getCurrentCustomer();
    if (!customer) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId } = body as { orderId: string };

    if (!orderId) {
      return NextResponse.json({ error: 'orderId requis' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { service: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    // Vérifier que la commande appartient bien au customer connecté
    if (!ownsOrder(order, customer)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Vérifier que la commande est bien active
    if (order.status !== 'active') {
      return NextResponse.json({ error: 'Cette commande est déjà résiliée ou en cours de résiliation' }, { status: 400 });
    }

    // Calculer la date effective de résiliation : date de commande + 30 jours
    let cancellationEffectiveAt = order.nextBillingAt || new Date(order.date.getTime() + 30 * 86400000);
    if (order.stripeSubscriptionId) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key || key === 'sk_test_mock') return NextResponse.json({ error: 'Stripe est temporairement indisponible.' }, { status: 503 });
      const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
      const sub = await stripe.subscriptions.update(order.stripeSubscriptionId, { cancel_at_period_end: true });
      const end = sub.items.data[0]?.current_period_end;
      if (!end) throw new Error('Stripe subscription period unavailable');
      cancellationEffectiveAt = new Date(end * 1000);
    }

    const now = new Date();

    // Mettre à jour la commande
    const changed = await prisma.order.updateMany({
      where: { id: orderId, status: 'active' },
      data: {
        status: 'cancelled_pending',
        cancellationRequestedAt: now,
        cancellationEffectiveAt,
      },
    });
    if (changed.count !== 1) return NextResponse.json({ error: 'Cette commande a changé. Rechargez la page.' }, { status: 409 });

    // Envoyer l'email de confirmation de résiliation
    await sendCancellationEmail(customer.email, order.service.name, orderId, cancellationEffectiveAt);

    sendTelegramNotification(
      `🔴 <b>Résiliation client (manuel)</b>\n👤 ${customer.email}\n📺 ${order.service.name}\n📅 Effective le ${cancellationEffectiveAt.toLocaleDateString('fr-FR')}`
    ).catch(() => {});

    return NextResponse.json({ success: true, effectiveAt: cancellationEffectiveAt });
  } catch (error: unknown) {
    console.error('Erreur POST cancel-order:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
