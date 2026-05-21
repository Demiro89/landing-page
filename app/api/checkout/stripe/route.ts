import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { sendOrderDetailsEmail } from '@/lib/nodemailer';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2023-10-16' as any,
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * POST /api/checkout/stripe : Crée une session Stripe Checkout en mode subscription (prélèvement mensuel auto).
 */
export async function POST(request: Request) {
  try {
    const { serviceId, stockAccountId, email } = await request.json();

    if (!serviceId || !stockAccountId || !email) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

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
            status: 'active',
            nextBillingAt: new Date(Date.now() + 30 * 86400000),
          },
        });
        await tx.chatThread.create({
          data: {
            id: createdOrder.id,
            orderId: createdOrder.id,
            title: `Support ${service.name}`,
            messages: { create: [{ sender: 'Support StreamMalin', text: `Bonjour ! Merci pour votre abonnement à ${service.name}. Vos accès sont prêts :\n\n${updatedStock.details}\n\nÉcrivez-nous ici en cas de problème.` }] },
          },
        });
        return createdOrder;
      });
      await sendOrderDetailsEmail(email, service.name, stockAccount.details, order.id);
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
      },
      subscription_data: {
        metadata: {
          serviceId,
          stockAccountId,
          clientEmail: email,
        },
      },
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error: any) {
    console.error('Erreur Stripe Checkout Route:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur Stripe' }, { status: 500 });
  }
}
