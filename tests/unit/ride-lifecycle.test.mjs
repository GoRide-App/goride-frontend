import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createStore } from 'zustand/vanilla';

function load(path, modules = {}, globals = {}) {
  const source = fs.readFileSync(new URL('../../src/' + path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Date, console, structuredClone,
    require(id) { assert.ok(modules[id], 'Unexpected dependency: ' + id); return modules[id]; },
    ...globals,
  });
  return exports;
}
const lifecycle = load('lib/ride-lifecycle.ts');
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function timers() {
  const queue = new Map();
  let id = 0;
  return {
    setTimeout(fn) { queue.set(++id, fn); return id; },
    clearTimeout(key) { queue.delete(key); },
    setInterval() { return ++id; }, clearInterval() {},
    async tick() {
      const next = queue.entries().next().value;
      assert.ok(next, 'A poll should be scheduled');
      queue.delete(next[0]);
      await next[1]();
      await flush();
    },
  };
}
const accepted = { tripId: 'trip', driverId: 'driver', riderId: 'rider', status: 'Accepted', fare: 100 };
function driver(overrides = {}, mock = false) {
  const clock = timers(), notices = [], writes = [];
  const live = {
    ON_TRIP_STATUSES: ['Accepted', 'Arrived', 'InProgress'],
    refreshDriverTripLive: async () => ({ offer: accepted }),
    updateTripStatusLive: async (_, __, action) => ({ ...accepted, status: action }),
    acceptOfferLive: async () => accepted,
    cancelOfferLive: async () => ({ ...accepted, status: 'Cancelled', cancelledBy: 'Driver' }),
    declineOfferLive: async () => ({ ...accepted, status: 'Declined' }),
    getPendingOffersLive: async () => [],
    ...overrides,
  };
  const api = {
    trips: { subscribeDriver: () => () => {} },
    location: { updateDriverLocation: async (...args) => writes.push(args), getDriverLocation: async () => null },
    drivers: { setOnline: async () => { throw new Error('not a mock driver'); } },
  };
  const module = load('store/driver-store.ts', {
    zustand: { create: () => createStore },
    '@/lib/api': { api, IS_MOCK: mock, errorMessage: (e) => e.message },
    '@/lib/mock/world': { world: () => ({ get: () => ({ sim: { trip: { live: true } } }) }) },
    '@/lib/utils': { bearing: () => 0 },
    '@/lib/geo/providers': {},
    '@/lib/api/live-matching': live,
    '@/lib/ride-lifecycle': lifecycle,
    '@/components/ui/toast': { toast: new Proxy({}, { get: (_, kind) => (...args) => notices.push([kind, ...args]) }) },
  }, clock);
  const store = module.useDriverStore;
  store.setState({ driverId: 'driver', acceptedOffer: accepted, online: true, restoringLiveTrip: false,
    location: { driverId: 'driver', lat: 1, lng: 2, heading: 0, status: 'OnTrip' } });
  return { store, live, clock, notices, writes, ...module };
}

for (const [index, status, next] of [[0, 'Accepted', 'Arrived'], [1, 'Arrived', 'InProgress'], [2, 'InProgress', 'Completed'], [3, 'Completed', null]]) {
  test('server stage maps to driver step: ' + status, () => {
    assert.equal(lifecycle.stageFor(status).index, index);
    assert.equal(lifecycle.stageFor(status).stage.next, next);
  });
}
test('unknown and terminal statuses cannot fall back to pickup step', () => {
  for (const status of ['Pending', 'Cancelled', 'Expired', 'DriverCancelled', 'bad'])
    assert.equal(lifecycle.stageFor(status), null);
});

