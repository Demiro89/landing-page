const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');
const { createLoader } = require('./load-ts.cjs');

const connection = process.env.TEST_DATABASE_URL;
if (!connection) throw new Error('TEST_DATABASE_URL is required.');
const parsed = new URL(connection);
if (!['localhost', '127.0.0.1', 'postgres'].includes(parsed.hostname) || !parsed.pathname.endsWith('_test')) throw new Error('Refusing a non-local/non-test database.');
const db = new PrismaClient({ datasources: { db: { url: connection } }, log: [] });
process.env.REMEDIATION_SCHEMA_ENABLED = 'true';
process.env.DELIVERY_WORKER_ENABLED = 'true';
process.env.ENCRYPTION_KEY = 'integration-fixture-encryption-key-not-for-production';
process.env.STRIPE_SECRET_KEY = 'sk_test_fixture_no_network';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fixture_no_network';
process.env.RESEND_API_KEY = 'fixture_no_network';
const services = [], events = [];
const subscriptions = new Map();
const transport = { rejected: false, calls: [] };

// Real SDK signature verification and real PostgreSQL transactions; provider I/O is simulated.
class IsolatedStripe extends Stripe {
  constructor(...args) {
    super(...args);
    this.subscriptions.retrieve = async id => {
      assert.ok(subscriptions.has(id), 'No network or unknown provider subscription allowed');
      return subscriptions.get(id);
    };
  }
}
class IsolatedResend {
  emails = { send: async (message, options) => {
    transport.calls.push({ message, options });
    return transport.rejected ? { data: null, error: { statusCode: 500, message: 'Simulated provider failure' } } : { data: { id: 'simulated-message-id' }, error: null };
  } };
}
const load = createLoader({ './prisma': { prisma: db }, '@/lib/prisma': { prisma: db }, stripe: IsolatedStripe, resend: { Resend: IsolatedResend },
  '@/lib/nodemailer': { sendOrderDetailsEmail: async () => {}, sendRenewalEmail: async () => {}, sendUnpaidReminderEmail: async () => {} },
  '@/lib/telegram': { sendTelegramNotification: async () => false },
  '@/lib/adminAuth': { isAdminAuthenticated: async () => true }, '@/lib/rateLimit': { enforceRateLimit: async () => null },
});
const { reserveCheckout } = load('lib/checkoutReservation.ts');
const webhook = load('app/api/stripe/webhook/route.ts');
const { runDeliveryJobs } = load('lib/deliveryWorker.ts');

async function fixture() {
  const serviceId = `test-${crypto.randomUUID()}`;
  services.push(serviceId);
  await db.service.create({ data: { id: serviceId, name: 'Isolated provider test', tagline: 'Test', price: 3, original: 6, maxSlots: 1, active: true, icon: 'T', gradient: '', features: ['Test'] } });
  const stock = await db.stockAccount.create({ data: { serviceId, price: 3, maxSlots: 1, details: load('lib/crypto.ts').encrypt('fictional-access-not-a-real-password') } });
  const checkout = await reserveCheckout(crypto.randomUUID(), { serviceId, stockAccountId: stock.id, price: 3, total: 3, details: '', clientEmail: 'test@example.test',
    paymentMethod: 'Carte bancaire (Stripe)', termsVersion: '2026-10-07.1', acceptedCgv: true, acceptedImmediateExecution: true });
  const subId = `sub_${crypto.randomUUID()}`;
  subscriptions.set(subId, { id: subId, customer: 'cus_isolated_fixture', default_payment_method: null, items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] } });
  const session = { id: `cs_${crypto.randomUUID()}`, payment_status: 'paid', subscription: subId, currency: 'eur', amount_total: 300, invoice: `in_${crypto.randomUUID()}`,
    customer_details: { name: 'Test Buyer', address: { line1: '1 Test Street', postal_code: '75001', city: 'Paris', country: 'FR' } },
    metadata: { orderId: checkout.order.id, reservationId: checkout.reservation.id } };
  await db.stockReservation.update({ where: { id: checkout.reservation.id }, data: { checkoutSessionId: session.id } });
  return { ...checkout, stock, session, subId };
}

