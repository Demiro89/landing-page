import crypto from 'crypto';

export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const actual = Buffer.from(request.headers.get('authorization') || '', 'utf8');
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
