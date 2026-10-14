import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated, ADMIN_COOKIE_NAME } from '@/lib/adminAuth';
import { listAdminSessions, revokeOtherAdminSessions } from '@/lib/revocableAdminSession';
import { requireRecentAdmin } from '@/lib/adminFreshness';
import { readJsonObject } from '@/lib/requestJson';
import { remediationSchemaEnabled } from '@/lib/commerce';
import { enforceRateLimit } from '@/lib/rateLimit';
import { runDeliveryJobs } from '@/lib/deliveryWorker';
import { lockStock } from '@/lib/stockReservations';
import { decrypt } from '@/lib/crypto';

export async function GET(request?: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  try {
    const cursor = request ? new URL(request.url).searchParams.get('withdrawalsBefore') : null;
    if (cursor && (!cursor.startsWith('withdrawal:') || cursor.length > 100)) return NextResponse.json({ error: 'Page invalide.' }, { status: 400 });
    const requests = await prisma.setting.findMany({ where: { key: { startsWith: 'withdrawal:', ...(cursor ? { lt: cursor } : {}) } }, take: 101, orderBy: { key: 'desc' } });
    const page = requests.slice(0, 100);
    const withdrawalsNextCursor = requests.length > 100 ? page.at(-1)!.key : null;
    const withdrawals = page.flatMap(row => { try { return [JSON.parse(decrypt(row.value))]; } catch { return []; } });
    const sessions = await listAdminSessions();
    if (!remediationSchemaEnabled()) return NextResponse.json({ success: true, schemaEnabled: false, jobs: [], payments: [], sessions, withdrawals, withdrawalsNextCursor });
    const jobs = await prisma.deliveryJob.findMany({ where: { status: { in: ['pending', 'processing', 'needs_review'] } }, orderBy: { createdAt: 'asc' }, take: 100 });
    const payments = await prisma.paymentRecord.findMany({ orderBy: { paidAt: 'desc' }, take: 100 });
    return NextResponse.json({ success: true, schemaEnabled: true, jobs, payments, sessions, withdrawals, withdrawalsNextCursor });
  } catch { return NextResponse.json({ error: 'Suivi opérationnel indisponible.' }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const recent = await requireRecentAdmin();
  if (recent) return recent;
  const limited = await enforceRateLimit(request, 'admin-operations', 10, 60, true);
  if (limited) return limited;
  try {
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.value;
    if (body.action === 'revoke_other_sessions') {
      const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
      if (!token) return NextResponse.json({ error: 'Reconnectez-vous avant cette action.' }, { status: 409 });
      await revokeOtherAdminSessions(token);
      return NextResponse.json({ success: true });
    }
    if (!remediationSchemaEnabled()) return NextResponse.json({ error: 'Migration non activée.' }, { status: 503 });
    if (body.action === 'process_deliveries') return NextResponse.json({ success: true, delivery: await runDeliveryJobs() });
    if (body.action === 'confirm_access_revoked' && typeof body.jobId === 'string' && body.confirmed === true) {
      const jobId = body.jobId;
      await prisma.$transaction(async tx => {
        const job = await tx.deliveryJob.findUniqueOrThrow({ where: { id: jobId } });
        if (job.kind !== 'access_revocation' || job.status !== 'needs_review') throw new Error();
        await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${job.orderId} FOR UPDATE`;
        const order = await tx.order.findUniqueOrThrow({ where: { id: job.orderId } });
        if (!['cancelled', 'cancelled_pending'].includes(order.status) ||
            (order.status === 'cancelled_pending' && (!order.cancellationEffectiveAt || order.cancellationEffectiveAt > new Date()))) throw new Error();
        await lockStock(tx, order.stockAccountId);
        const claimed = await tx.deliveryJob.updateMany({ where: { id: job.id, status: 'needs_review' }, data: { status: 'completed', completedAt: new Date() } });
        if (claimed.count !== 1) throw new Error();
        await tx.order.update({ where: { id: order.id }, data: { status: 'cancelled', details: '' } });
        await tx.stockAccount.updateMany({ where: { id: order.stockAccountId, filledSlots: { gt: 0 } }, data: { filledSlots: { decrement: 1 } } });
        await tx.auditLog.create({ data: { action: 'order.access_revoked', entityType: 'order', entityId: order.id, description: 'Révocation de l’accès fournisseur confirmée par l’administrateur ; place libérée.' } });
      });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Action invalide.' }, { status: 400 });
  } catch { return NextResponse.json({ error: 'Action non effectuée. Rechargez le suivi avant de réessayer.' }, { status: 409 }); }
}
