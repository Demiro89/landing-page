const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { NextRequest } = require('next/server');
const { createLoader } = require('./load-ts.cjs');
const json = (body, path = '/api/test') => new Request(`http://localhost${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const noLimit = { enforceRateLimit: async () => null };

test('JSON parser rejects invalid media types, shapes, syntax and oversized actual streams', async () => {
  const { readJsonObject } = createLoader()('lib/requestJson.ts');
  for (const value of [null, [], 1, 'text']) assert.equal((await readJsonObject(json(value))).response.status, 400);
  assert.equal((await readJsonObject(new Request('http://localhost', { method: 'POST', body: '{}' }))).response.status, 415);
  assert.equal((await readJsonObject(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }))).response.status, 400);
  for (const length of [undefined, '2', '20000']) {
    const headers = { 'Content-Type': 'application/json' };
    if (length) headers['Content-Length'] = length;
    const request = new Request('http://localhost', { method: 'POST', headers, body: JSON.stringify({ text: 'x'.repeat(9000) }) });
    assert.equal((await readJsonObject(request)).response.status, 413);
  }
  assert.deepEqual((await readJsonObject(json({ email: 'test@example.test' }))).value, { email: 'test@example.test' });
});

test('all authentication JSON entrypoints reject null before credential or business writes', async () => {
  const old = process.env.SITE_ACCESS_CODE;
  process.env.SITE_ACCESS_CODE = 'fixture-code';
  try {
    for (const path of ['acces', 'admin/auth', 'client/register', 'client/login', 'client/forgot-password', 'client/reset-password', 'client/change-password', 'client/change-email', 'client/delete-account', 'client/cancel-order', 'checkout/manual', 'checkout/stripe', 'checkout/confirmation', 'retractation']) {
      const { POST } = createLoader({ '@/lib/rateLimit': noLimit, '@/lib/clientAuth': { getCurrentCustomer: async () => ({ id: 'fixture' }) } })(`app/api/${path}/route.ts`);
      assert.equal((await POST(json(null))).status, 400, path);
    }
  } finally { if (old === undefined) delete process.env.SITE_ACCESS_CODE; else process.env.SITE_ACCESS_CODE = old; }
});

test('email confirmation invalidates all old-mailbox login links in the ownership transaction', async () => {
  let changed;
  const customer = { id: 'customer', email: 'old@example.test', pendingEmail: 'new@example.test', emailChangeTokenExp: new Date(Date.now() + 60000) };
  const tx = { customer: { updateMany: async input => { changed = input.data; return { count: 1 }; } }, order: { updateMany: async () => ({ count: 0 }) } };
  const { GET } = createLoader({ '@/lib/prisma': { prisma: { customer: { findFirst: async () => customer, findUnique: async () => null }, $transaction: async callback => callback(tx) } } })('app/api/client/verify-email-change/route.ts');
  assert.match((await GET(new NextRequest(`http://localhost/api/client/verify-email-change?token=${'a'.repeat(64)}`))).headers.get('location'), /success/);
  for (const field of ['verificationToken', 'resetToken', 'resetTokenExp']) assert.equal(changed[field], null, field);
  assert.equal(changed.sessionVersion.increment, 1);
});

test('a reset request racing an email or password change cannot issue a new old-mailbox token', async () => {
  let sends = 0;
  const customer = { id: 'customer', email: 'old@example.test', passwordHash: 'hash', sessionVersion: 3 };
  const { POST } = createLoader({
    '@/lib/rateLimit': noLimit, '@/lib/clientAuth': { generateVerificationToken: () => 'b'.repeat(64) },
    '@/lib/nodemailer': { sendResetPasswordEmail: async () => { sends++; } },
    '@/lib/prisma': { prisma: { customer: { findUnique: async () => customer, updateMany: async input => {
      assert.deepEqual(input.where, customer); return { count: 0 };
    } } } },
  })('app/api/client/forgot-password/route.ts');
  assert.equal((await POST(json({ email: customer.email }))).status, 200);
  assert.equal(sends, 0);
});

