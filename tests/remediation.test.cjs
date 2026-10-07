const test = require('node:test');
const assert = require('node:assert/strict');
const { createLoader } = require('./load-ts.cjs');

async function withEnv(values, run) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  try { return await run(); } finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}

test('checkout remains closed without both rollout flags and documentary review', async () => {
  const load = createLoader({ './prisma': { prisma: { setting: { findMany: async () => [] } } } });
  const commerce = load('lib/commerce.ts');
  for (const [schema, sales] of [['false', 'false'], ['false', 'true'], ['true', 'false'], ['true', 'true']]) {
    await withEnv({ REMEDIATION_SCHEMA_ENABLED: schema, COMMERCE_ENABLED: sales }, async () => {
      await assert.rejects(commerce.assertOfferSaleAllowed('surfshark'), commerce.CommerceUnavailableError);
    });
  }
});

test('approval needs supplier proof and each customer-facing condition', () => {
  const { parseCommercialReview } = createLoader()('lib/commerce.ts');
  const approved = { status: 'approved', authorizationReference: 'supplier-document', eligibility: 'Eligibility', accessType: 'Personal invitation', privacyNote: 'Member visibility' };
  assert.equal(parseCommercialReview(JSON.stringify(approved)).status, 'approved');
  for (const key of ['authorizationReference', 'eligibility', 'accessType', 'privacyNote']) assert.equal(parseCommercialReview(JSON.stringify({ ...approved, [key]: '' })).status, 'unverified');
  for (const value of ['[]', 'null', '{invalid']) assert.equal(parseCommercialReview(value).status, 'unverified');
});

test('savings require a current dated HTTPS source and an equivalent price', () => {
  const { hasVerifiedReference } = createLoader()('lib/commerce.ts');
  const now = Date.parse('2026-10-07T12:00:00Z');
  const review = { comparableReference: true, referenceUrl: 'https://example.test/prices', referencePrice: 12.99, referenceCheckedAt: '2026-10-06' };
  assert.equal(hasVerifiedReference(review, 12.99, now), true);
  for (const change of [{ referenceUrl: 'javascript:alert(1)' }, { referenceCheckedAt: '2026-10-08' }, { referenceCheckedAt: '2026-01-01' }, { referencePrice: 15 }, { comparableReference: false }]) assert.equal(hasVerifiedReference({ ...review, ...change }, 12.99, now), false);
});

test('stored marketing copy is softened and numeric availability is strict', () => {
  const copy = createLoader()('lib/offerPresentation.ts');
  assert.equal(copy.matchesServiceFilter('youtube-custom-2', ['youtube']), true);
  assert.equal(copy.matchesServiceFilter('other-youtube', ['youtube']), false);
  assert.equal(copy.hasAvailableOffer({ availableSlots: 0, availableStockId: 'stock' }), false);
  assert.equal(copy.hasAvailableOffer({ availableSlots: 1, availableStockId: null }), false);
  assert.equal(copy.hasAvailableOffer({ availableSlots: 1, availableStockId: 'stock' }), true);
  assert.equal(copy.prudentCommercialCopy('illimitées'), 'selon offre');
  const text = copy.prudentCommercialCopy('Accès immédiat après achat. Support 24/7. No-Logs. Zéro risque.');
  assert.doesNotMatch(text, /immédiat|24\/7|no-logs|zéro risque/i);
});

test('reservation refuses occupied capacity including other live holds', async () => {
  let filled = 0;
  let held = 1;
  const tx = { $queryRaw: async () => [], stockAccount: { findUniqueOrThrow: async () => ({ id: 'stock', serviceId: 'offer', price: 3, maxSlots: 1, filledSlots: filled, service: { active: true } }) }, stockReservation: { findUnique: async () => null, count: async () => held } };
  const { reserveCheckout } = createLoader({ './prisma': { prisma: { $transaction: callback => callback(tx) } } })('lib/checkoutReservation.ts');
  const data = { stockAccountId: 'stock', serviceId: 'offer' };
  await assert.rejects(reserveCheckout('12345678-1234-4234-8234-123456789012', data), /Aucune place/);
  filled = 1; held = 0;
  await assert.rejects(reserveCheckout('12345678-1234-4234-8234-123456789012', data), /Aucune place/);
  for (const id of [undefined, {}, '----', '00000000-0000-0000-0000-000000000000']) await assert.rejects(reserveCheckout(id, data), /Rechargez/);
});

