/**
 * POST /api/stripe/webhook
 * Endpoint Stripe webhook Live — URL configurée dans le dashboard Stripe.
 * Redirige vers le handler principal dans /api/checkout/stripe (PUT).
 */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { sendOrderDetailsEmail } from '@/lib/nodemailer';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const sig = request.headers.get('stripe-signature') || '';

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (err: any) {
      console.error('❌ Erreur signature Webhook:', err.message);
      return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;

      if (metadata) {
        const { serviceId, stockAccountId, clientEmail, price } = metadata;
        const parsedPrice = parseFloat(price);

        const service = await prisma.service.findUnique({ where: { id: serviceId } });
        const stockAccount = await prisma.stockAccount.findUnique({ where: { id: stockAccountId } });

        if (service && stockAccount) {
          const order = await prisma.$transaction(async (tx) => {
            const updatedStock = await tx.stockAccount.update({
              where: { id: stockAccountId },
              data: { filledSlots: { increment: 1 } },
            });

            const createdOrder = await tx.order.create({
              data: {
                serviceId,
                stockAccountId,
                price: parsedPrice,
                total: parsedPrice,
                details: updatedStock.details,
                clientEmail,
                status: 'active',
              },
            });

            await tx.chatThread.create({
              data: {
                id: createdOrder.id,
                orderId: createdOrder.id,
                title: `Support ${service.name}`,
                messages: {
                  create: [
                    {
                      sender: 'Support StreamMalin',
                      text: `Bonjour ! Merci pour votre achat de ${service.name}. Vos accès sont prêts :\n\n${updatedStock.details}\n\nÉcrivez-nous ici en cas de problème.`,
                    },
                  ],
                },
              },
            });

            return createdOrder;
          });

          await sendOrderDetailsEmail(clientEmail, service.name, stockAccount.details, order.id);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Erreur Webhook Stripe:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
