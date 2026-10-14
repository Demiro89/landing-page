const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const next = require('next/server');
const { createLoader } = require('./load-ts.cjs');
const json = body => new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const limits = { enforceRateLimit: async () => null, enforceKeyRateLimit: async () => null };

test('new account links store only purpose-bound fingerprints; expiry, tampering and hash-as-token are rejected', () => {
  const { createAccountToken, readAccountToken } = createLoader()('lib/accountTokens.ts');
  for (const purpose of ['verification', 'reset', 'email-change']) {
    const created = createAccountToken(purpose);
    assert.match(created.storedToken, /^h1\.\d{13}\.[a-f0-9]{64}$/);
    assert.notEqual(created.storedToken.split('.')[2], created.token.split('.')[2]);
    assert.equal(readAccountToken(created.token, purpose).storedToken, created.storedToken);
    assert.equal(readAccountToken(created.storedToken, purpose), null);
    assert.equal(readAccountToken(`v1.${Date.now() - 1}.${'a'.repeat(64)}`, purpose), null);
    assert.equal(readAccountToken(`${created.token}extra`, purpose), null);
    const altered = created.token.replace(/\d{13}/, String(Date.now() + 120000));
    assert.notEqual(readAccountToken(altered, purpose).storedToken, created.storedToken);
    const other = purpose === 'reset' ? 'verification' : 'reset';
    assert.notEqual(readAccountToken(created.token, other).storedToken, created.storedToken);
  }
  assert.equal(readAccountToken('a'.repeat(64), 'reset').legacy, true);
});

test('resend works without a session, uses conditional hashed writes and gives the same response for absent or verified accounts', async () => {
  let row = null, writes = 0, sends = 0, count = 1;
  const { POST } = createLoader({
    '@/lib/rateLimit': { ...limits, enforceKeyRateLimit: async key => { assert.doesNotMatch(key, /@/); return null; } },
    '@/lib/accountEmail': { scheduleAccountEmail: (kind, email, token) => { assert.equal(kind, 'verification'); assert.equal(email, 'client@example.test'); assert.match(token, /^v1\./); sends++; } },
    '@/lib/prisma': { prisma: { customer: {
      findUnique: async () => row,
      updateMany: async ({ where, data }) => {
        assert.equal(where.emailVerified, false); assert.equal(where.verificationToken, row.verificationToken);
        assert.equal(where.sessionVersion, row.sessionVersion); assert.match(data.verificationToken, /^h1\./);
        writes++; return { count };
      },
    } } },
  })('app/api/client/resend-verification/route.ts');
  const responses = [];
  for (const current of [null, { emailVerified: true }, { id: 'client', emailVerified: false, sessionVersion: 1, verificationToken: 'old' }]) {
    row = current;
    const response = await POST(json({ email: 'Client@example.test' }));
    responses.push([response.status, await response.json()]);
  }
  assert.deepEqual(responses[0], responses[1]); assert.deepEqual(responses[0], responses[2]);
  assert.equal(writes, 1); assert.equal(sends, 1);
  count = 0;
  assert.equal((await POST(json({ email: 'client@example.test' }))).status, 200);
  assert.equal(sends, 1);
});

test('resend rejects malformed input and unavailable recipient limiting before any token write', async () => {
  const { POST } = createLoader({ '@/lib/rateLimit': { ...limits, enforceKeyRateLimit: async () => Response.json({}, { status: 429 }) } })('app/api/client/resend-verification/route.ts');
  assert.equal((await POST(json(null))).status, 400);
  assert.equal((await POST(json({ email: 'bad' }))).status, 400);
  assert.equal((await POST(json({ email: 'client@example.test' }))).status, 429);
});

test('registration stores a fingerprint and registers a framework-managed email task before returning', async () => {
  const callbacks = []; let saved, sentToken, deliveries = 0;
  const load = createLoader({
    'next/server': { ...next, after: callback => callbacks.push(callback) },
    '@/lib/rateLimit': limits, '@/lib/clientAuth': { hashPassword: () => 'fixture-hash' },
    './nodemailer': { sendVerificationEmail: async (email, token) => { sentToken = token; deliveries++; return { success: true, messageId: 'fixture-message' }; } },
    '@/lib/prisma': { prisma: { customer: { findUnique: async () => null, create: async ({ data }) => { saved = data; } } } },
  });
  const response = await load('app/api/client/register/route.ts').POST(json({ email: 'client@example.test', password: 'FixturePassword1' }));
  assert.equal(response.status, 200); assert.equal(deliveries, 0); assert.equal(callbacks.length, 1);
  await callbacks[0](); assert.equal(deliveries, 1);
  assert.equal(saved.verificationToken, load('lib/accountTokens.ts').readAccountToken(sentToken, 'verification').storedToken);
});

