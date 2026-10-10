import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load() {
  const source = fs.readFileSync(new URL('../../src/lib/driver-payment-notifications.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports });
  return exports;
}

function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

const notice = { tripId: 'trip-1', amount: 921.37, currency: 'LKR', cardBrand: 'VISA', cardLast4: '1292', paidAt: '2026-10-11T10:00:00Z' };

test('redelivered notifications toast once per trip, even with different payment details', () => {
  const tracker = load().driverPaymentNotices('driver-1', false, storage());
  tracker.rememberDestination('trip-1', 'Colombo Fort');
  assert.equal(tracker.claim(notice), 'Card payment received: LKR 921.37 for your trip to Colombo Fort');
  assert.equal(tracker.claim(notice), null);
  assert.equal(tracker.claim({ ...notice, amount: 1000, paidAt: '2026-10-11T11:00:00Z' }), null);
  assert.match(tracker.claim({ ...notice, tripId: 'trip-2' }), /trip trip-2$/);
});

test('seen trips and destinations survive a reload with fresh module memory', () => {
  const disk = storage();
  const first = load().driverPaymentNotices('driver-1', false, disk);
  first.rememberDestination('trip-1', 'Galle');
  const reloaded = load().driverPaymentNotices('driver-1', false, disk);
  assert.match(reloaded.claim(notice), /your trip to Galle$/);
  assert.equal(load().driverPaymentNotices('driver-1', false, disk).claim(notice), null);
});

test('driver accounts and mock/live modes have separate dedupe and destination keys', () => {
  const disk = storage();
  const { driverPaymentNotices } = load();
  const first = driverPaymentNotices('driver-1', true, disk);
  first.rememberDestination('trip-1', 'Mock destination');
  assert.ok(first.claim(notice));
  const live = driverPaymentNotices('driver-1', false, disk).claim(notice);
  const other = driverPaymentNotices('driver-2', true, disk).claim(notice);
  assert.ok(live);
  assert.ok(other);
  assert.doesNotMatch(live, /Mock destination/);
  assert.doesNotMatch(other, /Mock destination/);
});

test('blocked localStorage still deduplicates across remounts within the session', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
  const { driverPaymentNotices } = load();
  assert.ok(driverPaymentNotices('driver-1', false, blocked).claim(notice));
  assert.equal(driverPaymentNotices('driver-1', false, blocked).claim(notice), null);
});

test('a failed storage write does not forget a displayed trip', () => {
  const full = { getItem: () => null, setItem() { throw new Error('quota'); } };
  const { driverPaymentNotices } = load();
  assert.ok(driverPaymentNotices('driver-1', false, full).claim(notice));
  assert.equal(driverPaymentNotices('driver-1', false, full).claim(notice), null);
});

test('malformed data never consumes a trip dedupe key', () => {
  const tracker = load().driverPaymentNotices('driver-1', false, storage());
  for (const invalid of [{ amount: NaN }, { amount: -1 }, { amount: 0 }, { currency: 'USD' }, { paidAt: 'bad' }, { tripId: '' }]) {
    assert.equal(tracker.claim({ ...notice, ...invalid }), null);
  }
  assert.ok(tracker.claim(notice));
});

test('mock feed uses confirmed final card payments for the signed-in driver only', () => {
  const { mockDriverPaymentNotifications } = load();
  const trip = { id: 'trip-1', driverId: 'driver-1', estimatedFare: 600, finalFare: 921.37,
    payment: { status: 'Paid', method: 'Card', finalFare: 921.37, processedAt: notice.paidAt } };
  const rows = mockDriverPaymentNotifications([
    trip,
    { ...trip, id: 'other', driverId: 'driver-2' },
    { ...trip, id: 'pending', payment: { ...trip.payment, status: 'Pending' } },
    { ...trip, id: 'failed', payment: { ...trip.payment, status: 'Failed' } },
    { ...trip, id: 'cash', payment: { ...trip.payment, method: 'Cash' } },
    { ...trip, id: 'old', payment: { ...trip.payment, processedAt: '2026-09-01T00:00:00Z' } },
  ], 'driver-1', '2026-10-10T00:00:00Z');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tripId, 'trip-1');
  assert.equal(rows[0].amount, 921.37);
  assert.equal(rows[0].paidAt, notice.paidAt);
  assert.equal(rows[0].currency, 'LKR');
});
