import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/rateLimit';
import { remediationSchemaEnabled } from '@/lib/commerce';

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, 'checkout-confirmation', 20, 600, true);
  if (limited) return limited;
  try {
    const { sessionId } = await request.json();
    if (typeof sessionId !== 'string' || !/^cs_(test_|live_)?[A-Za-z0-9]{10,200}$/.test(sessionId)) return NextResponse.json({ error: 'Référence invalide.' }, { status: 400 });
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key === 'sk_test_mock') return NextResponse.json({ error: 'Confirmation temporairement indisponible.' }, { status: 503 });
    const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') return NextResponse.json({ success: true, status: 'awaiting_payment' });
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const order = subId ? await prisma.order.findUnique({ where: { stripeSubscriptionId: subId }, include: { service: true } }) : null;
    if (!order) return NextResponse.json({ success: true, status: 'processing' });
    const job = remediationSchemaEnabled() ? await prisma.deliveryJob.findFirst({ where: { orderId: order.id, kind: 'delivery' }, orderBy: { createdAt: 'desc' } }) : null;
    // A session reference can show a receipt, never credentials or account ownership.
    return NextResponse.json({ success: true, orderId: order.id, offer: order.service.name, amount: order.total,
      status: order.status === 'payment_review' ? 'needs_review' : order.status === 'cancelled' ? 'cancelled' : job?.status === 'completed' ? 'sent' : 'processing',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ error: 'Confirmation indisponible. Contactez le support avec votre reçu de paiement.' }, { status: 503 }); }
}