test('a repeated reservation cannot change the original buyer, amount or proof', async () => {
  const data = { stockAccountId: 'stock', serviceId: 'offer', clientEmail: 'buyer@example.test', youtubeEmail: null, paymentMethod: 'PayPal', termsVersion: '2026-10-07.1' };
  const existing = { id: '12345678-1234-4234-8234-123456789012', stockAccountId: 'stock', status: 'held', expiresAt: new Date(Date.now() + 60000), order: { ...data, price: 3 } };
  const tx = { $queryRaw: async () => [], stockAccount: { findUniqueOrThrow: async () => ({ price: 3 }) }, stockReservation: { findUnique: async () => existing } };
  const { reserveCheckout } = createLoader({ './prisma': { prisma: { $transaction: callback => callback(tx) } } })('lib/checkoutReservation.ts');
  assert.equal((await reserveCheckout(existing.id, data)).order.clientEmail, data.clientEmail);
  for (const change of [{ clientEmail: 'other@example.test' }, { termsVersion: 'other' }, { paymentMethod: 'Carte bancaire (Stripe)' }]) await assert.rejects(reserveCheckout(existing.id, { ...data, ...change }), /changé/);
});

test('slot consumption excludes only its own reservation and locks before incrementing', async () => {
  const calls = [];
  const tx = {
    $queryRaw: async () => calls.push('lock'),
    stockAccount: { findUniqueOrThrow: async () => ({ service: { active: true }, serviceId: 'offer', filledSlots: 0, maxSlots: 1, details: 'encrypted' }), update: async () => calls.push('increment') },
    stockReservation: { count: async ({ where }) => { assert.equal(where.orderId.not, 'order'); assert.equal(where.status, 'held'); return 0; }, updateMany: async () => calls.push('consume') },
  };
  const { consumePlace } = createLoader()('lib/stockReservations.ts');
  assert.equal((await consumePlace(tx, 'order', 'stock', 'offer')).details, 'encrypted');
  assert.deepEqual(calls, ['lock', 'increment', 'consume']);
});

test('payment reference cannot be reused for a different order or amount', async () => {
  const { recordOrderPayment } = createLoader()('lib/durableOrders.ts');
  const params = { orderId: 'order', amountMinor: 349, currency: 'eur', provider: 'paypal_manual', providerPaymentId: 'provider-id' };
  const tx = { paymentRecord: { upsert: async () => params } };
  assert.equal((await recordOrderPayment(tx, params)).orderId, 'order');
  for (const change of [{ orderId: 'other' }, { amountMinor: 350 }, { amountMinor: 0 }, { amountMinor: 3.49 }, { currency: 'usd' }]) await assert.rejects(recordOrderPayment(tx, { ...params, ...change }));
});

test('revoked admin tokens, old cookies and unavailable session stores fail closed after migration', async () => {
  await withEnv({ REMEDIATION_SCHEMA_ENABLED: 'true', ADMIN_SECRET_TOKEN: 'unit-test-admin-secret-strong-enough' }, async () => {
    let session;
    const tx = { adminSession: { create: async ({ data }) => { session = data; }, findUnique: async () => session, updateMany: async () => { session.revokedAt = new Date(); } } };
    const load = createLoader({ './prisma': { prisma: tx } });
    const auth = load('lib/revocableAdminSession.ts');
    const token = await auth.issueAdminSession();
    assert.equal(await auth.authenticateAdminToken(token), true);
    await auth.revokeAdminToken(token);
    assert.equal(await auth.authenticateAdminToken(token), false);
    assert.equal(await auth.authenticateAdminToken(load('lib/adminSession.ts').createAdminSessionToken()), false);
    tx.adminSession.findUnique = async () => { throw new Error('DB down'); };
    assert.equal(await auth.authenticateAdminToken(token), false);
  });
});