test('account mail retries only transient rejections with one idempotency key and confirms a provider message ID', async () => {
  let calls = 0, permanent = false; const keys = [];
  const { deliverAccountEmail } = createLoader({ './nodemailer': { sendResetPasswordEmail: async (email, token, options) => {
    calls++; keys.push(options.idempotencyKey); assert.ok(options.signal instanceof AbortSignal);
    if (permanent) return { success: false, error: { statusCode: 403 } };
    return calls < 3 ? { success: false, error: { statusCode: calls === 1 ? 429 : 503 } } : { success: true, messageId: 'accepted-id' };
  } } })('lib/accountEmail.ts');
  assert.equal(await deliverAccountEmail('reset', 'client@example.test', 'private-link-token'), true);
  assert.equal(calls, 3); assert.equal(new Set(keys).size, 1); assert.doesNotMatch(keys[0], /private-link-token|client/);
  permanent = true; calls = 0;
  assert.equal(await deliverAccountEmail('reset', 'client@example.test', 'private-link-token'), false); assert.equal(calls, 1);
});

test('missing mail configuration or missing message ID is not treated as accepted delivery', async () => {
  for (const result of [{ success: false, simulated: true }, { success: true }]) {
    let calls = 0;
    const { deliverAccountEmail } = createLoader({ './nodemailer': { sendVerificationEmail: async () => { calls++; return result; } } })('lib/accountEmail.ts');
    assert.equal(await deliverAccountEmail('verification', 'client@example.test', 'token'), false); assert.equal(calls, 1);
  }
});

