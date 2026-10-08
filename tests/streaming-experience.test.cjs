const test = require('node:test');
const assert = require('node:assert/strict');
const { createLoader } = require('./load-ts.cjs');
const { streamingCategory, canCompareOffer } = createLoader()('lib/offerPresentation.ts');
const { validateContact } = createLoader()('lib/contactValidation.ts');
const contact = { email: 'Client@example.test', topic: 'eligibility', message: 'Mon compte est-il compatible ?', website: '', attemptId: 'd71a6e61-e503-4ee8-a38c-1045fa770b98' };

test('streaming categories match exact service identifiers and their variants, not substrings', () => {
  for (const id of ['netflix', 'netflix-premium', 'youtube', 'disney-plus', 'apple-tv-plus']) assert.equal(streamingCategory(id), 'video');
  for (const id of ['spotify-premium', 'deezer', 'apple-music']) assert.equal(streamingCategory(id), 'music');
  for (const id of ['surfshark', 'not-netflix', 'spotifyfake']) assert.equal(streamingCategory(id), 'other');
});

test('comparison needs a currently available stock and a verified valid reference', () => {
  const offer = { price: 5, original: 10, availableSlots: 1, availableStockId: 'stock', referenceVerified: true };
  assert.equal(canCompareOffer(offer), true);
  for (const change of [{ price: 0 }, { price: NaN }, { original: Infinity }, { original: 4 }, { referenceVerified: false }, { availableSlots: 0 }, { availableStockId: null }]) assert.equal(canCompareOffer({ ...offer, ...change }), false);
});

test('contact normalizes valid input and rejects unsolicited recipients, header injection and bots', () => {
  assert.equal(validateContact(contact).email, 'client@example.test');
  for (const change of [{ email: 'a@example.test\r\nBcc: b@example.test' }, { topic: '__proto__' }, { topic: 'arbitrary subject' }, { message: 'short' }, { message: 'a'.repeat(3001) }, { message: 'text\u0000invalid' }, { attemptId: 'not-a-uuid' }, { website: 'bot.test' }]) assert.equal(validateContact({ ...contact, ...change }), null);
  for (const invalid of [null, [], 'text', {}]) assert.equal(validateContact(invalid), null);
});

function contactRoute({ send = async () => ({ data: { id: 'fixture-mail' }, error: null }), rateLimit = async () => null } = {}) {
  return createLoader({ resend: { Resend: class { emails = { send }; } }, '@/lib/rateLimit': { enforceRateLimit: rateLimit } })('app/api/contact/route.ts');
}
function request(body = contact) { return new Request('https://streammalin.fr/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }

test('contact uses fixed destination, plain text and stable provider idempotency, with no automatic customer mail', async () => {
  const previous = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 're_fixture_not_real';
  try {
    const calls = [];
    const route = contactRoute({ send: async (...args) => { calls.push(args); return { data: { id: 'fixture' } }; } });
    const body = { ...contact, message: '<img src=x onerror=alert(1)> Question concernant mon compte' };
    assert.equal((await route.POST(request(body))).status, 202);
    assert.equal((await route.POST(request(body))).status, 202);
    assert.equal(calls[0][0].to, 'hello@streammalin.fr');
    assert.equal(calls[0][0].replyTo, 'client@example.test');
    assert.equal(calls[0][0].html, undefined);
    assert.ok(calls[0][0].text.includes(body.message));
    assert.equal(calls[0][1].idempotencyKey, calls[1][1].idempotencyKey);
    await route.POST(request({ ...body, message: 'Message différent pour un autre sujet' }));
    assert.notEqual(calls[0][1].idempotencyKey, calls[2][1].idempotencyKey);
  } finally { if (previous === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous; }
});

test('contact rejects malformed and oversized bodies without calling the provider', async () => {
  let sent = 0;
  const route = contactRoute({ send: async () => { sent++; throw Error('must not send'); } });
  assert.equal((await route.POST(request({ ...contact, topic: 'invalid' }))).status, 400);
  assert.equal((await route.POST(new Request('https://streammalin.fr/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' }))).status, 400);
  assert.equal((await route.POST(request({ ...contact, message: 'x'.repeat(17000) }))).status, 413);
  assert.equal(sent, 0);
});

test('contact fails closed on rate limiting, missing configuration and transport errors', async () => {
  const previous = process.env.RESEND_API_KEY;
  try {
    delete process.env.RESEND_API_KEY;
    assert.equal((await contactRoute().POST(request())).status, 503);
    process.env.RESEND_API_KEY = 're_fixture_not_real';
    assert.equal((await contactRoute({ rateLimit: async () => new Response('', { status: 429 }), send: async () => { throw Error('must not send'); } }).POST(request())).status, 429);
    assert.equal((await contactRoute({ send: async () => ({ error: { message: 'secret provider detail' } }) }).POST(request())).status, 503);
    const response = await contactRoute({ send: async () => { throw Error('secret provider detail'); } }).POST(request());
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes('secret provider detail'));
  } finally { if (previous === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous; }
});
