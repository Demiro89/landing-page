import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import { enforceRateLimit } from '@/lib/rateLimit';
import { readJsonObject } from '@/lib/requestJson';
import { clientIpFromRequest } from '@/lib/auditLog';

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const limited = await enforceRateLimit(request, 'admin-credentials', 30, 300, true);
  if (limited) return limited;
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const { stockId } = parsed.value;
  if (typeof stockId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(stockId)) {
    return NextResponse.json({ error: 'Compte de stock invalide.' }, { status: 400 });
  }
  try {
    const stock = await prisma.stockAccount.findUnique({ where: { id: stockId }, select: { details: true, updatedAt: true } });
    if (!stock) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
    // Fail closed if this sensitive read cannot be recorded. Never log the secret.
    await prisma.auditLog.create({ data: {
      action: 'stock.credentials_read', entityType: 'stock', entityId: stockId,
      description: 'Consultation des identifiants du compte de stock', ip: clientIpFromRequest(request),
    } });
    return NextResponse.json({ success: true, details: decrypt(stock.details), updatedAt: stock.updatedAt }, {
      headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
    });
  } catch {
    return NextResponse.json({ error: 'Consultation indisponible. Aucun identifiant transmis.' }, { status: 503 });
  }
}
