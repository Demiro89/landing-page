const test = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { createLoader } = require('./load-ts.cjs');
process.env.ADMIN_SECRET_TOKEN = 'test-admin-secret-with-more-than-32-characters';
process.env.CLIENT_SESSION_SECRET = 'test-client-secret-with-more-than-32-characters';
process.env.STRIPE_SECRET_KEY = 'sk_test_fixture_no_network';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fixture_no_network';
const request = body => new Request('http://localhost/api/test', { method: 'POST', body: JSON.stringify(body) });

test('repeated cancellations release one slot, including concurrent state changes', async () => {
  let status = 'active';
  let slots = 1;
  const tx = {
    $queryRaw: async () => [],
    order: {
      updateMany: async ({ where, data }) => { const matches = typeof where.status === 'string' ? status === where.status : where.status.in.includes(status); if (matches) status = data.status; return { count: Number(matches) }; },
      findUniqueOrThrow: async () => ({ stockAccountId: 'stock' }),
    },
    stockAccount: { updateMany: async () => { if (slots > 0) slots--; return { count: 1 }; } },
  };
  const { cancelOrderAndReleaseStock } = createLoader()('lib/orderLifecycle.ts');
  await cancelOrderAndReleaseStock(tx, 'order');
  await cancelOrderAndReleaseStock(tx, 'order');
  assert.equal(status, 'cancelled');
  assert.equal(slots, 0);
  status = 'pending';
  slots = 1;
  await cancelOrderAndReleaseStock(tx, 'order');
  assert.equal(slots, 1);
});

test('admin settings reject secret keys, non-boolean gateways and malformed payloads', async () => {
  const { PUT } = createLoader({
    '@/lib/prisma': { prisma: {} },
    '@/lib/adminAuth': { isAdminAuthenticated: async () => true },
    '@/lib/rateLimit': { enforceRateLimit: async () => null },
  })('app/api/admin/settings/route.ts');
  for (const settings of [null, {}, [{ key: 'admin_totp_secret', value: 'forbidden' }], [{ key: 'gateway_cb', value: 'yes' }], [{ key: 'paypal_email', value: '<script>' }], [{ key: 'gateway_cb', value: 'true' }, { key: 'gateway_cb', value: 'false' }]]) {
    assert.equal((await PUT(request({ settings }))).status, 400);
  }
});

test('admin logout clears the cookie without consulting an unavailable database', async () => {
  let cleared = false;
  const { POST } = createLoader({
    'next/headers': { cookies: async () => ({ set: cookie => { cleared = cookie.maxAge === 0; } }) },
    '@/lib/prisma': { prisma: {} },
    '@/lib/rateLimit': { enforceRateLimit: async () => { throw new Error('Database must not be called'); } },
  })('app/api/admin/auth/route.ts');
  assert.equal((await POST(request({ action: 'logout' }))).status, 200);
  assert.equal(cleared, true);
});

function webhookFixture(event, overrides = {}) {
  const markers = new Set();
  const changes = [];
  const notifications = [];
  const tx = {
    $queryRaw: async () => [],
    processedWebhookEvent: { create: async ({ data }) => { markers.add(data.id); } },
    order: { findUniqueOrThrow: async () => ({ id: 'order', status: 'cancelled', reminderCount: 1 }), updateMany: async query => { changes.push(query); return { count: 0 }; } },
  };
  const prisma = {
    processedWebhookEvent: { findUnique: async ({ where }) => markers.has(where.id) ? { id: where.id } : null, upsert: async ({ where }) => { markers.add(where.id); } },
    $transaction: async callback => callback(tx),
    order: { findFirst: async () => ({ id: 'order', status: 'cancelled', reminderCount: 1, service: { name: 'Service' } }) },
    ...overrides,
  };
  class FakeStripe {
    webhooks = { constructEvent: () => event };
    subscriptions = { retrieve: async () => ({ id: 'sub', items: { data: [{ current_period_end: 2000000000 }] }, default_payment_method: null }) };
  }
  const { POST } = createLoader({
    stripe: FakeStripe,
    '@/lib/prisma': { prisma },
    './prisma': { prisma },
    '@/lib/nodemailer': { sendOrderDetailsEmail: async () => notifications.push('delivery'), sendUnpaidReminderEmail: async () => notifications.push('reminder'), sendRenewalEmail: async () => notifications.push('renewal') },
    '@/lib/telegram': { sendTelegramNotification: async () => notifications.push('telegram') },
  })('app/api/stripe/webhook/route.ts');
  return { POST, markers, changes, notifications };
}

test('unpaid checkout events deliver no credentials; signed replays do no work', async () => {
  const f = webhookFixture({ id: 'event-unpaid', type: 'checkout.session.completed', data: { object: { metadata: { serviceId: 'service' }, payment_status: 'unpaid' } } });
  assert.equal((await f.POST(request({}))).status, 200);
  assert.equal(f.markers.has('event-unpaid'), true);
  assert.deepEqual(f.notifications, []);
  const second = await (await f.POST(request({}))).json();
  assert.equal(second.duplicate, true);
  assert.deepEqual(f.changes, []);
});

test('renewal and failed-payment events cannot resurrect or remind cancelled orders', async () => {
  for (const type of ['invoice.payment_succeeded', 'invoice.payment_failed']) {
    const f = webhookFixture({ id: type, type, data: { object: { billing_reason: 'subscription_cycle', parent: { subscription_details: { subscription: 'sub' } } } } });
    assert.equal((await f.POST(request({}))).status, 200);
    if (type === 'invoice.payment_failed') assert.deepEqual(f.changes, []);
    else assert.deepEqual(f.changes[0].where.status.in, ['active', 'unpaid']);
    assert.deepEqual(f.notifications, []);
  }
});

test('email changes preserve legacy order ownership and revoke sessions atomically', async () => {
  const actions = [];
  const customer = { id: 'owner', email: 'old@example.test', pendingEmail: 'new@example.test', emailChangeTokenExp: new Date(Date.now() + 60000) };
  const tx = {
    customer: { updateMany: async query => { actions.push(query); return { count: 1 }; } },
    order: { updateMany: async query => { actions.push(query); return { count: 1 }; } },
  };
  const { GET } = createLoader({ '@/lib/prisma': { prisma: { customer: { findFirst: async () => customer, findUnique: async () => null }, $transaction: async callback => callback(tx) } } })('app/api/client/verify-email-change/route.ts');
  const response = await GET(new NextRequest('http://localhost/api/client/verify-email-change?token=fixture'));
  assert.equal(response.status, 307);
  assert.equal(actions[0].data.sessionVersion.increment, 1);
  assert.deepEqual(actions[1], { where: { clientEmail: customer.email, customerId: null }, data: { customerId: customer.id } });
});
