/**
 * GET /api/admin/send-reminders
 *
 * Envoie les emails de relance d'expiration :
 *  - J-3 : sendExpiryReminder() pour les commandes qui expirent dans 3 jours
 *  - J0  : sendExpiryNotice()   pour les commandes expirées aujourd'hui
 *
 * Authentification :
 *  - Via Vercel Cron (header Authorization: Bearer <CRON_SECRET>)
 *  - Ou manuellement : ?token=ADMIN_SECRET_TOKEN
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendExpiryReminder, sendExpiryNotice } from '@/lib/email';

export async function GET(req: NextRequest) {
  // Accept either Vercel cron bearer token or manual admin token
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const { searchParams } = new URL(req.url);
  const manualToken = searchParams.get('token');
  const adminToken = process.env.ADMIN_SECRET_TOKEN;

  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isAdminAuth = adminToken && manualToken === adminToken;

  if (!isCronAuth && !isAdminAuth) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const now = new Date();

  // J-3 window : expires between 2d23h and 3d1h from now
  const reminderMin = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000);
  const reminderMax = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000);

  // J0 window : expired in the last 2 hours
  const noticeMin = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const [reminders, notices] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { gte: reminderMin, lte: reminderMax },
      },
      include: { user: true },
    }),
    prisma.order.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { gte: noticeMin, lte: now },
      },
      include: { user: true },
    }),
  ]);

  let remindersSent = 0;
  let noticesSent = 0;

  for (const order of reminders) {
    if (!order.expiresAt) continue;
    const msLeft = order.expiresAt.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    const ok = await sendExpiryReminder({
      to: order.user.email,
      service: order.service as 'YOUTUBE' | 'DISNEY',
      expiresAt: order.expiresAt,
      daysLeft,
    });
    if (ok) remindersSent++;
  }

  for (const order of notices) {
    const ok = await sendExpiryNotice({
      to: order.user.email,
      service: order.service as 'YOUTUBE' | 'DISNEY',
    });
    if (ok) noticesSent++;
  }

  return NextResponse.json({
    ok: true,
    remindersSent,
    noticesSent,
    timestamp: now.toISOString(),
  });
}
