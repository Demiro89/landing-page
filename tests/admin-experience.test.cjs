const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const { createLoader } = require('./load-ts.cjs');
const presentation = createLoader()('lib/adminPresentation.ts');

test('every order state is explicit; unknown and pending orders are never displayed as active', () => {
  assert.equal(presentation.orderStatusPresentation('active').label, 'Actif');
  for (const status of ['pending', 'payment_review', 'unpaid', 'cancelled_pending', 'cancelled', 'unknown']) {
    assert.notEqual(presentation.orderStatusPresentation(status).label, 'Actif');
  }
  for (const status of ['pending', 'payment_review', 'cancelled', 'unknown']) assert.equal(presentation.hasValidatedInitialAmount(status), false);
  assert.equal(presentation.isStripeOrder({ stripeSubscriptionId: 'sub_example', paymentMethod: null }), true);
  assert.equal(presentation.matchesOrderSearch({ id: 'order', clientEmail: 'Client@example.test', service: { name: 'Netflix' } }, ' CLIENT '), true);
});

test('admin transport never converts an HTTP, network or malformed response into success or retries a mutation', async () => {
  const { adminResponse } = createLoader()('lib/adminResponse.ts');
  for (const result of [() => { throw new Error('offline'); }, () => new Response('<html>proxy error</html>', { status: 502 }), () => Response.json({ success: true }, { status: 409 })]) {
    let calls = 0;
    const response = await adminResponse('/api/admin/stock', { method: 'PUT' }, async () => { calls++; return result(); });
    assert.equal(response.ok, false);
    assert.equal((await response.json()).success, false);
    assert.equal(calls, 1);
  }
  const response = await adminResponse('/api/admin/stock', undefined, async () => Response.json({ success: true, orders: [] }));
  assert.equal(response.ok, true);
  assert.equal((await response.json()).success, true);
});

function stockRoute(prisma, durable = false, extra = {}) {
  return createLoader({
    '@/lib/prisma': { prisma },
    '@/lib/adminAuth': { isAdminAuthenticated: async () => true },
    '@/lib/rateLimit': { enforceRateLimit: async (...args) => { assert.equal(args[4], true); return null; } },
    '@/lib/commerce': { remediationSchemaEnabled: () => durable },
    '@/lib/auditLog': { writeAuditLog: async () => {}, clientIpFromRequest: () => 'unknown' },
    ...extra,
  })('app/api/admin/stock/route.ts');
}
const mutation = body => new Request('http://localhost/api/admin/stock', { method: 'PUT', body: JSON.stringify(body) });

test('manual Stripe validation is rejected before any transaction in both rollout modes', async () => {
  for (const durable of [false, true]) {
    let writes = 0;
    const { PUT } = stockRoute({ order: { findUnique: async () => ({ id: 'order', status: 'pending', paymentMethod: 'Carte bancaire (Stripe)' }) }, $transaction: async () => { writes++; throw new Error('must not run'); } }, durable);
    assert.equal((await PUT(mutation({ action: 'validate_order', orderId: 'order', paymentReference: 'verified-123' }))).status, 409);
    assert.equal(writes, 0);
  }
});

test('manual regularization requires a new payment reference and records proof in the status transaction', async () => {
  let changed = 0, recorded = 0, usedReference = false;
  const tx = { $queryRaw: async () => [], paymentRecord: { findUnique: async () => usedReference ? { id: 'existing' } : null }, order: { updateMany: async () => { changed++; return { count: 1 }; } } };
  const { PUT } = stockRoute({ order: { findUnique: async () => ({ id: 'order', status: 'unpaid', paymentMethod: 'PayPal', price: 3.49, clientEmail: 'client@example.test', service: { name: 'Service' } }) }, $transaction: async callback => callback(tx) }, true, {
    '@/lib/durableOrders': { recordOrderPayment: async (transaction, data) => { assert.equal(transaction, tx); assert.equal(data.providerPaymentId, 'new-payment'); assert.equal(data.amountMinor, 349); recorded++; } },
  });
  assert.equal((await PUT(mutation({ action: 'mark_paid', orderId: 'order' }))).status, 400);
  assert.equal(changed, 0);
  assert.equal((await PUT(mutation({ action: 'mark_paid', orderId: 'order', paymentReference: 'new-payment' }))).status, 200);
  assert.equal(changed, 1); assert.equal(recorded, 1);
  usedReference = true;
  assert.equal((await PUT(mutation({ action: 'mark_paid', orderId: 'order', paymentReference: 'new-payment' }))).status, 409);
  assert.equal(changed, 1); assert.equal(recorded, 1);
});

