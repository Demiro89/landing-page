import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import { getCommercialReviews, parseCommercialReview, commerceEnabled, remediationSchemaEnabled } from '@/lib/commerce';
import { enforceRateLimit } from '@/lib/rateLimit';
import { clientIpFromRequest } from '@/lib/auditLog';

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const services = await prisma.service.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: 'asc' } });
  const reviews = await getCommercialReviews(services.map(service => service.id));
  return NextResponse.json({ success: true, commerceEnabled: commerceEnabled(), schemaEnabled: remediationSchemaEnabled(),
    services: services.map(service => ({ ...service, review: reviews.get(service.id) })) });
}

export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const limited = await enforceRateLimit(request, 'admin-commercial-review', 20, 60, true);
  if (limited) return limited;
  try {
    const body = await request.json();
    if (typeof body.serviceId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(body.serviceId) || !body.review || typeof body.review !== 'object') return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
    const service = await prisma.service.findUnique({ where: { id: body.serviceId }, select: { id: true } });
    if (!service) return NextResponse.json({ error: 'Offre introuvable.' }, { status: 404 });
    const review = parseCommercialReview(JSON.stringify(body.review));
    if (body.review.status === 'approved' && (body.authorizationConfirmed !== true || review.status !== 'approved')) return NextResponse.json({ error: 'Autorisation documentée, conditions d’éligibilité, type d’accès et confidentialité sont requis.' }, { status: 400 });
    await prisma.$transaction(async tx => {
      await tx.setting.upsert({ where: { key: `commercial_review:${service.id}` }, create: { key: `commercial_review:${service.id}`, value: JSON.stringify(review) }, update: { value: JSON.stringify(review) } });
      await tx.auditLog.create({ data: { action: 'service.commercial_review', entityType: 'service', entityId: service.id,
        description: `Vérification commerciale : ${review.status}. Document privé non inclus dans le journal.`, ip: clientIpFromRequest(request) } });
    });
    return NextResponse.json({ success: true, review });
  } catch { return NextResponse.json({ error: 'Vérification non enregistrée.' }, { status: 503 }); }
}