test('signup verification claims only an unverified recent account and issues a session once', async () => {
  let used = false, sessions = 0;
  const { GET } = createLoader({
    '@/lib/clientAuth': { setSession: async (id, version) => { assert.equal(version, 4); sessions++; } },
    '@/lib/prisma': { prisma: {
      customer: { findFirst: async () => ({ id: 'customer' }) },
      $transaction: async callback => callback({ customer: {
        updateMany: async input => {
          assert.equal(input.where.emailVerified, false); assert.ok(input.where.createdAt.gt instanceof Date);
          assert.equal(input.data.sessionVersion.increment, 1); assert.equal(input.data.resetToken, null);
          if (used) return { count: 0 }; used = true; return { count: 1 };
        }, findUniqueOrThrow: async () => ({ sessionVersion: 4 }),
      } }),
    } },
  })('app/api/client/verify/route.ts');
  const request = () => new Request(`http://localhost/api/client/verify?token=${'c'.repeat(64)}`);
  assert.match((await GET(request())).headers.get('location'), /success/);
  assert.match((await GET(request())).headers.get('location'), /invalid/);
  assert.equal(sessions, 1);
});

test('account deletion requires the current password and a fresh session before detaching orders', async () => {
  let validPassword = false, changed = false, deletes = 0, detaches = 0, cleared = 0;
  const customer = { id: 'customer', passwordHash: 'hash', sessionVersion: 2 };
  const { POST } = createLoader({
    '@/lib/rateLimit': noLimit,
    '@/lib/clientAuth': { getCurrentCustomer: async () => customer, verifyPassword: () => validPassword, clearSession: async () => { cleared++; } },
    '@/lib/prisma': { prisma: { $transaction: async callback => callback({
      customer: { updateMany: async input => { assert.deepEqual(input.where, customer); return { count: changed ? 0 : 1 }; }, delete: async () => { deletes++; } },
      order: { updateMany: async () => { detaches++; } },
    }) } },
  })('app/api/client/delete-account/route.ts');
  assert.equal((await POST(json({ confirmation: 'supprimer' }))).status, 400);
  const request = () => json({ confirmation: 'supprimer', currentPassword: 'Password1' });
  assert.equal((await POST(request())).status, 401);
  validPassword = true; changed = true;
  assert.equal((await POST(request())).status, 409);
  assert.equal(detaches + deletes + cleared, 0);
  changed = false;
  assert.equal((await POST(request())).status, 200);
  assert.equal(detaches, 1); assert.equal(deletes, 1); assert.equal(cleared, 1);
});

test('failed login uses an atomic increment and decides lockout on the updated row', async () => {
  let locked = false;
  const customer = { id: 'customer', passwordHash: 'hash', sessionVersion: 2, loginAttempts: 0 };
  const { POST } = createLoader({
    '@/lib/rateLimit': noLimit, '@/lib/clientAuth': { verifyPassword: () => false },
    '@/lib/prisma': { prisma: { customer: { findUnique: async () => customer }, $transaction: async callback => callback({ customer: {
      updateMany: async input => { assert.deepEqual(input.data.loginAttempts, { increment: 1 }); assert.equal(input.where.sessionVersion, 2); return { count: 1 }; },
      findUniqueOrThrow: async () => ({ loginAttempts: 5 }),
      update: async input => { assert.ok(input.data.lockedUntil > new Date()); locked = true; },
    } }) } },
  })('app/api/client/login/route.ts');
  assert.equal((await POST(json({ email: 'test@example.test', password: 'WrongPassword1' }))).status, 401);
  assert.equal(locked, true);
});

test('client cookies reject noncanonical HMAC suffixes even when Buffer decoding would ignore them', async () => {
  process.env.CLIENT_SESSION_SECRET = 'fixture-client-secret-more-than-32';
  const payload = `customer.1.${Date.now() + 60000}`;
  const sig = crypto.createHmac('sha256', process.env.CLIENT_SESSION_SECRET).update(payload).digest('hex');
  let token = `${payload}.${sig}`;
  const { getCurrentCustomer } = createLoader({
    'next/headers': { cookies: async () => ({ get: () => ({ value: token }) }) },
    './prisma': { prisma: { customer: { findUnique: async () => ({ id: 'customer', emailVerified: true, sessionVersion: 1 }) } } },
  })('lib/clientAuth.ts');
  assert.ok(await getCurrentCustomer());
  for (const suffix of ['z', '00']) { token = `${payload}.${sig}${suffix}`; assert.equal(await getCurrentCustomer(), null); }
});

