import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createStore } from 'zustand/vanilla';
import { webcrypto } from 'node:crypto';

const tripId = 'trp_8fbaf8c3-9e86-4f5a-a2e8-4a3b153a625d';
const paymentId = `demo_${tripId}`;
const pending = { tripId: paymentId, status: 'Pending', method: null, amount: 725.5, currency: 'LKR', paidAt: null };
const card = { cardId: 'card-1', isDefault: true, brand: 'Visa', last4: '4242' };

function module(path, modules = {}, globals = {}) {
  const source = fs.readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (id) => { assert.ok(modules[id], `Unexpected dependency: ${id}`); return modules[id]; },
    ...globals,
  });
  return exports;
}

// Load the actual adapters; fetch is controlled so these tests never use a network.
function client({ live = false, mode = 'mock', fetch } = {}) {
  const mapping = module('lib/api/payment-trip.ts', {
    './live-rider-matching': { isLiveTrip: () => live },
  }, { process: { env: { NEXT_PUBLIC_API_MODE: mode } } });
  const requests = [];
  const context = {
    AbortSignal, URL, URLSearchParams,
    process: { env: { NEXT_PUBLIC_API_MODE: mode } },
    fetch: async (url, init) => {
      requests.push({ url, init });
      return fetch ? fetch(url, init) : Response.json({ tripId: live || mode === 'http' ? tripId : paymentId });
    },
  };
  return {
    mapping, requests,
    ...module('lib/api/payments-live.ts', { './payment-trip': mapping }, context),
    ...module('lib/api/http.ts', {
      './payment-trip': mapping, '@microsoft/signalr': {}, '@/lib/auth/session': { getAccessToken: () => null },
    }, context),
  };
}

for (const live of [false, true]) {
  test(`${live ? 'live' : 'simulated'} payment requests use the correct trip ID on every endpoint`, async () => {
    const id = live ? tripId : paymentId;
    const h = client({ live, fetch: async () => Response.json({
      tripId: id, confirmation: { tripId: id, providerReference: paymentId },
    }) });
    await h.paymentService.completeDemoTrip(tripId, 725.5);
    const completion = h.requests[0];
    assert.equal(completion.url, '/payments/demo-completions');
    assert.deepEqual(JSON.parse(completion.init.body), { tripId: id, finalFare: 725.5 });
    const endpoints = [
      ['status', [], 'status', 'GET'], ['pay', ['card-1', 'request-1'], 'pay', 'POST'],
      ['confirmation', [], 'confirmation', 'GET'], ['receipt', [], 'receipt', 'GET'],
      ['resendReceipt', [], 'receipt/resend', 'POST'],
    ];
    for (const [method, args, path, verb] of endpoints) {
      const result = await h.paymentService[method](tripId, ...args);
      const request = h.requests.at(-1);
      assert.equal(request.url, `/payments/${id}/${path}`);
      assert.equal(request.init.method, verb);
      assert.equal(request.init.credentials, 'same-origin');
      assert.equal(request.init.cache, 'no-store');
      assert.equal(result.tripId, tripId);
      assert.equal(result.confirmation.tripId, tripId);
      assert.equal(result.confirmation.providerReference, paymentId);
    }
    assert.deepEqual(JSON.parse(h.requests[2].init.body), { cardId: 'card-1', requestId: 'request-1' });
    for (const [method, args, suffix] of [
      ['get', [], ''], ['selectMethod', ['Card'], '/select-method'],
      ['recordPayment', [{ method: 'Card' }], ''], ['dispute', ['rider', 'reason'], '/dispute'],
    ]) {
      const result = await h.httpApi.payments[method](tripId, ...args);
      assert.equal(new URL(h.requests.at(-1).url).pathname, `/payments/${id}${suffix}`);
      assert.equal(result.tripId, tripId);
    }
  });
}

test('HTTP mode keeps live IDs even without browser matching state', async () => {
  const h = client({ mode: 'http' });
  assert.equal(h.mapping.toPaymentTripId(tripId), tripId);
  assert.equal((await h.paymentService.status(tripId)).tripId, tripId);
  assert.equal(h.requests[0].url, `/payments/${tripId}/status`);
});

