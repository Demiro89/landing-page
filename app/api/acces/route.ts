import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { enforceRateLimit } from '@/lib/rateLimit';
import {
  createSiteAccessToken,
  SITE_ACCESS_COOKIE,
  SITE_ACCESS_TTL_SEC,
} from '@/lib/siteAccess';

export const dynamic = 'force-dynamic';

function timingSafeEqualStr(a: string, b: string): boolean {
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
 * Valide le code d'accès au site et, si correct, pose le cookie httpOnly
 * autorisant la navigation (le `proxy` vérifie ce cookie à chaque requête).
 */
export async function POST(request: Request) {
  // Rate limit pour empêcher le brute-force du code (fail-closed).
  const limited = await enforceRateLimit(request, 'site-acces', 10, 900, true);
  if (limited) return limited;

  const accessCode = process.env.SITE_ACCESS_CODE;
  // Porte désactivée : il n'y a rien à déverrouiller.
  if (!accessCode) {
    return NextResponse.json({ success: true });
  }

  let code = '';
  try {
    ({ code } = await request.json());
  } catch {
    code = '';
  }

  if (typeof code === 'string' && code.length > 0 && timingSafeEqualStr(code, accessCode)) {
    const token = createSiteAccessToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Configuration serveur incomplète.' },
        { status: 500 }
      );
    }
    const cookieStore = await cookies();
    cookieStore.set({
      name: SITE_ACCESS_COOKIE,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'strict',
      maxAge: SITE_ACCESS_TTL_SEC,
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: 'Code incorrect.' }, { status: 401 });
}
