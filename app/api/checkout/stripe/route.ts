import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { sendOrderDetailsEmail } from '@/lib/nodemailer';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2023-10-16' as any,
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * POST /api/checkout/stripe : Crée une session de paiement Stripe.
 */
export async function POST(request: Request) {
  try {
    const { serviceId, stockAccountId, email } = await request.json();

    if (!serviceId || !stockAccountId || !email) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Récupérer le service et le compte de stock associé
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    const stockAccount = await prisma.stockAccount.findUnique({ where: { id: stockAccountId } });

    if (!service || !stockAccount) {
      return NextResponse.json({ error: 'Service ou stock introuvable' }, { status: 404 });
    }

    // S'assurer qu'il reste de la place
    if (stockAccount.filledSlots >= stockAccount.maxSlots) {
      return NextResponse.json({ error: 'Plus de places disponibles dans ce compte' }, { status: 400 });
    }

    // Mode simulation si pas de clé Stripe réelle configurée
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_mock') {
      console.log('--- MODE SIMULATION STRIPE ACTIF ---');
      // On simule une réussite immédiate de Stripe pour la démo locale !
      // On génère la commande directement comme le ferait le webhook de Stripe
      const order = await prisma.$transaction(async (tx) => {
        // 1. Incrémenter les places occupées
        const updatedStock = await tx.stockAccount.update({
          where: { id: stockAccountId },
          data: { filledSlots: { increment: 1 } },
        });

        // 2. Créer la commande
        const createdOrder = await tx.order.create({
          data: {
            serviceId,
            stockAccountId,
            price: updatedStock.price,
            total: updatedStock.price,
            details: updatedStock.details,
            clientEmail: email,
            status: 'active',
          },
        });

        // 3. Créer le fil de discussion de support associé
        await tx.chatThread.create({
          data: {
            id: createdOrder.id,
            orderId: createdOrder.id,
            title: `Support ${service.name}`,
            messages: {
              create: [
                {
                  sender: 'Support StreamMalin',
                  text: `Bonjour ! Merci pour votre achat de ${service.name}. Vos accès sont prêts : \n\n${updatedStock.details}\n\nÉcrivez-nous ici en cas de problème.`,
                },
              ],
            },
          },
        });

        return createdOrder;
      });

      // 4. Envoyer l'email transactionnel
      await sendOrderDetailsEmail(email, service.name, stockAccount.details, order.id);

      // Rediriger vers l'espace client avec un paramètre de succès
      return NextResponse.json({
        success: true,
        simulated: true,
        url: `${APP_URL}/?success=true&email=${encodeURIComponent(email)}&orderId=${order.id}`,
      });
    }

    // Lancement du flux Stripe Réel
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'link'] as any,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `StreamMalin - ${service.name} (1 mois)`,
              description: `Votre abonnement de stock à ${service.name}`,
            },
            unit_amount: Math.round(stockAccount.price * 100), // En centimes
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: email,
      success_url: `${APP_URL}/?success=true&email=${encodeURIComponent(email)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/checkout?service=${serviceId}&stock=${stockAccountId}&cancelled=true`,
      metadata: {
        serviceId,
        stockAccountId,
        clientEmail: email,
        price: stockAccount.price.toString(),
      },
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error: any) {
    console.error('Erreur Stripe Checkout Route:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur Stripe' }, { status: 500 });
  }
}

/**
 * POST /api/checkout/stripe/webhook : Écoute les événements Stripe de production pour valider les abonnements.
 */
export async function PUT(request: Request) {
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
      console.error(`❌ Erreur signature Webhook:`, err.message);
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
          // Transaction atomique en base
          const order = await prisma.$transaction(async (tx) => {
            // 1. Incrémenter les places
            const updatedStock = await tx.stockAccount.update({
              where: { id: stockAccountId },
              data: { filledSlots: { increment: 1 } },
            });

            // 2. Créer la commande
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

            // 3. Créer le fil de discussion de support
            await tx.chatThread.create({
              data: {
                id: createdOrder.id,
                orderId: createdOrder.id,
                title: `Support ${service.name}`,
                messages: {
                  create: [
                    {
                      sender: 'Support StreamMalin',
                      text: `Bonjour ! Merci pour votre achat de ${service.name}. Vos accès sont prêts : \n\n${updatedStock.details}\n\nÉcrivez-nous ici en cas de problème.`,
                    },
                  ],
                },
              },
            });

            return createdOrder;
          });

          // 4. Envoyer l'email
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
