const test = require('node:test');
const assert = require('node:assert/strict');
const { createLoader } = require('./load-ts.cjs');

async function withEnv(values, callback) {
  const before = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  try { return await callback(); } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test('billing evidence is encrypted, immutable and absent for historical orders', async () => {
  await withEnv({ ENCRYPTION_KEY: 'unit-test-encryption-secret-long-enough-for-billing' }, async () => {
    const load = createLoader();
    const { saveBillingSnapshot, readBillingSnapshot, checkoutBilling } = load('lib/billingSnapshot.ts');
    let saved;
    const tx = { setting: { upsert: async data => { saved = data; } } };
    const details = { name: ' Test Buyer ', address: { line1: '1 Test Street', line2: null, postal_code: '75001', city: 'Paris', state: null, country: 'FR' } };
    await saveBillingSnapshot(tx, 'test-order', details);
    assert.equal(saved.where.key, 'billing:test-order');
    assert.deepEqual(saved.update, {});
    assert.ok(saved.create.value.startsWith('enc:v2:'));
    assert.equal(saved.create.value.includes('Test Buyer'), false);
    assert.deepEqual(readBillingSnapshot(saved.create.value), checkoutBilling(details));
    assert.deepEqual(readBillingSnapshot(null), { name: null, address: null });
    assert.throws(() => readBillingSnapshot('null'), /Invalid billing/);
  });
});

test('new invoice retains verified name and address while retries preserve original invoice', async () => {
  let data;
  const tx = { $queryRaw: async () => [], counter: { upsert: async () => ({ value: 1 }) },
    invoice: { findUnique: async () => null, create: async params => { data = params.data; return data; } } };
  const { createInvoiceForOrder } = createLoader({ './prisma': { prisma: { $transaction: callback => callback(tx) } } })('lib/invoice.ts');
  const input = { orderId: 'order', clientEmail: 'test@example.test', clientName: 'Test Buyer', clientAddress: 'Test address', serviceName: 'Offer', amount: 3, paymentMethod: 'Stripe' };
  await createInvoiceForOrder(input);
  assert.equal(data.clientName, input.clientName);
  assert.equal(data.clientAddress, input.clientAddress);
  tx.invoice.findUnique = async () => data;
  assert.equal(await createInvoiceForOrder({ ...input, clientName: 'Changed' }), data);
  assert.equal(data.clientName, input.clientName);
});

test('delivery runner rejects missing or incorrect authorization before any database access', async () => {
  await withEnv({ CRON_SECRET: 'test-cron-secret' }, async () => {
    const { GET } = createLoader()('app/api/cron/deliveries/route.ts');
    for (const auth of ['', 'Bearer wrong', 'test-cron-secret']) {
      const response = await GET(new Request('http://localhost/api/cron/deliveries', { headers: { authorization: auth } }));
      assert.equal(response.status, 401);
    }
  });
  await withEnv({ CRON_SECRET: undefined }, async () => {
    assert.equal(createLoader()('lib/cronAuth.ts').isCronAuthorized(new Request('http://localhost')), false);
  });
});

test('delivery-only runner never invokes the account cleanup and is explicit about disabled delivery', async () => {
  await withEnv({ CRON_SECRET: 'test-cron-secret' }, async () => {
    const { GET } = createLoader({ '@/lib/deliveryWorker': { runDeliveryJobs: async () => ({ enabled: false, completed: 0, failed: 0 }) },
      '@/lib/deliveryAlerts': { alertDeliveryIssues: async () => { throw new Error('Must not query disabled schema'); } } })('app/api/cron/deliveries/route.ts');
    const response = await GET(new Request('http://localhost', { headers: { authorization: 'Bearer test-cron-secret' } }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).delivery.enabled, false);
  });
});

test('Telegram confirms provider acceptance and does not log message bodies or secrets on failure', async () => {
  const oldFetch = global.fetch;
  const oldWarn = console.warn;
  const oldError = console.error;
  const logs = [];
  console.warn = console.error = (...args) => logs.push(args.join(' '));
  try {
    const { sendTelegramNotification } = createLoader()('lib/telegram.ts');
    await withEnv({ TELEGRAM_BOT_TOKEN: undefined, TELEGRAM_ADMIN_CHAT_ID: undefined, TELEGRAM_CHAT_ID: undefined }, async () => {
      assert.equal(await sendTelegramNotification('private-order@example.test'), false);
    });
    await withEnv({ TELEGRAM_BOT_TOKEN: 'private-token', TELEGRAM_ADMIN_CHAT_ID: 'fixture-chat' }, async () => {
      global.fetch = async () => Response.json({ ok: false });
      assert.equal(await sendTelegramNotification('private-order@example.test'), false);
      global.fetch = async () => { throw new Error('private-token in transport error'); };
      assert.equal(await sendTelegramNotification('private-order@example.test'), false);
      global.fetch = async () => Response.json({ ok: true });
      assert.equal(await sendTelegramNotification('private-order@example.test'), true);
    });
    assert.doesNotMatch(logs.join('\n'), /private-order|private-token/);
  } finally { global.fetch = oldFetch; console.warn = oldWarn; console.error = oldError; }
});

test('aggregate alerts retry rejected notifications and throttle accepted duplicates', async () => {
  let value = '{}';
  let accepted = false;
  let sends = 0;
  const db = { deliveryJob: { count: async ({ where }) => where.status === 'needs_review' ? 1 : 0 }, paymentRecord: { count: async () => 0 },
    setting: { upsert: async () => ({ value }), updateMany: async ({ where, data }) => {
      if (where.value !== value) return { count: 0 };
      value = data.value; return { count: 1 };
    } } };
  const { alertDeliveryIssues } = createLoader({ './prisma': { prisma: db }, './telegram': { sendTelegramNotification: async message => {
    assert.doesNotMatch(message, /@|orderId|password/); sends++; return accepted;
  } } })('lib/deliveryAlerts.ts');
  assert.equal((await alertDeliveryIssues()).notified, false);
  assert.equal(value, '{}');
  accepted = true;
  assert.equal((await alertDeliveryIssues()).notified, true);
  assert.equal((await alertDeliveryIssues()).throttled, true);
  assert.equal(sends, 2);
});

test('personal-data export includes billing evidence only for owned orders and is never cached', async () => {
  const load = createLoader({ '@/lib/clientAuth': { getCurrentCustomer: async () => ({ id: 'owner', email: 'test@example.test' }) },
    '@/lib/rateLimit': { enforceRateLimit: async () => null }, '@/lib/prisma': { prisma: {
      order: { findMany: async ({ where }) => {
        assert.equal(where.customerId, 'owner');
        return [{ id: 'owned-order', status: 'cancelled', service: { id: 'offer', name: 'Offer' }, chats: null, invoice: { number: 'fixture' } }];
      } },
      setting: { findMany: async ({ where }) => {
        assert.deepEqual(where.key.in, ['billing:owned-order']);
        return [{ key: 'billing:owned-order', value: JSON.stringify({ name: 'Test Buyer', address: 'Test address' }) }];
      } },
    } } });
  const response = await load('app/api/client/export-data/route.ts').GET(new Request('http://localhost'));
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const exported = await response.json();
  assert.equal(exported.orders[0].billingDetails.name, 'Test Buyer');
  assert.equal(exported.orders[0].invoice.number, 'fixture');
  assert.equal(exported.orders[0].accessDetails, '');
});

test('reminders use an escaped client-portal message, not a fixed payment recipient', () => {
  const { unpaidReminderMessage } = createLoader()('lib/unpaidReminders.ts');
  const message = unpaidReminderMessage('<img src=x onerror=alert(1)>', 'order<script>', 1, 'https://example.test/');
  assert.doesNotMatch(message.html, /<img|<script|paypal|gmail\.com/i);
  assert.match(message.html, /&lt;img/);
  assert.match(message.html, /lang="fr"/);
  assert.match(message.text, /https:\/\/example\.test\/espace-client/);
  assert.match(message.text, /avant tout autre règlement/);
  assert.throws(() => unpaidReminderMessage('Offer', 'order', 1, 'javascript:alert(1)'));
});

test('queued reminders are idempotent within an unpaid episode and distinct in a later episode', async () => {
  const saved = new Map();
  const tx = { deliveryJob: { upsert: async ({ where, create, update }) => {
    assert.deepEqual(update, {});
    if (!saved.has(where.dedupeKey)) saved.set(where.dedupeKey, { id: `job-${saved.size}`, ...create });
    return saved.get(where.dedupeKey);
  } } };
  const { queueUnpaidReminder } = createLoader()('lib/unpaidReminders.ts');
  const first = await queueUnpaidReminder(tx, 'order', new Date(1000), 1);
  assert.equal(await queueUnpaidReminder(tx, 'order', new Date(1000), 1), first);
  const second = await queueUnpaidReminder(tx, 'order', new Date(2000), 1);
  assert.notEqual(first.id, second.id);
  assert.equal(first.kind, 'unpaid_reminder_1');
});

function reminderWorkerFixture() {
  const unpaidSince = new Date();
  const { unpaidReminderKey } = createLoader()('lib/unpaidReminders.ts');
  const order = { id: 'order', status: 'unpaid', unpaidSince, reminderCount: 1, clientEmail: 'test@example.test',
    service: { name: 'Offer' }, details: 'secret-never-include', total: 3 };
  const job = { id: 'reminder-job', orderId: order.id, kind: 'unpaid_reminder_1', status: 'pending', createdAt: new Date(),
    nextAttemptAt: new Date(0), attempts: 0, dedupeKey: unpaidReminderKey(order.id, unpaidSince, 1), leaseToken: null };
  const transport = { calls: [], response: { data: { id: 'test-provider-message' }, error: null } };
  class FakeResend {
    emails = { send: async (message, options) => { transport.calls.push({ message, options }); return transport.response; } };
  }
  const db = { order: { findUniqueOrThrow: async () => order }, deliveryJob: {
    findMany: async ({ where }) => {
      assert.ok(where.kind.in.includes(job.kind));
      return job.status === 'pending' ? [{ ...job }] : [];
    },
    updateMany: async ({ where, data }) => {
      if (where.leaseToken && where.leaseToken !== job.leaseToken) return { count: 0 };
      if (where.OR && job.status !== 'pending') return { count: 0 };
      const { attempts, ...values } = data;
      Object.assign(job, values);
      if (attempts) job.attempts += attempts.increment;
      return { count: 1 };
    },
  }, paymentRecord: { findUnique: () => { throw new Error('Reminder must not require or fabricate a paid ledger entry'); } },
    setting: { findUnique: () => { throw new Error('Reminder must not access billing or access credentials'); } } };
  const { runDeliveryJobs } = createLoader({ resend: { Resend: FakeResend }, './prisma': { prisma: db } })('lib/deliveryWorker.ts');
  return { order, job, transport, runDeliveryJobs };
}

const reminderEnv = { REMEDIATION_SCHEMA_ENABLED: 'true', DELIVERY_WORKER_ENABLED: 'true', RESEND_API_KEY: 'isolated-unit-test', NEXT_PUBLIC_APP_URL: 'https://example.test' };

test('unpaid reminders survive a transient provider error and retry with the same key without credentials', async () => {
  await withEnv(reminderEnv, async () => {
    const f = reminderWorkerFixture();
    f.transport.response = { data: null, error: { statusCode: 500 } };
    assert.equal((await f.runDeliveryJobs()).failed, 1);
    assert.equal(f.job.status, 'pending');
    const firstKey = f.transport.calls[0].options.idempotencyKey;
    f.transport.response = { data: { id: 'test-provider-message' }, error: null };
    assert.equal((await f.runDeliveryJobs()).completed, 1);
    assert.equal(f.transport.calls[1].options.idempotencyKey, firstKey);
    assert.equal(f.job.providerMessageId, 'test-provider-message');
    assert.doesNotMatch(f.transport.calls[1].message.html, /secret-never-include/);
    assert.ok(f.transport.calls[1].message.text);
  });
});

test('settled, cancelled, superseded or later-episode reminders are skipped without sending', async () => {
  await withEnv(reminderEnv, async () => {
    for (const mutate of [f => { f.order.status = 'active'; }, f => { f.order.status = 'cancelled'; },
      f => { f.order.reminderCount = 2; }, f => { f.order.unpaidSince = new Date(f.order.unpaidSince.getTime() + 1); }]) {
      const f = reminderWorkerFixture(); mutate(f);
      await f.runDeliveryJobs();
      assert.equal(f.transport.calls.length, 0);
      assert.equal(f.job.status, 'skipped');
      assert.equal(f.job.lastError, 'reminder_obsolete');
    }
  });
});

test('permanent provider rejections require review while rate limits remain retryable', async () => {
  await withEnv(reminderEnv, async () => {
    for (const statusCode of [400, 401, 403, 409, 422, 429]) {
      const f = reminderWorkerFixture();
      f.transport.response = { data: null, error: { statusCode } };
      await f.runDeliveryJobs();
      assert.equal(f.job.status, statusCode === 429 ? 'pending' : 'needs_review');
    }
  });
});
