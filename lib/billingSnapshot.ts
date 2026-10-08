import 'server-only';
import type { Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import { encrypt, decrypt } from './crypto';

export type BillingSnapshot = { name: string | null; address: string | null };
type CustomerDetails = Stripe.Checkout.Session['customer_details'];

function clean(value: unknown, length: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, length) : null;
}

export function checkoutBilling(details: CustomerDetails): BillingSnapshot {
  const address = details?.address;
  return {
    name: clean(details?.name, 200),
    address: address ? [address.line1, address.line2, address.postal_code, address.city, address.state, address.country]
      .map(part => clean(part, 200)).filter(Boolean).join(', ') || null : null,
  };
}

// The authenticated Stripe event is the source; never accept billing data from metadata.
export async function saveBillingSnapshot(tx: Prisma.TransactionClient, orderId: string, details: CustomerDetails) {
  const billing = checkoutBilling(details);
  if (!billing.name && !billing.address) return;
  await tx.setting.upsert({
    where: { key: `billing:${orderId}` },
    create: { key: `billing:${orderId}`, value: encrypt(JSON.stringify(billing)) },
    update: {},
  });
}

export function readBillingSnapshot(value?: string | null): BillingSnapshot {
  if (!value) return { name: null, address: null };
  const billing = JSON.parse(decrypt(value));
  if (!billing || typeof billing !== 'object' || Array.isArray(billing)) throw new Error('Invalid billing snapshot');
  return { name: clean(billing.name, 200), address: clean(billing.address, 1200) };
}