test('invalid activation values are rejected before updating a service', async () => {
  const { PUT } = stockRoute({});
  for (const active of ['true', 1, null]) assert.equal((await PUT(mutation({ action: 'toggle_service', id: 'service', active }))).status, 400);
});

test('client totals and exports exclude unvalidated orders rather than claiming money spent', async () => {
  const orders = ['active', 'pending', 'payment_review', 'cancelled', 'unknown'].map(status => ({ clientEmail: 'client@example.test', date: new Date(), total: 10, status }));
  const { GET } = createLoader({ '@/lib/prisma': { prisma: { order: { findMany: async () => orders } } }, '@/lib/adminAuth': { isAdminAuthenticated: async () => true } })('app/api/admin/clients/route.ts');
  const data = await (await GET()).json();
  assert.equal(data.clients[0].totalSpent, 10);
  assert.equal(data.clients[0].orderCount, 5);
  const { GET: exportClients } = createLoader({
    '@/lib/prisma': { prisma: { order: { findMany: async () => orders } } },
    '@/lib/adminAuth': { isAdminAuthenticated: async () => true },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
  })('app/api/admin/export/route.ts');
  const csv = await (await exportClients(new NextRequest('http://localhost/api/admin/export?type=clients'))).text();
  assert.match(csv, /Montants initiaux validés hors renouvellements/);
  assert.match(csv, /,5,1,10\.00/);
});

test('every protected admin handler refuses unauthenticated requests before accessing data', async () => {
  const root = path.resolve(__dirname, '..', 'app/api/admin');
  let handlers = 0;
  for (const directory of fs.readdirSync(root)) {
    if (directory === 'auth') continue;
    const route = createLoader({ '@/lib/adminAuth': { isAdminAuthenticated: async () => false } })(`app/api/admin/${directory}/route.ts`);
    for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
      if (!route[method]) continue;
      const request = new NextRequest(`http://localhost/api/admin/${directory}`, { method });
      assert.equal((await route[method](request)).status, 401, `${directory} ${method}`);
      handlers++;
    }
  }
  assert.equal(handlers, 17);
});

test('password change updates credentials and revokes sessions in one conditional transaction', async () => {
  let issued = 0, writes = 0, conflict = false;
  const customer = { id: 'customer', passwordHash: 'old-hash', sessionVersion: 4 };
  const { POST } = createLoader({
    '@/lib/clientAuth': { getCurrentCustomer: async () => customer, verifyPassword: () => true, hashPassword: () => 'new-hash', setSession: async (id, version) => { assert.equal(id, customer.id); assert.equal(version, 5); issued++; } },
    '@/lib/rateLimit': { enforceRateLimit: async (...args) => { assert.equal(args[4], true); return null; } },
    '@/lib/prisma': { prisma: { $transaction: async callback => callback({ customer: {
      updateMany: async input => { assert.deepEqual(input.where, customer); assert.equal(input.data.sessionVersion.increment, 1); assert.equal(input.data.passwordHash, 'new-hash'); assert.equal(input.data.resetToken, null); assert.equal(input.data.emailChangeToken, null); if (conflict) return { count: 0 }; writes++; return { count: 1 }; },
      findUniqueOrThrow: async () => ({ sessionVersion: 5 }),
    } }) } },
  })('app/api/client/change-password/route.ts');
  const request = () => new Request('http://localhost/api/client/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: 'OldPassword1', newPassword: 'NewPassword2' }) });
  assert.equal((await POST(request())).status, 200);
  assert.equal(issued, 1); assert.equal(writes, 1);
  conflict = true;
  assert.equal((await POST(request())).status, 409);
  assert.equal(issued, 1); assert.equal(writes, 1);
});

test('password reset consumes a valid unexpired token and revokes old sessions atomically; a replay issues no session', async () => {
  let used = false, issued = 0;
  const token = 'a'.repeat(64);
  const { POST } = createLoader({
    '@/lib/clientAuth': { hashPassword: () => 'new-hash', setSession: async (id, version) => { assert.equal(id, 'customer'); assert.equal(version, 7); issued++; } },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/prisma': { prisma: {
      customer: { findFirst: async () => ({ id: 'customer', resetTokenExp: new Date(Date.now() + 60000) }) },
      $transaction: async callback => callback({ customer: {
        updateMany: async input => { assert.equal(input.where.resetToken, token); assert.ok(input.where.resetTokenExp.gt instanceof Date); assert.equal(input.data.sessionVersion.increment, 1); assert.equal(input.data.passwordHash, 'new-hash'); assert.equal(input.data.resetToken, null); assert.equal(input.data.emailChangeToken, null); if (used) return { count: 0 }; used = true; return { count: 1 }; },
        findUniqueOrThrow: async () => ({ sessionVersion: 7 }),
      } }),
    } },
  })('app/api/client/reset-password/route.ts');
  const request = value => new Request('http://localhost/api/client/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: value, password: 'NewPassword2' }) });
  assert.equal((await POST(request('invalid'))).status, 400);
  assert.equal((await POST(request(token))).status, 200);
  assert.equal((await POST(request(token))).status, 400);
  assert.equal(issued, 1);
});

