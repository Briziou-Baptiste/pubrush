const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
// Load the actual pure TypeScript services without adding an Expo/Jest runtime or dependencies.
function loadService(name) {
  const file = path.resolve(__dirname, '../src/features/create_barathon/services', name + '.ts');
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const mod = new Module(file, module);
  mod._compile(output.outputText, file);
  return mod.exports;
}
const { createWalkingRouter, getRouteSegmentKey, getRouteLabel } = loadService('routing.service');
const { appendSelectedStops, getSearchCenter, getModificationSearchCenter } = loadService('routePlan.service');
const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'fixtures/toulouse-route.json')));
const A = { id: 'a', latitude: 43.6045, longitude: 1.444 };
const B = { id: 'b', latitude: 43.6027, longitude: 1.4411 };
const C = { id: 'c', latitude: 43.603, longitude: 1.442 };
function setup(provider, enabled = true) {
  let clock = 10000;
  const calls = [];
  const router = createWalkingRouter({
    enabled,
    now: () => clock, sleep: async ms => { clock += ms; },
    fetch: async (url, options) => {
      calls.push({ url, options, at: clock });
      if (provider) return provider(url, options);
      const points = url.split('/foot/')[1].split('?')[0].split(';').map(p => p.split(',').map(Number));
      const data = structuredClone(fixture);
      data.routes[0].geometry.coordinates = points;
      return { ok: true, json: async () => data };
    },
  });
  return { ...router, calls, advance: ms => { clock += ms; } };
}

test('measured pedestrian fixture is parsed with explicit graph and lon/lat order', async () => {
  const r = setup(() => ({ ok: true, json: async () => fixture }));
  const seg = await r.fetchRoute(A, B);
  assert.equal(seg.status, 'walking');
  assert.equal(seg.distanceMeters, 363);
  assert.equal(seg.durationMinutes, 5);
  assert.deepEqual(seg.coordinates[0], { longitude: fixture.routes[0].geometry.coordinates[0][0], latitude: fixture.routes[0].geometry.coordinates[0][1] });
  assert.match(r.calls[0].url, /^https:\/\/routing.openstreetmap.de\/routed-foot\/route\/v1\/foot\/1.444,43.6045;1.4411,43.6027\?/);
  assert.match(r.calls[0].options.headers['User-Agent'], /PubRush/);
  assert.match(getRouteLabel(seg), /Piéton calculé/);
});

test('deduplicates in-flight calls and caches only current coordinate pairs', async () => {
  const r = setup();
  const [one, two] = await Promise.all([r.fetchRoute(A, B), r.fetchRoute(A, B)]);
  assert.equal(one, two);
  assert.equal(r.calls.length, 1);
  assert.equal(await r.fetchRoute(A, B), one);
  r.advance(300001);
  assert.notEqual(await r.fetchRoute(A, B), one);
  assert.equal(r.calls.length, 2);
});

test('replacement with same ID invalidates both adjacent legs, even below old rounding precision', async () => {
  const r = setup();
  await r.fetchRoutes([A, B, C]);
  const replacement = { ...B, longitude: B.longitude + 0.000001 };
  const updated = await r.fetchRoutes([A, replacement, C]);
  assert.equal(r.calls.length, 4);
  assert.deepEqual(updated[getRouteSegmentKey(A, replacement)].coordinates.at(-1), { latitude: replacement.latitude, longitude: replacement.longitude });
  assert.equal(updated[getRouteSegmentKey(A, B)], undefined);
});

