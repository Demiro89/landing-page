import crypto from 'crypto';
import { Resend } from 'resend';
import { prisma } from './prisma';
import { decrypt } from './crypto';
import { escapeHtml } from './html';
import { createInvoiceForOrder } from './invoice';
import { remediationSchemaEnabled } from './commerce';
import { CURRENT_TERMS_VERSION, CURRENT_TERMS_URL } from './termsVersion';
import { TERMS_TEXT } from './legal/terms-2026-10-07.1';

export async function runDeliveryJobs(limit = 10) {
  if (!remediationSchemaEnabled() || process.env.DELIVERY_WORKER_ENABLED !== 'true') return { enabled: false, completed: 0, failed: 0 };
  if (!process.env.RESEND_API_KEY) return { enabled: true, completed: 0, failed: 0, configurationMissing: true };
  const resend = new Resend(process.env.RESEND_API_KEY);
  const now = new Date();
  const jobs = await prisma.deliveryJob.findMany({ where: {
    kind: { in: ['delivery', 'renewal', 'credentials'] }, nextAttemptAt: { lte: now },
    OR: [{ status: 'pending' }, { status: 'processing', lockedUntil: { lt: now } }],
  }, orderBy: { createdAt: 'asc' }, take: Math.min(limit, 20) });
  let completed = 0;
  let failed = 0;
  for (const job of jobs) {
    const leaseToken = crypto.randomUUID();
    const claimed = await prisma.deliveryJob.updateMany({ where: { id: job.id,
      OR: [{ status: 'pending' }, { status: 'processing', lockedUntil: { lt: now } }],
    }, data: { status: 'processing', attempts: { increment: 1 }, leaseToken, lockedUntil: new Date(Date.now() + 5 * 60000) } });
    if (claimed.count !== 1) continue;
    try {
      // Resend retains idempotency keys for 24h. Ambiguous old sends require human review.
      if (Date.now() - job.createdAt.getTime() >= 23 * 3600000 || job.attempts >= 5) throw new Error('review_required');
      const order = await prisma.order.findUniqueOrThrow({ where: { id: job.orderId }, include: { service: true } });
      if (!['active', 'cancelled_pending'].includes(order.status)) {
        await prisma.deliveryJob.updateMany({ where: { id: job.id, leaseToken }, data: { status: 'needs_review', lastError: 'order_not_active', leaseToken: null, lockedUntil: null } });
        continue;
      }
      const payment = job.kind === 'renewal' ? await prisma.paymentRecord.findUnique({ where: {
        provider_providerPaymentId: { provider: 'stripe', providerPaymentId: job.dedupeKey.slice('renewal:'.length) },
      } }) : job.kind === 'delivery' ? await prisma.paymentRecord.findFirst({ where: { orderId: order.id, status: 'paid' }, orderBy: { paidAt: 'asc' } }) : null;
      if (job.kind !== 'credentials' && (!payment || payment.orderId !== order.id || payment.status !== 'paid')) throw new Error('review_required');
      const invoice = job.kind === 'delivery' ? await createInvoiceForOrder({ orderId: order.id, clientEmail: order.clientEmail,
        serviceName: payment!.serviceName, amount: payment!.amountMinor / 100, paidAt: payment!.paidAt, paymentMethod: order.paymentMethod || 'Paiement vérifié' }) : null;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.streammalin.fr';
      const amount = (payment ? payment.amountMinor / 100 : order.total).toFixed(2);
      const terms = order.termsVersion === CURRENT_TERMS_VERSION ? `<p>CGV acceptées : <a href="${appUrl}${CURRENT_TERMS_URL}">${CURRENT_TERMS_VERSION}</a>.</p>` : '';
      const details = job.kind === 'renewal' ? '<p>Ce message confirme le paiement du renouvellement. Les conditions de votre offre restent applicables.</p>' : order.youtubeEmail
        ? `<p>Votre accès nécessite une invitation à ${escapeHtml(order.youtubeEmail)}. Le support assure le suivi de cette invitation ; contactez-nous si elle n’a pas été reçue.</p>`
        : `<p>Informations d’accès :</p><pre>${escapeHtml(decrypt(order.details))}</pre>`;
      if (job.kind !== 'renewal' && !order.youtubeEmail && !decrypt(order.details).trim()) throw new Error('review_required');
      const result = await resend.emails.send({
        from: 'StreamMalin <noreply@streammalin.fr>', to: payment?.clientEmail || order.clientEmail,
        subject: job.kind === 'renewal' ? 'StreamMalin : paiement de renouvellement confirmé' : 'StreamMalin : suivi de votre accès',
        ...(order.termsVersion === CURRENT_TERMS_VERSION ? { attachments: [{ filename: `CGV-StreamMalin-${CURRENT_TERMS_VERSION}.txt`, content: Buffer.from(TERMS_TEXT, 'utf8') }] } : {}),
        html: `<h1>StreamMalin</h1><p>Commande ${escapeHtml(order.id)} · ${escapeHtml(payment?.serviceName || order.service.name)} · ${amount} EUR.</p>${details}${terms}${invoice ? `<p><a href="${appUrl}/facture/${encodeURIComponent(invoice.id)}">Facture ${escapeHtml(invoice.number)}</a></p>` : ''}<p>Support : hello@streammalin.fr. Service indépendant des plateformes citées.</p>`,
      }, { idempotencyKey: `streammalin:${job.id}` });
      if (result.error || !result.data?.id) throw new Error('provider_rejected');
      await prisma.deliveryJob.updateMany({ where: { id: job.id, leaseToken }, data: {
        status: 'completed', completedAt: new Date(), providerMessageId: result.data.id, lastError: null, leaseToken: null, lockedUntil: null,
      } });
      completed++;
    } catch (error) {
      const reason = error instanceof Error && error.message === 'review_required' ? 'review_required' : 'delivery_failed';
      await prisma.deliveryJob.updateMany({ where: { id: job.id, leaseToken }, data: {
        status: reason === 'review_required' || job.attempts >= 4 ? 'needs_review' : 'pending',
        nextAttemptAt: new Date(Date.now() + Math.min(60, 2 ** job.attempts) * 60000), lastError: reason, leaseToken: null, lockedUntil: null,
      } });
      failed++;
    }
  }
  return { enabled: true, completed, failed };
}
