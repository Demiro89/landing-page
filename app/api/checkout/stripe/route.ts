import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';
import { CURRENT_TERMS_VERSION } from '@/lib/termsVersion';
import { enforceRateLimit } from '@/lib/rateLimit';
import { validateCheckout } from '@/lib/checkoutValidation';
import { clientIp } from '@/lib/clientIp';
import { isGatewayEnabled } from '@/lib/paymentSettings';
import { assertOfferSaleAllowed, CommerceUnavailableError } from '@/lib/commerce';
import { reserveCheckout } from '@/lib/checkoutReservation';
import { AvailabilityError } from '@/lib/stockReservations';
import { readJsonObject } from '@/lib/requestJson';
import { logServerFailure } from '@/lib/securityLog';
import { APP_URL } from '@/lib/appUrl';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, 'checkout-stripe', 15, 600, true);
    if (limited) return limited;
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.value;
    const input = validateCheckout(body);
    if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });
    const { amountMinor } = body;
    if (typeof amountMinor !== 'number' || !Number.isSafeInteger(amountMinor) || amountMinor < 1) {
      return NextResponse.json({ error: 'Montant invalide. Rechargez la page.' }, { status: 400 });
    }
    await assertOfferSaleAllowed(input.serviceId);
    if (body.termsVersion !== CURRENT_TERMS_VERSION) return NextResponse.json({ error: 'Les CGV ont changé. Rechargez la page et relisez-les.' }, { status: 409 });
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key === 'sk_test_mock' || !(await isGatewayEnabled('cb'))) {
      return NextResponse.json({ error: 'Le paiement est temporairement indisponible.' }, { status: 503 });
    }
    // Never create a paid order in a simulation path, even in development.
    const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
    const acceptedAt = new Date();
    const customer = await getCurrentCustomer();
    const ownerId = customer?.email === input.email ? customer.id : null;
    const { reservation, order, stock } = await reserveCheckout(body.attemptId, {
      serviceId: input.serviceId, stockAccountId: input.stockAccountId, clientEmail: input.email,
      customerId: ownerId,
      youtubeEmail: input.youtubeEmail, paymentMethod: 'Carte bancaire (Stripe)', price: 0, total: 0, details: '',
      acceptedCgv: true, acceptedImmediateExecution: true, acceptedAt,
      acceptedTermsAt: acceptedAt, acceptedWithdrawalWaiverAt: acceptedAt, acceptedEligibilityAt: acceptedAt,
      termsVersion: CURRENT_TERMS_VERSION, acceptanceIp: clientIp(request),
      acceptanceUserAgent: (request.headers.get('user-agent') || '').slice(0, 450),
    }, amountMinor);
    if (reservation.checkoutSessionId) {
      const existing = await stripe.checkout.sessions.retrieve(reservation.checkoutSessionId);
      if (existing.status !== 'open' || !existing.url) return NextResponse.json({ error: 'Cette session est terminée. Consultez votre confirmation ou rechargez la page.' }, { status: 409 });
      return NextResponse.json({ success: true, url: existing.url, expiresAt: reservation.expiresAt });
    }
    if (reservation.expiresAt.getTime() < Date.now() + 30 * 60 * 1000) {
      await prisma.stockReservation.updateMany({
        where: { id: reservation.id, status: 'held', checkoutSessionId: null },
        data: { status: 'released' },
      });
      return NextResponse.json({ error: 'La réservation a expiré. Rechargez la page.' }, { status: 409 });
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', payment_method_types: ['card'], customer_email: input.email,
      billing_address_collection: 'required',
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
    logServerFailure('checkout/stripe', error);
    return NextResponse.json({ error: 'La réservation n’a pas pu être confirmée. Réessayez sans changer vos informations ou contactez le support.' }, { status: 503 });
  }
}
