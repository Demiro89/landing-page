// Isolated UI fixtures. All API requests terminate here, never at a real provider.
const http = require('node:http');
const crypto = require('node:crypto');
const services = [
  { id: 'netflix', name: 'Netflix Premium', icon: 'N', tagline: 'Films et series', price: 5.49, original: 19.99, maxSlots: 4, active: true, gradient: 'linear-gradient(135deg, #b32232, #721923)', features: ['Profil personnel', 'Qualite selon offre'] },
  { id: 'youtube', name: 'YouTube Premium', icon: 'YT', tagline: 'Videos et musique', price: 3.49, original: 12.99, maxSlots: 6, active: true, gradient: 'linear-gradient(135deg, #c43940, #942027)', features: ['Videos selon offre', 'Invitation par email'] },
  { id: 'spotify', name: 'Spotify Premium', icon: 'S', tagline: 'Musique et podcasts', price: 3.99, original: 11.99, maxSlots: 6, active: true, gradient: 'linear-gradient(135deg, #207c54, #175536)', features: ['Compte personnel', 'Musique selon offre'] },
];
const now = new Date().toISOString();
const stocks = [
  { id: 'fixture-netflix', serviceId: 'netflix', price: 5.49, maxSlots: 4, filledSlots: 2 },
  { id: 'fixture-netflix-alt', serviceId: 'netflix', price: 4.49, maxSlots: 4, filledSlots: 3 },
  { id: 'fixture-youtube', serviceId: 'youtube', price: 3.49, maxSlots: 6, filledSlots: 4 },
].map(s => ({ ...s, service: services.find(v => v.id === s.serviceId), details: 'DEMONSTRATION - aucun acces reel', accountsBoughtPrice: 12, createdAt: now, updatedAt: now }));
const settings = { gateway_cb: 'true', gateway_paypal: 'true', gateway_crypto: 'false', paypal_email: 'fixture@example.test', crypto_btc: '', crypto_eth: '', crypto_usdt: '', crypto_ltc: '' };
const server = http.createServer((req, res) => {
  if (process.env.FIXTURE_DEBUG === 'true') console.log(req.method, req.url);
  const url = new URL(req.url, 'http://127.0.0.1:3101');
  const mode = url.searchParams.get('fixture') || /fixture-mode=(empty|error)/.exec(req.headers.cookie || '')?.[1] || 'normal';
  const json = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  if (url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET') return json({ error: 'Demonstration locale : aucune operation effectuee.' }, 503);
    const empty = mode === 'empty';
    if (mode === 'error') return json({ error: 'Erreur simulee' }, 503);
    const endpoints = {
      '/api/services': { success: true, services: empty ? [] : services.map(s => ({ ...s, availableStockId: stocks.find(v => v.serviceId === s.id)?.id || null, availableSlots: stocks.filter(v => v.serviceId === s.id).reduce((n, v) => n + v.maxSlots - v.filledSlots, 0) })) },
      '/api/stocks/public': { success: true, stocks: empty ? [] : stocks.map(s => ({ id: s.id, serviceId: s.serviceId, price: s.price, maxSlots: s.maxSlots, filledSlots: s.filledSlots, service: s.service })) },
      '/api/settings/public': { success: true, settings },
      '/api/client/me': { authenticated: false },
      '/api/admin/auth': { authenticated: true },
      '/api/admin/stock': { success: true, services: services.map(s => ({ ...s, stocks: stocks.filter(v => v.serviceId === s.id) })), orders: [], kpis: { totalRevenue: 0, totalCogs: 0, totalInvestment: 36, netProfit: 0, marginPercentage: 0 } },
      '/api/admin/settings': { success: true, settings },
      '/api/admin/clients': { success: true, clients: [] },
      '/api/admin/2fa': { success: true, enabled: false },
      '/api/chat': { success: true, threads: [] },
    };
    return json(endpoints[url.pathname] || { error: 'API non simulee' }, endpoints[url.pathname] ? 200 : 404);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return json({ error: 'Lecture seule' }, 405);
  const exp = String(Date.now() + 600000);
  const signature = crypto.createHmac('sha256', 'audit-local-admin-secret-not-for-production').update(exp).digest('hex');
  const upstream = http.request({ hostname: '127.0.0.1', port: 3100, path: req.url, method: req.method, headers: { ...req.headers, host: '127.0.0.1:3100', cookie: `ADMIN_SECRET_TOKEN=${exp}.${signature}` } }, upstreamRes => {
    const headers = { ...upstreamRes.headers };
    if (url.searchParams.has('fixture')) headers['set-cookie'] = `fixture-mode=${mode}; Path=/; HttpOnly; SameSite=Strict`;
    delete headers['set-cookie2'];
    res.writeHead(upstreamRes.statusCode, headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error', () => json({ error: 'Serveur local indisponible' }, 502));
  upstream.end();
});
server.listen(3101, '127.0.0.1', () => console.log('UI fixtures: http://127.0.0.1:3101 (read-only)'));
