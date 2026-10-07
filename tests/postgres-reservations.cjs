const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { createLoader } = require('./load-ts.cjs');

// Never accepts the application DATABASE_URL or a remote/production database.
const connection = process.env.TEST_DATABASE_URL;
if (!connection) throw new Error('TEST_DATABASE_URL is required; use an isolated local database ending in _test.');
const parsed = new URL(connection);
if (!['localhost', '127.0.0.1', 'postgres'].includes(parsed.hostname) || !parsed.pathname.endsWith('_test')) throw new Error('Refusing a non-local/non-test database.');
const db = new PrismaClient({ datasources: { db: { url: connection } }, log: [] });
const load = createLoader({ './prisma': { prisma: db } });
process.env.REMEDIATION_SCHEMA_ENABLED = 'true';
process.env.ENCRYPTION_KEY = 'integration-fixture-encryption-key-not-for-production';
const { reserveCheckout } = load('lib/checkoutReservation.ts');
const { activatePendingOrder } = load('lib/orderLifecycle.ts');
const { createInvoiceForOrder } = load('lib/invoice.ts');

test('PostgreSQL: simultaneous checkout attempts cannot reserve or consume the last slot twice', async () => {
  const serviceId = `test-${crypto.randomUUID()}`;
  let stock;
  try {
    await db.service.create({ data: { id: serviceId, name: 'Isolated test offer', tagline: 'Test', price: 3, original: 6, maxSlots: 1, active: true, icon: 'T', gradient: '', features: ['Test'] } });
    stock = await db.stockAccount.create({ data: { serviceId, price: 3, maxSlots: 1, details: 'test-encrypted-placeholder' } });
    const input = { serviceId, stockAccountId: stock.id, price: 3, total: 3, details: '', clientEmail: 'test@example.test', paymentMethod: 'PayPal', acceptedCgv: true, acceptedImmediateExecution: true, termsVersion: '2026-10-07.1' };
    const attempts = await Promise.allSettled(Array.from({ length: 4 }, () => reserveCheckout(crypto.randomUUID(), input)));
    const winners = attempts.filter(result => result.status === 'fulfilled');
    assert.equal(winners.length, 1);
    const winner = winners[0].value;
    assert.equal(await db.stockReservation.count({ where: { stockAccountId: stock.id, status: 'held' } }), 1);
    assert.equal((await db.stockAccount.findUniqueOrThrow({ where: { id: stock.id } })).filledSlots, 0);
    const activations = await Promise.allSettled([1, 2].map(() => db.$transaction(tx => activatePendingOrder(tx, winner.order.id))));
    assert.equal(activations.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal((await db.stockAccount.findUniqueOrThrow({ where: { id: stock.id } })).filledSlots, 1);
    assert.equal((await db.stockReservation.findUniqueOrThrow({ where: { id: winner.reservation.id } })).status, 'consumed');
    assert.equal(await db.deliveryJob.count({ where: { orderId: winner.order.id, kind: 'delivery' } }), 1);
    const counterKey = `invoice-${new Date().getFullYear()}`;
    const before = (await db.counter.findUnique({ where: { id: counterKey } }))?.value || 0;
    const invoiceInput = { orderId: winner.order.id, clientEmail: input.clientEmail, serviceName: 'Isolated test offer', amount: 3, paymentMethod: 'PayPal' };
    const invoices = await Promise.all([createInvoiceForOrder(invoiceInput), createInvoiceForOrder(invoiceInput)]);
    assert.equal(invoices[0].id, invoices[1].id);
    assert.equal((await db.counter.findUniqueOrThrow({ where: { id: counterKey } })).value, before + 1);
  } finally {
    // Only records bearing this randomly generated test service ID are removed.
    const orders = await db.order.findMany({ where: { serviceId }, select: { id: true } });
    const ids = orders.map(order => order.id);
    await db.deliveryJob.deleteMany({ where: { orderId: { in: ids } } });
    await db.stockReservation.deleteMany({ where: { orderId: { in: ids } } });
    await db.setting.deleteMany({ where: { key: { in: ids.map(id => `contract:${id}`) } } });
    await db.invoice.deleteMany({ where: { orderId: { in: ids } } });
    await db.order.deleteMany({ where: { serviceId } });
    if (stock) await db.stockAccount.delete({ where: { id: stock.id } });
    await db.service.deleteMany({ where: { id: serviceId } });
    await db.$disconnect();
  }
});
