export const ACCESS_STATUSES = ['active', 'cancelled_pending'] as const;
export const STOCK_CONSUMING_STATUSES = ['active', 'unpaid', 'cancelled_pending'];

export function canReadAccess(status: string): boolean {
  return ACCESS_STATUSES.some((allowed) => allowed === status);
}

export function ownsOrder(
  order: { customerId: string | null; clientEmail: string },
  customer: { id: string; email: string }
): boolean {
  // An explicit owner takes precedence over the legacy email association.
  return order.customerId !== null
    ? order.customerId === customer.id
    : order.clientEmail.toLowerCase() === customer.email.toLowerCase();
}
