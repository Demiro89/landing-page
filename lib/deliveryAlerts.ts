import 'server-only';
import crypto from 'crypto';
import { prisma } from './prisma';
import { sendTelegramNotification } from './telegram';

const ALERT_KEY = 'operations:delivery-alert';

export async function alertDeliveryIssues(configurationMissing = false) {
  const now = new Date();
  const needsReview = await prisma.deliveryJob.count({ where: { status: 'needs_review' } });
  const delayed = await prisma.deliveryJob.count({ where: {
    OR: [{ status: 'pending', createdAt: { lt: new Date(now.getTime() - 15 * 60000) } },
      { status: 'processing', lockedUntil: { lt: now } }],
  } });
  const paymentsToReview = await prisma.paymentRecord.count({ where: { status: 'refund_needed' } });
  const health = { needsReview, delayed, paymentsToReview, configurationMissing };
  if (!needsReview && !delayed && !paymentsToReview && !configurationMissing) return { ...health, notified: false };
  const fingerprint = JSON.stringify(health);
  const previous = await prisma.setting.upsert({ where: { key: ALERT_KEY }, create: { key: ALERT_KEY, value: '{}' }, update: {} });
  const last = JSON.parse(previous.value);
  if (last.fingerprint === fingerprint && last.until > now.getTime()) return { ...health, notified: false, throttled: true };
  // Compare-and-set prevents concurrent runners from sending the same alert.
  const claim = JSON.stringify({ fingerprint, until: now.getTime() + 30 * 60000, token: crypto.randomUUID() });
  const acquired = await prisma.setting.updateMany({ where: { key: ALERT_KEY, value: previous.value }, data: { value: claim } });
  if (acquired.count !== 1) return { ...health, notified: false, throttled: true };
  const notified = await sendTelegramNotification(
    `<b>StreamMalin : intervention requise</b>\nTaches a examiner : ${needsReview}\nEnvois en retard : ${delayed}\nPaiements a examiner : ${paymentsToReview}\nConfiguration e-mail absente : ${configurationMissing ? 'oui' : 'non'}\nConsultez le suivi dans votre administration.`
  );
  if (!notified) await prisma.setting.updateMany({ where: { key: ALERT_KEY, value: claim }, data: { value: previous.value } });
  return { ...health, notified };
}
