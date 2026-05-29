import crypto from 'crypto';

/**
 * Authentification à deux facteurs — TOTP (RFC 6238), compatible Google
 * Authenticator, Authy, etc. Implémentation sans dépendance externe.
 */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIOD = 30; // secondes
const DIGITS = 6;

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const idx = B32.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Génère un nouveau secret TOTP (base32). */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

/** Construit l'URI otpauth:// à fournir à l'application d'authentification. */
export function totpUri(secret: string, account: string, issuer: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

/**
 * Vérifie un code à 6 chiffres. Tolère une fenêtre de ±1 période (±30 s)
 * pour absorber un léger décalage d'horloge. Comparaison à temps constant.
 * @returns le counter TOTP utilisé (pour protection anti-replay), ou null si invalide.
 */
export function verifyTotpAndGetCounter(secret: string, token: string, window = 1): number | null {
  if (!/^\d{6}$/.test(token || '')) return null;
  const secretBuf = base32Decode(secret);
  if (secretBuf.length === 0) return null;
  const counter = Math.floor(Date.now() / 1000 / PERIOD);
  const tokenBuf = Buffer.from(token);
  for (let i = -window; i <= window; i++) {
    const candidate = Buffer.from(hotp(secretBuf, counter + i));
    if (candidate.length === tokenBuf.length && crypto.timingSafeEqual(candidate, tokenBuf)) {
      return counter + i;
    }
  }
  return null;
}

/** Wrapper rétrocompatible (utiliser verifyTotpAndGetCounter pour la protection anti-replay). */
export function verifyTotp(secret: string, token: string, window = 1): boolean {
  return verifyTotpAndGetCounter(secret, token, window) !== null;
}
