const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { NextRequest } = require('next/server');
const { createLoader } = require('./load-ts.cjs');

const connection = process.env.TEST_DATABASE_URL;
if (!connection) throw new Error('TEST_DATABASE_URL is required.');
const parsed = new URL(connection);
if (!['localhost', '127.0.0.1', 'postgres'].includes(parsed.hostname) || !parsed.pathname.endsWith('_test')) throw new Error('Refusing a non-local/non-test database.');
const db = new PrismaClient({ datasources: { db: { url: connection } }, log: [] });
const customers = [];
const token = () => crypto.randomBytes(32).toString('hex');
const json = body => new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const mocks = { '@/lib/prisma': { prisma: db }, '@/lib/rateLimit': { enforceRateLimit: async () => null } };
async function fixture(extra = {}) {
  const row = await db.customer.create({ data: { email: `auth-${crypto.randomUUID()}@example.test`, passwordHash: 'fixture-hash-not-real', ...extra } });
  customers.push(row.id); return row;
}
test.after(async () => { await db.customer.deleteMany({ where: { id: { in: customers } } }); await db.$disconnect(); });

test('PostgreSQL: password reset makes an older signup auto-login link unusable', async () => {
  const row = await fixture({ verificationToken: token(), resetToken: token(), resetTokenExp: new Date(Date.now() + 60000) });
  let sessions = 0;
  const load = createLoader({ ...mocks, '@/lib/clientAuth': { hashPassword: () => 'new-fixture-hash', setSession: async () => { sessions++; } } });
  assert.equal((await load('app/api/client/reset-password/route.ts').POST(json({ token: row.resetToken, password: 'FixturePassword2' }))).status, 200);
  const response = await load('app/api/client/verify/route.ts').GET(new Request(`http://localhost/api/client/verify?token=${row.verificationToken}`));
  assert.match(response.headers.get('location'), /invalid/);
  assert.equal(sessions, 1);
  const after = await db.customer.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal(after.verificationToken, null); assert.equal(after.resetToken, null); assert.equal(after.sessionVersion, 1);
});

test('PostgreSQL: concurrent signup verification consumes the token and issues a session only once', async () => {
  const row = await fixture({ verificationToken: token() });
  let sessions = 0;
  const { GET } = createLoader({ ...mocks, '@/lib/clientAuth': { setSession: async () => { sessions++; } } })('app/api/client/verify/route.ts');
  const responses = await Promise.all([1, 2].map(() => GET(new Request(`http://localhost/api/client/verify?token=${row.verificationToken}`))));
  assert.equal(responses.filter(r => r.headers.get('location').includes('success')).length, 1);
  assert.equal(sessions, 1);
  assert.equal((await db.customer.findUniqueOrThrow({ where: { id: row.id } })).sessionVersion, 1);
});

test('PostgreSQL: confirmed email change invalidates an old reset and defeats an in-flight reset issuance', async () => {
  const row = await fixture({ emailVerified: true, pendingEmail: `new-${crypto.randomUUID()}@example.test`, emailChangeToken: token(), emailChangeTokenExp: new Date(Date.now() + 60000), resetToken: token(), resetTokenExp: new Date(Date.now() + 60000) });
  let releaseRead, readFinished, sends = 0;
  const waiting = new Promise(resolve => { releaseRead = resolve; });
  const read = new Promise(resolve => { readFinished = resolve; });
  const wrapper = { customer: {
    findUnique: async query => { const result = await db.customer.findUnique(query); readFinished(); await waiting; return result; },
    updateMany: query => db.customer.updateMany(query),
  } };
  const { POST: forgot } = createLoader({ ...mocks, '@/lib/prisma': { prisma: wrapper },
    '@/lib/clientAuth': { generateVerificationToken: token }, '@/lib/nodemailer': { sendResetPasswordEmail: async () => { sends++; } },
  })('app/api/client/forgot-password/route.ts');
  const inflight = forgot(json({ email: row.email }));
  await read;
  try {
    const { GET } = createLoader(mocks)('app/api/client/verify-email-change/route.ts');
    assert.match((await GET(new NextRequest(`http://localhost/api/client/verify-email-change?token=${row.emailChangeToken}`))).headers.get('location'), /success/);
  } finally { releaseRead(); }
  assert.equal((await inflight).status, 200); assert.equal(sends, 0);
  const after = await db.customer.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal(after.email, row.pendingEmail); assert.equal(after.resetToken, null); assert.equal(after.verificationToken, null);
});

test('PostgreSQL: five simultaneous bad passwords cannot overwrite one another in the lockout counter', async () => {
  const row = await fixture({ emailVerified: true });
  const { POST } = createLoader({ ...mocks, '@/lib/clientAuth': { verifyPassword: () => false } })('app/api/client/login/route.ts');
  const responses = await Promise.all(Array.from({ length: 5 }, () => POST(json({ email: row.email, password: 'WrongPassword1' }))));
  assert.ok(responses.every(r => r.status === 401));
  const after = await db.customer.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal(after.loginAttempts, 5); assert.ok(after.lockedUntil > new Date());
});

test('PostgreSQL: deletion refuses stale credentials and only deletes after fresh reauthentication', async () => {
  let row = await fixture({ emailVerified: true });
  const { POST } = createLoader({ ...mocks, '@/lib/clientAuth': {
    getCurrentCustomer: async () => row, verifyPassword: () => true, clearSession: async () => {},
  } })('app/api/client/delete-account/route.ts');
  await db.customer.update({ where: { id: row.id }, data: { sessionVersion: { increment: 1 } } });
  assert.equal((await POST(json({ confirmation: 'supprimer', currentPassword: 'FixturePassword1' }))).status, 409);
  row = await db.customer.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal((await POST(json({ confirmation: 'supprimer', currentPassword: 'FixturePassword1' }))).status, 200);
  assert.equal(await db.customer.findUnique({ where: { id: row.id } }), null);
});
