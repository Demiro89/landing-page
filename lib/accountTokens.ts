import 'server-only';
import crypto from 'crypto';

export type AccountTokenPurpose = 'verification' | 'reset' | 'email-change';
const TTL = { verification: 24 * 60 * 60 * 1000, reset: 60 * 60 * 1000, 'email-change': 24 * 60 * 60 * 1000 };

function fingerprint(purpose: AccountTokenPurpose, token: string, expires: string) {
  return `h1.${expires}.${crypto.createHash('sha256').update(`${purpose}:${token}`).digest('hex')}`;
}

export function createAccountToken(purpose: AccountTokenPurpose) {
  const expiresAt = new Date(Date.now() + TTL[purpose]);
  const expires = String(expiresAt.getTime());
  const token = `v1.${expires}.${crypto.randomBytes(32).toString('hex')}`;
  return { token, storedToken: fingerprint(purpose, token, expires), expiresAt };
}

export function readAccountToken(value: unknown, purpose: AccountTokenPurpose) {
  if (typeof value !== 'string') return null;
  // Existing links retain their original database expiry; no new plaintext tokens are issued.
  if (/^[a-f0-9]{64}$/.test(value)) return { storedToken: value, legacy: true };
  const match = /^v1\.(\d{13})\.[a-f0-9]{64}$/.exec(value);
  if (!match || Number(match[1]) <= Date.now()) return null;
  return { storedToken: fingerprint(purpose, value, match[1]), legacy: false };
}

// Fixed-width millisecond timestamps sort chronologically in the stored format.
export function expiredVerificationTokens(now: Date) {
  return { OR: [
    { verificationToken: null },
    { NOT: { verificationToken: { startsWith: 'h1.' } } },
    { verificationToken: { lt: `h1.${now.getTime()}.` } },
  ] };
}
