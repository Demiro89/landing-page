import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import { generateTotpSecret, totpUri, verifyTotpAndGetCounter } from '@/lib/totp';
import { encrypt, decrypt } from '@/lib/crypto';
import { enforceRateLimit } from '@/lib/rateLimit';
import { writeAuditLog, clientIpFromRequest } from '@/lib/auditLog';
import { lockAdminTotp } from '@/lib/adminTotp';

export const dynamic = 'force-dynamic';

async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row ? row.value : null;
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
    // Limite les tentatives de codes TOTP (enable/disable) — fail-closed.
    const limited = await enforceRateLimit(request, 'admin-2fa', 10, 900, true);
    if (limited) return limited;

    const body = await request.json();
    const { action } = body;
    if (!['setup', 'enable', 'disable'].includes(action)) {
      return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
    }
    const result = await prisma.$transaction(async (tx) => {
      await lockAdminTotp(tx);
      const read = async (key: string) => (await tx.setting.findUnique({ where: { key } }))?.value;
      const write = async (key: string, value: string) => tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
      const enabled = (await read('admin_totp_enabled')) === 'true';
      if (enabled && action !== 'disable') {
        return NextResponse.json({ error: 'Désactivez d’abord la 2FA avec un code valide avant de la remplacer.' }, { status: 409 });
      }

      // Génère un secret à présenter à l'administrateur (pas encore actif).
      if (action === 'setup') {
        const secret = generateTotpSecret();
        await write('admin_totp_pending_secret', encrypt(secret));
        await write('admin_totp_pending_expires', String(Date.now() + 10 * 60 * 1000));
        return NextResponse.json({
          success: true,
          secret,
          uri: totpUri(secret, 'admin', 'StreamMalin'),
        });
      }

      // Active la 2FA après vérification d'un premier code.
      if (action === 'enable') {
        const stored = await read('admin_totp_pending_secret');
        const expires = Number(await read('admin_totp_pending_expires'));
        const secret = stored ? decrypt(stored) : '';
        const counter = secret && typeof body.token === 'string' ? verifyTotpAndGetCounter(secret, body.token) : null;
        if (!secret || !Number.isFinite(expires) || expires <= Date.now() || body.secret !== secret || counter === null) {
          return NextResponse.json(
            { error: "Code incorrect. Vérifiez l'heure de votre téléphone et réessayez." },
            { status: 400 }
          );
        }
        await write('admin_totp_secret', encrypt(secret));
        await write('admin_totp_enabled', 'true');
        await write('admin_totp_last_counter', String(counter));
        await write('admin_totp_pending_secret', '');
        await write('admin_totp_pending_expires', '');
        return NextResponse.json({ success: true });
      }

      // Désactive la 2FA (nécessite un code valide en cours).
      if (action === 'disable') {
        const stored = await read('admin_totp_secret');
        const lastCounter = Number((await read('admin_totp_last_counter')) ?? -1);
        const counter = stored && typeof body.token === 'string' ? verifyTotpAndGetCounter(decrypt(stored), body.token) : null;
        if (!enabled || counter === null || counter <= lastCounter) {
          return NextResponse.json({ error: 'Code incorrect.' }, { status: 400 });
        }
        await write('admin_totp_enabled', 'false');
        await write('admin_totp_secret', '');
        await write('admin_totp_pending_secret', '');
        await write('admin_totp_pending_expires', '');
        await write('admin_totp_last_counter', '');
        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
    });
    if (result.ok && action !== 'setup') {
      await writeAuditLog({ action: `2fa.${action}`, entityType: 'settings', description: `2FA admin : ${action}`, ip: clientIpFromRequest(request) });
    }
    return result;
  } catch (error) {
    console.error('Erreur /api/admin/2fa:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
