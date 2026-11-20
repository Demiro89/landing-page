const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { NextRequest } = require('next/server');
const { createLoader } = require('./load-ts.cjs');

process.env.ADMIN_SECRET_TOKEN = 'test-admin-secret-with-more-than-32-characters';
process.env.CLIENT_SESSION_SECRET = 'test-client-secret-with-more-than-32-characters';
process.env.ENCRYPTION_KEY = 'test-encryption-key-with-more-than-32-characters';
const body = { serviceId: 'youtube', stockAccountId: 'test-stock', amountMinor: 300, email: 'client@example.test', youtubeEmail: 'google@example.test', acceptedCgv: true, acceptedImmediateExecution: true, acceptedEligibility: true, termsVersion: '2026-10-07.1', attemptId: '12345678-1234-4234-8234-123456789012' };
const allowedCommerce = { assertOfferSaleAllowed: async () => {}, CommerceUnavailableError: class extends Error {} };
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
  const previous = process.env.SITE_ACCESS_CODE;
  process.env.SITE_ACCESS_CODE = 'fixture-gate';
  try {
    const siteToken = createSiteAccessToken();
    assert.ok(siteToken);
    assert.equal(verifyAdminSessionToken(siteToken), false);
  } finally {
    if (previous === undefined) delete process.env.SITE_ACCESS_CODE; else process.env.SITE_ACCESS_CODE = previous;
  }
  assert.equal(verifyAdminSessionToken('0.' + crypto.createHmac('sha256', process.env.ADMIN_SECRET_TOKEN).update('0').digest('hex')), false);
  assert.equal(verifyAdminSessionToken(createAdminSessionToken() + 'bad'), false);
});

