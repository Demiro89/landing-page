import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { CURRENT_TERMS_VERSION } from '@/lib/termsVersion';
import { enforceRateLimit } from '@/lib/rateLimit';
import { validateCheckout } from '@/lib/checkoutValidation';
import { clientIp } from '@/lib/clientIp';
import { isGatewayEnabled } from '@/lib/paymentSettings';
import { assertOfferSaleAllowed, CommerceUnavailableError } from '@/lib/commerce';
import { reserveCheckout } from '@/lib/checkoutReservation';
import { AvailabilityError } from '@/lib/stockReservations';

export const dynamic = 'force-dynamic';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.streammalin.fr';

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, 'checkout-stripe', 15, 600, true);
    if (limited) return limited;
    const body = await request.json();
    const input = validateCheckout(body);
    if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });
    await assertOfferSaleAllowed(input.serviceId);
    if (body.termsVersion !== CURRENT_TERMS_VERSION) return NextResponse.json({ error: 'Les CGV ont changé. Rechargez la page et relisez-les.' }, { status: 409 });
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key === 'sk_test_mock' || !(await isGatewayEnabled('cb'))) {
      return NextResponse.json({ error: 'Le paiement est temporairement indisponible.' }, { status: 503 });
    }
    // Never create a paid order in a simulation path, even in development.
    const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
    const acceptedAt = new Date();
    const { reservation, order, stock } = await reserveCheckout(body.attemptId, {
      serviceId: input.serviceId, stockAccountId: input.stockAccountId, clientEmail: input.email,
      youtubeEmail: input.youtubeEmail, paymentMethod: 'Carte bancaire (Stripe)', price: 0, total: 0, details: '',
      acceptedCgv: true, acceptedImmediateExecution: true, acceptedAt,
      acceptedTermsAt: acceptedAt, acceptedWithdrawalWaiverAt: acceptedAt, acceptedEligibilityAt: acceptedAt,
      termsVersion: CURRENT_TERMS_VERSION, acceptanceIp: clientIp(request),
      acceptanceUserAgent: (request.headers.get('user-agent') || '').slice(0, 450),
    });
    if (reservation.checkoutSessionId) {
      const existing = await stripe.checkout.sessions.retrieve(reservation.checkoutSessionId);
      if (existing.status !== 'open' || !existing.url) return NextResponse.json({ error: 'Cette session est terminée. Consultez votre confirmation ou rechargez la page.' }, { status: 409 });
      return NextResponse.json({ success: true, url: existing.url, expiresAt: reservation.expiresAt });
    }
    if (reservation.expiresAt.getTime() < Date.now() + 30 * 60 * 1000) {
      return NextResponse.json({ error: 'La réservation a expiré. Rechargez la page.' }, { status: 409 });
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', payment_method_types: ['card'], customer_email: input.email,
      expires_at: Math.floor(reservation.expiresAt.getTime() / 1000), client_reference_id: order.id,
      line_items: [{ price_data: { currency: 'eur', product_data: {
        name: `StreamMalin - ${stock.service.name}`, description: 'Abonnement avec prélèvement mensuel automatique. Résiliation avant la prochaine échéance depuis l’espace client.',
      }, unit_amount: Math.round(order.price * 100), recurring: { interval: 'month' } }, quantity: 1 }],
      success_url: `${APP_URL}/commande/confirmee?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/checkout?${new URLSearchParams({ service: input.serviceId, stock: input.stockAccountId, cancelled: 'true' })}`,
      metadata: { orderId: order.id, reservationId: reservation.id },
      subscription_data: { metadata: { orderId: order.id } },
    }, { idempotencyKey: `checkout:${reservation.id}` });
    await prisma.stockReservation.update({ where: { id: reservation.id }, data: { checkoutSessionId: session.id } });
    return NextResponse.json({ success: true, url: session.url, expiresAt: reservation.expiresAt });
  } catch (error) {
    if (error instanceof CommerceUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof AvailabilityError) return NextResponse.json({ error: error.message }, { status: 409 });
    // Keep a hold on an uncertain Stripe response; retry uses the same idempotency key.
    console.error('[checkout] Session creation failed');
    return NextResponse.json({ error: 'La réservation n’a pas pu être confirmée. Réessayez sans changer vos informations ou contactez le support.' }, { status: 503 });
  }
}
