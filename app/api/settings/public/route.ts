import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Clés non sensibles, destinées à la page de paiement publique :
// adresses crypto (que le client doit voir pour payer) et passerelles actives.
const PUBLIC_KEYS = [
  'crypto_btc', 'crypto_eth', 'crypto_usdt', 'crypto_ltc',
  'gateway_cb', 'gateway_paypal', 'gateway_crypto',
  'paypal_email',
];

const DEFAULTS: Record<string, string> = {
  crypto_btc: '', crypto_eth: '', crypto_usdt: '', crypto_ltc: '',
  gateway_cb: 'true', gateway_paypal: 'true', gateway_crypto: 'true',
  paypal_email: '',
};

/**
 * GET /api/settings/public : paramètres publics nécessaires au tunnel de paiement.
 * N'expose volontairement aucune clé sensible (commissions, etc.).
 */
export async function GET() {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { in: PUBLIC_KEYS } } });
    const settings: Record<string, string> = { ...DEFAULTS };
    rows.forEach((r) => { settings[r.key] = r.value; });
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Erreur GET settings public:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