test('admin documents are private and never cached', async () => {
  const { proxy } = createLoader({ './lib/revocableAdminSession': { authenticateAdminToken: async () => true } })('proxy.ts');
  const response = await proxy(new NextRequest('http://localhost/admin'));
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
});

test('email change refuses a stale password/session and never claims provider rejection as a sent email', async () => {
  let conflict = true, delivered = false, sends = 0;
  const customer = { id: 'customer', passwordHash: 'verified-hash', sessionVersion: 5, email: 'old@example.test' };
  const { POST } = createLoader({
    '@/lib/clientAuth': { getCurrentCustomer: async () => customer, verifyPassword: () => true, generateVerificationToken: () => 'b'.repeat(64) },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
    '@/lib/nodemailer': { sendEmailChangeVerificationEmail: async () => { sends++; return { success: delivered }; } },
    '@/lib/prisma': { prisma: { customer: { findUnique: async () => null, updateMany: async input => { assert.deepEqual(input.where, { id: customer.id, passwordHash: customer.passwordHash, sessionVersion: customer.sessionVersion }); return { count: conflict ? 0 : 1 }; } } } },
  })('app/api/client/change-email/route.ts');
  const request = () => new Request('http://localhost/api/client/change-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: 'Password1', newEmail: 'new@example.test' }) });
  assert.equal((await POST(request())).status, 409); assert.equal(sends, 0);
  conflict = false;
  assert.equal((await POST(request())).status, 503);
  delivered = true;
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.match((await response.json()).message, /accepté par le prestataire/);
});

test('client module graphs contain no server environment variable or server-only runtime import', () => {
  const root = path.resolve(__dirname, '..');
  const files = [];
  function walk(directory) { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) { const file = path.join(directory, entry.name); if (entry.isDirectory()) walk(file); else if (/\.tsx?$/.test(file)) files.push(file); } }
  for (const directory of ['app', 'components', 'lib']) walk(path.join(root, directory));
  const visited = new Set();
  function inspect(file) {
    if (visited.has(file)) return; visited.add(file);
    const source = fs.readFileSync(file, 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    assert.doesNotMatch(source, /process\.env\.(?!NEXT_PUBLIC_)[A-Z][A-Z0-9_]*/, path.relative(root, file));
    for (const statement of ast.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const clause = statement.importClause;
      if (clause?.isTypeOnly || (clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && !clause.name && clause.namedBindings.elements.every(element => element.isTypeOnly))) continue;
      const name = statement.moduleSpecifier.text;
      assert.notEqual(name, 'server-only', `Server runtime reachable from ${path.relative(root, file)}`);
      const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null;
      if (base) { const dependency = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map(suffix => base + suffix).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile() && /\.tsx?$/.test(candidate)); if (dependency) inspect(dependency); }
    }
  }
  for (const file of files) if (/^\s*['"]use client['"];/.test(fs.readFileSync(file, 'utf8'))) inspect(file);
});
