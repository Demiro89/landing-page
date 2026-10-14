import 'server-only';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, readAdminSecret } from './adminAuth';

export const ADMIN_FRESH_COOKIE = 'sm_admin_fresh';
const MAX_AGE = 10 * 60;
const sessionHash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const sign = (payload: string, secret: string) => crypto.createHmac('sha256', secret).update(`admin-fresh:${payload}`).digest('hex');

export async function markAdminFresh(token: string) {
  const secret = readAdminSecret();
  if (!secret) throw new Error('Admin authentication unavailable');
  const payload = `${Date.now() + MAX_AGE * 1000}.${sessionHash(token)}`;
  (await cookies()).set(ADMIN_FRESH_COOKIE, `${payload}.${sign(payload, secret)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: MAX_AGE,
  });
}

export async function requireRecentAdmin() {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  const fresh = jar.get(ADMIN_FRESH_COOKIE)?.value;
  const secret = readAdminSecret();
  const parts = fresh ? /^(\d{13})\.([a-f0-9]{64})\.([a-f0-9]{64})$/.exec(fresh) : null;
  if (token && secret && parts && Number(parts[1]) > Date.now() && Number(parts[1]) <= Date.now() + MAX_AGE * 1000 && parts[2] === sessionHash(token)) {
    const expected = sign(`${parts[1]}.${parts[2]}`, secret);
    if (crypto.timingSafeEqual(Buffer.from(parts[3], 'hex'), Buffer.from(expected, 'hex'))) return null;
  }
  return NextResponse.json({ success: false, code: 'ADMIN_REAUTH_REQUIRED', error: 'Confirmez votre identité pour poursuivre cette action.' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
}
