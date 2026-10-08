export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

const ORDER_STATUSES: Record<string, { label: string; tone: StatusTone }> = {
  active: { label: 'Actif', tone: 'success' },
  pending: { label: 'En attente', tone: 'warning' },
  payment_review: { label: 'Paiement à vérifier', tone: 'danger' },
  unpaid: { label: 'Impayé', tone: 'warning' },
  cancelled_pending: { label: 'Résiliation programmée', tone: 'warning' },
  cancelled: { label: 'Résilié / refusé', tone: 'neutral' },
};

export function orderStatusPresentation(status: string) {
  return ORDER_STATUSES[status] ?? { label: 'Statut à vérifier', tone: 'danger' as const };
}

// An order snapshot is not a payment ledger, especially for renewals/refunds.
export function hasValidatedInitialAmount(status: string) {
  return ['active', 'unpaid', 'cancelled_pending'].includes(status);
}

export function matchesOrderSearch(order: { id: string; clientEmail: string; service: { name: string } }, search: string) {
  const value = search.trim().toLocaleLowerCase('fr-FR');
  return !value || [order.id, order.clientEmail, order.service.name].some(text => text.toLocaleLowerCase('fr-FR').includes(value));
}

export function isStripeOrder(order: { paymentMethod?: string | null; stripeSubscriptionId?: string | null }) {
  return Boolean(order.stripeSubscriptionId) || order.paymentMethod === 'Carte bancaire (Stripe)';
}
