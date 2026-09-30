import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { ADMIN_COOKIE_NAME, readAdminSecret, isAdminAuthenticated } from '@/lib/adminAuth';
import { createAdminSessionToken, ADMIN_SESSION_TTL_SEC } from '@/lib/adminSession';
import { enforceRateLimit } from '@/lib/rateLimit';
import { verifyTotpAndGetCounter } from '@/lib/totp';
import { decrypt } from '@/lib/crypto';
import { lockAdminTotp } from '@/lib/adminTotp';

export const dynamic = 'force-dynamic';

function timingSafeEqualStr(a: string, b: string): boolean {
  // Pad les deux buffers à la même longueur pour que timingSafeEqual s'exécute
  // toujours en temps constant (pas de fuite de timing sur la longueur du mot de passe).
  const lenA = Buffer.byteLength(a, 'utf8');
  const lenB = Buffer.byteLength(b, 'utf8');
  const maxLen = Math.max(lenA, lenB, 1);
  const bufA = Buffer.alloc(maxLen, 0);
  const bufB = Buffer.alloc(maxLen, 0);
  Buffer.from(a, 'utf8').copy(bufA);
  Buffer.from(b, 'utf8').copy(bufB);
  return crypto.timingSafeEqual(bufA, bufB) && lenA === lenB;
}

/**
 * API pour gérer l'authentification Administrateur via cookie httpOnly fait maison.
 */
export async function POST(request: Request) {
  try {
    const { password, action, totp } = await request.json();

    // Gestion de la déconnexion
    if (action === 'logout') {
      const cookieStore = await cookies();
      cookieStore.set({
        name: ADMIN_COOKIE_NAME,
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'strict',
        maxAge: 0, // Détruit le cookie immédiatement
      });
      return NextResponse.json({ success: true, message: 'Déconnexion réussie' });
    }

    // Logout must remain available when the database or login limiter is unavailable.
    const limited = await enforceRateLimit(request, 'admin-auth', 8, 900, true);
    if (limited) return limited;
    if (typeof password !== 'string' || password.length > 128 || (totp !== undefined && (typeof totp !== 'string' || !/^\d{6}$/.test(totp)))) {
      return NextResponse.json({ success: false, error: 'Identifiants invalides' }, { status: 400 });
    }

    // Gestion de la connexion — aucune valeur par défaut codée en dur.
    const adminPassword = process.env.ADMIN_PASSWORD;
    const secretToken = readAdminSecret();

    if (!adminPassword || adminPassword.length < 8 || !secretToken) {
      console.error('[admin/auth] ADMIN_PASSWORD ou ADMIN_SECRET_TOKEN non configuré correctement.');
      return NextResponse.json(
        { success: false, error: 'Configuration serveur incomplète. Contactez l’administrateur.' },
        { status: 500 }
      );
    }

    if (typeof password === 'string' && timingSafeEqualStr(password, adminPassword)) {
      // Second facteur (2FA / TOTP) si activé.
      const secondFactor = await prisma.$transaction(async (tx) => {
        await lockAdminTotp(tx);
        const totpEnabled =
          (await tx.setting.findUnique({ where: { key: 'admin_totp_enabled' } }))?.value === 'true';
        if (totpEnabled) {
          if (!totp) {
            return NextResponse.json({ success: false, needsTotp: true }, { status: 401 });
          }
          const secretRow = await tx.setting.findUnique({ where: { key: 'admin_totp_secret' } });
          const rawSecret = secretRow?.value ?? '';
          const secret = rawSecret ? decrypt(rawSecret) : '';

          // Fenêtre ±2 périodes (±60s) pour absorber les décalages d'horloge téléphone/serveur.
          const usedCounter = secret ? verifyTotpAndGetCounter(secret, String(totp), 2) : null;

          if (!secret || usedCounter === null) {
            console.error('[admin/auth] TOTP invalide — secret disponible:', !!secret);
            return NextResponse.json(
              { success: false, needsTotp: true, error: 'Code incorrect. Vérifiez l\'heure de votre téléphone.' },
              { status: 401 }
            );
          }

          // Anti-replay : rejeter tout code dont le counter a déjà été consommé.
          const lastCounterRow = await tx.setting.findUnique({ where: { key: 'admin_totp_last_counter' } });
          const lastCounter = lastCounterRow ? parseInt(lastCounterRow.value, 10) : -1;
          if (!isNaN(lastCounter) && usedCounter <= lastCounter) {
            return NextResponse.json(
              { success: false, needsTotp: true, error: 'Code déjà utilisé — attendez le prochain code (30 s).' },
              { status: 401 }
            );
          }
          await tx.setting.upsert({
            where: { key: 'admin_totp_last_counter' },
            create: { key: 'admin_totp_last_counter', value: String(usedCounter) },
            update: { value: String(usedCounter) },
          });
        }
        return null;
      });
      if (secondFactor) return secondFactor;

      const sessionToken = createAdminSessionToken();
      if (!sessionToken) {
        return NextResponse.json(
          { success: false, error: 'Configuration serveur incomplète.' },
          { status: 500 }
        );
      }
      const cookieStore = await cookies();
      cookieStore.set({
        name: ADMIN_COOKIE_NAME,
        value: sessionToken, // jeton signé HMAC, ne contient PAS le secret
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'strict',
        maxAge: ADMIN_SESSION_TTL_SEC,
      });

      return NextResponse.json({ success: true, message: 'Authentification réussie' });
    }

    return NextResponse.json(
      { success: false, error: 'Mot de passe incorrect' },
      { status: 401 }
    );
  } catch (error) {
    console.error("Erreur d'authentification admin:", error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

/**
 * Permet de vérifier rapidement le statut de l'authentification côté client.
 */
export async function GET() {
  if (await isAdminAuthenticated()) {
    return NextResponse.json({ authenticated: true });
  }
  return NextResponse.json({ authenticated: false }, { status: 401 });
}
