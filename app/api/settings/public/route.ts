import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { commerceEnabled } from '@/lib/commerce';
import { CRYPTO_COINS } from '@/lib/manualPayment';
import { normalizeEmail } from '@/lib/checkoutValidation';
import { logServerFailure } from '@/lib/securityLog';

export const dynamic = 'force-dynamic';

const GATEWAY_KEYS = [
  ...CRYPTO_COINS.map(coin => `crypto_${coin}`),
  'gateway_cb', 'gateway_paypal', 'gateway_crypto',
  'paypal_email',
];

export async function GET() {
  try {
    const enabled = commerceEnabled();
    const rows = enabled ? await prisma.setting.findMany({ where: { key: { in: GATEWAY_KEYS } } }) : [];
    const values = new Map(rows.map(({ key, value }) => [key, value]));
    const manual = enabled && process.env.MANUAL_PAYMENTS_ENABLED === 'true';
    const coins = manual && values.get('gateway_crypto') === 'true'
      ? CRYPTO_COINS.filter(coin => Boolean(values.get(`crypto_${coin}`)?.trim())) : [];

    return NextResponse.json({ success: true, settings: {
      gateway_cb: String(values.get('gateway_cb') === 'true'),
      gateway_paypal: String(manual && values.get('gateway_paypal') === 'true' && Boolean(normalizeEmail(values.get('paypal_email')))),
      gateway_crypto: String(coins.length > 0),
      crypto_coins: coins,
    } }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    logServerFailure('settings/public', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
