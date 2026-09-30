const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { NextRequest } = require('next/server');
const { createLoader } = require('./load-ts.cjs');

process.env.ADMIN_SECRET_TOKEN = 'test-admin-secret-with-more-than-32-characters';
process.env.CLIENT_SESSION_SECRET = 'test-client-secret-with-more-than-32-characters';
process.env.ENCRYPTION_KEY = 'test-encryption-key-with-more-than-32-characters';
const body = { serviceId: 'youtube', stockAccountId: 'test-stock', email: 'client@example.test', youtubeEmail: 'google@example.test', acceptedCgv: true, acceptedImmediateExecution: true, acceptedEligibility: true };
const request = (payload) => new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

test('checkout requires real booleans for every consent', () => {
  const { validateCheckout } = createLoader()('lib/checkoutValidation.ts');
  for (const key of ['acceptedCgv', 'acceptedImmediateExecution', 'acceptedEligibility']) {
    for (const value of [false, 'false', 'true', 1, null, undefined, {}, []]) assert.ok(validateCheckout({ ...body, [key]: value }).error);
  }
  assert.equal(validateCheckout(body).email, body.email);
});

test('checkout rejects malformed identities and HTML in emails', () => {
  const { validateCheckout } = createLoader()('lib/checkoutValidation.ts');
  for (const invalid of [null, [], {}, { ...body, email: {} }, { ...body, email: 'a<b@example.test' }, { ...body, email: 'a'.repeat(260) + '@example.test' }, { ...body, youtubeEmail: 'not-an-email' }, { ...body, serviceId: '../admin' }]) assert.ok(validateCheckout(invalid).error);
});

test('an explicit order owner overrides legacy email matching', () => {
  const { ownsOrder, canReadAccess } = createLoader()('lib/orderAccess.ts');
  const customer = { id: 'owner', email: 'client@example.test' };
  assert.equal(ownsOrder({ customerId: 'other', clientEmail: customer.email }, customer), false);
  assert.equal(ownsOrder({ customerId: null, clientEmail: customer.email.toUpperCase() }, customer), true);
  for (const status of ['pending', 'unpaid', 'cancelled']) assert.equal(canReadAccess(status), false);
  for (const status of ['active', 'cancelled_pending']) assert.equal(canReadAccess(status), true);
});

function legacyCipher(kdf) {
  const key = kdf === 'sha256' ? crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest() : crypto.scryptSync(process.env.ENCRYPTION_KEY, 'streammalin-enc-v1', 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update('legacy-access', 'utf8'), cipher.final()]);
  return `enc:v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${data.toString('hex')}`;
}

test('encryption reads both historical v1 key derivations and writes v2', () => {
  const { encrypt, decrypt, isEncrypted } = createLoader()('lib/crypto.ts');
  for (const kdf of ['sha256', 'scrypt']) assert.equal(decrypt(legacyCipher(kdf)), 'legacy-access');
  const encrypted = encrypt('new-access');
  assert.ok(encrypted.startsWith('enc:v2:'));
  assert.equal(decrypt(encrypted), 'new-access');
  assert.equal(encrypt(encrypted), encrypted);
  assert.equal(isEncrypted(legacyCipher('sha256')), true);
  assert.equal(decrypt('legacy plaintext'), 'legacy plaintext');
});

test('encryption refuses invalid or tampered ciphertext', () => {
  const { encrypt, decrypt } = createLoader()('lib/crypto.ts');
  const encrypted = encrypt('new-access');
  assert.throws(() => decrypt(encrypted.slice(0, -2) + '00'));
  assert.throws(() => decrypt('enc:v1:invalid'));
  assert.throws(() => encrypt('enc:v2:invalid'));
  assert.throws(() => decrypt('enc:v9:unsupported'));
});

test('signed admin tokens reject expiry, tampering and site-access tokens', () => {
  const load = createLoader();
  const { createAdminSessionToken, verifyAdminSessionToken } = load('lib/adminSession.ts');
  const { createSiteAccessToken } = load('lib/siteAccess.ts');
  assert.equal(verifyAdminSessionToken(createAdminSessionToken()), true);
  assert.equal(verifyAdminSessionToken(createSiteAccessToken()), false);
  assert.equal(verifyAdminSessionToken('0.' + crypto.createHmac('sha256', process.env.ADMIN_SECRET_TOKEN).update('0').digest('hex')), false);
  assert.equal(verifyAdminSessionToken(createAdminSessionToken() + 'bad'), false);
});

