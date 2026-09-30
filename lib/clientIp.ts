import { isIP } from 'node:net';

export function clientIp(request: Request): string {
  // Only trust headers when the deployment edge overwrites them.
  // A self-hosted reverse proxy must strip these headers and forbid direct access.
  if (process.env.VERCEL !== '1' && process.env.TRUSTED_PROXY_HEADERS !== 'true') return 'unknown';
  const ip = (request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || '').trim();
  return isIP(ip) ? ip : 'unknown';
}
