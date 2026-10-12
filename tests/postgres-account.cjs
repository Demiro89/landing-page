const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { NextRequest } = require('next/server');
const { createLoader } = require('./load-ts.cjs');

const connection = process.env.TEST_DATABASE_URL;
if (!connection) throw new Error('TEST_DATABASE_URL is required');
const address = new URL(connection);
if (!['localhost', '127.0.0.1', 'postgres'].includes(address.hostname) || !address.pathname.endsWith('_test')) throw new Error('Refusing a non-local/non-test database');
const db = new PrismaClient({ datasources: { db: { url: connection } }, log: [] });
const emails = [], sessionKeys = [], auditSince = new Date();
const freshEmail = () => { const email = `account-${crypto.randomUUID()}@example.test`; emails.push(email); return email; };
const json = body => new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const base = { '@/lib/prisma': { prisma: db }, './prisma': { prisma: db }, '@/lib/rateLimit': { enforceRateLimit: async () => null, enforceKeyRateLimit: async () => null } };
process.env.CLIENT_SESSION_SECRET = 'postgres-client-fixture-secret-for-tests';

test.after(async () => {
  await db.customer.deleteMany({ where: { email: { in: emails } } });
  await db.setting.deleteMany({ where: { key: { in: sessionKeys } } });
  await db.auditLog.deleteMany({ where: { action: 'admin.sessions_revoke', createdAt: { gte: auditSince } } });
  await db.$disconnect();
});

test('PostgreSQL: signup, confirmation, reset, email change and login work with hashed links and revoked old sessions', async () => {
  const email = freshEmail(), newEmail = freshEmail(), mail = [], jar = new Map();
  const load = createLoader({ ...base,
    'next/headers': { cookies: async () => ({ get: key => jar.get(key), set: (key, value) => jar.set(key, { value }), delete: key => jar.delete(key) }) },
    '@/lib/accountEmail': {
      scheduleAccountEmail: (kind, to, token) => mail.push({ kind, to, token }),
      deliverAccountEmail: async (kind, to, token) => { mail.push({ kind, to, token }); return true; },
    },
  });
  const auth = load('lib/clientAuth.ts'); const tokens = load('lib/accountTokens.ts');
  assert.equal((await load('app/api/client/register/route.ts').POST(json({ email, password: 'FixturePassword1' }))).status, 200);
  const signup = mail.at(-1); let row = await db.customer.findUniqueOrThrow({ where: { email } });
  assert.equal(row.verificationToken, tokens.readAccountToken(signup.token, 'verification').storedToken);
  assert.notEqual(row.verificationToken, signup.token);
  assert.match((await load('app/api/client/verify/route.ts').GET(new Request(`http://localhost/api/client/verify?token=${signup.token}`))).headers.get('location'), /success/);
  assert.equal((await auth.getCurrentCustomer()).email, email);
  const oldSession = jar.get('sm_client_session');
  assert.equal((await load('app/api/client/forgot-password/route.ts').POST(json({ email }))).status, 200);
  const reset = mail.at(-1); row = await db.customer.findUniqueOrThrow({ where: { email } });
  assert.equal(row.resetToken, tokens.readAccountToken(reset.token, 'reset').storedToken);
  assert.equal((await load('app/api/client/reset-password/route.ts').POST(json({ token: row.resetToken, password: 'FixturePassword2' }))).status, 400);
  assert.equal((await load('app/api/client/reset-password/route.ts').POST(json({ token: reset.token, password: 'FixturePassword2' }))).status, 200);
  const resetSession = jar.get('sm_client_session'); jar.set('sm_client_session', oldSession);
  assert.equal(await auth.getCurrentCustomer(), null); jar.set('sm_client_session', resetSession);
  assert.equal((await load('app/api/client/change-email/route.ts').POST(json({ newEmail, currentPassword: 'FixturePassword2' }))).status, 200);
  const change = mail.at(-1); row = await db.customer.findUniqueOrThrow({ where: { email } });
  assert.equal(row.emailChangeToken, tokens.readAccountToken(change.token, 'email-change').storedToken);
  assert.match((await load('app/api/client/verify-email-change/route.ts').GET(new NextRequest(`http://localhost/api/client/verify-email-change?token=${change.token}`))).headers.get('location'), /success/);
  assert.equal(await auth.getCurrentCustomer(), null);
  assert.equal((await load('app/api/client/login/route.ts').POST(json({ email: newEmail, password: 'FixturePassword2' }))).status, 200);
  assert.equal((await auth.getCurrentCustomer()).email, newEmail);
  assert.equal((await load('app/api/client/reset-password/route.ts').POST(json({ token: reset.token, password: 'AttackerPassword3' }))).status, 400);
});

