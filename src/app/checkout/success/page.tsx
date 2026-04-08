/**
 * /checkout/success — Page de confirmation paiement Stripe
 *
 * Récupère la session Stripe, crée la commande si besoin (idempotent via paymentTxId),
 * puis redirige vers /track-order.
 */

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

    if (session.payment_status !== 'paid') {
      // Paiement non complété — afficher un message
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
              Votre paiement n'a pas encore été confirmé par Stripe. Si vous venez de payer,
              attendez quelques secondes et rafraîchissez la page.
            </p>
            <a href="/" style={{
              display: 'inline-block', marginTop: '24px', padding: '12px 24px',
              background: '#2563eb', color: '#fff', borderRadius: '10px',
              textDecoration: 'none', fontWeight: 700,
            }}>
              ← Retour à l'accueil
            </a>
          </div>
        </div>
      );
    }

    const { email, service, gmail, durationMonths: durStr } = session.metadata ?? {};
    if (!email || !service) redirect('/');

    clientEmail = email;
    const durationMonths = parseInt(durStr ?? '1', 10) || 1;
    const msPerMonth = 30.5 * 24 * 60 * 60 * 1000;
    const totalAmount = (session.amount_total ?? 0) / 100;

    // Idempotency : ne pas créer deux fois la même commande
    const existing = await prisma.order.findFirst({
      where: { paymentTxId: sessionId },
    });

    if (!existing) {
      // Upsert user
      const user = await prisma.user.upsert({
        where: { email: email.toLowerCase().trim() },
        update: {},
        create: { email: email.toLowerCase().trim() },
      });

      // Créer la commande ACTIVE directement (paiement vérifié)
      const order = await prisma.order.create({
        data: {
          userId: user.id,
          service,
          amount: totalAmount,
          paymentMethod: 'STRIPE',
          paymentTxId: sessionId,
          status: 'ACTIVE',
          durationMonths,
          gmail: service === 'YOUTUBE' ? (gmail || null) : null,
          expiresAt: new Date(Date.now() + durationMonths * msPerMonth),
        },
      });

      // Emails — non-bloquants sur erreur
      try {
        await sendAdminNewOrder({
          orderId: order.id,
          customerEmail: email,
          service: service as 'YOUTUBE' | 'DISNEY',
          amount: totalAmount,
          durationMonths,
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
    }
  } catch (err) {
    console.error('[stripe/success]', err);
    redirect('/');
  }

  redirect(`/track-order?email=${encodeURIComponent(clientEmail)}`);
}
