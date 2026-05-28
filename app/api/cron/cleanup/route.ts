import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Sécurisation par token Bearer (CRON_SECRET env var, aussi utilisé par Vercel Cron)
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const now = new Date();
  const results: Record<string, number> = {};

  // 1. Tokens de réinitialisation de mot de passe expirés
  const expiredResetTokens = await prisma.customer.updateMany({
    where: { resetTokenExp: { lt: now }, resetToken: { not: null } },
    data: { resetToken: null, resetTokenExp: null },
  });
  results.expiredResetTokens = expiredResetTokens.count;

  // 2. Tokens de changement d'email expirés
  const expiredEmailChangeTokens = await prisma.customer.updateMany({
    where: { emailChangeTokenExp: { lt: now }, emailChangeToken: { not: null } },
    data: { emailChangeToken: null, emailChangeTokenExp: null, pendingEmail: null },
  });
  results.expiredEmailChangeTokens = expiredEmailChangeTokens.count;

  // 3. Comptes non vérifiés créés il y a plus de 7 jours (sans commande)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const unverifiedAccounts = await prisma.customer.findMany({
    where: { emailVerified: false, createdAt: { lt: sevenDaysAgo } },
    select: { id: true, _count: { select: { orders: true } } },
  });
  const toDelete = unverifiedAccounts.filter(c => c._count.orders === 0).map(c => c.id);
  if (toDelete.length > 0) {
    const deleted = await prisma.customer.deleteMany({ where: { id: { in: toDelete } } });
    results.deletedUnverifiedAccounts = deleted.count;
  } else {
    results.deletedUnverifiedAccounts = 0;
  }

  // 4. Fenêtres de rate limit expirées
  const expiredRateLimits = await prisma.rateLimit.deleteMany({
    where: { windowEnd: { lt: now } },
  });
  results.expiredRateLimits = expiredRateLimits.count;

  // 5. Événements webhook Stripe traités il y a plus de 90 jours
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const oldWebhookEvents = await prisma.processedWebhookEvent.deleteMany({
    where: { createdAt: { lt: ninetyDaysAgo } },
  });
  results.oldWebhookEvents = oldWebhookEvents.count;

  // 6. Logs d'audit de plus de 180 jours
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const oldAuditLogs = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: sixMonthsAgo } },
  });
  results.oldAuditLogs = oldAuditLogs.count;

  return NextResponse.json({ success: true, cleaned: results, at: now.toISOString() });
}