test('add, delete and reorder preserve requested direction, drop obsolete legs and reuse unchanged pairs', async () => {
  const r = setup();
  const input = [A, B];
  await r.fetchRoutes(input);
  let result = await r.fetchRoutes([A, B, C]);
  assert.equal(r.calls.length, 2);
  assert.deepEqual(Object.keys(result), [getRouteSegmentKey(A, B), getRouteSegmentKey(B, C)]);
  result = await r.fetchRoutes([A, C]);
  assert.deepEqual(Object.keys(result), [getRouteSegmentKey(A, C)]);
  result = await r.fetchRoutes([C, A, B]);
  assert.deepEqual(Object.keys(result), [getRouteSegmentKey(C, A), getRouteSegmentKey(A, B)]);
  assert.equal(r.calls.length, 4);
  assert.deepEqual(input, [A, B]);
  assert.deepEqual(await r.fetchRoutes([A]), {});
});

test('all requests share a queue spaced by at least 1.1 seconds', async () => {
  const r = setup();
  await Promise.all([r.fetchRoute(A, B), r.fetchRoute(B, C), r.fetchRoute(C, A)]);
  for (let i = 1; i < r.calls.length; i++) assert.ok(r.calls[i].at - r.calls[i - 1].at >= 1100);
});

test('cache stays bounded', async () => {
  const r = setup();
  for (let i = 0; i < 201; i++) await r.fetchRoute(A, { ...B, longitude: 1 + i / 1000 });
  await r.fetchRoute(A, { ...B, longitude: 1 });
  assert.equal(r.calls.length, 202);
});

for (const code of ['NoRoute', 'NoSegment']) test(`${code} is unavailable, without a drawn route or walking duration`, async () => {
  const r = setup(() => ({ ok: false, json: async () => ({ code }) }));
  const seg = await r.fetchRoute(A, B);
  assert.equal(seg.status, 'unavailable');
  assert.deepEqual(seg.coordinates, []);
  assert.equal(seg.distanceMeters, null);
  assert.equal(seg.durationMinutes, null);
  assert.match(getRouteLabel(seg), /Aucun itinéraire/);
  await r.fetchRoute(A, B);
  assert.equal(r.calls.length, 2);
});

for (const failure of ['network', '429', 'invalid-json', 'missing-geometry', 'missing-duration', 'negative-distance', 'bad-coordinate', 'far-snap']) {
  test(`${failure} gives explicitly straight-line distance, no walking time, then retries successfully`, async () => {
    let fail = true;
    const r = setup(() => {
      if (!fail) return { ok: true, json: async () => fixture };
      if (failure === 'network') throw new Error('offline');
      if (failure === 'invalid-json') return { ok: true, json: async () => { throw new Error('HTML'); } };
      const data = structuredClone(fixture);
      if (failure === 'missing-geometry') delete data.routes[0].geometry;
      if (failure === 'missing-duration') delete data.routes[0].duration;
      if (failure === 'negative-distance') data.routes[0].distance = -1;
      if (failure === 'bad-coordinate') data.routes[0].geometry.coordinates[0] = [Infinity, 43];
      if (failure === 'far-snap') data.waypoints[0].distance = 100;
      return { ok: failure !== '429', json: async () => data };
    });
    const seg = await r.fetchRoute(A, B);
    assert.equal(seg.status, 'straight_line');
    assert.equal(seg.durationMinutes, null);
    assert.match(getRouteLabel(seg), /vol d’oiseau/);
    assert.ok(seg.distanceMeters > 0);
    fail = false;
    assert.equal((await r.fetchRoute(A, B)).status, 'walking');
    assert.equal(r.calls.length, 2);
  });
}

test('timeout aborts fetch and falls back without caching', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const r = setup((url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))));
  const promise = r.fetchRoute(A, B);
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  t.mock.timers.tick(5000);
  assert.equal((await promise).status, 'straight_line');
});

test('invalid coordinates never leave the device', async () => {
  const r = setup();
  assert.equal((await r.fetchRoute(A, { latitude: NaN, longitude: 181 })).status, 'unavailable');
  assert.equal(r.calls.length, 0);
});

