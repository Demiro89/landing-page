import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';
import { enforceRateLimit } from '@/lib/rateLimit';
import { sendTelegramNotification } from '@/lib/telegram';
import { LEGAL_LAST_UPDATED } from '@/lib/legalConfig';
import { validateCheckout } from '@/lib/checkoutValidation';
import { clientIp } from '@/lib/clientIp';
import { isGatewayEnabled } from '@/lib/paymentSettings';

export const dynamic = 'force-dynamic';

const METHOD_LABELS: Record<string, string> = {
  paypal: 'PayPal',
  crypto: 'Cryptomonnaie',
};

/**
 * POST /api/checkout/manual : enregistre une commande « en attente » pour les
 * paiements PayPal / crypto. La preuve de consentement aux CGV (horodatage + IP)
 * est conservée. Le stock n'est PAS décrémenté et aucun identifiant n'est livré
 * tant que l'administrateur n'a pas validé le paiement reçu.
 */
export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, 'checkout-manual', 10, 600, true);
    if (limited) return limited;

    const body = await request.json();
    const input = validateCheckout(body);
    if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });
    const { serviceId, stockAccountId, email: cleanedEmail, youtubeEmail } = input;
    const { paymentMethod } = body;
    if (paymentMethod !== 'paypal' && paymentMethod !== 'crypto') {
      return NextResponse.json({ error: 'Moyen de paiement invalide' }, { status: 400 });
    }
    const methodLabel = METHOD_LABELS[paymentMethod];
    if (!methodLabel) {
      return NextResponse.json({ error: 'Moyen de paiement invalide' }, { status: 400 });
    }
    if (!(await isGatewayEnabled(paymentMethod))) {
      return NextResponse.json({ error: 'Ce moyen de paiement est indisponible.' }, { status: 503 });
    }
    const destinationKey = paymentMethod === 'paypal' ? 'paypal_email' : ['btc', 'eth', 'usdt', 'ltc'].includes(body.cryptoCoin) ? `crypto_${body.cryptoCoin}` : null;
    if (!destinationKey || !(await prisma.setting.findUnique({ where: { key: destinationKey } }))?.value) {
      return NextResponse.json({ error: 'Ce moyen de paiement n’est pas configuré.' }, { status: 503 });
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    const stock = await prisma.stockAccount.findUnique({ where: { id: stockAccountId } });
    if (!service?.active || !stock) {
      return NextResponse.json({ error: 'Service ou stock introuvable' }, { status: 404 });
    }
    if (stock.serviceId !== serviceId) {
      return NextResponse.json({ error: 'Ce stock ne correspond pas au service sélectionné' }, { status: 400 });
    }
    if (stock.filledSlots >= stock.maxSlots) {
      return NextResponse.json({ error: 'Plus de places disponibles dans ce compte' }, { status: 400 });
    }
    if (!Number.isFinite(stock.price) || Math.round(stock.price * 100) < 1) {
      return NextResponse.json({ error: 'Cette offre est temporairement indisponible.' }, { status: 409 });
    }

    // Preuve d'acceptation des CGV : horodatage serveur + métadonnées techniques.
    const acceptedAt = new Date();
    const acceptanceUserAgent = (request.headers.get('user-agent') || '').slice(0, 450);
    const acceptanceIp = clientIp(request);
    const termsVersion = LEGAL_LAST_UPDATED;

    const customer = await getCurrentCustomer();
    const ownerId = customer?.email === cleanedEmail ? customer.id : null;
    // Reuse only an authenticated owner's identical order; never overwrite proof.
    const existing = ownerId ? await prisma.order.findFirst({
      where: { stockAccountId, clientEmail: cleanedEmail, customerId: ownerId, status: 'pending', paymentMethod: methodLabel, youtubeEmail },
    }) : null;
    if (existing && ownerId && existing.price === stock.price) {
      return NextResponse.json({ success: true, orderId: existing.id, reused: true });
    }

    const order = await prisma.order.create({
      data: {
        serviceId,
        stockAccountId,
        price: stock.price,
        total: stock.price,
        details: '', // rempli lors de la validation par l'administrateur
        clientEmail: cleanedEmail,
        youtubeEmail: youtubeEmail ? String(youtubeEmail).trim().toLowerCase() : null,
        paymentMethod: methodLabel,
        customerId: ownerId,
        status: 'pending',
        acceptedCgv: true,
        acceptedImmediateExecution: true,
        acceptedAt,
        acceptedTermsAt: acceptedAt,
        acceptedWithdrawalWaiverAt: acceptedAt,
        acceptedEligibilityAt: acceptedAt,
        termsVersion,
        acceptanceUserAgent,
        acceptanceIp,
      },
    });

    sendTelegramNotification(
      `🕓 <b>Commande à valider</b>\n💳 ${methodLabel}\n👤 ${cleanedEmail}\n📺 ${service.name}\n💶 ${stock.price.toFixed(2)}€\n🔖 Réf. ${order.id.slice(0, 8).toUpperCase()}`
    ).catch(() => {});

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (error) {
    console.error('Erreur POST checkout/manual:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