test('IP evidence ignores spoofable headers outside trusted deployments', () => {
  delete process.env.VERCEL;
  delete process.env.TRUSTED_PROXY_HEADERS;
  const { clientIp } = createLoader()('lib/clientIp.ts');
  const req = new Request('http://localhost', { headers: { 'x-real-ip': '192.0.2.7' } });
  assert.equal(clientIp(req), 'unknown');
  process.env.VERCEL = '1';
  assert.equal(clientIp(req), '192.0.2.7');
  assert.equal(clientIp(new Request('http://localhost', { headers: { 'x-real-ip': 'not-an-IP' } })), 'unknown');
  delete process.env.VERCEL;
});

test('the access gate allows only authenticated machine endpoints to reach handlers', () => {
  process.env.SITE_ACCESS_CODE = 'test-gate';
  const { proxy } = createLoader()('proxy.ts');
  for (const pathname of ['/api/stripe/webhook', '/api/cron/cleanup']) assert.equal(proxy(new NextRequest(`http://localhost${pathname}`, { method: 'GET' })).status, 200);
  for (const pathname of ['/api/services', '/api/stripe/webhook/other', '/api/acces/other']) assert.equal(proxy(new NextRequest(`http://localhost${pathname}`, { headers: { purpose: 'prefetch' } })).status, 403);
  assert.equal(proxy(new NextRequest('http://localhost/', { headers: { purpose: 'prefetch' } })).status, 307);
  delete process.env.SITE_ACCESS_CODE;
});

test('CSRF rejects missing, cross-site and downgrade origins; sensitive responses are not cached', () => {
  const { proxy } = createLoader()('proxy.ts');
  for (const origin of [undefined, 'https://attacker.test', 'http://localhost']) {
    const headers = origin ? { origin } : {};
    assert.equal(proxy(new NextRequest('https://localhost/api/client/logout', { method: 'POST', headers })).status, 403);
  }
  const safe = proxy(new NextRequest('https://localhost/api/client/logout', { method: 'POST', headers: { origin: 'https://localhost' } }));
  assert.equal(safe.status, 200);
  assert.match(safe.headers.get('cache-control'), /no-store/);
  assert.match(safe.headers.get('content-security-policy'), /api.coingecko.com/);
});

test('client sessions require a verified customer', async () => {
  let customer = { id: 'customer', emailVerified: false, sessionVersion: 0 };
  let cookie;
  const load = createLoader({
    'next/headers': { cookies: async () => ({ get: () => cookie && { value: cookie }, set: (_name, value) => { cookie = value; } }) },
    './prisma': { prisma: { customer: { findUnique: async () => customer } } },
  });
  const { getCurrentCustomer, setSession } = load('lib/clientAuth.ts');
  await setSession(customer.id, 0);
  assert.equal(await getCurrentCustomer(), null);
  customer.emailVerified = true;
  assert.equal((await getCurrentCustomer()).id, customer.id);
  customer.sessionVersion = 1;
  assert.equal(await getCurrentCustomer(), null);
});

test('client account and export do not return suspended access', async () => {
  const orders = ['active', 'cancelled_pending', 'unpaid', 'cancelled', 'pending'].map(status => ({ id: status, status, details: 'sensitive-access', service: { id: 'service', name: 'Service' }, chats: null }));
  const load = createLoader({
    '@/lib/prisma': { prisma: { order: { updateMany: async () => ({}), findMany: async () => orders } } },
    '@/lib/clientAuth': { getCurrentCustomer: async () => ({ id: 'customer', email: body.email }) },
    '@/lib/crypto': { decrypt: value => value },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
  });
  const me = await (await load('app/api/client/me/route.ts').GET()).json();
  const exported = await (await load('app/api/client/export-data/route.ts').GET(new Request('http://localhost'))).json();
  for (let i = 0; i < orders.length; i++) {
    const allowed = i < 2 ? 'sensitive-access' : '';
    assert.equal(me.orders[i].details, allowed);
    assert.equal(exported.orders[i].accessDetails, allowed);
  }
});