test('changing the access code invalidates old cookies and protected pages are not cached', async (t) => {
  const previous = process.env.SITE_ACCESS_CODE;
  t.after(() => { if (previous === undefined) delete process.env.SITE_ACCESS_CODE; else process.env.SITE_ACCESS_CODE = previous; });
  process.env.SITE_ACCESS_CODE = 'fixture-gate';
  const load = createLoader();
  const { createSiteAccessToken, verifySiteAccessToken } = load('lib/siteAccess.ts');
  const { proxy } = load('proxy.ts');
  const token = createSiteAccessToken();
  assert.equal(verifySiteAccessToken(token), true);
  const response = await proxy(new NextRequest('http://localhost/', { headers: { cookie: `SITE_ACCESS=${token}` } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  process.env.SITE_ACCESS_CODE = 'fixture-gate-rotated';
  assert.equal(verifySiteAccessToken(token), false);
  assert.equal(verifySiteAccessToken(createSiteAccessToken()), true);
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

test('the access gate allows authenticated machine endpoints and public legal pages', async () => {
  process.env.SITE_ACCESS_CODE = 'test-gate';
  const { proxy } = createLoader()('proxy.ts');
  for (const pathname of ['/api/stripe/webhook', '/api/cron/cleanup', '/api/cron/deliveries', '/cgv', '/retractation']) assert.equal((await proxy(new NextRequest(`http://localhost${pathname}`, { method: 'GET' }))).status, 200);
  for (const pathname of ['/api/services', '/api/stripe/webhook/other', '/api/acces/other']) assert.equal((await proxy(new NextRequest(`http://localhost${pathname}`, { headers: { purpose: 'prefetch' } }))).status, 403);
  assert.equal((await proxy(new NextRequest('http://localhost/', { headers: { purpose: 'prefetch' } }))).status, 307);
  delete process.env.SITE_ACCESS_CODE;
});

test('CSRF rejects missing, cross-site and downgrade origins; sensitive responses are not cached', async () => {
  const { proxy } = createLoader()('proxy.ts');
  for (const origin of [undefined, 'https://attacker.test', 'http://localhost']) {
    const headers = origin ? { origin } : {};
    assert.equal((await proxy(new NextRequest('https://localhost/api/client/logout', { method: 'POST', headers }))).status, 403);
  }
  const safe = await proxy(new NextRequest('https://localhost/api/client/logout', { method: 'POST', headers: { origin: 'https://localhost' } }));
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

test('client account and export omit expired access; account responses omit internal fields', async () => {
  const orders = ['active', 'cancelled_pending', 'unpaid', 'cancelled', 'pending', 'cancelled_pending'].map((status, index) => ({
    id: String(index), status, details: 'sensitive-access', service: { id: 'service', name: 'Service' }, chats: null,
    cancellationEffectiveAt: index === 5 ? new Date(0) : null, stripeSubscriptionId: 'fixture-subscription',
    stripeCustomerId: 'fixture-provider-customer', acceptanceIp: '192.0.2.7', acceptanceUserAgent: 'fixture-browser', stockAccountId: 'fixture-stock',
  }));
  const load = createLoader({
    '@/lib/prisma': { prisma: { order: { updateMany: async () => ({}), findMany: async () => orders }, setting: { findMany: async () => [] } } },
    '@/lib/clientAuth': { getCurrentCustomer: async () => ({ id: 'customer', email: body.email }) },
    '@/lib/crypto': { decrypt: value => value },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
  });
  const me = await (await load('app/api/client/me/route.ts').GET(new Request('http://localhost/api/client/me'))).json();
  const accountOrders = await (await load('app/api/client/orders/route.ts').GET()).json();
  const exported = await (await load('app/api/client/export-data/route.ts').GET(new Request('http://localhost'))).json();
  for (let i = 0; i < orders.length; i++) {
    const allowed = i < 2 ? 'sensitive-access' : '';
    assert.equal(me.orders[i].details, allowed);
    assert.equal(accountOrders.orders[i].details, allowed);
    assert.equal(exported.orders[i].accessDetails, allowed);
    for (const order of [me.orders[i], accountOrders.orders[i]]) {
      assert.equal(order.stripeManaged, true);
      for (const key of ['stripeSubscriptionId', 'stripeCustomerId', 'acceptanceIp', 'acceptanceUserAgent', 'stockAccountId']) assert.equal(Object.hasOwn(order, key), false, key);
    }
  }
});

test('checkout profile never fetches or writes order records', async () => {
  const { GET } = createLoader({
    '@/lib/prisma': { prisma: {} },
    '@/lib/clientAuth': { getCurrentCustomer: async () => ({ id: 'customer', email: body.email, emailVerified: true, passwordHash: 'not-for-client' }) },
  })('app/api/client/me/route.ts');
  const response = await GET(new Request('http://localhost/api/client/me?profile=1'));
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await response.json(), { authenticated: true, customer: { id: 'customer', email: body.email, emailVerified: true } });
});

test('client logout revokes existing sessions through the account version', async () => {
  const customer = { id: 'fixture', emailVerified: true, sessionVersion: 2 };
  let cookie;
  const prisma = { customer: {
    findUnique: async () => customer,
    updateMany: async ({ where, data }) => {
      assert.equal(where.id, customer.id);
      assert.equal(where.sessionVersion, customer.sessionVersion);
      customer.sessionVersion += data.sessionVersion.increment;
      return { count: 1 };
    },
  } };
  const load = createLoader({
    'next/headers': { cookies: async () => ({ get: () => cookie && { value: cookie }, set: (_name, value) => { cookie = value; }, delete: () => { cookie = undefined; } }) },
    './prisma': { prisma }, '@/lib/prisma': { prisma },
  });
  const { setSession, getCurrentCustomer } = load('lib/clientAuth.ts');
  await setSession(customer.id, customer.sessionVersion);
  const priorSession = cookie;
  assert.equal((await load('app/api/client/logout/route.ts').POST()).status, 200);
  assert.equal(cookie, undefined);
  cookie = priorSession;
  assert.equal(await getCurrentCustomer(), null);
});

test('public checkout settings show availability without revealing recipients', async (t) => {
  const old = process.env.MANUAL_PAYMENTS_ENABLED;
  t.after(() => { if (old === undefined) delete process.env.MANUAL_PAYMENTS_ENABLED; else process.env.MANUAL_PAYMENTS_ENABLED = old; });
  const values = { gateway_cb: 'true', gateway_paypal: 'true', gateway_crypto: 'true', paypal_email: 'recipient@example.test', crypto_ltc: 'fixture-wallet', admin_totp_secret: 'fixture-otp' };
  const { GET } = createLoader({
    '@/lib/commerce': { commerceEnabled: () => true },
    '@/lib/prisma': { prisma: { setting: { findMany: async () => Object.entries(values).map(([key, value]) => ({ key, value })) } } },
  })('app/api/settings/public/route.ts');
  process.env.MANUAL_PAYMENTS_ENABLED = 'true';
  assert.deepEqual((await (await GET()).json()).settings, { gateway_cb: 'true', gateway_paypal: 'true', gateway_crypto: 'true', crypto_coins: ['ltc'] });
  process.env.MANUAL_PAYMENTS_ENABLED = 'false';
  assert.deepEqual((await (await GET()).json()).settings, { gateway_cb: 'true', gateway_paypal: 'false', gateway_crypto: 'false', crypto_coins: [] });
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
  const oldKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = 'sk_test_fixture';
  const tx = { $queryRaw: async () => [], stockAccount: { findUniqueOrThrow: async () => ({ id: body.stockAccountId, serviceId: body.serviceId, price: 3, filledSlots: 0, maxSlots: 2, service: { active: false } }) }, stockReservation: { findUnique: async () => null } };
  const load = createLoader({
    '@/lib/prisma': { prisma: {} },
    './prisma': { prisma: { $transaction: callback => callback(tx) } },
    '@/lib/commerce': allowedCommerce,
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/paymentSettings': { isGatewayEnabled: async () => enabled },
    '@/lib/clientAuth': { getCurrentCustomer: async () => null },
  });
  const { POST } = load('app/api/checkout/stripe/route.ts');
  assert.equal((await POST(request(body))).status, 503);
  enabled = true;
  assert.equal((await POST(request(body))).status, 409);
  if (oldKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = oldKey;
});

test('a guest checkout never borrows the logged-in customer for a different email', async () => {
  let created;
  let notification;
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
    '@/lib/telegram': { sendTelegramNotification: async message => { notification = message; } },
    '@/lib/commerce': allowedCommerce,
    '@/lib/checkoutReservation': { reserveCheckout: async (_id, data, amountMinor) => { assert.equal(amountMinor, 300); created = data; return { order: { id: 'order' }, reservation: { expiresAt: new Date() } }; } },
  });
  const response = await load('app/api/checkout/manual/route.ts').POST(request({ ...body, paymentMethod: 'paypal' }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await response.json()).destination, 'billing@example.test');
  assert.doesNotMatch(notification, /@example\.test/);
  assert.equal(created.customerId, null);
  assert.equal(created.details, '');
});

test('checkout refuses exhausted stock and non-positive prices before any payment', async () => {
  let stock = { serviceId: body.serviceId, maxSlots: 1, filledSlots: 1, price: 3 };
  const oldKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = 'sk_test_fixture';
  const tx = { $queryRaw: async () => [], stockAccount: { findUniqueOrThrow: async () => ({ ...stock, id: body.stockAccountId, service: { active: true } }) }, stockReservation: { findUnique: async () => null, count: async () => 0 } };
  const load = createLoader({
    '@/lib/prisma': { prisma: { service: { findUnique: async () => ({ active: true }) }, stockAccount: { findUnique: async () => stock }, setting: { findUnique: async () => ({ value: 'fixture@example.test' }) } } },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/paymentSettings': { isGatewayEnabled: async () => true },
    '@/lib/commerce': allowedCommerce,
    '@/lib/clientAuth': { getCurrentCustomer: async () => null },
    './prisma': { prisma: { $transaction: callback => callback(tx) } },
  });
  for (const path of ['manual', 'stripe']) {
    const response = await load(`app/api/checkout/${path}/route.ts`).POST(request({ ...body, paymentMethod: 'paypal' }));
    assert.equal(response.status, path === 'manual' ? 400 : 409);
    assert.equal(Object.hasOwn(await response.json(), 'destination'), false);
  }
  stock = { ...stock, filledSlots: 0, price: 0 };
  for (const path of ['manual', 'stripe']) {
    assert.equal((await load(`app/api/checkout/${path}/route.ts`).POST(request({ ...body, paymentMethod: 'paypal' }))).status, 409);
  }
  if (oldKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = oldKey;
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
  assert.equal((await GET(req)).status, 404);
});

test('2FA rejects replacement of an active factor and forged setup secrets', async () => {
  const settings = new Map([['admin_totp_enabled', 'true']]);
  const tx = { $queryRaw: async () => [], setting: { findUnique: async ({ where }) => settings.has(where.key) ? { value: settings.get(where.key) } : null, upsert: async ({ where, create }) => { settings.set(where.key, create.value); } } };
  const load = createLoader({
    '@/lib/adminFreshness': { requireRecentAdmin: async () => null },
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

(() => {
  const secTest = require('node:test');
  const secAssert = require('node:assert/strict');
  const { NextResponse } = require('next/server');
  const { createLoader: createSecLoader } = require('./load-ts.cjs');

  secTest('checkout/stripe validates amountMinor, binds matching customerId, and releases short uncreated reservations', async () => {
    const prevKey = process.env.STRIPE_SECRET_KEY;
    const reserveCalls = [];
    const releasedUpdates = [];
    let currentCustomer = { id: 'cust_match', email: 'client@example.test' };
    let nextReserveResult = null;
    try {
      process.env.STRIPE_SECRET_KEY = 'sk_test_valid_dummy';
      const { POST } = createSecLoader({
        '@/lib/rateLimit': { enforceRateLimit: async () => null },
        '@/lib/commerce': {
          CommerceUnavailableError: class extends Error {},
          assertOfferSaleAllowed: async () => {},
        },
        '@/lib/paymentSettings': { isGatewayEnabled: async () => true },
        '@/lib/clientAuth': { getCurrentCustomer: async () => currentCustomer },
        '@/lib/checkoutReservation': {
          reserveCheckout: async (attemptId, data, expectedAmountMinor) => {
            reserveCalls.push({ attemptId, data, expectedAmountMinor });
            return nextReserveResult;
          },
        },
        '@/lib/prisma': {
          prisma: {
            stockReservation: {
              updateMany: async args => { releasedUpdates.push(args); return { count: 1 }; },
              update: async () => ({}),
            },
          },
        },
        stripe: class MockStripe {},
      })('app/api/checkout/stripe/route.ts');

      const basePayload = {
        serviceId: 'youtube',
        stockAccountId: 'stk_1',
        amountMinor: 300,
        email: 'client@example.test',
        youtubeEmail: 'google@example.test',
        acceptedCgv: true,
        acceptedImmediateExecution: true,
        acceptedEligibility: true,
        termsVersion: '2026-10-07.1',
        attemptId: '12345678-1234-4234-8234-123456789012',
      };

      const badAmount = await POST(new Request('http://localhost/api/checkout/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...basePayload, amountMinor: -5 }),
      }));
      secAssert.equal(badAmount.status, 400);
      secAssert.equal(reserveCalls.length, 0);

      nextReserveResult = {
        reservation: { id: basePayload.attemptId, checkoutSessionId: null, expiresAt: new Date(Date.now() + 10 * 60_000) },
        order: { id: 'ord_1', price: 3 },
        stock: { service: { name: 'YouTube' } },
      };
      const expiredRes = await POST(new Request('http://localhost/api/checkout/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basePayload),
      }));
      secAssert.equal(expiredRes.status, 409);
      secAssert.equal(reserveCalls.length, 1);
      secAssert.equal(reserveCalls[0].expectedAmountMinor, 300);
      secAssert.equal(reserveCalls[0].data.customerId, 'cust_match');
      secAssert.equal(releasedUpdates.length, 1);
      secAssert.deepEqual(releasedUpdates[0].data, { status: 'released' });

      currentCustomer = { id: 'cust_other', email: 'other@example.test' };
      const mismatchRes = await POST(new Request('http://localhost/api/checkout/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basePayload),
      }));
      secAssert.equal(mismatchRes.status, 409);
      secAssert.equal(reserveCalls[1].data.customerId, null);
    } finally {
      if (prevKey === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = prevKey;
    }

    const { AvailabilityError, reserveCheckout } = createSecLoader({
      './prisma': {
        prisma: {
          $transaction: async cb => cb({
            stockAccount: { findUniqueOrThrow: async () => ({ id: 'stk_1', serviceId: 'youtube', price: 4.5, maxSlots: 4, filledSlots: 0, service: { active: true } }) },
            $queryRaw: async () => [],
          }),
        },
      },
      './crypto': { encrypt: v => v },
    })('lib/checkoutReservation.ts');
    await secAssert.rejects(
      () => reserveCheckout('12345678-1234-4234-8234-123456789012', { stockAccountId: 'stk_1', serviceId: 'youtube' }, 300),
      AvailabilityError,
    );
  });

  secTest('checkout/manual skips duplicate Telegram alerts when reservation already exists', async () => {
    let telegramCalls = 0;
    let createdFlag = false;
    const { POST } = createSecLoader({
      '@/lib/rateLimit': { enforceRateLimit: async () => null },
      '@/lib/commerce': { CommerceUnavailableError: class extends Error {}, assertOfferSaleAllowed: async () => {} },
      '@/lib/paymentSettings': { isGatewayEnabled: async () => true },
      '@/lib/clientAuth': { getCurrentCustomer: async () => null },
      '@/lib/telegram': { sendTelegramNotification: async () => { telegramCalls++; return true; } },
      '@/lib/checkoutReservation': {
        reserveCheckout: async () => ({
          created: createdFlag,
          reservation: { id: 'att', expiresAt: new Date(Date.now() + 3600_000) },
          order: { id: 'ord_manual_1' },
        }),
      },
      '@/lib/prisma': {
        prisma: {
          setting: { findUnique: async () => ({ value: 'paypal@example.test' }) },
          service: { findUnique: async () => ({ id: 'youtube', active: true }) },
          stockAccount: { findUnique: async () => ({ id: 'stk_1', serviceId: 'youtube', price: 3, maxSlots: 4, filledSlots: 0 }) },
        },
      },
    })('app/api/checkout/manual/route.ts');

    const req = () => new Request('http://localhost/api/checkout/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: 'youtube',
        stockAccountId: 'stk_1',
        paymentMethod: 'paypal',
        amountMinor: 300,
        email: 'client@example.test',
        youtubeEmail: 'google@example.test',
        acceptedCgv: true,
        acceptedImmediateExecution: true,
        acceptedEligibility: true,
        termsVersion: '2026-10-07.1',
        attemptId: '12345678-1234-4234-8234-123456789012',
      }),
    });

    const dupRes = await POST(req());
    secAssert.equal(dupRes.status, 200);
    secAssert.equal(telegramCalls, 0);

    createdFlag = true;
    const freshRes = await POST(req());
    secAssert.equal(freshRes.status, 200);
    secAssert.equal(telegramCalls, 1);
  });

  secTest('stripe/webhook customer.subscription.updated syncs portal cancel_at_period_end and reactivation', async () => {
    const prevKey = process.env.STRIPE_SECRET_KEY;
    const prevSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let nextEvent = null;
    const updateManyCalls = [];
    try {
      process.env.STRIPE_SECRET_KEY = 'sk_test_webhook_dummy';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy';
      const { POST } = createSecLoader({
        '@/lib/prisma': {
          prisma: {
            processedWebhookEvent: {
              findUnique: async () => null,
              upsert: async () => ({}),
            },
          },
        },
        '@/lib/webhookTransaction': {
          processWebhookEvent: async (_event, fn) => fn({
            order: {
              updateMany: async args => { updateManyCalls.push(args); return { count: 1 }; },
            },
          }),
        },
        stripe: class MockStripe {
          constructor() {
            this.webhooks = { constructEvent: () => nextEvent };
            this.paymentMethods = { retrieve: async () => null };
          }
        },
      })('app/api/stripe/webhook/route.ts');

      const makeReq = () => new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'sig_test' },
        body: '{}',
      });

      nextEvent = {
        id: 'evt_cancel_pending',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'active',
            cancel_at_period_end: true,
            default_payment_method: null,
            items: { data: [{ current_period_end: 1800000000 }] },
          },
        },
      };
      const resCancel = await POST(makeReq());
      secAssert.equal(resCancel.status, 200);
      secAssert.ok(updateManyCalls.some(c => c.where.status === 'active' && c.data.status === 'cancelled_pending'));

      updateManyCalls.length = 0;
      nextEvent = {
        id: 'evt_reactivate',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'active',
            cancel_at_period_end: false,
            default_payment_method: null,
            items: { data: [{ current_period_end: 1800000000 }] },
          },
        },
      };
      const resReactivate = await POST(makeReq());
      secAssert.equal(resReactivate.status, 200);
      secAssert.ok(updateManyCalls.some(c => c.where.status === 'cancelled_pending' && c.data.status === 'active' && c.data.cancellationEffectiveAt === null));
    } finally {
      if (prevKey === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = prevKey;
      if (prevSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = prevSecret;
    }
  });

  secTest('client/billing-portal and migrate-to-subscription enforce rate limits and fail closed without STRIPE_SECRET_KEY', async () => {
    const prevKey = process.env.STRIPE_SECRET_KEY;
    const prevCommerce = process.env.COMMERCE_ENABLED;
    const prevSchema = process.env.REMEDIATION_SCHEMA_ENABLED;
    const prevMig = process.env.LEGACY_SUBSCRIPTION_MIGRATION_ENABLED;
    try {
      delete process.env.STRIPE_SECRET_KEY;
      process.env.COMMERCE_ENABLED = 'true';
      process.env.REMEDIATION_SCHEMA_ENABLED = 'true';
      process.env.LEGACY_SUBSCRIPTION_MIGRATION_ENABLED = 'true';

      let allowLimit = false;
      const rateMock = {
        enforceRateLimit: async () => allowLimit ? null : NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 }),
      };

      const { POST: portalPost } = createSecLoader({
        '@/lib/rateLimit': rateMock,
        '@/lib/clientAuth': { getCurrentCustomer: async () => ({ id: 'c1', email: 'c@example.test', stripeCustomerId: 'cus_1' }) },
        '@/lib/prisma': { prisma: {} },
        stripe: class MockStripe {},
      })('app/api/client/billing-portal/route.ts');

      const portal429 = await portalPost(new Request('http://localhost/api/client/billing-portal', { method: 'POST' }));
      secAssert.equal(portal429.status, 429);

      const { POST: migratePost } = createSecLoader({
        '@/lib/rateLimit': rateMock,
        '@/lib/clientAuth': { getCurrentCustomer: async () => ({ id: 'c1', email: 'c@example.test' }) },
        '@/lib/prisma': { prisma: {} },
        stripe: class MockStripe {},
      })('app/api/client/migrate-to-subscription/route.ts');

      const mig429 = await migratePost(new Request('http://localhost/api/client/migrate-to-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: 'ord_1' }),
      }));
      secAssert.equal(mig429.status, 429);

      allowLimit = true;
      const mig503 = await migratePost(new Request('http://localhost/api/client/migrate-to-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: 'ord_1' }),
      }));
      secAssert.equal(mig503.status, 503);
    } finally {
      if (prevKey === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = prevKey;
      if (prevCommerce === undefined) delete process.env.COMMERCE_ENABLED;
      else process.env.COMMERCE_ENABLED = prevCommerce;
      if (prevSchema === undefined) delete process.env.REMEDIATION_SCHEMA_ENABLED;
      else process.env.REMEDIATION_SCHEMA_ENABLED = prevSchema;
      if (prevMig === undefined) delete process.env.LEGACY_SUBSCRIPTION_MIGRATION_ENABLED;
      else process.env.LEGACY_SUBSCRIPTION_MIGRATION_ENABLED = prevMig;
    }
  });
})();