for (const status of ['Arrived', 'InProgress', 'Completed']) {
  test('action error silently restores server stage: ' + status, async () => {
    const h = driver({
      updateTripStatusLive: async () => { throw Object.assign(new Error('conflict'), { status: 409, code: 'INVALID_TRIP_TRANSITION' }); },
      refreshDriverTripLive: async () => ({ offer: { ...accepted, status } }),
    });
    assert.equal(await h.store.getState().advanceLiveTrip('Arrived'), true);
    assert.equal(h.store.getState().acceptedOffer.status, status);
    assert.equal(h.store.getState().error, null);
    assert.equal(h.notices.length, 0);
    assert.equal(h.store.getState().busy, false);
    assert.equal(h.store.getState().location.status, status === 'Completed' ? 'Online' : 'OnTrip');
  });
}
test('any action failure recovers, including a lost successful response', async () => {
  const h = driver({ updateTripStatusLive: async () => { throw new Error('network lost'); },
    refreshDriverTripLive: async () => ({ offer: { ...accepted, status: 'Arrived' } }) });
  await h.store.getState().advanceLiveTrip('Arrived');
  assert.equal(h.store.getState().acceptedOffer.status, 'Arrived');
  assert.equal(h.notices.length, 0);
});
test('only a failed resync displays an action error', async () => {
  const h = driver({ updateTripStatusLive: async () => { throw new Error('original'); },
    refreshDriverTripLive: async () => { throw new Error('refresh unavailable'); } });
  assert.equal(await h.store.getState().advanceLiveTrip('Arrived'), false);
  assert.equal(h.store.getState().error, 'refresh unavailable');
  assert.equal(h.notices.filter((n) => n[0] === 'error').length, 1);
  assert.equal(h.store.getState().acceptedOffer.status, 'Accepted');
});
test('double taps send one action while the response is pending', async () => {
  let resolve, calls = 0;
  const h = driver({ updateTripStatusLive: () => { calls++; return new Promise((r) => { resolve = r; }); } });
  const first = h.store.getState().advanceLiveTrip('Arrived');
  assert.equal(h.store.getState().busy, true);
  assert.equal(await h.store.getState().advanceLiveTrip('Arrived'), false);
  assert.equal(await h.store.getState().cancelLiveTrip(), false);
  resolve({ ...accepted, status: 'Arrived' });
  await first;
  assert.equal(calls, 1);
});
test('a poll started before an action cannot overwrite its newer stage', async () => {
  let resolve;
  const h = driver({ refreshDriverTripLive: () => new Promise((r) => { resolve = r; }) });
  h.store.getState().start('driver');
  const poll = h.clock.tick();
  await flush();
  await h.store.getState().advanceLiveTrip('Arrived');
  resolve({ offer: accepted });
  await poll;
  assert.equal(h.store.getState().acceptedOffer.status, 'Arrived');
  h.store.getState().stop();
});
for (const endedStatus of ['Cancelled', 'Expired', 'DriverCancelled']) {
  test('terminal poll frees driver and announces outcome: ' + endedStatus, async () => {
    const h = driver({ refreshDriverTripLive: async () => ({ offer: null, endedStatus }) });
    h.store.getState().start('driver');
    await h.clock.tick();
    assert.equal(h.store.getState().acceptedOffer, null);
    assert.equal(h.liveTripLocked(h.store.getState()), false);
    assert.equal(h.store.getState().location.status, 'Online');
    assert.match(h.notices[0][1], endedStatus === 'Cancelled' ? /Rider cancelled this trip/ : endedStatus === 'Expired' ? /expired/ : /cancelled/);
    h.store.getState().stop();
  });
}
test('driver cancel frees driver; InProgress cannot be cancelled', async () => {
  const h = driver();
  assert.equal(await h.store.getState().cancelLiveTrip(), true);
  assert.equal(h.store.getState().acceptedOffer, null);
  assert.equal(h.store.getState().location.status, 'Online');
  assert.equal(h.notices[0][1], 'Trip cancelled');
  h.store.setState({ acceptedOffer: { ...accepted, status: 'InProgress' } });
  assert.equal(await h.store.getState().cancelLiveTrip(), false);
});
test('a stale browser copy of a live trip cannot keep a cancelled driver OnTrip', async () => {
  const h = driver({}, true);
  h.store.setState({ trip: { id: 'trip', status: 'DRIVER_ARRIVED' } });
  await h.store.getState().cancelLiveTrip();
  assert.equal(h.store.getState().acceptedOffer, null);
  assert.equal(h.store.getState().location.status, 'Online');
});
test('accepted, arrived and in-progress rides block offline and another accept', async () => {
  const h = driver({ acceptOfferLive: async () => { assert.fail('cannot accept while driving'); } });
  for (const status of ['Accepted', 'Arrived', 'InProgress']) {
    h.store.setState({ acceptedOffer: { ...accepted, status }, liveOffers: [{ ...accepted, tripId: 'other' }] });
    assert.equal(await h.store.getState().setOnline(false), false);
    assert.equal(await h.store.getState().acceptLiveOffer('other'), false);
  }
});
test('completed trip frees availability without reading any payment state', async () => {
  const h = driver({ refreshDriverTripLive: async () => ({ offer: { ...accepted, status: 'Completed' } }) });
  await h.store.getState().advanceLiveTrip('Completed');
  assert.equal(h.liveTripLocked(h.store.getState()), false);
  assert.equal(await h.store.getState().setOnline(false), true);
});
test('decline records server decision and removes offer; failed decision resyncs pending offers', async () => {
  let calls = 0;
  const h = driver({ declineOfferLive: async () => { calls++; } });
  h.store.setState({ acceptedOffer: null, liveOffers: [accepted] });
  await h.store.getState().declineLiveOffer('trip');
  assert.equal(calls, 1);
  assert.equal(h.store.getState().liveOffers.length, 0);
  h.live.declineOfferLive = async () => { throw new Error('lost'); };
  h.live.refreshDriverTripLive = async () => ({ offer: null });
  h.live.getPendingOffersLive = async () => [accepted];
  await h.store.getState().declineLiveOffer('trip');
  assert.equal(h.store.getState().liveOffers.length, 1);
  assert.equal(h.notices.length, 0);
});
test('reload restores the exact authoritative driver stage', async () => {
  const h = driver({ refreshDriverTripLive: async () => ({ offer: { ...accepted, status: 'InProgress' } }) });
  h.store.setState({ acceptedOffer: null });
  await h.store.getState().restoreLiveTrip();
  assert.equal(h.store.getState().acceptedOffer.status, 'InProgress');
  assert.equal(h.store.getState().restoringLiveTrip, false);
});
test('accept errors restore the current trip silently and do not invent Accepted', async () => {
  const h = driver({ acceptOfferLive: async () => { throw new Error('busy'); },
    refreshDriverTripLive: async () => ({ offer: { ...accepted, status: 'Arrived' } }) });
  h.store.setState({ acceptedOffer: null, liveOffers: [{ ...accepted, tripId: 'other' }] });
  await h.store.getState().acceptLiveOffer('other');
  assert.equal(h.store.getState().acceptedOffer.status, 'Arrived');
  assert.equal(h.notices.length, 0);
});

