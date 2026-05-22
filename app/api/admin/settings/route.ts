import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

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
