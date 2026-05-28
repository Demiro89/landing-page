import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentCustomer } from '@/lib/clientAuth';
import { decrypt } from '@/lib/crypto';
import { enforceRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/client/export-data
 *
 * Droit à la portabilité des données (RGPD Art. 20).
 * Renvoie un fichier JSON structuré contenant toutes les données personnelles
 * liées au compte connecté : profil, commandes, messages de support.
 */
export async function GET(request: Request) {
  // Limite : 3 exports par heure pour éviter l'abus.
  const limited = await enforceRateLimit(request, 'export-data', 3, 3600);
  if (limited) return limited;

  const customer = await getCurrentCustomer();
  if (!customer) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    include: {
      service: { select: { name: true, id: true } },
      chats: {
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      },
    },
    orderBy: { date: 'desc' },
  });

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    account: {
      email: customer.email,
      emailVerified: customer.emailVerified,
      createdAt: customer.createdAt,
    },
    orders: orders.map((o) => ({
      id: o.id,
      date: o.date,
      service: o.service.name,
      serviceId: o.service.id,
      status: o.status,
      price: o.price,
      total: o.total,
      paymentMethod: o.paymentMethod,
      accessDetails: decrypt(o.details),
      nextBillingAt: o.nextBillingAt,
      cancellationRequestedAt: o.cancellationRequestedAt,
      cancellationEffectiveAt: o.cancellationEffectiveAt,
      acceptedTermsAt: o.acceptedTermsAt,
      acceptedWithdrawalWaiverAt: o.acceptedWithdrawalWaiverAt,
      acceptedEligibilityAt: o.acceptedEligibilityAt,
      termsVersion: o.termsVersion,
      acceptanceIp: o.acceptanceIp,
      acceptanceUserAgent: o.acceptanceUserAgent,
      support: o.chats
        ? o.chats.messages.map((m) => ({
            sender: m.sender,
            text: m.text,
            sentAt: m.createdAt,
          }))
        : [],
    })),
  };

  const json = JSON.stringify(exportPayload, null, 2);
  const filename = `streammalin-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
