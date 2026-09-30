import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { sendOrderDetailsEmail } from '@/lib/nodemailer';
import { createInvoiceForOrder } from '@/lib/invoice';
import { decrypt } from '@/lib/crypto';
import { LEGAL_LAST_UPDATED } from '@/lib/legalConfig';
import { enforceRateLimit } from '@/lib/rateLimit';
import { validateCheckout } from '@/lib/checkoutValidation';
import { clientIp } from '@/lib/clientIp';
import { isGatewayEnabled } from '@/lib/paymentSettings';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2026-04-22.dahlia',
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * POST /api/checkout/stripe : Crée une session Stripe Checkout en mode subscription (prélèvement mensuel auto).
 */
export async function POST(request: Request) {
  try {
    // Limite la création de sessions Stripe (anti-abus / anti-spam de checkout).
    const limited = await enforceRateLimit(request, 'checkout-stripe', 15, 600, true);
    if (limited) return limited;

    const input = validateCheckout(await request.json());
    if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });
    const { serviceId, stockAccountId, email: cleanedEmail, youtubeEmail } = input;
    const cleanedYoutubeEmail = youtubeEmail || '';
    if (!(await isGatewayEnabled('cb'))) {
      return NextResponse.json({ error: 'Ce moyen de paiement est indisponible.' }, { status: 503 });
    }

    // Preuve d'acceptation : horodatage serveur + métadonnées techniques
    const acceptedAt = new Date();
    const acceptanceUserAgent = (request.headers.get('user-agent') || '').slice(0, 450);
    // x-real-ip est défini par l'edge Vercel (non falsifiable), contrairement à
    // x-forwarded-for que le client peut préfixer. Preuve légale d'acceptation.
    const acceptanceIp = clientIp(request);
    const termsVersion = LEGAL_LAST_UPDATED;

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    const stockAccount = await prisma.stockAccount.findUnique({ where: { id: stockAccountId } });

    if (!service?.active || !stockAccount) {
      return NextResponse.json({ error: 'Service ou stock introuvable' }, { status: 404 });
    }

    if (stockAccount.serviceId !== serviceId) {
      return NextResponse.json({ error: 'Ce stock ne correspond pas au service sélectionné' }, { status: 400 });
    }

    if (stockAccount.filledSlots >= stockAccount.maxSlots) {
      return NextResponse.json({ error: 'Plus de places disponibles dans ce compte' }, { status: 400 });
    }
    if (!Number.isFinite(stockAccount.price) || Math.round(stockAccount.price * 100) < 1) {
      return NextResponse.json({ error: 'Cette offre est temporairement indisponible.' }, { status: 409 });
    }

    const stripeConfigured = !!process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_mock';

    // Fail-closed : en production, Stripe DOIT être configuré.
    // Sans clé réelle on ne crée JAMAIS de commande sans paiement.
    if (!stripeConfigured && process.env.NODE_ENV === 'production') {
      console.error('[checkout] STRIPE_SECRET_KEY absent en production — paiement refusé');
      return NextResponse.json({ error: 'Le paiement est temporairement indisponible. Merci de réessayer plus tard.' }, { status: 503 });
    }

    // Mode simulation : nécessite un opt-in explicite via STRIPE_SIMULATION_ENABLED=true
    // pour éviter l'activation accidentelle sur les environnements de preview.
    const simulationEnabled = process.env.STRIPE_SIMULATION_ENABLED === 'true';
    if (!stripeConfigured && !simulationEnabled) {
      console.error('[checkout] Stripe non configuré et simulation désactivée');
      return NextResponse.json({ error: 'Le paiement est temporairement indisponible.' }, { status: 503 });
    }
    if (!stripeConfigured && simulationEnabled) {
      console.log('--- MODE SIMULATION STRIPE (subscription, dev) ---');
      const order = await prisma.$transaction(async (tx) => {
        const stockIncrement = await tx.stockAccount.updateMany({
          where: { id: stockAccountId, filledSlots: { lt: tx.stockAccount.fields.maxSlots }, service: { active: true } },
          data: { filledSlots: { increment: 1 } },
        });
        if (stockIncrement.count === 0) {
          throw new Error('Plus de places disponibles dans ce compte');
        }
        const updatedStock = await tx.stockAccount.findUnique({ where: { id: stockAccountId } });
        if (!updatedStock) throw new Error('Stock introuvable');
        const createdOrder = await tx.order.create({
          data: {
            serviceId,
            stockAccountId,
            price: updatedStock.price,
            total: updatedStock.price,
            details: updatedStock.details,
            clientEmail: cleanedEmail,
            youtubeEmail: cleanedYoutubeEmail || null,
            paymentMethod: 'Carte bancaire (Stripe)',
            status: 'active',
            nextBillingAt: new Date(Date.now() + 30 * 86400000),
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
        await tx.chatThread.create({
          data: {
            id: createdOrder.id,
            orderId: createdOrder.id,
            title: `Support ${service.name}`,
            messages: { create: [{ sender: 'Support StreamMalin', text: `Bonjour ! Merci pour votre abonnement à ${service.name}. Vos identifiants de connexion sont disponibles sur votre commande dans votre espace client et vous ont été envoyés par e-mail. Une question ? Écrivez-nous ici.` }] },
          },
        });
        return createdOrder;
      });
      const invoice = await createInvoiceForOrder({
        orderId: order.id,
        clientEmail: cleanedEmail,
        serviceName: service.name,
        amount: order.total,
        paymentMethod: 'Carte bancaire (Stripe)',
      }).catch((err) => { console.error('[invoice] simulation error:', err); return null; });
      await sendOrderDetailsEmail(cleanedEmail, service.name, decrypt(order.details), order.id, cleanedYoutubeEmail || undefined, {
        amount: order.total,
        invoiceId: invoice?.id,
        invoiceNumber: invoice?.number,
      });
      return NextResponse.json({
        success: true,
        simulated: true,
        url: `${APP_URL}/?success=true&email=${encodeURIComponent(cleanedEmail)}&orderId=${order.id}`,
      });
    }

    // Stripe Subscription réelle
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'link'],
      customer_email: cleanedEmail,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `StreamMalin - ${service.name}`,
              description: `Abonnement mensuel à ${service.name} — résiliable à tout moment`,
            },
            unit_amount: Math.round(stockAccount.price * 100),
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}/?success=true&email=${encodeURIComponent(cleanedEmail)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/checkout?service=${serviceId}&stock=${stockAccountId}&cancelled=true`,
      metadata: {
        serviceId,
        stockAccountId,
        clientEmail: cleanedEmail,
        price: stockAccount.price.toString(),
        youtubeEmail: cleanedYoutubeEmail,
        acceptedAt: acceptedAt.toISOString(),
        acceptedTermsAt: acceptedAt.toISOString(),
        acceptedWithdrawalWaiverAt: acceptedAt.toISOString(),
        acceptedEligibilityAt: acceptedAt.toISOString(),
        termsVersion,
        acceptanceUserAgent,
        acceptanceIp,
      },
      subscription_data: {
        metadata: {
          serviceId,
          stockAccountId,
          clientEmail: cleanedEmail,
          youtubeEmail: cleanedYoutubeEmail,
        },
      },
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error: unknown) {
    // On journalise le détail côté serveur mais on n'expose jamais le message
    // brut au client (peut révéler des détails Stripe / schéma interne).
    console.error('Erreur Stripe Checkout Route:', error);
    return NextResponse.json({ error: 'Erreur serveur. Merci de réessayer plus tard.' }, { status: 500 });
  }
}
