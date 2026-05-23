import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';
import { sendCancellationEmail } from '@/lib/nodemailer';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId } = body as { orderId: string };

    if (!orderId) {
      return NextResponse.json({ error: 'orderId requis' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { service: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    // Vérifier que la commande appartient bien au customer connecté
    if (order.clientEmail.toLowerCase() !== customer.email.toLowerCase()) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Vérifier que la commande est bien active
    if (order.status !== 'active') {
      return NextResponse.json({ error: 'Cette commande est déjà résiliée ou en cours de résiliation' }, { status: 400 });
    }

    // Calculer la date effective de résiliation : date de commande + 30 jours
    const cancellationEffectiveAt = new Date(order.date);
    cancellationEffectiveAt.setDate(cancellationEffectiveAt.getDate() + 30);

    const now = new Date();

    // Mettre à jour la commande
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'cancelled_pending',
        cancellationRequestedAt: now,
        cancellationEffectiveAt,
      },
    });

    // Envoyer l'email de confirmation de résiliation
    await sendCancellationEmail(customer.email, order.service.name, orderId, cancellationEffectiveAt);

    return NextResponse.json({ success: true, effectiveAt: cancellationEffectiveAt });
  } catch (error: unknown) {
    console.error('Erreur POST cancel-order:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