function event(type, object) {
  const result = { id: `evt_${crypto.randomUUID()}`, type, created: Math.floor(Date.now() / 1000), data: { object } };
  events.push(result.id); return result;
}

async function signed(event, valid = true) {
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: valid ? process.env.STRIPE_WEBHOOK_SECRET : 'whsec_invalid_fixture' });
  return webhook.POST(new Request('http://localhost/api/stripe/webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': signature } }));
}

test('PostgreSQL + signed Stripe events: invalid signature and unpaid checkout never grant access', async () => {
  const f = await fixture();
  const invalid = event('checkout.session.completed', f.session);
  assert.equal((await signed(invalid, false)).status, 400);
  assert.equal(await db.processedWebhookEvent.count({ where: { id: invalid.id } }), 0);
  assert.equal((await signed(event('checkout.session.completed', { ...f.session, payment_status: 'unpaid' }))).status, 200);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, 'pending');
  assert.equal(await db.deliveryJob.count({ where: { orderId: f.order.id } }), 0);
  assert.equal(await db.paymentRecord.count({ where: { orderId: f.order.id } }), 0);
  assert.equal((await signed(event('checkout.session.expired', f.session))).status, 200);
  assert.equal((await db.stockReservation.findUniqueOrThrow({ where: { id: f.reservation.id } })).status, 'released');
});

test('PostgreSQL: duplicate signed checkouts create one payment, one slot and one delivery; failed sends retry', async () => {
  const f = await fixture();
  const paid = event('checkout.session.completed', f.session);
  const responses = await Promise.all([signed(paid), signed(paid)]);
  assert.ok(responses.every(response => response.status === 200));
  assert.equal(await db.paymentRecord.count({ where: { orderId: f.order.id } }), 1);
  assert.equal(await db.deliveryJob.count({ where: { orderId: f.order.id, kind: 'delivery' } }), 1);
  assert.equal((await db.stockAccount.findUniqueOrThrow({ where: { id: f.stock.id } })).filledSlots, 1);
  const job = await db.deliveryJob.findFirstOrThrow({ where: { orderId: f.order.id, kind: 'delivery' } });
  transport.rejected = true; transport.calls = [];
  await runDeliveryJobs();
  assert.equal((await db.deliveryJob.findUniqueOrThrow({ where: { id: job.id } })).status, 'pending');
  const originalKey = transport.calls[0].options.idempotencyKey;
  await db.deliveryJob.update({ where: { id: job.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
  transport.rejected = false; transport.calls = [];
  await Promise.all([runDeliveryJobs(), runDeliveryJobs()]);
  assert.equal(transport.calls.length, 1);
  assert.equal(transport.calls[0].options.idempotencyKey, originalKey);
  assert.equal((await db.deliveryJob.findUniqueOrThrow({ where: { id: job.id } })).status, 'completed');
  assert.equal(transport.calls[0].message.to, 'test@example.test');
  assert.match(transport.calls[0].message.html, /fictional-access-not-a-real-password/);
  assert.equal(transport.calls[0].message.attachments.length, 1);
  const invoice = await db.invoice.findUniqueOrThrow({ where: { orderId: f.order.id } });
  assert.equal(invoice.clientName, 'Test Buyer');
  assert.equal(invoice.clientAddress, '1 Test Street, 75001, Paris, FR');

  const renewalInvoice = { id: `in_${crypto.randomUUID()}`, amount_paid: 300, currency: 'eur', billing_reason: 'subscription_cycle',
    parent: { subscription_details: { subscription: f.subId } }, status_transitions: { paid_at: Math.floor(Date.now() / 1000) } };
  const renewal = event('invoice.payment_succeeded', renewalInvoice);
  assert.equal((await signed(renewal)).status, 200);
  assert.equal((await signed(renewal)).status, 200);
  assert.equal(await db.paymentRecord.count({ where: { orderId: f.order.id } }), 2);
  assert.equal(await db.deliveryJob.count({ where: { orderId: f.order.id, kind: 'renewal' } }), 1);
  await runDeliveryJobs();
  const failed = event('invoice.payment_failed', { id: `in_${crypto.randomUUID()}`, parent: renewalInvoice.parent });
  assert.equal((await signed(failed)).status, 200);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, 'unpaid');
  assert.equal((await signed(event('invoice.payment_succeeded', { ...renewalInvoice, id: `in_${crypto.randomUUID()}` }))).status, 200);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, 'active');
  await runDeliveryJobs();

  const cancelled = event('customer.subscription.deleted', { id: f.subId });
  assert.equal((await signed(cancelled)).status, 200);
  assert.equal((await signed(cancelled)).status, 200);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, 'cancelled');
  assert.equal((await db.stockAccount.findUniqueOrThrow({ where: { id: f.stock.id } })).filledSlots, 1, 'No resale until provider access is revoked');
  const revocation = await db.deliveryJob.findFirstOrThrow({ where: { orderId: f.order.id, kind: 'access_revocation' } });
  const operations = load('app/api/admin/operations/route.ts');
  const confirm = () => operations.POST(new Request('http://localhost/api/admin/operations', { method: 'POST', body: JSON.stringify({ action: 'confirm_access_revoked', jobId: revocation.id, confirmed: true }) }));
  const confirmations = await Promise.all([confirm(), confirm()]);
  assert.deepEqual(confirmations.map(response => response.status).sort(), [200, 409]);
  assert.equal((await db.stockAccount.findUniqueOrThrow({ where: { id: f.stock.id } })).filledSlots, 0);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).details, '');
});

