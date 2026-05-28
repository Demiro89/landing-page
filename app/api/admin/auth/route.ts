import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { ADMIN_COOKIE_NAME, readAdminSecret, isAdminAuthenticated } from '@/lib/adminAuth';
import { createAdminSessionToken, ADMIN_SESSION_TTL_SEC } from '@/lib/adminSession';
import { enforceRateLimit } from '@/lib/rateLimit';
import { verifyTotp } from '@/lib/totp';
import { decrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
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

    // Limitation anti brute-force sur les tentatives de connexion.
    const limited = await enforceRateLimit(request, 'admin-auth', 8, 900);
    if (limited) return limited;

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
      const totpEnabled =
        (await prisma.setting.findUnique({ where: { key: 'admin_totp_enabled' } }))?.value === 'true';
      if (totpEnabled) {
        if (!totp) {
          return NextResponse.json({ success: false, needsTotp: true }, { status: 401 });
        }
        const secretRow = await prisma.setting.findUnique({ where: { key: 'admin_totp_secret' } });
        const secret = secretRow?.value ? decrypt(secretRow.value) : '';
        if (!secret || !verifyTotp(secret, String(totp))) {
          return NextResponse.json(
            { success: false, needsTotp: true, error: 'Code de vérification incorrect' },
            { status: 401 }
          );
        }
      }

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