test('checkout blocks string consents before any business query', async () => {
  const load = createLoader({ '@/lib/prisma': { prisma: {} }, '@/lib/rateLimit': { enforceRateLimit: async () => null }, '@/lib/clientAuth': { getCurrentCustomer: async () => null } });
  for (const path of ['manual', 'stripe']) {
    const response = await load(`app/api/checkout/${path}/route.ts`).POST(request({ ...body, acceptedCgv: 'true', paymentMethod: 'paypal' }));
    assert.equal(response.status, 400);
  }
});

test('gateway and inactive-service checks fail closed', async () => {
  let enabled = false;
  const load = createLoader({
    '@/lib/prisma': { prisma: { service: { findUnique: async () => ({ active: false }) }, stockAccount: { findUnique: async () => ({ price: 3 }) } } },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/paymentSettings': { isGatewayEnabled: async () => enabled },
  });
  const { POST } = load('app/api/checkout/stripe/route.ts');
  assert.equal((await POST(request(body))).status, 503);
  enabled = true;
  assert.equal((await POST(request(body))).status, 404);
});

test('a guest checkout never borrows the logged-in customer for a different email', async () => {
  let created;
  const load = createLoader({
    '@/lib/prisma': { prisma: {
      setting: { findUnique: async () => ({ value: 'billing@example.test' }) },
      service: { findUnique: async () => ({ active: true, name: 'Service' }) },
      stockAccount: { findUnique: async () => ({ serviceId: body.serviceId, price: 3, maxSlots: 2, filledSlots: 0 }) },
      order: { create: async ({ data }) => { created = data; return { id: 'order' }; }, findFirst: async () => { throw new Error('guest must not reuse another order'); } },
    } },
    '@/lib/clientAuth': { getCurrentCustomer: async () => ({ id: 'other-account', email: 'other@example.test' }) },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/paymentSettings': { isGatewayEnabled: async () => true },
    '@/lib/telegram': { sendTelegramNotification: async () => {} },
  });
  assert.equal((await load('app/api/checkout/manual/route.ts').POST(request({ ...body, paymentMethod: 'paypal' }))).status, 200);
  assert.equal(created.customerId, null);
  assert.equal(created.details, '');
});

test('checkout refuses exhausted stock and non-positive prices before any payment', async () => {
  let stock = { serviceId: body.serviceId, maxSlots: 1, filledSlots: 1, price: 3 };
  const load = createLoader({
    '@/lib/prisma': { prisma: { service: { findUnique: async () => ({ active: true }) }, stockAccount: { findUnique: async () => stock }, setting: { findUnique: async () => ({ value: 'fixture@example.test' }) } } },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/paymentSettings': { isGatewayEnabled: async () => true },
  });
  for (const path of ['manual', 'stripe']) {
    assert.equal((await load(`app/api/checkout/${path}/route.ts`).POST(request({ ...body, paymentMethod: 'paypal' }))).status, 400);
  }
  stock = { ...stock, filledSlots: 0, price: 0 };
  for (const path of ['manual', 'stripe']) {
    assert.equal((await load(`app/api/checkout/${path}/route.ts`).POST(request({ ...body, paymentMethod: 'paypal' }))).status, 409);
  }
});

test('client support responses omit access details and reject another explicit owner', async () => {
  const customer = { id: 'owner', email: body.email };
  const order = { id: 'order', customerId: 'owner', clientEmail: body.email, details: 'encrypted-secret', service: { name: 'Service' } };
  const { GET } = createLoader({
    '@/lib/prisma': { prisma: { chatThread: { findUnique: async () => ({ id: 'chat', order, messages: [] }) } } },
    '@/lib/adminAuth': { isAdminAuthenticated: async () => false },
    '@/lib/clientAuth': { getCurrentCustomer: async () => customer },
  })('app/api/chat/route.ts');
  const req = new Request('http://localhost/api/chat?orderId=order');
  const history = await (await GET(req)).json();
  assert.equal(history.thread.order.details, undefined);
  assert.equal(JSON.stringify(history).includes('encrypted-secret'), false);
  order.customerId = 'another-owner';
  assert.equal((await GET(req)).status, 403);
});