test('settled live trips retain their payment namespace in persisted history and other tabs', () => {
  const { world } = module('lib/mock/world.ts', {
    '@/lib/constants': {}, '@/lib/utils': { uid: () => 'notification-1' }, '@/lib/geo/providers': {}, './seed': {},
  });
  for (const live of [true, false]) {
    const trip = { id: tripId, riderId: 'rider-1', driverId: 'driver-1', version: 1,
      pickup: { name: 'Pickup' }, destination: { name: 'Destination' } };
    const state = { sim: { [tripId]: { live, phase: 'done' } }, notifications: [] };
    world().markPaid(state, trip, { finalFare: 725.5, method: 'Card' });
    assert.equal(trip.status, 'PAID');
    // The world is persisted as JSON and read back by reloads and other tabs.
    const restored = JSON.parse(JSON.stringify(state));
    const matching = module('lib/api/live-rider-matching.ts', {
      '@/lib/constants': {}, '@/components/ui/toast': {}, './live-matching': {},
      '@/lib/mock/world': { world: () => ({ get: () => restored }) },
    });
    const mapping = module('lib/api/payment-trip.ts', { './live-rider-matching': matching }, { process: { env: {} } });
    assert.equal(matching.isLiveTrip(tripId), live);
    assert.equal(mapping.toPaymentTripId(tripId), live ? tripId : paymentId);
  }
});

test('UUID and actual base36 fallback generators fit the payment namespace across reloads', () => {
  for (const crypto of [webcrypto, undefined]) {
    const { uid } = module('lib/utils.ts', { clsx: {}, 'tailwind-merge': {} }, { crypto });
    const uiId = uid('trp');
    const first = client().mapping.toPaymentTripId(uiId);
    const reloaded = client().mapping.toPaymentTripId(uiId);
    assert.match(first, /^demo_trp_[A-Za-z0-9_-]{1,100}$/);
    assert.equal(first, `demo_${uiId}`);
    assert.equal(reloaded, first);
    assert.equal(client().mapping.fromPaymentTripIds({ tripId: first }).tripId, uiId);
  }
});

test('response mapping handles collections and nested IDs without changing references or unrelated trip IDs', async () => {
  const original = { tripId: paymentId, confirmation: { tripId: 'demo_trp_other', confirmationId: paymentId },
    notifications: [{ tripId: paymentId }, { tripId: 'trp_live' }], optional: null, reference: paymentId };
  const h = client({ fetch: async () => Response.json(original) });
  for (const read of [
    () => h.paymentService.driverNotifications('2026-10-11T00:00:00Z'),
    () => h.httpApi.payments.list({}), () => h.httpApi.payments.listDisputes(),
    () => h.httpApi.payments.resolveDispute('dispute-1', 'Resolved'),
  ]) {
    const result = await read();
    assert.equal(result.tripId, tripId);
    assert.equal(result.confirmation.tripId, 'trp_other');
    assert.notEqual(result.confirmation.tripId, tripId);
    assert.equal(result.confirmation.confirmationId, paymentId);
    assert.equal(result.notifications[0].tripId, tripId);
    assert.equal(result.notifications[1].tripId, 'trp_live');
    assert.equal(result.optional, null);
    assert.equal(result.reference, paymentId);
  }
  assert.equal(original.tripId, paymentId);
  assert.equal(h.mapping.fromPaymentTripIds(null), null);
  assert.equal(h.mapping.fromPaymentTripIds(undefined), undefined);
});

test('null status and structured retry errors retain their existing behavior', async () => {
  const empty = client({ fetch: async () => Response.json(null) });
  assert.equal(await empty.paymentService.status(tripId), null);
  const failed = client({ fetch: async () => Response.json({ title: 'Retry later', code: 'PROCESSING_ERROR',
    retryable: true, autoRetried: true, attempts: 2 }, { status: 402 }) });
  await assert.rejects(failed.paymentService.pay(tripId, 'card-1', 'request-1'), (e) => {
    assert.equal(e.code, 'PROCESSING_ERROR');
    assert.equal(e.retryable, true);
    assert.equal(e.autoRetried, true);
    assert.equal(e.attempts, 2);
    return true;
  });
});

