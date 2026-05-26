import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

const ALLOWED_KEYS = new Set([
  'crypto_btc',
  'crypto_eth',
  'crypto_usdt',
  'crypto_ltc',
  'gateway_cb',
  'gateway_paypal',
  'gateway_crypto',
  'commission_percent',
  'commission_fixed',
]);

const DEFAULT_SETTINGS: Record<string, string> = {
  crypto_btc: '',
  crypto_eth: '',
  crypto_usdt: '',
  crypto_ltc: '',
  gateway_cb: 'true',
  gateway_paypal: 'true',
  gateway_crypto: 'true',
  commission_percent: '0.0',
  commission_fixed: '0.0',
};

const checkAuth = isAdminAuthenticated;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Erreur serveur';

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const rows = await prisma.setting.findMany();
    const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
    rows.forEach((r) => {
      if (ALLOWED_KEYS.has(r.key)) settings[r.key] = r.value;
    });
    return NextResponse.json({ success: true, settings });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const updates: Array<{ key: string; value: string }> = body.settings || [];

    const forbidden = updates.filter(({ key }) => !ALLOWED_KEYS.has(key));
    if (forbidden.length > 0) {
      return NextResponse.json({ error: `Clé(s) non autorisée(s) : ${forbidden.map(f => f.key).join(', ')}` }, { status: 400 });
    }

    for (const { key, value } of updates) {
      await prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
