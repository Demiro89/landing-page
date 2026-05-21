import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

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

async function checkAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('ADMIN_SECRET_TOKEN')?.value;
  const secretToken = process.env.ADMIN_SECRET_TOKEN || 'SM_SUPER_SECRET_TOKEN_2026';
  return token === secretToken;
}

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const rows = await prisma.setting.findMany();
    const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
    rows.forEach((r) => { settings[r.key] = r.value; });
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Public endpoint for checkout (only crypto addresses + active gateways)
export async function OPTIONS() {
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ['crypto_btc', 'crypto_eth', 'crypto_usdt', 'crypto_ltc', 'gateway_cb', 'gateway_paypal', 'gateway_crypto'] } }
    });
    const settings: Record<string, string> = {
      crypto_btc: DEFAULT_SETTINGS.crypto_btc,
      crypto_eth: DEFAULT_SETTINGS.crypto_eth,
      crypto_usdt: DEFAULT_SETTINGS.crypto_usdt,
      crypto_ltc: DEFAULT_SETTINGS.crypto_ltc,
      gateway_cb: 'true',
      gateway_paypal: 'true',
      gateway_crypto: 'true',
    };
    rows.forEach((r) => { settings[r.key] = r.value; });
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const updates: Array<{ key: string; value: string }> = body.settings || [];

    for (const { key, value } of updates) {
      await prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
