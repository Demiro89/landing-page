import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';
import { enforceRateLimit } from '@/lib/rateLimit';
import { sendTelegramNotification } from '@/lib/telegram';
import { LEGAL_LAST_UPDATED } from '@/lib/legalConfig';

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
    const limited = await enforceRateLimit(request, 'checkout-manual', 10, 600);
    if (limited) return limited;

    const { serviceId, stockAccountId, email, youtubeEmail, paymentMethod, acceptedCgv, acceptedImmediateExecution, acceptedEligibility } =
      await request.json();

    if (!serviceId || !stockAccountId || !email) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }
    const isValidId = (v: unknown) =>
      typeof v === 'string' && v.length > 0 && v.length <= 64 && /^[A-Za-z0-9_-]+$/.test(v);
    if (!isValidId(serviceId) || !isValidId(stockAccountId)) {
      return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 });
    }
    const methodLabel = METHOD_LABELS[paymentMethod];
    if (!methodLabel) {
      return NextResponse.json({ error: 'Moyen de paiement invalide' }, { status: 400 });
    }
    if (!acceptedCgv || !acceptedImmediateExecution || !acceptedEligibility) {
      return NextResponse.json(
        { error: "Vous devez accepter les CGV, la demande d'exécution immédiate et confirmer votre éligibilité." },
        { status: 400 }
      );
    }
    const cleanedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 });
    }
    if (serviceId === 'youtube' && !youtubeEmail) {
      return NextResponse.json({ error: 'Adresse e-mail YouTube requise pour YouTube Premium' }, { status: 400 });
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    const stock = await prisma.stockAccount.findUnique({ where: { id: stockAccountId } });
    if (!service || !stock) {
      return NextResponse.json({ error: 'Service ou stock introuvable' }, { status: 404 });
    }
    if (stock.serviceId !== serviceId) {
      return NextResponse.json({ error: 'Ce stock ne correspond pas au service sélectionné' }, { status: 400 });
    }
    if (stock.filledSlots >= stock.maxSlots) {
      return NextResponse.json({ error: 'Plus de places disponibles dans ce compte' }, { status: 400 });
    }

    // Preuve d'acceptation des CGV : horodatage serveur + métadonnées techniques.
    const acceptedAt = new Date();
    const acceptanceUserAgent = (request.headers.get('user-agent') || '').slice(0, 450);
    const acceptanceIp = (
      request.headers.get('x-real-ip')?.trim() ||
      (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    ).slice(0, 90);
    const termsVersion = LEGAL_LAST_UPDATED;

    // Évite les doublons sur double-clic : réutilise une commande en attente identique.
    const existing = await prisma.order.findFirst({
      where: { stockAccountId, clientEmail: cleanedEmail, status: 'pending' },
    });
    if (existing) {
      await prisma.order.update({
        where: { id: existing.id },
        data: {
          price: stock.price,
          total: stock.price,
          paymentMethod: methodLabel,
          youtubeEmail: youtubeEmail ? String(youtubeEmail).trim().toLowerCase() : null,
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
      return NextResponse.json({ success: true, orderId: existing.id, reused: true });
    }

    const customer = await getCurrentCustomer();

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
        customerId: customer?.id || null,
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
