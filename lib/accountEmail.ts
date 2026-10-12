import 'server-only';
import crypto from 'crypto';
import { after } from 'next/server';
import { sendVerificationEmail, sendResetPasswordEmail, sendEmailChangeVerificationEmail } from './nodemailer';
import type { AccountTokenPurpose } from './accountTokens';

export type AccountEmailSendOptions = { idempotencyKey: string; signal: AbortSignal };
const SENDERS = { verification: sendVerificationEmail, reset: sendResetPasswordEmail, 'email-change': sendEmailChangeVerificationEmail };

export async function deliverAccountEmail(kind: AccountTokenPurpose, email: string, token: string) {
  const idempotencyKey = `account-${crypto.createHash('sha256').update(`${kind}:${token}`).digest('hex')}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let retryable = false;
    try {
      const result = await SENDERS[kind](email, token, { idempotencyKey, signal: controller.signal });
      if (result.success && result.messageId) {
        console.info('[account-mail]', { kind, outcome: 'accepted', messageId: result.messageId });
        return true;
      }
      const error = 'error' in result ? result.error : null;
      const status = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : null;
      retryable = Boolean(error) && (status == null || status === 429 || (typeof status === 'number' && status >= 500));
    } catch { retryable = true; }
    finally { clearTimeout(timeout); }
    if (!retryable || attempt === 2) break;
    await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
  }
  // Never log addresses, link tokens, provider bodies or credentials.
  console.error('[account-mail]', { kind, outcome: 'not-confirmed' });
  return false;
}

export function scheduleAccountEmail(kind: AccountTokenPurpose, email: string, token: string) {
  // Next keeps this callback alive after the generic public response, including on Vercel.
  after(async () => { await deliverAccountEmail(kind, email, token); });
}
