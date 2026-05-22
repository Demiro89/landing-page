import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import { generateTotpSecret, totpUri, verifyTotp } from '@/lib/totp';
import { encrypt, decrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row ? row.value : null;
}

async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/** GET : statut de la 2FA admin. */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const enabled = (await getSetting('admin_totp_enabled')) === 'true';
  return NextResponse.json({ success: true, enabled });
}

/** POST : setup / enable / disable de la 2FA admin. */
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { action } = body;

    // Génère un secret à présenter à l'administrateur (pas encore actif).
    if (action === 'setup') {
      const secret = generateTotpSecret();
      return NextResponse.json({
        success: true,
        secret,
        uri: totpUri(secret, 'admin', 'StreamMalin'),
      });
    }

    // Active la 2FA après vérification d'un premier code.
    if (action === 'enable') {
      const { secret, token } = body;
      if (!secret || !verifyTotp(String(secret), String(token || ''))) {
        return NextResponse.json(
          { error: "Code incorrect. Vérifiez l'heure de votre téléphone et réessayez." },
          { status: 400 }
        );
      }
      await setSetting('admin_totp_secret', encrypt(String(secret)));
      await setSetting('admin_totp_enabled', 'true');
      return NextResponse.json({ success: true });
    }

    // Désactive la 2FA (nécessite un code valide en cours).
    if (action === 'disable') {
      const { token } = body;
      const stored = await getSetting('admin_totp_secret');
      if (!stored || !verifyTotp(decrypt(stored), String(token || ''))) {
        return NextResponse.json({ error: 'Code incorrect.' }, { status: 400 });
      }
      await setSetting('admin_totp_enabled', 'false');
      await setSetting('admin_totp_secret', '');
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
  } catch (error) {
    console.error('Erreur /api/admin/2fa:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
