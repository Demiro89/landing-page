import 'server-only';
import { prisma } from './prisma';

export interface CommercialReview {
  status: 'unverified' | 'approved';
  authorizationReference: string;
  eligibility: string;
  accessType: string;
  privacyNote: string;
  referenceUrl: string;
  referenceCheckedAt: string;
  referencePrice: number | null;
  comparableReference: boolean;
}

export const EMPTY_COMMERCIAL_REVIEW: CommercialReview = {
  status: 'unverified', authorizationReference: '', eligibility: '', accessType: '', privacyNote: '',
  referenceUrl: '', referenceCheckedAt: '', referencePrice: null, comparableReference: false,
};

export function remediationSchemaEnabled(): boolean {
  return process.env.REMEDIATION_SCHEMA_ENABLED === 'true';
}

export function commerceEnabled(): boolean {
  return process.env.COMMERCE_ENABLED === 'true' && remediationSchemaEnabled();
}

export class CommerceUnavailableError extends Error {}

export function parseCommercialReview(raw?: string | null): CommercialReview {
  try {
    const value = JSON.parse(raw || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY_COMMERCIAL_REVIEW };
    const text = (key: string) => typeof value[key] === 'string' ? value[key].trim().slice(0, 2000) : '';
    const authorizationReference = text('authorizationReference');
    const eligibility = text('eligibility');
    const accessType = text('accessType');
    const privacyNote = text('privacyNote');
    return {
      status: value.status === 'approved' && authorizationReference && eligibility && accessType && privacyNote ? 'approved' : 'unverified',
      authorizationReference, eligibility, accessType, privacyNote,
      referenceUrl: text('referenceUrl'), referenceCheckedAt: text('referenceCheckedAt'),
      referencePrice: Number.isFinite(value.referencePrice) && value.referencePrice > 0 ? value.referencePrice : null,
      comparableReference: value.comparableReference === true,
    };
  } catch { return { ...EMPTY_COMMERCIAL_REVIEW }; }
}

export async function getCommercialReviews(serviceIds: string[]): Promise<Map<string, CommercialReview>> {
  if (serviceIds.length === 0) return new Map();
  const rows = await prisma.setting.findMany({ where: { key: { in: serviceIds.map(id => `commercial_review:${id}`) } } });
  return new Map(serviceIds.map(id => [id, parseCommercialReview(rows.find(row => row.key === `commercial_review:${id}`)?.value)]));
}

export function hasVerifiedReference(review: CommercialReview, original: number, now = Date.now()): boolean {
  const checkedAt = Date.parse(review.referenceCheckedAt);
  try {
    const url = new URL(review.referenceUrl);
    return review.comparableReference && url.protocol === 'https:' && review.referencePrice === original &&
      Number.isFinite(checkedAt) && checkedAt <= now && now - checkedAt <= 90 * 86400000;
  } catch { return false; }
}

export async function assertOfferSaleAllowed(serviceId: string): Promise<void> {
  if (!commerceEnabled()) throw new CommerceUnavailableError('La commande est temporairement indisponible. Contactez le support.');
  const reviews = await getCommercialReviews([serviceId]);
  if (reviews.get(serviceId)?.status !== 'approved') throw new CommerceUnavailableError('Cette offre n’est pas ouverte à la commande.');
}
