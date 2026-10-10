import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createStore } from 'zustand/vanilla';
import { webcrypto } from 'node:crypto';

// Run the actual store with controlled network responses and timers. No browser,
// real accounts, live payments, or additional test dependencies are needed.
function checkout(overrides = {}, storage = new Map()) {
  const timers = new Map();
  const settlements = [];
  const requests = [];
  let timerId = 0;
  const pending = { tripId: 'trip-1', status: 'Pending', method: null, amount: 725.5, currency: 'LKR', paidAt: null };
  const card = { cardId: 'card-1', isDefault: true, brand: 'Visa', last4: '4242' };
  const paymentService = {
    status: async () => { requests.push('status'); return pending; },
    cards: { list: async () => { requests.push('cards'); return [card]; } },
    ...overrides,
  };
  const modules = {
    zustand: { create: () => (factory) => createStore(factory) },
    '@/lib/api': { errorMessage: (e) => e.message },
    '@/lib/api/payments-live': {
      paymentService,
      isPaymentError: (e, ...codes) => !!e.code && (!codes.length || codes.includes(e.code)),
      paidOutcomeFromStatus: (s) => ({ ...s, reference: null }),
    },
    '@/lib/card-input': { sortCards: (cards) => cards, withCard: (_, c) => [c] },
    './ride-store': { useRideStore: { getState: () => ({ settlePayment: async (p) => settlements.push(p) }) } },
  };
  const source = fs.readFileSync(new URL('../../src/store/checkout-store.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (id) => { assert.ok(modules[id], `Unexpected dependency: ${id}`); return modules[id]; },
    setTimeout: (callback) => { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout: (id) => timers.delete(id),
    Date, console, crypto: webcrypto,
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  });
  const store = exports.useCheckoutStore;
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  return {
    store, paymentService, settlements, pending, timers, requests,
    async begin(method = 'Card') { store.getState().begin({ tripId: 'trip-1', live: true, finalFare: 725.5, method }); await flush(); },
    async tick() { const [id, callback] = timers.entries().next().value; timers.delete(id); await callback(); await flush(); },
    flush,
  };
}

test('live cash checkout finishes locally without any payment-service requests', async () => {
  const h = checkout();
  await h.begin('Cash');
  h.store.getState().payByCash();
  assert.equal(h.store.getState().stage, 'paid');
  assert.equal(h.store.getState().result.method, 'Cash');
  assert.equal(h.store.getState().result.currency, 'LKR');
  assert.equal(h.store.getState().result.reference, null);
  assert.equal(h.store.getState().result.cardLast4, null);
  assert.equal(h.settlements.length, 1);
  assert.equal(h.settlements[0].amount, 725.5);
  assert.equal(h.timers.size, 0);
  h.store.getState().payByCash();
  await h.flush();
  assert.equal(h.settlements.length, 1);
  assert.deepEqual(h.requests, []);
});

test('reopening a finished local cash checkout does not poll or settle it again', async () => {
  const h = checkout();
  await h.begin('Cash');
  h.store.getState().payByCash();
  h.store.getState().pause();
  await h.begin('Cash');
  assert.equal(h.store.getState().stage, 'paid');
  assert.equal(h.settlements.length, 1);
  assert.equal(h.timers.size, 0);
  assert.deepEqual(h.requests, []);
});

test('switching from cash to card starts normal card preparation', async () => {
  const h = checkout();
  await h.begin('Cash');
  assert.deepEqual(h.requests, []);
  await h.begin('Card');
  assert.equal(h.store.getState().stage, 'ready');
  assert.equal(h.store.getState().selectedCardId, 'card-1');
  assert.deepEqual(h.requests, ['status', 'cards']);
});

test('a lost card response recovers the committed payment without charging again', async () => {
  let charges = 0;
  const h = checkout({ pay: async () => { charges++; throw new Error('Connection lost'); } });
  await h.begin();
  h.paymentService.status = async () => ({ ...h.pending, status: 'Paid', method: 'Card' });
  await h.store.getState().payByCard();
  assert.equal(h.store.getState().stage, 'paid');
  assert.equal(charges, 1);
  assert.equal(h.settlements.length, 1);
});

test('double taps and an older pending poll cannot enable a second card charge', async () => {
  let finish, resolveStatus, charges = 0;
  const h = checkout({ pay: () => { charges++; return new Promise((r) => { finish = r; }); } });
  await h.begin();
  h.paymentService.status = () => new Promise((r) => { resolveStatus = r; });
  const poll = h.tick();
  const request = h.store.getState().payByCard();
  h.store.getState().payByCash();
  assert.equal(h.store.getState().stage, 'processing');
  assert.equal(h.settlements.length, 0);
  resolveStatus(h.pending);
  await poll;
  h.paymentService.status = async () => h.pending;
  await h.tick();
  assert.equal(h.store.getState().stage, 'processing');
  await h.store.getState().payByCard();
  assert.equal(charges, 1);
  finish({ confirmation: { amount: 725.5, currency: 'LKR', cardLast4: '4242', providerReference: 'demo_paid' } });
  await request;
  assert.equal(h.store.getState().stage, 'paid');
});

test('automatic retry is reported by the server without a second client charge', async () => {
  let finish;
  const charges = [];
  const h = checkout({ pay: (...args) => { charges.push(args); return new Promise((resolve) => { finish = resolve; }); } });
  await h.begin();
  const paying = h.store.getState().payByCard();
  const requestId = charges[0][2];
  h.paymentService.status = async () => ({ ...h.pending, requestId, requestState: 'Retrying', autoRetried: true, requestAttempts: 1 });
  await h.tick();
  assert.equal(h.store.getState().autoRetrying, true);
  assert.equal(h.store.getState().stage, 'processing');
  // A delayed first-attempt snapshot cannot hide a retry or enable Pay.
  h.paymentService.status = async () => ({ ...h.pending, requestId, requestState: 'Processing' });
  await h.tick();
  assert.equal(h.store.getState().autoRetrying, true);
  await h.store.getState().payByCard();
  assert.equal(charges.length, 1);
  finish({ confirmation: { amount: 812.37, currency: 'LKR', cardLast4: '0341', providerReference: 'demo_paid' }, attempts: 2, autoRetried: true });
  await paying;
  assert.equal(h.store.getState().stage, 'paid');
  assert.equal(h.store.getState().result.amount, 812.37);
  assert.equal(h.settlements.length, 1);
});

for (const [code, retryable, autoRetried, attempts] of [
  ['PROCESSING_ERROR', true, true, 2], ['CARD_DECLINED', false, false, 1],
]) {
  test(`${code} keeps the failure metadata and manual Retry starts a new request`, async () => {
    const ids = [];
    const h = checkout({ pay: async (trip, card, id) => {
      ids.push(id);
      throw Object.assign(new Error('Payment failed'), { status: 402, code, retryable, autoRetried, attempts });
    } });
    await h.begin();
    await h.store.getState().payByCard();
    const state = h.store.getState();
    assert.equal(state.stage, 'ready');
    assert.equal(state.cardDisabled, false);
    assert.equal(state.payError.retryable, retryable);
    assert.equal(state.payError.autoRetried, autoRetried);
    assert.equal(state.payError.attempts, attempts);
    assert.equal(state.pendingPay, null);
    await state.payByCard();
    assert.equal(ids.length, 2);
    assert.notEqual(ids[0], ids[1]);
  });
}

test('an uncertain response reuses its request ID after reload, even with a removed card', async () => {
  const storage = new Map();
  const charges = [];
  const pay = async (...args) => { charges.push(args); throw new Error('Connection lost'); };
  const first = checkout({ pay }, storage);
  await first.begin();
  await first.store.getState().payByCard();
  assert.ok(first.store.getState().pendingPay);
  first.store.getState().selectCard('replacement');
  assert.equal(first.store.getState().selectedCardId, 'card-1');
  first.store.getState().payByCash();
  assert.equal(first.settlements.length, 0);
  const reloaded = checkout({ pay, cards: { list: async () => [] } }, storage);
  await reloaded.begin();
  await reloaded.store.getState().payByCard();
  assert.equal(charges.length, 2);
  assert.deepEqual(charges[0], charges[1]);
});

test('a new saved card can be used with a new request after a hard decline', async () => {
  const charges = [];
  const h = checkout({ pay: async (...args) => {
    charges.push(args);
    if (charges.length === 1) throw Object.assign(new Error('Use another card'), { code: 'EXPIRED_CARD', status: 402, attempts: 1, retryable: false, autoRetried: false });
    return { confirmation: { amount: 725.5, currency: 'LKR', cardLast4: '4444' } };
  } });
  await h.begin();
  await h.store.getState().payByCard();
  h.store.getState().addCard({ cardId: 'replacement', brand: 'Mastercard', last4: '4444' });
  await h.store.getState().payByCard();
  assert.equal(charges[1][1], 'replacement');
  assert.notEqual(charges[0][2], charges[1][2]);
  assert.equal(h.store.getState().stage, 'paid');
});

test('polling a confirmed failure resolves a lost response and enables a new manual request', async () => {
  const ids = [];
  const h = checkout({ pay: async (trip, card, id) => { ids.push(id); throw new Error('Response lost'); } });
  await h.begin();
  await h.store.getState().payByCard();
  h.paymentService.status = async () => ({ ...h.pending, requestId: ids[0], requestState: 'Failed', requestAttempts: 2, autoRetried: true, retryable: true, lastFailureCode: 'PROCESSING_ERROR' });
  await h.tick();
  assert.equal(h.store.getState().pendingPay, null);
  assert.equal(h.store.getState().payError.autoRetried, true);
  await h.store.getState().payByCard();
  assert.notEqual(ids[0], ids[1]);
});

test('another tab retrying blocks Pay until its final outcome arrives', async () => {
  const h = checkout();
  await h.begin();
  h.paymentService.status = async () => ({ ...h.pending, requestId: 'another-tab', requestState: 'Retrying' });
  await h.tick();
  assert.equal(h.store.getState().stage, 'processing');
  assert.equal(h.store.getState().autoRetrying, true);
  await h.store.getState().payByCard();
  h.paymentService.status = async () => ({ ...h.pending, status: 'Paid', method: 'Card' });
  await h.tick();
  assert.equal(h.store.getState().stage, 'paid');
  assert.equal(h.settlements.length, 1);
});

test('a Paid poll settles once and a late failed pay response cannot revert it', async () => {
  let reject;
  const h = checkout({ pay: () => new Promise((_, fail) => { reject = fail; }) });
  await h.begin();
  const paying = h.store.getState().payByCard();
  h.paymentService.status = async () => ({ ...h.pending, status: 'Paid', method: 'Card' });
  await h.tick();
  reject(new Error('Response lost'));
  await paying;
  assert.equal(h.store.getState().stage, 'paid');
  assert.equal(h.settlements.length, 1);
  assert.equal(h.timers.size, 0);
});

test('a poll begun during pay cannot overwrite the final failure', async () => {
  let reject, resolveStatus;
  const h = checkout({ pay: () => new Promise((_, fail) => { reject = fail; }) });
  await h.begin();
  const paying = h.store.getState().payByCard();
  const requestId = h.store.getState().pendingPay.requestId;
  h.paymentService.status = () => new Promise((resolve) => { resolveStatus = resolve; });
  const poll = h.tick();
  h.paymentService.status = async () => h.pending;
  reject(Object.assign(new Error('No funds'), { status: 402, code: 'INSUFFICIENT_FUNDS', attempts: 1, retryable: false }));
  await paying;
  resolveStatus({ ...h.pending, requestId, requestState: 'Retrying' });
  await poll;
  assert.equal(h.store.getState().stage, 'ready');
  assert.equal(h.store.getState().autoRetrying, false);
  assert.equal(h.store.getState().payError.code, 'INSUFFICIENT_FUNDS');
});

test('pausing and reopening an active request resumes status polling', async () => {
  let finish;
  const h = checkout({ pay: () => new Promise((resolve) => { finish = resolve; }) });
  await h.begin();
  const paying = h.store.getState().payByCard();
  const requestId = h.store.getState().pendingPay.requestId;
  h.store.getState().pause();
  h.paymentService.status = async () => ({ ...h.pending, requestId, requestState: 'Retrying' });
  await h.begin();
  assert.equal(h.store.getState().stage, 'processing');
  assert.equal(h.store.getState().autoRetrying, true);
  finish({ confirmation: { amount: 725.5, currency: 'LKR', cardLast4: '0341' } });
  await paying;
  assert.equal(h.store.getState().stage, 'paid');
});

test('reopening checkout discovers a payment completed in another tab', async () => {
  const h = checkout();
  await h.begin();
  h.store.getState().pause();
  h.paymentService.status = async () => ({ ...h.pending, status: 'Paid', method: 'Card' });
  await h.begin();
  assert.equal(h.store.getState().stage, 'paid');
});

test('selecting cash stops card polling and prevents a subsequent card charge', async () => {
  let charges = 0;
  const h = checkout({
    pay: async () => { charges++; },
  });
  await h.begin();
  const requests = [...h.requests];
  await h.begin('Cash');
  assert.equal(h.timers.size, 0);
  h.store.getState().payByCash();
  await h.store.getState().payByCard();
  assert.equal(charges, 0);
  assert.equal(h.store.getState().stage, 'paid');
  assert.deepEqual(h.requests, requests);
});

test('a poll started before choosing cash cannot revert the finished checkout', async () => {
  const h = checkout();
  await h.begin();
  let resolveStatus;
  h.paymentService.status = () => new Promise((r) => { resolveStatus = r; });
  const poll = h.tick();
  h.store.getState().payByCash();
  resolveStatus(h.pending);
  await poll;
  assert.equal(h.store.getState().stage, 'paid');
  assert.equal(h.settlements.length, 1);
  assert.equal(h.timers.size, 0);
});

test('cash can finish locally even when card payment preparation fails', async () => {
  const h = checkout();
  await h.begin('Cash');
  h.store.setState({ stage: 'prepare_failed', prepareError: 'Payment service unavailable' });
  h.store.getState().payByCash();
  assert.equal(h.store.getState().stage, 'paid');
  assert.equal(h.store.getState().prepareError, null);
  assert.equal(h.settlements.length, 1);
  assert.deepEqual(h.requests, []);
});

test('local cash settlement reaches the rider finished screen without using the HTTP payment adapter', async () => {
  const requests = [];
  const modules = {
    zustand: { create: () => (factory) => createStore(factory) },
    'zustand/middleware': { persist: (factory) => factory, createJSONStorage: () => undefined },
    '@/lib/api': {
      IS_MOCK: false,
      api: { payments: { recordPayment: async () => { requests.push('recordPayment'); throw new Error('Unexpected payment request'); } } },
      errorMessage: (e) => e.message,
    },
    '@/lib/constants': { ACTIVE_TRIP_STATUSES: [] },
    '@/components/ui/toast': {},
  };
  const source = fs.readFileSync(new URL('../../src/store/ride-store.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console,
    require: (id) => { assert.ok(modules[id], `Unexpected dependency: ${id}`); return modules[id]; },
  });
  const store = exports.useRideStore;
  store.setState({ trip: { id: 'trip-1', status: 'PAYMENT_PENDING', payment: { status: 'Pending', method: null } } });
  await store.getState().settlePayment({ tripId: 'trip-1', method: 'Cash', amount: 725.5, paidAt: '2026-10-10T10:00:00Z' });
  const trip = store.getState().trip;
  assert.equal(exports.phaseForTrip(trip, 'plan'), 'paid');
  assert.equal(trip.payment.method, 'Cash');
  assert.equal(trip.payment.status, 'Paid');
  assert.equal(trip.finalFare, 725.5);
  assert.deepEqual(requests, []);
});

function driver(status = 'Completed') {
  const offer = { tripId: 'trip-1', status };
  const locationUpdates = [];
  const accepted = [];
  const modules = {
    zustand: { create: () => (factory) => createStore(factory) },
    '@/lib/api': {
      api: {
        drivers: { setOnline: async () => null },
        location: { updateDriverLocation: async (...args) => locationUpdates.push(args[3]) },
      },
      IS_MOCK: false,
      errorMessage: (e) => e.message,
    },
    '@/lib/mock/world': {}, '@/lib/utils': {}, '@/lib/geo/providers': {},
    '@/lib/api/live-matching': {
      ON_TRIP_STATUSES: ['Accepted', 'Arrived', 'InProgress'],
      getActiveOfferLive: async () => offer,
      updateTripStatusLive: async (tripId, driverId, action) => ({ ...offer, status: action }),
      acceptOfferLive: async (tripId) => { accepted.push(tripId); return { tripId, status: 'Accepted' }; },
    },
    '@/components/ui/toast': { toast: { info() {}, error() {}, success() {} } },
  };
  const source = fs.readFileSync(new URL('../../src/store/driver-store.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console,
    require: (id) => { assert.ok(modules[id], `Unexpected dependency: ${id}`); return modules[id]; },
  });
  exports.useDriverStore.setState({ driverId: 'driver-1', online: true, location: { heading: 0, status: 'Online' } });
  return { ...exports, offer, locationUpdates, accepted };
}

test('completing a trip frees the driver immediately to toggle availability, finish, and take a new ride', async () => {
  const h = driver('InProgress');
  h.useDriverStore.setState({ acceptedOffer: h.offer });
  assert.equal(await h.useDriverStore.getState().advanceLiveTrip('Completed'), true);
  assert.equal(h.liveTripLocked(h.useDriverStore.getState()), false);
  assert.equal(h.locationUpdates.at(-1), 'Online');
  assert.equal(await h.useDriverStore.getState().setOnline(false), true);
  assert.equal(h.locationUpdates.at(-1), 'Offline');
  assert.equal(await h.useDriverStore.getState().setOnline(true), true);
  assert.equal(h.locationUpdates.at(-1), 'Online');
  h.useDriverStore.getState().dismissAcceptedOffer();
  assert.equal(h.useDriverStore.getState().acceptedOffer, null);
  h.useDriverStore.setState({ liveOffers: [{ tripId: 'trip-2', status: 'Pending' }] });
  assert.equal(await h.useDriverStore.getState().acceptLiveOffer('trip-2'), true);
  assert.deepEqual(h.accepted, ['trip-2']);
  assert.equal(h.locationUpdates.at(-1), 'OnTrip');
});

test('a completed trip is never restored after a driver reload', async () => {
  const h = driver();
  await h.useDriverStore.getState().restoreLiveTrip();
  assert.equal(h.useDriverStore.getState().acceptedOffer, null);
  assert.equal(h.liveTripLocked(h.useDriverStore.getState()), false);
});

for (const status of ['Accepted', 'Arrived', 'InProgress']) {
  test(`a driver with a ${status} trip still cannot finish, go offline, or accept another request`, async () => {
    const h = driver(status);
    await h.useDriverStore.getState().restoreLiveTrip();
    assert.equal(h.useDriverStore.getState().acceptedOffer.status, status);
    assert.equal(h.liveTripLocked(h.useDriverStore.getState()), true);
    h.useDriverStore.getState().dismissAcceptedOffer();
    assert.ok(h.useDriverStore.getState().acceptedOffer);
    assert.equal(await h.useDriverStore.getState().setOnline(false), false);
    h.useDriverStore.setState({ liveOffers: [{ tripId: 'trip-2', status: 'Pending' }] });
    assert.equal(await h.useDriverStore.getState().acceptLiveOffer('trip-2'), false);
    assert.deepEqual(h.accepted, []);
    assert.equal(h.locationUpdates.at(-1), 'OnTrip');
  });
}