test('2FA rejects replacement of an active factor and forged setup secrets', async () => {
  const settings = new Map([['admin_totp_enabled', 'true']]);
  const tx = { $queryRaw: async () => [], setting: { findUnique: async ({ where }) => settings.has(where.key) ? { value: settings.get(where.key) } : null, upsert: async ({ where, create }) => { settings.set(where.key, create.value); } } };
  const load = createLoader({
    '@/lib/prisma': { prisma: { $transaction: async callback => callback(tx) } },
    '@/lib/adminAuth': { isAdminAuthenticated: async () => true },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/auditLog': { writeAuditLog: async () => {}, clientIpFromRequest: () => 'unknown' },
    '@/lib/totp': { generateTotpSecret: () => 'server-secret', totpUri: () => 'otpauth://test', verifyTotpAndGetCounter: () => 100 },
    '@/lib/crypto': { encrypt: value => value, decrypt: value => value },
  });
  const { POST } = load('app/api/admin/2fa/route.ts');
  assert.equal((await POST(request({ action: 'setup' }))).status, 409);
  assert.equal((await POST(request({ action: 'enable', secret: 'attacker-secret', token: '123456' }))).status, 409);
  settings.set('admin_totp_enabled', 'false');
  assert.equal((await POST(request({ action: 'enable', secret: 'attacker-secret', token: '123456' }))).status, 400);
  await POST(request({ action: 'setup' }));
  assert.equal((await POST(request({ action: 'enable', secret: 'attacker-secret', token: '123456' }))).status, 400);
  assert.equal((await POST(request({ action: 'enable', secret: 'server-secret', token: '123456' }))).status, 200);
  assert.equal(settings.get('admin_totp_pending_secret'), '');
  assert.equal((await POST(request({ action: 'disable', token: '123456' }))).status, 400);
});

test('rate limit increments use a single parameterized PostgreSQL statement', async () => {
  let sql;
  let values;
  const { enforceRateLimit } = createLoader({ './prisma': { prisma: { $queryRaw: async (strings, ...args) => { sql = strings.join('?'); values = args; return [{ count: 11, windowEnd: new Date(Date.now() + 60000) }]; } } } })('lib/rateLimit.ts');
  const response = await enforceRateLimit(new Request('http://localhost'), 'login', 10, 60, true);
  assert.equal(response.status, 429);
  assert.match(sql, /ON CONFLICT/);
  assert.ok(values.includes('login:unknown'));
  assert.ok(response.headers.get('retry-after'));
});

test('activation claims the pending order before taking a slot; duplicate claim fails', async () => {
  const { activatePendingOrder, OrderConflictError } = createLoader()('lib/orderLifecycle.ts');
  const calls = [];
  let status = 'pending';
  const tx = {
    order: {
      updateMany: async ({ where, data }) => { calls.push('claim'); const matched = status === where.status; if (matched) status = data.status; return { count: Number(matched) }; },
      findUniqueOrThrow: async () => ({ stockAccountId: 'stock' }),
      update: async () => {},
    },
    stockAccount: { fields: { maxSlots: 'field-reference' }, updateMany: async ({ where }) => { calls.push('slot'); assert.equal(where.filledSlots.lt, 'field-reference'); return { count: 1 }; }, findUniqueOrThrow: async () => ({ details: 'encrypted' }) },
  };
  assert.equal(await activatePendingOrder(tx, 'order'), 'encrypted');
  await assert.rejects(activatePendingOrder(tx, 'order'), OrderConflictError);
  assert.deepEqual(calls, ['claim', 'slot', 'claim']);
});

test('webhook marker and business changes share one transaction', async () => {
  const calls = [];
  const tx = { processedWebhookEvent: { create: async () => calls.push('marker') } };
  const { processWebhookEvent } = createLoader({ './prisma': { prisma: { $transaction: async callback => { calls.push('begin'); const result = await callback(tx); calls.push('commit'); return result; } } } })('lib/webhookTransaction.ts');
  await processWebhookEvent({ id: 'event', type: 'checkout.session.completed' }, async client => { assert.equal(client, tx); calls.push('business'); });
  assert.deepEqual(calls, ['begin', 'marker', 'business', 'commit']);
});

test('email HTML is escaped and missing configuration logs no access or tokens', async () => {
  const { escapeHtml } = createLoader()('lib/html.ts');
  assert.equal(escapeHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  delete process.env.RESEND_API_KEY;
  const logs = [];
  const warn = console.warn;
  console.warn = value => logs.push(value);
  try {
    const email = createLoader()('lib/nodemailer.ts');
    await email.sendOrderDetailsEmail('private@example.test', 'Service', 'sensitive-credential', 'order');
    await email.sendResetPasswordEmail('private@example.test', 'sensitive-token');
  } finally { console.warn = warn; }
  assert.equal(logs.some(value => /private|sensitive/.test(value)), false);
});