test('missing client-session secret never creates a fallback session', async () => {
  await withEnv({ CLIENT_SESSION_SECRET: undefined }, async () => {
    const auth = createLoader()('lib/clientAuth.ts');
    assert.equal(await auth.getCurrentCustomer(), null);
    await assert.rejects(auth.setSession('customer', 0), /désactivée/);
  });
});

test('failed e-mail remains pending instead of being reported as delivered', async () => {
  await withEnv({ REMEDIATION_SCHEMA_ENABLED: 'true', DELIVERY_WORKER_ENABLED: 'true', RESEND_API_KEY: 'unit-test-key' }, async () => {
    const job = { id: 'job', orderId: 'order', kind: 'credentials', dedupeKey: 'credentials:order', attempts: 0, createdAt: new Date() };
    const updates = [];
    class FakeResend { emails = { send: async (_data, options) => { assert.equal(options.idempotencyKey, 'streammalin:job'); return { error: { message: 'failure' }, data: null }; } }; }
    const db = { deliveryJob: { findMany: async () => [job], updateMany: async ({ data }) => { updates.push(data); return { count: 1 }; } },
      order: { findUniqueOrThrow: async () => ({ status: 'active', id: 'order', total: 3.49, clientEmail: 'test@example.test', details: 'encrypted', youtubeEmail: null, service: { name: 'Offer' }, termsVersion: null }) } };
    const { runDeliveryJobs } = createLoader({ resend: { Resend: FakeResend }, './prisma': { prisma: db }, './crypto': { decrypt: () => 'unit-test-access' } })('lib/deliveryWorker.ts');
    const result = await runDeliveryJobs();
    assert.equal(result.completed, 0); assert.equal(result.failed, 1);
    assert.equal(updates.at(-1).status, 'pending');
    assert.equal(updates.at(-1).lastError, 'delivery_failed');
  });
});

test('old uncertain mail jobs require review outside provider idempotency window', async () => {
  await withEnv({ REMEDIATION_SCHEMA_ENABLED: 'true', DELIVERY_WORKER_ENABLED: 'true', RESEND_API_KEY: 'unit-test-key' }, async () => {
    let last;
    class FakeResend { emails = { send: async () => { throw new Error('Must not send'); } }; }
    const db = { deliveryJob: { findMany: async () => [{ id: 'job', attempts: 1, createdAt: new Date(Date.now() - 24 * 3600000) }], updateMany: async ({ data }) => { last = data; return { count: 1 }; } } };
    await createLoader({ resend: { Resend: FakeResend }, './prisma': { prisma: db } })('lib/deliveryWorker.ts').runDeliveryJobs();
    assert.equal(last.status, 'needs_review');
  });
});

test('withdrawal is persisted before sending and never grants access or refunds', async () => {
  await withEnv({ RESEND_API_KEY: undefined, ENCRYPTION_KEY: 'unit-test-strong-encryption-key-long-enough' }, async () => {
    let saved;
    const load = createLoader({ '@/lib/rateLimit': { enforceRateLimit: async () => null }, '@/lib/prisma': { prisma: { setting: { create: async ({ data }) => { saved = data; } } } } });
    const response = await load('app/api/retractation/route.ts').POST(new Request('http://localhost/api/retractation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test Buyer', email: 'buyer@example.test', orderId: 'unit-test-order', confirmed: true }) }));
    const receipt = await response.json();
    assert.equal(response.status, 200); assert.equal(receipt.emailed, false);
    assert.ok(saved.value.startsWith('enc:v2:')); assert.equal(saved.value.includes('buyer@example.test'), false);
    const proof = JSON.parse(load('lib/crypto.ts').decrypt(saved.value));
    assert.equal(proof.receivedAt, receipt.receivedAt); assert.equal(proof.declaration, receipt.declaration);
  });
});