function checkout(fetch, storage = new Map()) {
  const h = client({ fetch });
  const timers = new Map();
  const settlements = [];
  let timerId = 0;
  const { useCheckoutStore: store } = module('store/checkout-store.ts', {
    zustand: { create: () => (factory) => createStore(factory) },
    '@/lib/api': { errorMessage: (e) => e.message },
    '@/lib/api/payments-live': h,
    '@/lib/card-input': { sortCards: (cards) => cards, withCard: (_, c) => [c] },
    './ride-store': { useRideStore: { getState: () => ({ settlePayment: async (p) => settlements.push(p) }) } },
  }, {
    setTimeout: (callback) => { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout: (id) => timers.delete(id), Date, console, crypto: webcrypto,
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  });
  const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
  return {
    ...h, store, settlements, timers, flush,
    async begin() { store.getState().begin({ tripId, live: false, finalFare: 725.5 }); await flush(); },
    async tick() { const [id, callback] = timers.entries().next().value; timers.delete(id); await callback(); await flush(); },
  };
}

function respond(url) {
  if (url.endsWith('/demo-completions')) return Response.json({ tripId: paymentId });
  if (url.endsWith('/cards')) return Response.json({ cards: [card] });
  if (url.endsWith('/status')) return Response.json(pending);
  assert.fail(`Unexpected request: ${url}`);
}

test('simulated checkout recovers a lost pay response across reloads with the same payment and request IDs', async () => {
  const storage = new Map();
  const charges = [];
  let paid = false;
  const fetch = async (url, init) => {
    if (url.endsWith('/pay')) { charges.push({ url, body: init.body }); throw new Error('Lost response'); }
    if (url.endsWith('/status') && paid) return Response.json({ ...pending, status: 'Paid', method: 'Card' });
    return respond(url);
  };
  const first = checkout(fetch, storage);
  await first.begin();
  assert.equal(first.store.getState().stage, 'ready');
  await first.store.getState().payByCard();
  assert.ok(first.store.getState().pendingPay);
  first.store.getState().pause();
  const reloaded = checkout(fetch, storage);
  await reloaded.begin();
  await reloaded.store.getState().payByCard();
  assert.equal(charges.length, 2);
  assert.deepEqual(charges[0], charges[1]);
  assert.equal(charges[0].url, `/payments/${paymentId}/pay`);
  paid = true;
  await reloaded.tick();
  assert.equal(reloaded.store.getState().stage, 'paid');
  assert.equal(reloaded.store.getState().result.tripId, tripId);
  assert.equal(reloaded.settlements.length, 1);
  assert.equal(reloaded.settlements[0].tripId, tripId);
  assert.equal(storage.has(`card-pay:${tripId}`), false);
});

test('simulated checkout preserves double-tap and stale-poll guards while Pay is in flight', async () => {
  let finishPay, finishPoll;
  let slowPoll = false;
  let charges = 0;
  const h = checkout(async (url) => {
    if (url.endsWith('/pay')) { charges++; return new Promise((resolve) => { finishPay = resolve; }); }
    if (url.endsWith('/status') && slowPoll) return new Promise((resolve) => { finishPoll = resolve; });
    return respond(url);
  });
  await h.begin();
  slowPoll = true;
  const polling = h.tick();
  const paying = h.store.getState().payByCard();
  await h.store.getState().payByCard();
  finishPoll(Response.json(pending));
  await polling;
  assert.equal(h.store.getState().stage, 'processing');
  assert.equal(charges, 1);
  finishPay(Response.json({ confirmation: { tripId: paymentId, amount: 725.5, currency: 'LKR', providerReference: 'demo_paid' } }));
  await paying;
  assert.equal(h.store.getState().stage, 'paid');
  assert.equal(h.settlements.length, 1);
  assert.equal(h.settlements[0].tripId, tripId);
});

test('simulated checkout ignores another trip status and picks up payment completed in another tab', async () => {
  let status = { ...pending, tripId: 'demo_trp_other', status: 'Paid', method: 'Card' };
  const h = checkout(async (url) => url.endsWith('/status') ? Response.json(status) : respond(url));
  await h.begin();
  assert.equal(h.settlements.length, 0);
  status = { ...pending, status: 'Paid', method: 'Card' };
  await h.tick();
  assert.equal(h.store.getState().stage, 'paid');
  assert.equal(h.settlements.length, 1);
  assert.equal(h.settlements[0].tripId, tripId);
  assert.ok(h.requests.every(({ url }) => !url.endsWith('/pay')));
});