test('PostgreSQL: a late payment cannot steal another live hold and is queued for review without credentials', async () => {
  const f = await fixture();
  await db.stockReservation.update({ where: { id: f.reservation.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await reserveCheckout(crypto.randomUUID(), { serviceId: f.order.serviceId, stockAccountId: f.stock.id, price: 3, total: 3, details: '', clientEmail: 'second@example.test', paymentMethod: 'Carte bancaire (Stripe)', termsVersion: '2026-10-07.1' });
  assert.equal((await signed(event('checkout.session.completed', f.session))).status, 200);
  const order = await db.order.findUniqueOrThrow({ where: { id: f.order.id } });
  assert.equal(order.status, 'payment_review'); assert.equal(order.details, '');
  assert.equal((await db.paymentRecord.findFirstOrThrow({ where: { orderId: order.id } })).status, 'refund_needed');
  assert.equal(await db.deliveryJob.count({ where: { orderId: order.id, kind: 'delivery' } }), 0);
  assert.equal((await db.stockAccount.findUniqueOrThrow({ where: { id: f.stock.id } })).filledSlots, 0);
});

test('PostgreSQL: unpaid reminders commit with order state, retry once, and become obsolete after recovery or cancellation', async () => {
  const f = await fixture();
  transport.rejected = false; transport.calls = [];
  assert.equal((await signed(event('checkout.session.completed', f.session))).status, 200);
  await runDeliveryJobs();
  const invoice = { id: `in_${crypto.randomUUID()}`, amount_paid: 300, currency: 'eur', billing_reason: 'subscription_cycle',
    parent: { subscription_details: { subscription: f.subId } }, status_transitions: { paid_at: Math.floor(Date.now() / 1000) } };
  const failed = event('invoice.payment_failed', { ...invoice, amount_paid: 0 });
  const responses = await Promise.all([signed(failed), signed(failed)]);
  assert.ok(responses.every(response => response.status === 200));
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).reminderCount, 1);
  const reminder = await db.deliveryJob.findFirstOrThrow({ where: { orderId: f.order.id, kind: 'unpaid_reminder_1' } });
  assert.equal(await db.deliveryJob.count({ where: { orderId: f.order.id, kind: 'unpaid_reminder_1' } }), 1);

  transport.rejected = true; transport.calls = [];
  await runDeliveryJobs();
  assert.equal((await db.deliveryJob.findUniqueOrThrow({ where: { id: reminder.id } })).status, 'pending');
  const key = transport.calls[0].options.idempotencyKey;
  await db.deliveryJob.update({ where: { id: reminder.id }, data: { nextAttemptAt: new Date(0) } });
  transport.rejected = false; transport.calls = [];
  await Promise.all([runDeliveryJobs(), runDeliveryJobs()]);
  assert.equal(transport.calls.length, 1);
  assert.equal(transport.calls[0].options.idempotencyKey, key);
  assert.doesNotMatch(transport.calls[0].message.html, /fictional-access|paypal|gmail\.com/i);
  assert.match(transport.calls[0].message.text, /espace-client/);
  assert.equal((await db.deliveryJob.findUniqueOrThrow({ where: { id: reminder.id } })).status, 'completed');

  assert.equal((await signed(event('invoice.payment_succeeded', invoice))).status, 200);
  assert.equal((await signed(event('invoice.payment_failed', invoice))).status, 200);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, 'active', 'A late failure for a paid invoice must not downgrade the order');
  await runDeliveryJobs();

  const admin = load('app/api/admin/stock/route.ts');
  const action = name => admin.PUT(new Request('http://localhost/api/admin/stock', { method: 'PUT',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: name, orderId: f.order.id }) }));
  assert.equal((await action('mark_unpaid')).status, 200);
  const secondEpisode = await db.deliveryJob.findFirstOrThrow({ where: { orderId: f.order.id, kind: 'unpaid_reminder_1', status: 'pending' } });
  assert.notEqual(secondEpisode.dedupeKey, reminder.dedupeKey);
  const simultaneous = await Promise.all([action('send_reminder'), action('send_reminder')]);
  assert.ok(simultaneous.every(response => [200, 409].includes(response.status)));
  let current = await db.order.findUniqueOrThrow({ where: { id: f.order.id } });
  assert.ok([2, 3].includes(current.reminderCount));
  if (current.reminderCount < 3) assert.equal((await action('send_reminder')).status, 200);
  assert.equal((await action('send_reminder')).status, 409);
  assert.equal((await action('mark_paid')).status, 409, 'A Stripe subscription cannot be marked paid manually');
  current = await db.order.findUniqueOrThrow({ where: { id: f.order.id } });
  assert.equal(current.reminderCount, 3);
  const pending = await db.deliveryJob.findMany({ where: { orderId: f.order.id, status: 'pending', kind: { startsWith: 'unpaid_reminder_' } } });
  assert.equal(pending.length, 3);
  assert.equal(new Set(pending.map(job => job.kind)).size, 3);

  assert.equal((await signed(event('customer.subscription.deleted', { id: f.subId }))).status, 200);
  transport.calls = [];
  await runDeliveryJobs();
  assert.equal(transport.calls.length, 0);
  assert.equal(await db.deliveryJob.count({ where: { id: { in: pending.map(job => job.id) }, status: 'skipped', lastError: 'reminder_obsolete' } }), 3);
});

test.after(async () => {
  try {
    const orders = await db.order.findMany({ where: { serviceId: { in: services } }, select: { id: true } });
    const ids = orders.map(order => order.id);
    await db.deliveryJob.deleteMany({ where: { orderId: { in: ids } } });
    await db.paymentRecord.deleteMany({ where: { orderId: { in: ids } } });
    await db.stockReservation.deleteMany({ where: { orderId: { in: ids } } });
    await db.setting.deleteMany({ where: { key: { in: ids.flatMap(id => [`contract:${id}`, `billing:${id}`]) } } });
    await db.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await db.order.deleteMany({ where: { serviceId: { in: services } } });
    await db.stockAccount.deleteMany({ where: { serviceId: { in: services } } });
    await db.service.deleteMany({ where: { id: { in: services } } });
    await db.processedWebhookEvent.deleteMany({ where: { id: { in: events } } });
  } finally { await db.$disconnect(); }
});