test('new admin read and mutation endpoints reject unauthenticated requests before querying', async () => {
  const load = createLoader({ '@/lib/adminAuth': { isAdminAuthenticated: async () => false } });
  for (const name of ['operations', 'commercial-review']) {
    const route = load(`app/api/admin/${name}/route.ts`);
    assert.equal((await route.GET()).status, 401);
    assert.equal((await (route.POST || route.PUT)(new Request('http://localhost'))).status, 401);
  }
});

for (const available of [true, false]) test(`paid Stripe checkout ${available ? 'queues delivery once' : 'queues refund review without access'} after reservation validation`, async () => {
  class AvailabilityError extends Error {}
  const updates = [], payments = [], jobs = [];
  const order = { id: 'order', status: 'pending', stockAccountId: 'stock', serviceId: 'offer', total: 3.49, clientEmail: 'buyer@example.test', service: { name: 'Offer' }, termsVersion: '2026-10-07.1' };
  let consumption = 0, chats = 0;
  const tx = { $queryRaw: async () => [], order: { findUniqueOrThrow: async () => order, update: async ({ data }) => updates.push(data) },
    stockReservation: { findUnique: async () => ({ id: 'reservation', checkoutSessionId: 'cs_test_fixture' }), update: async () => {} }, chatThread: { upsert: async () => { chats++; } } };
  const stripe = { subscriptions: { retrieve: async () => ({ customer: 'cus_fixture', default_payment_method: null, items: { data: [{ current_period_end: 1800000000 }] } }) } };
  const { fulfillReservedStripeOrder } = createLoader({
    './webhookTransaction': { processWebhookEvent: async (_event, callback) => callback(tx) },
    './stockReservations': { AvailabilityError, consumePlace: async () => { consumption++; if (!available) throw new AvailabilityError('No capacity'); return { details: 'encrypted-access' }; } },
    './durableOrders': { enqueueOrderJob: async (_tx, ...params) => jobs.push(params), recordOrderPayment: async (_tx, payment) => payments.push(payment) },
  })('lib/reservedStripeOrder.ts');
  const event = { created: 1800000000 };
  const session = { id: 'cs_test_fixture', payment_status: 'paid', subscription: 'sub_fixture', currency: 'eur', invoice: 'in_fixture', amount_total: 349, metadata: { orderId: 'order', reservationId: 'reservation' } };
  await fulfillReservedStripeOrder(event, { ...session, payment_status: 'unpaid' }, stripe);
  assert.equal(consumption, 0);
  await assert.rejects(fulfillReservedStripeOrder(event, { ...session, amount_total: 399 }, stripe), /proof mismatch/);
  assert.equal(consumption, 0);
  await fulfillReservedStripeOrder(event, session, stripe);
  assert.equal(consumption, 1);
  assert.equal(updates[0].status, available ? 'active' : 'payment_review');
  assert.equal(updates[0].details, available ? 'encrypted-access' : '');
  assert.equal(payments[0].status, available ? 'paid' : 'refund_needed');
  assert.equal(jobs[0][1], available ? 'delivery' : 'payment_review');
  assert.equal(chats, available ? 1 : 0);
  order.status = updates[0].status; order.stripeSubscriptionId = 'sub_fixture';
  await fulfillReservedStripeOrder(event, session, stripe);
  assert.equal(consumption, 1); assert.equal(payments.length, 1); assert.equal(jobs.length, 1);
});

test('invoice retry returns the existing invoice without allocating another number', async () => {
  const calls = [], existing = { id: 'invoice', number: 'SM-2026-0001' };
  const tx = { $queryRaw: async () => calls.push('lock'), invoice: { findUnique: async () => existing }, counter: { upsert: async () => { throw new Error('Must not allocate'); } } };
  const invoice = createLoader({ './prisma': { prisma: { $transaction: callback => callback(tx) } } })('lib/invoice.ts');
  assert.equal(await invoice.createInvoiceForOrder({ orderId: 'order' }), existing);
  assert.deepEqual(calls, ['lock']);
});
