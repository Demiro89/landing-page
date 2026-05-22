import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { sendOrderDetailsEmail } from '@/lib/nodemailer';
import { createInvoiceForOrder } from '@/lib/invoice';
import { decrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2023-10-16' as any,
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * POST /api/checkout/stripe : Crée une session Stripe Checkout en mode subscription (prélèvement mensuel auto).
 */
export async function POST(request: Request) {
  try {
    const { serviceId, stockAccountId, email, youtubeEmail, acceptedCgv, acceptedImmediateExecution } = await request.json();

    if (!serviceId || !stockAccountId || !email) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    if (serviceId === 'youtube' && !youtubeEmail) {
      return NextResponse.json({ error: 'Adresse e-mail YouTube requise pour YouTube Premium' }, { status: 400 });
    }

    if (!acceptedCgv || !acceptedImmediateExecution) {
      return NextResponse.json(
        { error: 'Vous devez accepter les CGV et la demande d\'exécution immédiate.' },
        { status: 400 }
      );
    }

    // Preuve d'acceptation : horodatage serveur + métadonnées techniques
    const acceptedAt = new Date();
    const acceptanceUserAgent = (request.headers.get('user-agent') || '').slice(0, 450);
    const acceptanceIp = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 90);

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    const stockAccount = await prisma.stockAccount.findUnique({ where: { id: stockAccountId } });

    if (!service || !stockAccount) {
      return NextResponse.json({ error: 'Service ou stock introuvable' }, { status: 404 });
    }

    if (stockAccount.filledSlots >= stockAccount.maxSlots) {
      return NextResponse.json({ error: 'Plus de places disponibles dans ce compte' }, { status: 400 });
    }

    // Mode simulation si Stripe pas configuré
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_mock') {
      console.log('--- MODE SIMULATION STRIPE (subscription) ---');
      const order = await prisma.$transaction(async (tx) => {
        const updatedStock = await tx.stockAccount.update({
          where: { id: stockAccountId },
          data: { filledSlots: { increment: 1 } },
        });
        const createdOrder = await tx.order.create({
          data: {
            serviceId,
            stockAccountId,
            price: updatedStock.price,
            total: updatedStock.price,
            details: updatedStock.details,
            clientEmail: email,
            youtubeEmail: youtubeEmail || null,
            status: 'active',
            nextBillingAt: new Date(Date.now() + 30 * 86400000),
            acceptedCgv: true,
            acceptedImmediateExecution: true,
            acceptedAt,
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
        clientEmail: email,
        serviceName: service.name,
        amount: order.total,
        paymentMethod: 'Carte bancaire (Stripe)',
      }).catch((err) => { console.error('[invoice] simulation error:', err); return null; });
      await sendOrderDetailsEmail(email, service.name, decrypt(stockAccount.details), order.id, undefined, {
        amount: order.total,
        invoiceId: invoice?.id,
        invoiceNumber: invoice?.number,
      });
      return NextResponse.json({
        success: true,
        simulated: true,
        url: `${APP_URL}/?success=true&email=${encodeURIComponent(email)}&orderId=${order.id}`,
      });
    }

    // Stripe Subscription réelle
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'link'] as any,
      customer_email: email,
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
      success_url: `${APP_URL}/?success=true&email=${encodeURIComponent(email)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/checkout?service=${serviceId}&stock=${stockAccountId}&cancelled=true`,
      metadata: {
        serviceId,
        stockAccountId,
        clientEmail: email,
        price: stockAccount.price.toString(),
        youtubeEmail: youtubeEmail || '',
        acceptedAt: acceptedAt.toISOString(),
        acceptanceUserAgent,
        acceptanceIp,
      },
      subscription_data: {
        metadata: {
          serviceId,
          stockAccountId,
          clientEmail: email,
          youtubeEmail: youtubeEmail || '',
        },
      },
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error: any) {
    console.error('Erreur Stripe Checkout Route:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur Stripe' }, { status: 500 });
  }
}