test('PostgreSQL: simultaneous confirmation resends cannot overwrite a link issued from the same account snapshot', async () => {
  const email = freshEmail(); const row = await db.customer.create({ data: { email, passwordHash: 'fixture', verificationToken: 'a'.repeat(64) } });
  let reads = 0, release; const barrier = new Promise(resolve => { release = resolve; }); const sends = [];
  const wrapper = { customer: {
    findUnique: async query => { const value = await db.customer.findUnique(query); if (++reads === 2) release(); await barrier; return value; },
    updateMany: query => db.customer.updateMany(query),
  } };
  const load = createLoader({ ...base, '@/lib/prisma': { prisma: wrapper }, '@/lib/accountEmail': { scheduleAccountEmail: (kind, to, token) => sends.push(token) } });
  const { POST } = load('app/api/client/resend-verification/route.ts');
  const responses = await Promise.all([1, 2].map(() => POST(json({ email }))));
  assert.ok(responses.every(response => response.status === 200)); assert.equal(sends.length, 1);
  assert.equal((await db.customer.findUniqueOrThrow({ where: { id: row.id } })).verificationToken, load('lib/accountTokens.ts').readAccountToken(sends[0], 'verification').storedToken);
});

test('PostgreSQL: cleanup preserves a recently resent confirmation on an old account and removes expired links only', async () => {
  const tokens = createLoader()('lib/accountTokens.ts'); const now = new Date(); const old = new Date(now.getTime() - 9 * 86400000);
  const active = await db.customer.create({ data: { email: freshEmail(), passwordHash: 'fixture', createdAt: old, verificationToken: tokens.createAccountToken('verification').storedToken } });
  const expired = await db.customer.create({ data: { email: freshEmail(), passwordHash: 'fixture', createdAt: old, verificationToken: `h1.${now.getTime() - 1000}.${'a'.repeat(64)}` } });
  const legacy = await db.customer.create({ data: { email: freshEmail(), passwordHash: 'fixture', createdAt: old, verificationToken: 'a'.repeat(64) } });
  await db.customer.deleteMany({ where: { id: { in: [active.id, expired.id, legacy.id] }, emailVerified: false, createdAt: { lt: new Date(now.getTime() - 7 * 86400000) }, orders: { none: {} }, ...tokens.expiredVerificationTokens(now) } });
  assert.ok(await db.customer.findUnique({ where: { id: active.id } }));
  assert.equal(await db.customer.findUnique({ where: { id: expired.id } }), null);
  assert.equal(await db.customer.findUnique({ where: { id: legacy.id } }), null);
});

test('PostgreSQL: admin sessions revoke correctly without enabling the commerce migration', async () => {
  process.env.REMEDIATION_SCHEMA_ENABLED = 'false'; process.env.ADMIN_SECRET_TOKEN = 'postgres-admin-fixture-secret-for-tests';
  const load = createLoader(base); const auth = load('lib/revocableAdminSession.ts');
  const first = await auth.issueAdminSession(), second = await auth.issueAdminSession();
  sessionKeys.push(`admin_session:${load('lib/adminSession.ts').adminSessionId(first)}`, `admin_session:${load('lib/adminSession.ts').adminSessionId(second)}`);
  assert.equal(await auth.authenticateAdminToken(first), true); assert.equal(await auth.authenticateAdminToken(second), true);
  await auth.revokeOtherAdminSessions(first);
  assert.equal(await auth.authenticateAdminToken(first), true); assert.equal(await auth.authenticateAdminToken(second), false);
  await auth.revokeAdminToken(first); assert.equal(await auth.authenticateAdminToken(first), false);
});