function matching(fetch) {
  return load('lib/api/live-matching.ts', { '../ride-lifecycle': lifecycle }, { process: { env: {} }, fetch });
}
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
test('active lookup does not resurrect older completed trip after cancellation', async () => {
  const paths = [];
  const live = matching(async (url) => {
    paths.push(url);
    return url.includes('/active') ? response({ ...accepted, tripId: 'old', status: 'Completed' }) : response({ status: 'Cancelled' });
  });
  const result = await live.refreshDriverTripLive('driver', accepted);
  assert.equal(result.offer, null);
  assert.equal(result.endedStatus, 'Cancelled');
  assert.equal(paths.length, 2);
});
test('204 active and expiry free driver; matching HTTP errors preserve currentStatus', async () => {
  const live = matching(async (url) => url.includes('/active') ? response(null, 204) : response({ status: 'Expired' }));
  const result = await live.refreshDriverTripLive('driver', accepted);
  assert.equal(result.offer, null);
  assert.equal(result.endedStatus, 'Expired');
  const broken = matching(async () => response({ code: 'INVALID_TRIP_TRANSITION', currentStatus: 'Completed' }, 409));
  await assert.rejects(broken.updateTripStatusLive('trip', 'driver', 'Arrived'), (e) => e.currentStatus === 'Completed');
});
test('cancel and decline clients use encoded routes and correct request bodies', async () => {
  const calls = [];
  const live = matching(async (url, init) => { calls.push([url, init]); return response({}); });
  await live.cancelOfferLive('trip/id', 'driver', 'reason');
  await live.declineOfferLive('trip/id', 'driver');
  await live.cancelRideRequestLive('trip/id', 'rider');
  assert.match(calls[0][0], /offers\/trip%2Fid\/cancel$/);
  assert.deepEqual(JSON.parse(calls[0][1].body), { driverId: 'driver', reason: 'reason' });
  assert.match(calls[1][0], /offers\/trip%2Fid\/decline$/);
  assert.deepEqual(JSON.parse(calls[1][1].body), { driverId: 'driver' });
  assert.match(calls[2][0], /ride-requests\/trip%2Fid\/cancel$/);
  assert.deepEqual(JSON.parse(calls[2][1].body), { riderId: 'rider' });
});
function rider(stage = 'SEARCHING_DRIVER', overrides = {}, saved) {
  const clock = timers();
  const seed = {
    ALL_USERS: [], DRIVERS: [], VEHICLE_TYPES: [{ id: 'tuk', code: 'TUK' }], TRIPS: [],
    COMPLAINTS: [], SOS_ALERTS: [], AUDIT_LOG: [], NOTIFICATIONS: [], EMERGENCY_CONTACTS: [],
    DEMO_RIDER: { id: 'rider' }, DEMO_ADMIN: { id: 'admin' },
    estimateFor: () => ({ total: 100, base: 100, distance: 0, time: 0, stops: 0, waiting: 0 }),
  };
  let id = 0;
  const w = load('lib/mock/world.ts', {
    '@/lib/constants': {}, '@/lib/utils': { uid: () => String(++id), clamp: (v, a, b) => Math.min(b, Math.max(a, v)) },
    '@/lib/geo/providers': {}, './seed': seed,
  }).world();
  Object.assign(w.get(), saved ?? {});
  if (!saved) {
    w.get().trips.push({ id: 'trip', riderId: 'rider', status: stage, vehicleTypeId: 'tuk', vehicleTypeCode: 'TUK',
      pickup: { name: 'Pickup', lat: 1, lng: 2 }, destination: { name: 'Destination' }, stops: [], version: 1, durationMin: 10,
      distanceKm: 5, estimatedFare: 100, requestedAt: '2000-01-01T00:00:00Z' });
    w.get().sim.trip = { live: true, declined: [], npc: true };
  }
  const status = { tripId: 'trip', status: 'Accepted', driver: { driverId: 'driver', vehicleTypeCode: 'TUK', vehicleMake: 'Bajaj', vehicleModel: 'RE', vehiclePlate: 'ABC' } };
  const live = {
    getRideRequestStatusLive: async () => status,
    requestRideLive: async () => ({ matched: true, drivers: [] }),
    cancelRideRequestLive: async () => ({ status: 'Cancelled' }),
    LiveMatchingError: class extends Error {},
    ...overrides,
  };
  const module = load('lib/api/live-rider-matching.ts', {
    '@/lib/ride-lifecycle': lifecycle, '@/components/ui/toast': { toast: { warning() {} } },
    '@/lib/mock/world': { world: () => w }, './live-matching': live,
  }, clock);
  const deps = { resolveDriver: async () => ({ name: 'Driver' }) };
  return { w, live, status, clock, deps, ...module };
}
for (const [status, expected] of [['Accepted', 'DRIVER_ASSIGNED'], ['Arrived', 'DRIVER_ARRIVED'], ['InProgress', 'TRIP_IN_PROGRESS'], ['Completed', 'PAYMENT_PENDING']]) {
  test('rider reload applies authoritative stage and skipped intermediate stages: ' + status, async () => {
    const h = rider();
    h.status.status = status;
    h.status.fare = 725;
    await h.resumeLiveRideRequest('trip', h.deps);
    assert.equal(h.w.trip('trip').status, expected);
    if (status === 'Completed') {
      assert.equal(h.w.trip('trip').finalFare, 725);
      assert.equal(h.isLiveTrip('trip'), true);
    }
    assert.equal(lifecycle.RIDER_STAGE[status] > 0, true);
  });
}
test('rider keeps polling each server stage through completion', async () => {
  const h = rider();
  await h.resumeLiveRideRequest('trip', h.deps);
  for (const [status, expected] of [['Arrived', 'DRIVER_ARRIVED'], ['InProgress', 'TRIP_IN_PROGRESS'], ['Completed', 'PAYMENT_PENDING']]) {
    h.status.status = status;
    await h.clock.tick();
    assert.equal(h.w.trip('trip').status, expected);
  }
});
for (const status of ['Cancelled', 'DriverCancelled', 'Expired']) {
  test('rider terminal outcome survives reload: ' + status, async () => {
    const h = rider();
    h.status.status = status;
    await h.resumeLiveRideRequest('trip', h.deps);
    assert.equal(h.w.trip('trip').status, 'CANCELLED');
    assert.equal(h.w.trip('trip').liveOutcome, status);
    const fresh = rider(null, {}, structuredClone(h.w.get()));
    assert.equal(fresh.w.trip('trip').liveOutcome, status);
    assert.equal(fresh.isLiveTrip('trip'), true);
  });
}
test('expired local search clock cannot hide a driver that already accepted', async () => {
  const h = rider();
  await h.startLiveRideRequest('trip', h.deps);
  await flush();
  assert.equal(h.w.trip('trip').status, 'DRIVER_ASSIGNED');
});
test('rider cancellation waits for request delivery before posting cancel', async () => {
  let delivered, calls = 0;
  const h = rider(undefined, {
    requestRideLive: () => new Promise((r) => { delivered = r; }),
    cancelRideRequestLive: async () => { calls++; return { status: 'Cancelled' }; },
  });
  const request = h.startLiveRideRequest('trip', h.deps);
  const cancel = h.cancelLiveRideRequest('trip', 'rider', 'Changed plans', h.deps);
  await flush();
  assert.equal(calls, 0);
  delivered({ matched: true, drivers: [] });
  await request;
  await cancel;
  assert.equal(calls, 1);
  assert.equal(h.w.trip('trip').status, 'CANCELLED');
});
test('rider cancellation rejected after start resyncs to InProgress', async () => {
  const h = rider(undefined, { cancelRideRequestLive: async () => { throw new Error('started'); } });
  h.status.status = 'InProgress';
  await assert.rejects(h.cancelLiveRideRequest('trip', 'rider', 'Changed plans', h.deps), /started/);
  assert.equal(h.w.trip('trip').status, 'TRIP_IN_PROGRESS');
});
test('late progress response cannot resurrect a cancelled ride', async () => {
  const h = rider();
  await h.resumeLiveRideRequest('trip', h.deps);
  h.w.endLiveTrip('trip', 'DriverCancelled');
  h.w.advanceLiveTrip('trip', 'Completed', 100);
  assert.equal(h.w.trip('trip').status, 'CANCELLED');
  assert.equal(h.w.get().payments.length, 0);
});

