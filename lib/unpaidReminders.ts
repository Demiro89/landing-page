import type { Prisma } from '@prisma/client';
import { enqueueOrderJob } from './durableOrders';
import { escapeHtml } from './html';

export type ReminderLevel = 1 | 2 | 3;
export const REMINDER_JOB_KINDS = ['unpaid_reminder_1', 'unpaid_reminder_2', 'unpaid_reminder_3'];

export function reminderJobLevel(kind: string): ReminderLevel | null {
  const index = REMINDER_JOB_KINDS.indexOf(kind);
  return index < 0 ? null : (index + 1) as ReminderLevel;
}

export function unpaidReminderKey(orderId: string, unpaidSince: Date, level: ReminderLevel) {
  // Each unpaid episode has its own keys, so a later episode can notify again.
  return `unpaid_reminder:${orderId}:${unpaidSince.getTime()}:${level}`;
}

export function queueUnpaidReminder(tx: Prisma.TransactionClient, orderId: string, unpaidSince: Date, level: ReminderLevel) {
  return enqueueOrderJob(tx, orderId, REMINDER_JOB_KINDS[level - 1], unpaidReminderKey(orderId, unpaidSince, level));
}

export function unpaidReminderMessage(serviceName: string, orderId: string, level: ReminderLevel, appUrl: string) {
  const portal = new URL('/espace-client', appUrl);
  if (!['https:', 'http:'].includes(portal.protocol)) throw new Error('Invalid application URL');
  const message = level === 1
    ? 'Un paiement est en attente pour votre abonnement. Consultez votre espace client pour vérifier la situation et le moyen de paiement utilisé.'
    : level === 2
      ? 'Votre paiement reste en attente. Consultez votre espace client ou contactez notre support pour faire le point.'
      : 'Votre paiement reste en attente après nos relances. En l’absence de régularisation, votre accès pourra être suspendu ou résilié selon les CGV. Contactez notre support si vous rencontrez une difficulté.';
  return {
    subject: `StreamMalin : paiement en attente (${serviceName.replace(/[\r\n]/g, ' ')})`,
    text: `Bonjour,\n\n${message}\n\nOffre : ${serviceName}\nCommande : ${orderId}\nEspace client : ${portal.href}\n\nSi vous avez déjà régularisé votre paiement, contactez le support avant tout autre règlement.\nSupport : hello@streammalin.fr\nStreamMalin est indépendant des plateformes citées.`,
    html: `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Paiement en attente - StreamMalin</title></head><body style="font-family:Arial,sans-serif;color:#202124;background:#fff;line-height:1.6;padding:24px"><h1 style="font-size:22px">StreamMalin</h1><h2 style="font-size:18px">Paiement en attente</h2><p>Bonjour,</p><p>${message}</p><p>Offre : <strong>${escapeHtml(serviceName)}</strong><br>Commande : ${escapeHtml(orderId)}</p><p><a href="${escapeHtml(portal.href)}">Consulter mon espace client</a></p><p>Si vous avez déjà régularisé votre paiement, contactez le support avant tout autre règlement.</p><p>Support : <a href="mailto:hello@streammalin.fr">hello@streammalin.fr</a><br>Service indépendant des plateformes citées.</p></body></html>`,
  };
}