test('registration and failed login do not disclose whether an email is registered or locked', async () => {
  let exists = false, passwordChecks = 0;
  const responses = [];
  const { POST: register } = createLoader({
    '@/lib/rateLimit': noLimit, '@/lib/clientAuth': { hashPassword: () => 'fixture-hash', generateVerificationToken: () => 'f'.repeat(64) },
    '@/lib/nodemailer': { sendVerificationEmail: async () => {} },
    '@/lib/prisma': { prisma: { customer: { findUnique: async () => exists ? { id: 'customer' } : null, create: async () => ({ id: 'customer' }) } } },
  })('app/api/client/register/route.ts');
  for (const existing of [false, true]) { exists = existing; const response = await register(json({ email: 'test@example.test', password: 'Password1' })); responses.push([response.status, await response.json()]); }
  assert.deepEqual(responses[0], responses[1]);
  let account = null;
  const { POST: login } = createLoader({
    '@/lib/rateLimit': noLimit,
    '@/lib/clientAuth': { DUMMY_PASSWORD_HASH: 'dummy-hash', verifyPassword: (password, hash) => { assert.ok(hash); passwordChecks++; return false; } },
    '@/lib/prisma': { prisma: { customer: { findUnique: async () => account }, $transaction: async callback => callback({ customer: {
      updateMany: async () => ({ count: 1 }), findUniqueOrThrow: async () => ({ loginAttempts: 1 }),
    } }) } },
  })('app/api/client/login/route.ts');
  const failures = [];
  for (const current of [null, { id: 'customer', passwordHash: 'fixture', sessionVersion: 1 }, { id: 'customer', passwordHash: 'fixture', sessionVersion: 1, lockedUntil: new Date(Date.now() + 60000) }]) {
    account = current;
    const response = await login(json({ email: 'test@example.test', password: 'WrongPassword1' }));
    failures.push([response.status, await response.json()]);
  }
  assert.deepEqual(failures[0], failures[1]); assert.deepEqual(failures[0], failures[2]); assert.equal(passwordChecks, 3);
});

