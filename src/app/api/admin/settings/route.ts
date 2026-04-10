/**
 * GET  /api/admin/settings?token=XXX  — tous les paramètres
 * PATCH /api/admin/settings           — { token, key, value } — met à jour un paramètre
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SETTING_KEYS, SETTING_DEFAULTS, type SettingKey } from '@/lib/settings';

function checkAuth(token: string | null): boolean {
  const adminToken = process.env.ADMIN_SECRET_TOKEN;
  return Boolean(adminToken && token === adminToken);
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token');
  if (!checkAuth(token)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const rows = await prisma.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  // Merge with defaults so every key is always present
  const settings = Object.fromEntries(
    SETTING_KEYS.map((k) => [k, map[k] ?? SETTING_DEFAULTS[k]])
  );

  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token, key, value } = body as { token: string; key: string; value: string };

  if (!checkAuth(token)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }
  if (!SETTING_KEYS.includes(key as SettingKey)) {
    return NextResponse.json({ error: 'Clé invalide.' }, { status: 400 });
  }
  if (typeof value !== 'string') {
    return NextResponse.json({ error: 'Valeur invalide.' }, { status: 400 });
  }

  // Extra validation for prices
  if (key === 'price_youtube' || key === 'price_disney') {
    const n = parseFloat(value);
    if (isNaN(n) || n <= 0 || n > 999) {
      return NextResponse.json({ error: 'Prix invalide (ex: 5.99).' }, { status: 400 });
    }
  }

  const setting = await prisma.setting.upsert({
    where: { key },
    update: { value: value.trim() },
    create: { key, value: value.trim() },
  });

  return NextResponse.json({ ok: true, setting });
}
