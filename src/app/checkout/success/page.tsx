/**
 * /checkout/success — Page de confirmation paiement Stripe (abonnement)
 *
 * Récupère la session Stripe, crée la commande si besoin (idempotent via paymentTxId),
 * stocke stripeSubscriptionId + stripeCustomerId, puis redirige vers /track-order.
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { sendOrderConfirmed, sendAdminNewOrder } from '@/lib/email';

export default async function StripeSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id;
  if (!sessionId) redirect('/');

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) redirect('/');

  let clientEmail = '';

  try {
    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // For subscriptions, payment_status is 'paid' after first invoice
    if (session.payment_status !== 'paid') {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0a0a0f', fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{
            background: '#12121a', border: '1px solid #1e1e2e', borderRadius: '16px',
            padding: '36px', maxWidth: '420px', textAlign: 'center',
          }}>
            <h1 style={{ color: '#ff3b3b', fontSize: '1.4rem', marginBottom: '12px' }}>
              ⚠️ Paiement non confirmé
            </h1>
            <p style={{ color: '#8888aa', lineHeight: 1.6 }}>
              Votre paiement n&apos;a pas encore été confirmé par Stripe. Si vous venez de payer,
              attendez quelques secondes et rafraîchissez la page.
            </p>
            <a href="/" style={{
              display: 'inline-block', marginTop: '24px', padding: '12px 24px',
              background: '#2563eb', color: '#fff', borderRadius: '10px',
              textDecoration: 'none', fontWeight: 700,
            }}>
              ← Retour à l&apos;accueil
            </a>
          </div>
        </div>
      );
    }

    const { email, service, gmail } = session.metadata ?? {};
    if (!email || !service) redirect('/');

    clientEmail = email;
    const totalAmount = (session.amount_total ?? 0) / 100;
    const msPerMonth = 30 * 24 * 60 * 60 * 1000;

    // Extract subscription & customer IDs (subscription mode)
    const stripeSubscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription as Stripe.Subscription | null)?.id ?? null;
    const stripeCustomerId =
      typeof session.customer === 'string'
        ? session.customer
        : (session.customer as Stripe.Customer | null)?.id ?? null;

    // Idempotency — don't create the order twice
    const existing = await prisma.order.findFirst({
      where: { paymentTxId: sessionId },
    });

    if (!existing) {
      const user = await prisma.user.upsert({
        where: { email: email.toLowerCase().trim() },
        update: {},
        create: { email: email.toLowerCase().trim() },
      });

      const order = await prisma.order.create({
        data: {
          userId: user.id,
          service,
          amount: totalAmount,
          paymentMethod: 'STRIPE',
          paymentTxId: sessionId,
          status: 'ACTIVE',
          durationMonths: 1,
          gmail: service === 'YOUTUBE' ? (gmail || null) : null,
          expiresAt: new Date(Date.now() + msPerMonth),
          stripeSubscriptionId,
          stripeCustomerId,
        },
      });

      try {
        await sendAdminNewOrder({
          orderId: order.id,
          customerEmail: email,
          service: service as 'YOUTUBE' | 'DISNEY',
          amount: totalAmount,
          durationMonths: 1,
          paymentMethod: 'STRIPE',
          paymentTxId: sessionId,
          gmail: service === 'YOUTUBE' ? gmail : undefined,
        });
      } catch (e) {
        console.error('[stripe/success] email admin:', e);
      }

      try {
        await sendOrderConfirmed({
          to: email,
          orderId: order.id,
          service: service as 'YOUTUBE' | 'DISNEY',
          expiresAt: order.expiresAt ?? undefined,
        });
      } catch (e) {
        console.error('[stripe/success] email client:', e);
      }
    } else if (stripeSubscriptionId && !existing.stripeSubscriptionId) {
      // Patch subscription IDs if missing (webhook may have arrived first)
      await prisma.order.update({
        where: { id: existing.id },
        data: { stripeSubscriptionId, stripeCustomerId },
      });
    }
  } catch (err) {
    console.error('[stripe/success]', err);
    redirect('/');
  }

  redirect(`/track-order?email=${encodeURIComponent(clientEmail)}`);
}