test('gate redirects, forbidden requests and token pages all carry CSP and private no-store', async () => {
  const old = process.env.SITE_ACCESS_CODE;
  const { proxy } = createLoader({ './lib/revocableAdminSession': { authenticateAdminToken: async () => false } })('proxy.ts');
  try {
    for (const [gate, url, method] of [[true, '/', 'GET'], [true, '/api/services', 'GET'], [false, '/admin/login-extra', 'GET'], [false, '/api/client/logout', 'POST'], [false, '/?reset=fixture', 'GET']]) {
      if (gate) process.env.SITE_ACCESS_CODE = 'fixture'; else delete process.env.SITE_ACCESS_CODE;
      const response = await proxy(new NextRequest(`https://localhost${url}`, { method }));
      assert.match(response.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
      assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
    }
  } finally { if (old === undefined) delete process.env.SITE_ACCESS_CODE; else process.env.SITE_ACCESS_CODE = old; }
});

test('CSV exports neutralize leading whitespace, LF and formula prefixes', async () => {
  for (const name of ['=1+1', '  =1+1', '\n=1+1', '\t@SUM(1)', '\r-1+1']) {
    const { GET } = createLoader({
      '@/lib/adminAuth': { isAdminAuthenticated: async () => true }, '@/lib/rateLimit': noLimit,
      '@/lib/prisma': { prisma: { order: { findMany: async () => [{ id: 'order', date: new Date(), service: { name }, clientEmail: 'fixture@example.test', status: 'active' }] } } },
    })('app/api/admin/export/route.ts');
    const response = await GET(new NextRequest('http://localhost/api/admin/export?type=orders'));
    assert.ok((await response.text()).includes(`'${name}`));
  }
});

test('chat writes require authentication before any order lookup', async () => {
  const { POST } = createLoader({ '@/lib/rateLimit': noLimit,
    '@/lib/adminAuth': { isAdminAuthenticated: async () => false }, '@/lib/clientAuth': { getCurrentCustomer: async () => null },
  })('app/api/chat/route.ts');
  assert.equal((await POST(json({ orderId: 'unknown', sender: 'client', text: 'hello' }))).status, 401);
});

test('admin bulk inventory and support queries no longer include credentials', async () => {
  const { GET } = createLoader({
    '@/lib/adminAuth': { isAdminAuthenticated: async () => true },
    '@/lib/crypto': { decrypt: () => { throw new Error('Bulk decryption forbidden'); } },
    '@/lib/prisma': { prisma: {
      service: { findMany: async () => [{ stocks: [{ details: 'secret-stock' }] }] },
      order: { findMany: async () => [{ status: 'pending', details: 'secret-order', stockAccount: { details: 'nested-secret' } }] },
      stockAccount: { findMany: async () => [] },
    } },
  })('app/api/admin/stock/route.ts');
  const response = await GET(); assert.equal(response.status, 200);
  assert.doesNotMatch(await response.text(), /secret/);
  const { GET: chats } = createLoader({
    '@/lib/adminAuth': { isAdminAuthenticated: async () => true },
    '@/lib/prisma': { prisma: { chatThread: { findMany: async query => {
      assert.deepEqual(query.include.order.select, { id: true, clientEmail: true, service: true }); return [];
    } } } },
  })('app/api/chat/route.ts');
  assert.equal((await chats(new Request('http://localhost/api/chat'))).status, 200);
});

test('on-demand credentials fail closed on auth, limiting or audit failure and return only one account', async () => {
  let authenticated = false, limited = false, auditFails = false, reads = 0, decrypts = 0;
  const { POST } = createLoader({
    '@/lib/adminAuth': { isAdminAuthenticated: async () => authenticated },
    '@/lib/rateLimit': { enforceRateLimit: async (...args) => { assert.equal(args[4], true); return limited ? Response.json({}, { status: 429 }) : null; } },
    '@/lib/crypto': { decrypt: () => { decrypts++; return 'fixture-secret'; } },
    '@/lib/auditLog': { clientIpFromRequest: () => 'unknown' },
    '@/lib/prisma': { prisma: {
      stockAccount: { findUnique: async input => { reads++; assert.equal(input.where.id, 'stock'); return { details: 'encrypted', updatedAt: new Date() }; } },
      auditLog: { create: async input => { assert.equal(input.data.action, 'stock.credentials_read'); assert.doesNotMatch(JSON.stringify(input), /encrypted|fixture-secret/); if (auditFails) throw new Error('offline'); } },
    } },
  })('app/api/admin/credentials/route.ts');
  const request = () => json({ stockId: 'stock' });
  assert.equal((await POST(request())).status, 401); assert.equal(reads, 0);
  authenticated = true; limited = true;
  assert.equal((await POST(request())).status, 429); assert.equal(reads, 0);
  limited = false; auditFails = true;
  assert.equal((await POST(request())).status, 503); assert.equal(decrypts, 0);
  auditFails = false;
  const response = await POST(request()); assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await response.json()).details, 'fixture-secret'); assert.equal(decrypts, 1);
});

test('cleanup rechecks verification and absence of orders in the delete itself', async () => {
  let predicate;
  const count = async () => ({ count: 0 });
  const { GET } = createLoader({
    '@/lib/cronAuth': { isCronAuthorized: () => true }, '@/lib/deliveryWorker': { runDeliveryJobs: async () => ({ enabled: false }) },
    '@/lib/commerce': { remediationSchemaEnabled: () => false },
    '@/lib/prisma': { prisma: {
      customer: { updateMany: count, deleteMany: async input => { predicate = input.where; return { count: 0 }; } },
      rateLimit: { deleteMany: count }, processedWebhookEvent: { deleteMany: count }, auditLog: { deleteMany: count },
    } },
  })('app/api/cron/cleanup/route.ts');
  assert.equal((await GET(new NextRequest('http://localhost/api/cron/cleanup'))).status, 200);
  assert.equal(predicate.emailVerified, false); assert.deepEqual(predicate.orders, { none: {} }); assert.ok(predicate.createdAt.lt instanceof Date);
});