test('all account email templates pass timeout and idempotency options to the provider', async () => {
  const previous = process.env.RESEND_API_KEY; process.env.RESEND_API_KEY = 're_fixture_no_network';
  try {
    const captures = [];
    class FakeResend { emails = { send: async (body, options) => { captures.push({ body, options }); return { data: { id: 'id' }, error: null }; } }; }
    const mail = createLoader({ resend: { Resend: FakeResend } })('lib/nodemailer.ts');
    const options = { signal: new AbortController().signal, idempotencyKey: 'fixture-key' };
    for (const name of ['sendVerificationEmail', 'sendResetPasswordEmail', 'sendEmailChangeVerificationEmail']) {
      assert.equal((await mail[name]('client@example.test', 'fixture-token', options)).success, true);
    }
    assert.equal(captures.length, 3); assert.ok(captures.every(item => item.options === options));
  } finally { if (previous === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous; }
});

test('fresh admin proof is signed, session-bound, HttpOnly and expires after ten minutes', async () => {
  const jar = new Map([['ADMIN_SECRET_TOKEN', { value: 'session-A' }]]); let attributes;
  const load = createLoader({
    './adminAuth': { ADMIN_COOKIE_NAME: 'ADMIN_SECRET_TOKEN', readAdminSecret: () => 'fixture-admin-secret-32-characters' },
    'next/headers': { cookies: async () => ({ get: key => jar.get(key), set: (key, value, options) => { jar.set(key, { value }); attributes = options; } }) },
  });
  const fresh = load('lib/adminFreshness.ts');
  assert.equal((await fresh.requireRecentAdmin()).status, 403);
  await fresh.markAdminFresh('session-A'); assert.equal(await fresh.requireRecentAdmin(), null);
  assert.equal(attributes.httpOnly, true); assert.equal(attributes.sameSite, 'strict'); assert.equal(attributes.maxAge, 600);
  jar.set('ADMIN_SECRET_TOKEN', { value: 'session-B' }); assert.equal((await fresh.requireRecentAdmin()).status, 403);
  jar.set('ADMIN_SECRET_TOKEN', { value: 'session-A' });
  const valid = jar.get('sm_admin_fresh').value;
  jar.set('sm_admin_fresh', { value: valid + 'z' }); assert.equal((await fresh.requireRecentAdmin()).status, 403);
  const expired = `${Date.now() - 1}.${crypto.createHash('sha256').update('session-A').digest('hex')}`;
  const signature = crypto.createHmac('sha256', 'fixture-admin-secret-32-characters').update(`admin-fresh:${expired}`).digest('hex');
  jar.set('sm_admin_fresh', { value: `${expired}.${signature}` }); assert.equal((await fresh.requireRecentAdmin()).status, 403);
});

test('every sensitive admin action refuses stale confirmation before data access or mutation', async () => {
  const targets = [['stock', 'POST'], ['stock', 'PUT'], ['stock', 'DELETE'], ['settings', 'PUT'], ['2fa', 'POST'], ['credentials', 'POST'], ['commercial-review', 'PUT'], ['operations', 'POST'], ['encrypt-legacy', 'POST']];
  for (const [path, method] of targets) {
    const route = createLoader({
      '@/lib/adminAuth': { isAdminAuthenticated: async () => true },
      '@/lib/adminFreshness': { requireRecentAdmin: async () => Response.json({ code: 'ADMIN_REAUTH_REQUIRED' }, { status: 403 }) },
    })(`app/api/admin/${path}/route.ts`);
    const response = await route[method](json({})); assert.equal(response.status, 403, `${path} ${method}`);
    assert.equal((await response.json()).code, 'ADMIN_REAUTH_REQUIRED');
  }
});

test('admin transport retries only after approved pre-mutation reauthentication, once, and cancellation writes nothing', async () => {
  for (const accepted of [false, true]) {
    let calls = 0, approvals = 0;
    const load = createLoader();
    const unregister = load('lib/adminReauthentication.ts').registerAdminReauthentication(async () => { approvals++; return accepted; });
    const response = await load('lib/adminResponse.ts').adminResponse('/api/admin/settings', { method: 'PUT', body: '{}' }, async () => {
      calls++; return calls === 1 ? Response.json({ code: 'ADMIN_REAUTH_REQUIRED' }, { status: 403 }) : Response.json({ success: true });
    });
    assert.equal(calls, accepted ? 2 : 1); assert.equal(approvals, 1); assert.equal(response.ok, accepted); unregister();
  }
});

test('fallback admin sessions are revocable with existing tables and reject legacy stateless cookies', async () => {
  const oldFlag = process.env.REMEDIATION_SCHEMA_ENABLED, oldSecret = process.env.ADMIN_SECRET_TOKEN;
  process.env.REMEDIATION_SCHEMA_ENABLED = 'false'; process.env.ADMIN_SECRET_TOKEN = 'fixture-admin-secret-more-than-32';
  try {
    const records = new Map(); let offline = false;
    const prisma = { setting: {
      create: async ({ data }) => records.set(data.key, data),
      findUnique: async ({ where }) => { if (offline) throw new Error('down'); return records.get(where.key); },
      deleteMany: async ({ where }) => records.delete(where.key),
    } };
    const load = createLoader({ './prisma': { prisma } }); const auth = load('lib/revocableAdminSession.ts');
    const token = await auth.issueAdminSession(); assert.equal(await auth.authenticateAdminToken(token), true);
    assert.equal(await auth.authenticateAdminToken(load('lib/adminSession.ts').createAdminSessionToken()), false);
    await auth.revokeAdminToken(token); assert.equal(await auth.authenticateAdminToken(token), false);
    offline = true; assert.equal(await auth.authenticateAdminToken(token), false);
  } finally {
    if (oldFlag === undefined) delete process.env.REMEDIATION_SCHEMA_ENABLED; else process.env.REMEDIATION_SCHEMA_ENABLED = oldFlag;
    if (oldSecret === undefined) delete process.env.ADMIN_SECRET_TOKEN; else process.env.ADMIN_SECRET_TOKEN = oldSecret;
  }
});

test('admin reauthentication requires the existing session, password and an unused second factor before granting freshness', async () => {
  const previous = process.env.ADMIN_PASSWORD; process.env.ADMIN_PASSWORD = 'FixturePassword1';
  let authenticated = false, fresh = 0, counter = 10;
  const settings = new Map([['admin_totp_enabled', 'true'], ['admin_totp_secret', 'encrypted-secret'], ['admin_totp_last_counter', '9']]);
  try {
    const { POST } = createLoader({
      '@/lib/adminAuth': { ADMIN_COOKIE_NAME: 'ADMIN_SECRET_TOKEN', readAdminSecret: () => 'fixture-secret-at-least-32-characters', isAdminAuthenticated: async () => authenticated },
      '@/lib/adminFreshness': { markAdminFresh: async token => { assert.equal(token, 'existing-session'); fresh++; } },
      '@/lib/rateLimit': limits,
      '@/lib/revocableAdminSession': { issueAdminSession: async () => { throw new Error('reauth must not create a new session'); } },
      '@/lib/crypto': { decrypt: () => 'fixture-totp-secret' },
      '@/lib/totp': { verifyTotpAndGetCounter: () => counter },
      'next/headers': { cookies: async () => ({ get: () => ({ value: 'existing-session' }) }) },
      '@/lib/prisma': { prisma: { $transaction: async callback => callback({
        $queryRaw: async () => [],
        setting: { findUnique: async ({ where }) => ({ value: settings.get(where.key) }), upsert: async ({ where, create }) => settings.set(where.key, create.value) },
      }) } },
    })('app/api/admin/auth/route.ts');
    const request = extra => json({ action: 'reauth', password: 'FixturePassword1', ...extra });
    assert.equal((await POST(request({}))).status, 401); assert.equal(fresh, 0);
    authenticated = true;
    assert.equal((await POST(request({ password: 'WrongPassword1' }))).status, 401); assert.equal(fresh, 0);
    assert.equal((await (await POST(request({}))).json()).needsTotp, true); assert.equal(fresh, 0);
    counter = null; assert.equal((await POST(request({ totp: '123456' }))).status, 401); assert.equal(fresh, 0);
    counter = 10; assert.equal((await POST(request({ totp: '123456' }))).status, 200); assert.equal(fresh, 1);
    assert.equal((await POST(request({ totp: '123456' }))).status, 401); assert.equal(fresh, 1);
  } finally { if (previous === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = previous; }
});