test('lost delivery response recovers a committed ride without switching to demo', async () => {
  const h = rider(undefined, { requestRideLive: async () => { throw new Error('lost response'); } });
  await h.startLiveRideRequest('trip', h.deps);
  assert.equal(h.w.trip('trip').status, 'DRIVER_ASSIGNED');
  assert.equal(h.isLiveTrip('trip'), true);
});
test('unconfirmed delivery stays live while status is unavailable', async () => {
  const h = rider(undefined, { requestRideLive: async () => { throw new Error('lost response'); },
    getRideRequestStatusLive: async () => { throw new Error('offline'); } });
  await h.startLiveRideRequest('trip', h.deps);
  assert.equal(h.w.trip('trip').status, 'SEARCHING_DRIVER');
  assert.equal(h.isLiveTrip('trip'), true);
});
test('an authoritative missing trip after 204 does not leave the driver locked', async () => {
  const live = matching(async (url) => url.includes('/active') ? response(null, 204) : response({}, 404));
  assert.equal((await live.refreshDriverTripLive('driver', accepted)).offer, null);
});

function rideStore(api) {
  return load('store/ride-store.ts', {
    zustand: { create: () => createStore },
    'zustand/middleware': { persist: (factory) => factory, createJSONStorage: () => undefined },
    '@/lib/api': { api, IS_MOCK: true, errorMessage: (e) => e.message },
    '@/lib/constants': { ACTIVE_TRIP_STATUSES: ['DRIVER_ASSIGNED', 'DRIVER_ARRIVED', 'TRIP_IN_PROGRESS'] },
    '@/components/ui/toast': { toast: new Proxy({}, { get: () => () => {} }) },
  });
}
test('rider store restores a cancelled outcome using the persisted trip ID', async () => {
  const ended = { id: 'trip', riderId: 'rider', status: 'CANCELLED', liveOutcome: 'Expired', version: 3 };
  const { useRideStore, phaseForTrip } = rideStore({ trips: {
    activeForRider: async () => null, get: async () => ended, subscribe: () => () => {},
  } });
  useRideStore.setState({ currentTripId: 'trip' });
  await useRideStore.getState().restore('rider');
  assert.equal(useRideStore.getState().trip.liveOutcome, 'Expired');
  assert.equal(phaseForTrip(useRideStore.getState().trip, 'plan'), 'cancelled');
  useRideStore.getState().finish();
  assert.equal(useRideStore.getState().currentTripId, null);
});
test('an older rider refresh cannot regress a subscribed trip stage', async () => {
  let resolve;
  const { useRideStore } = rideStore({ trips: { get: () => new Promise((r) => { resolve = r; }) } });
  useRideStore.setState({ trip: { id: 'trip', status: 'DRIVER_ASSIGNED', version: 1 } });
  const refresh = useRideStore.getState().refreshTrip();
  useRideStore.setState({ trip: { id: 'trip', status: 'TRIP_IN_PROGRESS', version: 3 } });
  resolve({ id: 'trip', status: 'DRIVER_ARRIVED', version: 2 });
  await refresh;
  assert.equal(useRideStore.getState().trip.status, 'TRIP_IN_PROGRESS');
});
