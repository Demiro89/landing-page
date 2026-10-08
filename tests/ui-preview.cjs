// Isolated UI fixtures. All API requests terminate here, never at a real provider.
const http = require('node:http');
const crypto = require('node:crypto');
const previewPort = Number(process.env.PREVIEW_PORT || 3101);
const nextPort = Number(process.env.PREVIEW_NEXT_PORT || 3100);
const services = [
  { id: 'netflix', name: 'Netflix Premium', icon: 'N', tagline: 'Films et series', price: 5.49, original: 19.99, maxSlots: 4, active: true, gradient: 'linear-gradient(135deg, #b32232, #721923)', features: ['Profil personnel', 'Qualite selon offre'] },
  { id: 'youtube', name: 'YouTube Premium', icon: 'YT', tagline: 'Videos et musique', price: 3.49, original: 12.99, maxSlots: 6, active: true, gradient: 'linear-gradient(135deg, #c43940, #942027)', features: ['Videos selon offre', 'Invitation par email'] },
  { id: 'spotify', name: 'Spotify Premium', icon: 'S', tagline: 'Musique et podcasts', price: 3.99, original: 11.99, maxSlots: 6, active: true, gradient: 'linear-gradient(135deg, #207c54, #175536)', features: ['Compte personnel', 'Musique selon offre'] },
].map(service => ({ ...service, eligibility: 'Fixture : compte et pays compatibles, sans restriction récente de groupe.', accessType: 'Invitation sur le compte personnel du client (démonstration).', privacyNote: 'Fixture : les autres membres peuvent voir le nom et l’adresse de profil.', referenceVerified: true, referenceUrl: 'https://example.test/tarifs', referenceCheckedAt: '2026-10-07' }));
const now = new Date().toISOString();
const stocks = [
  { id: 'fixture-netflix', serviceId: 'netflix', price: 5.49, maxSlots: 4, filledSlots: 2 },
  { id: 'fixture-netflix-alt', serviceId: 'netflix', price: 4.49, maxSlots: 4, filledSlots: 3 },
  { id: 'fixture-youtube', serviceId: 'youtube', price: 3.49, maxSlots: 6, filledSlots: 4 },
].map(s => ({ ...s, service: services.find(v => v.id === s.serviceId), details: 'DEMONSTRATION - aucun acces reel', accountsBoughtPrice: 12, createdAt: now, updatedAt: now }));
const settings = { gateway_cb: 'true', gateway_paypal: 'true', gateway_crypto: 'false', paypal_email: 'fixture@example.test', crypto_btc: '', crypto_eth: '', crypto_usdt: '', crypto_ltc: '' };
const unpaidOrders = [1, 3].map(level => ({
  id: `readonly-reminder-${level}`, status: 'unpaid', clientEmail: `demo-${level}@example.test`,
  serviceId: services[0].id, service: services[0], stockAccountId: stocks[0].id, stockAccount: stocks[0],
  price: 5.49, total: 5.49, details: '', date: now, createdAt: now, updatedAt: now,
  unpaidSince: now, lastReminderAt: now, reminderCount: level,
  paymentMethod: 'Carte bancaire (Stripe)', stripeSubscriptionId: 'sub_readonly_fixture',
}));
const adminOrders = ['active', 'pending', 'payment_review', 'unpaid', 'cancelled_pending', 'cancelled'].map((status, index) => ({
  id: `demo-order-${index + 1}`, status, clientEmail: `client-${index + 1}@example.test`,
  serviceId: services[index % 2].id, service: services[index % 2], stockAccountId: stocks[index % 2 === 0 ? 0 : 2].id,
  stockAccount: stocks[index % 2 === 0 ? 0 : 2], price: services[index % 2].price, fee: 0, total: services[index % 2].price,
  details: 'DEMONSTRATION - aucun acces reel', date: new Date(Date.now() - index * 86400000).toISOString(),
  paymentMethod: index % 2 === 0 ? 'Carte bancaire (Stripe)' : 'PayPal', stripeSubscriptionId: index % 2 === 0 ? `sub_demo_${index}` : null,
  unpaidSince: status === 'unpaid' ? now : null, reminderCount: status === 'unpaid' ? 1 : 0,
  cancellationEffectiveAt: status.startsWith('cancelled') ? now : null,
  acceptedTermsAt: now, acceptedWithdrawalWaiverAt: now, acceptedEligibilityAt: now, termsVersion: '2026-10-07.1',
  acceptanceIp: '192.0.2.1', acceptanceUserAgent: 'Demonstration locale',
}));
const adminOperations = {
  success: true, schemaEnabled: true,
  jobs: [{ id: 'demo-job-1', orderId: 'demo-order-1', kind: 'delivery', status: 'pending', attempts: 0, lastError: null },
    { id: 'demo-job-2', orderId: 'demo-order-3', kind: 'payment_review', status: 'needs_review', attempts: 1, lastError: 'Demonstration : verification prestataire necessaire.' },
    { id: 'demo-job-3', orderId: 'demo-order-6', kind: 'access_revocation', status: 'needs_review', attempts: 0, lastError: null }],
  payments: [{ id: 'demo-payment-1', orderId: 'demo-order-1', amountMinor: 549, paidAt: now, provider: 'stripe', providerPaymentId: 'pi_demo_non_reel', status: 'paid' }],
  sessions: [{ createdAt: now, expiresAt: new Date(Date.now() + 3600000).toISOString() }],
  withdrawals: [{ id: 'demo-withdrawal-1', orderId: 'demo-order-6', receivedAt: now, email: 'client-6@example.test' }],
};
const supportThreads = [0, 3].map(index => ({ id: adminOrders[index].id, orderId: adminOrders[index].id, title: 'Support demonstration', createdAt: now,
  order: { clientEmail: adminOrders[index].clientEmail, service: adminOrders[index].service },
  messages: [{ id: `demo-message-${index}`, sender: 'Vous', text: 'Bonjour, pouvez-vous verifier mon acces ? (demonstration)', createdAt: now }],
}));
const server = http.createServer((req, res) => {
  if (process.env.FIXTURE_DEBUG === 'true') console.log(req.method, req.url);
  const url = new URL(req.url, `http://127.0.0.1:${previewPort}`);
  const mode = url.searchParams.get('fixture') || /fixture-mode=(empty|error|soldout|reminders|admin|login)/.exec(req.headers.cookie || '')?.[1] || 'normal';
  const json = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  if (url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET') return json({ error: 'Demonstration locale : aucune operation effectuee.' }, 503);
    const empty = mode === 'empty';
    if (mode === 'error') return json({ error: 'Erreur simulee' }, 503);
    const endpoints = {
      '/api/services': { success: true, services: empty ? [] : services.map(s => ({ ...s, availableStockId: mode === 'soldout' ? null : stocks.find(v => v.serviceId === s.id)?.id || null, availableSlots: mode === 'soldout' ? 0 : stocks.filter(v => v.serviceId === s.id).reduce((n, v) => n + v.maxSlots - v.filledSlots, 0) })) },
      '/api/stocks/public': { success: true, stocks: empty || mode === 'soldout' ? [] : stocks.map(s => ({ id: s.id, serviceId: s.serviceId, price: s.price, maxSlots: s.maxSlots, filledSlots: s.filledSlots, service: s.service })) },
      '/api/settings/public': { success: true, settings },
      '/api/client/me': { authenticated: false },
      '/api/admin/auth': { authenticated: mode !== 'login' },
      '/api/admin/stock': { success: true, schemaEnabled: mode === 'admin', services: empty ? [] : services.map(s => ({ ...s, stocks: stocks.filter(v => v.serviceId === s.id) })), orders: mode === 'admin' ? adminOrders : mode === 'reminders' ? unpaidOrders : [], kpis: { totalRevenue: 0, totalCogs: 0, totalInvestment: empty ? 0 : 36, netProfit: 0, marginPercentage: 0 } },
      '/api/admin/settings': { success: true, settings },
      '/api/admin/clients': { success: true, clients: mode === 'admin' ? adminOrders.map(order => ({ email: order.clientEmail, firstOrderDate: new Date(order.date).toLocaleDateString('fr-FR'), orderCount: 1, activeOrders: Number(order.status === 'active'), totalSpent: ['active', 'unpaid', 'cancelled_pending'].includes(order.status) ? order.total : 0 })) : [] },
      '/api/admin/2fa': { success: true, enabled: false },
      '/api/admin/commercial-review': { success: true, commerceEnabled: false, schemaEnabled: false, services: services.map(service => ({ id: service.id, name: service.name, active: service.active, review: { status: 'unverified', authorizationReference: '', eligibility: service.eligibility, accessType: service.accessType, privacyNote: service.privacyNote, referenceUrl: '', referenceCheckedAt: '', referencePrice: null, comparableReference: false } })) },
      '/api/admin/operations': mode === 'admin' ? adminOperations : { success: true, schemaEnabled: false, jobs: [], payments: [], sessions: [], withdrawals: [] },
      '/api/admin/audit': { success: true, logs: mode === 'admin' ? [{ id: 'demo-audit-1', action: 'order.validate', entityType: 'order', entityId: 'demo-order-1', description: 'DEMONSTRATION : validation de paiement', ip: '192.0.2.1', createdAt: now }] : [] },
      '/api/chat': { success: true, threads: mode === 'admin' ? supportThreads : [] },
    };
    return json(endpoints[url.pathname] || { error: 'API non simulee' }, endpoints[url.pathname] ? 200 : 404);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return json({ error: 'Lecture seule' }, 405);
  const exp = String(Date.now() + 600000);
  const signature = crypto.createHmac('sha256', 'audit-local-admin-secret-not-for-production').update(exp).digest('hex');
  const upstream = http.request({ hostname: '127.0.0.1', port: nextPort, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${nextPort}`, cookie: `ADMIN_SECRET_TOKEN=${exp}.${signature}` } }, upstreamRes => {
    const headers = { ...upstreamRes.headers };
    if (url.searchParams.has('fixture')) headers['set-cookie'] = `fixture-mode=${mode}; Path=/; HttpOnly; SameSite=Strict`;
    delete headers['set-cookie2'];
    res.writeHead(upstreamRes.statusCode, headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error', () => json({ error: 'Serveur local indisponible' }, 502));
  upstream.end();
});
server.listen(previewPort, '127.0.0.1', () => console.log(`UI fixtures: http://127.0.0.1:${previewPort} (read-only)`));