test('generation appends selected bars in order and search follows the final bar after edits', () => {
  const selected = [A, B];
  assert.deepEqual(appendSelectedStops(selected, [C]), [A, B, C]);
  assert.deepEqual(selected, [A, B]);
  assert.equal(getSearchCenter([A, B, C], undefined), C);
  assert.equal(getSearchCenter([C, A], undefined), A);
  assert.equal(getSearchCenter([A], undefined), A);
  assert.equal(getSearchCenter([], B), B);
});


test('provider is disabled unless explicitly enabled for an eligible use', async () => {
  const r = setup(undefined, false);
  const segment = await r.fetchRoute(A, B);
  assert.equal(segment.status, 'straight_line');
  assert.equal(segment.durationMinutes, null);
  assert.equal(r.calls.length, 0);
});


test('adding at the end searches around the last bar while replacing uses the current bar', () => {
  assert.equal(getModificationSearchCenter(A, C, 'add', 'at_end', B), C);
  assert.equal(getModificationSearchCenter(A, C, 'add', 'after_current', B), A);
  assert.equal(getModificationSearchCenter(A, C, 'add', 'before_current', B), A);
  assert.equal(getModificationSearchCenter(A, C, 'replace', 'at_end', B), A);
  assert.equal(getModificationSearchCenter(null, null, 'add', 'at_end', B), B);
});

// PLACES-003: check the real module singleton as bundled, not a parallel copy of its guard.
test('release/OTA stays disabled with an inherited flag; private development requires explicit opt-in', async () => {
  const vm = require('node:vm');
  const source = fs.readFileSync(path.resolve(__dirname, '../src/features/create_barathon/services/routing.service.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  for (const [dev, flag, expectedCalls] of [[false, 'true', 0], [true, undefined, 0], [true, 'true', 1]]) {
    let calls = 0;
    const context = { exports: {}, __DEV__: dev,
      process: { env: { EXPO_PUBLIC_WALKING_ROUTING_ENABLED: flag } },
      AbortController, setTimeout, clearTimeout,
      fetch: async () => { calls++; return { ok: true, json: async () => fixture }; },
    };
    vm.runInNewContext(compiled, context);
    const segment = await context.exports.fetchWalkingRoute(A, B);
    assert.equal(calls, expectedCalls);
    assert.equal(segment.status, expectedCalls ? 'walking' : 'straight_line');
    if (!expectedCalls) assert.equal(segment.durationMinutes, null);
  }
});

test('disabled routing edits recalculate geometric distances without network or wait and retain honest labels', async () => {
  const r = createWalkingRouter({
    now: () => 100,
    fetch: async () => assert.fail('Disabled provider must never be called'),
    sleep: async () => assert.fail('Disabled routing must not wait for a provider'),
  });
  const before = await r.fetchRoutes([A, B, C]);
  const replacement = { ...B, longitude: 1.43 };
  for (const points of [[A, replacement, C], [C, A], [A, C, replacement], [A], []]) {
    const updated = await r.fetchRoutes(points);
    assert.deepEqual(Object.keys(updated), points.slice(0, -1).map((p, i) => getRouteSegmentKey(p, points[i + 1])));
    for (const segment of Object.values(updated)) {
      assert.equal(segment.status, 'straight_line');
      assert.equal(segment.durationMinutes, null);
      assert.match(getRouteLabel(segment), /vol d’oiseau/);
      assert.doesNotMatch(getRouteLabel(segment), /Piéton calculé/);
    }
    if (points[1] === replacement) {
      assert.notEqual(updated[getRouteSegmentKey(A, replacement)].distanceMeters, before[getRouteSegmentKey(A, B)].distanceMeters);
      assert.equal(updated[getRouteSegmentKey(A, B)], undefined);
    }
  }
  const invalid = await r.fetchRoute(A, { latitude: NaN, longitude: 1.44 });
  assert.equal(invalid.status, 'unavailable');
  assert.equal(invalid.distanceMeters, null);
  assert.match(getRouteLabel(invalid), /Aucun itinéraire/);
});
