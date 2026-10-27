const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const src = path.resolve(__dirname, '../src');
function load(relative, mocks = {}) {
  const file = path.resolve(src, relative);
  const mod = new Module(file, module);
  mod.paths = module.paths;
  mod.require = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(file), name);
      const ext = ['.ts', '.tsx'].find(ext => fs.existsSync(target + ext));
      if (ext) return load(path.relative(src, target + ext), mocks);
    }
    return require(name);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, file);
  return mod.exports;
}
const replay = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../docs/places-008/replay.json')));
const { getSuggestionsPadding } = load('features/create_barathon/services/mapLayout.service.ts');
const api = load('lib/api.ts', { 'expo-router': { router: {} }, './authStorage': {} });
const center = { id: 'public-tito', name: 'Tito Mojito', latitude: 43.6100825, longitude: 1.4429057, stopType: 'bar' };
const insets = { top: 47, left: 0, right: 0, bottom: 34 };
const diagnostics = (sample = replay.normal) => ({ provider: sample.provider, rawCount: sample.raw,
  filteredCount: sample.filtered, returnedCount: sample.returned, limited: sample.limited });
function findAll(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => findAll(child, predicate))];
}

// Execute the actual component with persistent hooks, dependency-aware effects,
// native map commands, layouts and gestures simulated. No native rendering claim.
function screen(fetchNearby, platform = 'ios', initial = [center]) {
  const slots = [], effects = [], frames = new Map(), logs = [], calls = [];
  const nativeMap = { fitToCoordinates: (...args) => calls.push(['fit', ...args]),
    animateToRegion: (...args) => calls.push(['region', ...args]) };
  let cursor = 0, dirty = true, tree, nextFrame = 0;
  const different = (a, b) => !a || !b || a.length !== b.length || a.some((value, index) => !Object.is(value, b[index]));
  const hooks = { ...React,
    useState(init) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof init === 'function' ? init() : init };
      return [slots[index].value, update => {
        const value = typeof update === 'function' ? update(slots[index].value) : update;
        if (!Object.is(slots[index].value, value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useRef(init) { const index = cursor++; return (slots[index] ||= { current: init }); },
    useMemo(fn, deps) {
      const index = cursor++;
      if (!slots[index] || different(slots[index].deps, deps)) slots[index] = { deps, value: fn() };
      return slots[index].value;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!slots[index] || different(slots[index].deps, deps)) effects.push(() => {
        slots[index]?.cleanup?.();
        slots[index] = { deps, cleanup: fn() };
      });
    },
  };
  const RN = { StyleSheet: { create: x => x }, Platform: { OS: platform },
    useWindowDimensions: () => ({ width: 390, height: 844 }), Keyboard: { dismiss() {} }, Alert: { alert() {} },
    ...Object.fromEntries(['View','Text','TextInput','TouchableOpacity','ScrollView','Modal','KeyboardAvoidingView','ActivityIndicator'].map(x => [x, x])) };
  const navigation = { getState: () => ({ routes: [] }), dispatch() {} };
  const route = { key: 'map' };
  const location = { latitude: 43.60, longitude: 1.44 };
  const Component = load('features/create_barathon/screens/CreateBarathonMapScreen.tsx', {
    react: hooks, 'react-native': RN,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => insets },
    '@react-navigation/native': { useRoute: () => route, CommonActions: { setParams: params => ({ params }) } },
    '@react-navigation/elements': { useHeaderHeight: () => 100 },
    'expo-router': { useLocalSearchParams: () => ({ travelTime: '12', initialStopsJson: JSON.stringify(initial) }), useNavigation: () => navigation, useRoute: () => route, router: {} },
    'react-native-maps': { __esModule: true, default: 'MapView', Marker: 'Marker', Circle: 'Circle', Polyline: 'Polyline' },
    '@expo/vector-icons': { Ionicons: 'Icon' }, '../components/RouteSummarySheet': { __esModule: true, default: 'RouteSummarySheet' },
    '../components/WalkingDirectionsButton': { __esModule: true, default: 'WalkingDirectionsButton' },
    '../components/RoutingAttribution': { __esModule: true, default: 'RoutingAttribution' },
    '../../home/components/LocationButton': { __esModule: true, default: 'LocationButton' },
    '../../home/hooks/useUserLocation': { useUserLocation: () => ({ location, permissionGranted: false }) },
    '../../../lib/api': { fetchNearbyBarsWithDiagnostics: fetchNearby, fetchMapFilters: async () => [], fetchBarsSearch: async () => [] },
    '../../../lib/authStorage': { getAccessToken: async () => 'test-token' },
    '../services/routing.service': { ...load('features/create_barathon/services/routing.service.ts'), fetchWalkingRoutesInParallel: async () => ({}) },
  }).default;
  function environment(fn) {
    const oldRAF = global.requestAnimationFrame, oldCancel = global.cancelAnimationFrame, oldInfo = console.info;
    global.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame; };
    global.cancelAnimationFrame = id => frames.delete(id);
    console.info = (...args) => logs.push(args);
    try { return fn(); } finally { global.requestAnimationFrame = oldRAF; global.cancelAnimationFrame = oldCancel; console.info = oldInfo; }
  }
  function render() {
    for (let limit = 0; dirty && limit < 30; limit++) environment(() => {
      dirty = false; cursor = 0; tree = Component();
      findAll(tree, node => node.type === 'MapView')[0].props.ref.current = nativeMap;
      while (effects.length) effects.shift()();
    });
    assert.equal(dirty, false, 'component settles without render loop');
  }
  async function settle() {
    for (let i = 0; i < 8; i++) { await Promise.resolve(); render(); }
  }
  const result = { calls, logs, render, settle,
    nodes: predicate => findAll(tree, predicate),
    map: () => findAll(tree, node => node.type === 'MapView')[0],
    sheet: () => findAll(tree, node => node.type === 'RouteSummarySheet')[0],
    button: label => findAll(tree, node => node.props.accessibilityLabel === label)[0],
    text: () => findAll(tree, node => node.type === 'Text').map(node => node.props.children).flat().join(' '),
    markers: () => findAll(tree, node => node.type === 'Marker' && String(node.key).includes('suggestion-marker')),
    frames() { environment(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); }); render(); },
    layout(height = 744, top = 230, bottom = 220) {
      result.map().props.onMapReady();
      result.map().props.onLayout({ nativeEvent: { layout: { width: 390, height } } });
      findAll(tree, node => node.type === 'View' && node.props.onLayout)[0].props.onLayout({ nativeEvent: { layout: { height: top } } });
      result.sheet().props.onLayout({ nativeEvent: { layout: { height: bottom } } }); render();
    },
    close() { environment(() => { slots.forEach(slot => slot?.cleanup?.()); }); },
  };
  render(); return result;
}

for (const platform of ['ios', 'android']) for (const count of [2, 10, 50]) {
  test(`${platform}: ${count} suggestions fit once, clear panels, survive panning and sheet toggles`, async () => {
    const items = Array.from({ length: count }, (_, index) => ({ name: `Nearby ${index}`, latitude: center.latitude + .0001 * (index + 1), longitude: center.longitude, stop_type: 'bar' }));
    const h = screen(async () => ({ items, diagnostics: diagnostics() }), platform);
    try {
      await h.settle(); h.frames();
      assert.equal(h.calls.length, 0, 'no native command before map/layout readiness');
      h.layout(); h.frames();
      assert.equal(h.markers().length, count);
      const [type, coords, options] = h.calls[0];
      assert.equal(type, 'fit'); assert.equal(coords.length, count + 1);
      assert.equal(coords[0].latitude, center.latitude);
      assert.equal(options.edgePadding.top, 282);
      assert.equal(options.edgePadding.bottom, 290);
      assert.equal(options.animated, true);
      h.map().props.onPanDrag();
      h.sheet().props.onCollapsedChange(true); h.render(); h.layout(744, 230, 72); h.frames();
      h.sheet().props.onCollapsedChange(false); h.render(); h.frames();
      assert.equal(h.calls.length, 1);
      assert.equal(h.markers().length, count);
      h.button('Voir les lieux à proximité').props.onPress(); h.render(); h.frames();
      assert.equal(h.calls.length, 2);
      assert.equal(h.calls[1][2].edgePadding.bottom, 142);
    } finally { h.close(); }
  });
}

test('Tito replay: 50 received -> 49 native Marker elements; diagnostics contain counts only', async () => {
  const h = screen(async () => ({ items: replay.normal.items, diagnostics: diagnostics() }));
  try {
    await h.settle(); h.layout(); h.frames();
    assert.equal(h.markers().length, 49);
    assert.ok(h.text().includes('49 lieux à proximité'));
    const diagnostic = h.logs.find(log => log[0] === '[places.nearby]')[1];
    assert.deepEqual(diagnostic, { provider: 'overpass', raw: 673, filtered: 116, transmitted: 50, mobileFiltered: 49, markersCreated: 49, limited: false });
    assert.equal(/43\.610|Tito|token|latitude|longitude/.test(JSON.stringify(h.logs)), false);
  } finally { h.close(); }
});

test('pan while request pending suppresses automatic fit; manual Voir restores it', async () => {
  let complete;
  const h = screen(() => new Promise(resolve => { complete = resolve; }));
  try {
    await h.settle(); h.layout(); h.map().props.onTouchStart();
    complete({ items: replay.normal.items, diagnostics: diagnostics() });
    await h.settle(); h.frames();
    assert.equal(h.calls.length, 0);
    h.button('Voir les lieux à proximité').props.onPress(); h.render(); h.frames();
    assert.equal(h.calls.length, 1);
  } finally { h.close(); }
});

test('short viewport collapses summary before fitting; no selection is lost', async () => {
  const h = screen(async () => ({ items: replay.normal.items, diagnostics: diagnostics() }));
  try {
    await h.settle(); h.layout(568, 230, 220); h.frames();
    assert.equal(h.calls.length, 0);
    assert.equal(h.sheet().props.collapsed, true);
    h.layout(568, 230, 72); h.frames();
    assert.equal(h.calls.length, 1);
    assert.equal(h.sheet().props.count, 1);
    assert.equal(h.markers().length, 49);
  } finally { h.close(); }
});

test('Photon limitation is explicit, retry is manual and keeps the last selected center', async () => {
  const calls = [];
  const h = screen(async (...args) => {
    calls.push(args); return { items: replay.photon_limited.items, diagnostics: diagnostics(replay.photon_limited) };
  });
  try {
    await h.settle(); h.layout(); h.frames();
    assert.equal(h.markers().length, 3);
    assert.ok(h.text().includes('Résultats limités'));
    h.layout(); h.frames(); await h.settle();
    assert.equal(calls.length, 1);
    h.button('Relancer la recherche à proximité').props.onPress(); h.render(); await h.settle();
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map(args => args.slice(0, 3)), [[center.latitude, center.longitude, 12], [center.latitude, center.longitude, 12]]);
    assert.equal(calls[0][5].aborted, true);
  } finally { h.close(); }
});

test('late old response is ignored after manual retry aborts its request', async () => {
  let completeOld; let count = 0;
  const h = screen(() => ++count === 1 ? new Promise(resolve => { completeOld = resolve; })
    : Promise.resolve({ items: replay.photon_limited.items, diagnostics: diagnostics(replay.photon_limited) }));
  try {
    await h.settle();
    // A new center/filter runs the same cleanup as this explicit refresh.
    h.button('Relancer la recherche à proximité').props.onPress(); h.render(); await h.settle();
    completeOld({ items: replay.normal.items, diagnostics: diagnostics() }); await h.settle();
    assert.equal(h.markers().length, 3);
    assert.ok(h.text().includes('Résultats limités'));
  } finally { h.close(); }
});

test('network failure is distinguishable from complete empty inventory and can be retried', async () => {
  for (const fail of [false, true]) {
    const h = screen(async () => {
      if (fail) throw new Error('private-network-detail');
      return { items: [], diagnostics: diagnostics() };
    });
    try {
      await h.settle();
      assert.equal(h.markers().length, 0);
      assert.equal(h.text().includes('Recherche indisponible'), fail);
      assert.equal(h.button('Relancer la recherche à proximité').props.disabled, false);
      assert.equal(JSON.stringify(h.logs).includes('private-network-detail'), false);
    } finally { h.close(); }
  }
});

test('edge padding waits for measurement, rounds Android integers and respects safe areas', () => {
  assert.equal(getSuggestionsPadding({ width: 390, height: 744 }, 0, 72, insets), null);
  assert.equal(getSuggestionsPadding({ width: 390, height: 400 }, 230, 220, insets), null);
  const padding = getSuggestionsPadding({ width: 700, height: 744 }, 230.4, 72.8, { left: 44.5, right: 44.5, bottom: 21.5 });
  assert.ok(Object.values(padding).every(Number.isInteger));
  assert.ok(padding.left >= 80 && padding.bottom >= 130);
});

test('headers are optional for old backend; Photon always limited and counts are sanitized', () => {
  assert.deepEqual(api.readNearbyDiagnostics(new Headers()), { provider: 'unknown', rawCount: null, filteredCount: null, returnedCount: null, limited: false });
  const data = api.readNearbyDiagnostics(new Headers({ 'X-Places-Provider': 'photon', 'X-Places-Raw-Count': '15', 'X-Places-Filtered-Count': '-1', 'X-Places-Returned-Count': 'secret' }));
  assert.equal(data.limited, true); assert.equal(data.rawCount, 15);
  assert.equal(data.filteredCount, null); assert.equal(data.returnedCount, null);
});

test('fetch API preserves array consumers and forwards cancellation to native fetch', async () => {
  const oldFetch = global.fetch;
  const controller = new AbortController(); const calls = [];
  global.fetch = async (...args) => { calls.push(args); return new Response(JSON.stringify(replay.normal.items), { headers: { 'X-Places-Provider': 'overpass' } }); };
  try {
    const detailed = await api.fetchNearbyBarsWithDiagnostics(center.latitude, center.longitude, 12, 'test-token', 'bar', controller.signal);
    assert.equal(detailed.items.length, 50);
    assert.equal(detailed.diagnostics.provider, 'overpass');
    assert.equal(calls[0][1].signal, controller.signal);
    assert.equal((await api.fetchNearbyBars(center.latitude, center.longitude, 12, 'test-token', 'bar')).length, 50);
  } finally { global.fetch = oldFetch; }
});

test('12s client timeout aborts fetch, clears loading and allows manual retry', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  const h = screen(async (...args) => {
    signal = args[5];
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  });
  try {
    await h.settle();
    assert.equal(signal.aborted, false);
    context.mock.timers.tick(12000); await h.settle();
    assert.equal(signal.aborted, true);
    assert.ok(h.text().includes('Recherche indisponible'));
    assert.equal(h.button('Relancer la recherche à proximité').props.disabled, false);
    assert.equal(h.markers().length, 0);
  } finally { h.close(); }
});

test('nearby remains centered on last selected venue with an existing multi-stop draft', async () => {
  const calls = [];
  const h = screen(async (...args) => {
    calls.push(args); return { items: replay.normal.items, diagnostics: diagnostics() };
  }, 'ios', [{ ...center, id: 'earlier', name: 'Earlier stop', latitude: 43.605 }, center]);
  try {
    await h.settle();
    assert.deepEqual(calls[0].slice(0, 3), [center.latitude, center.longitude, 12]);
    assert.equal(h.sheet().props.count, 2);
  } finally { h.close(); }
});

test('very short viewport compacts search after summary, keeps reopening search and free exploration', async () => {
  const h = screen(async () => ({ items: replay.normal.items, diagnostics: diagnostics() }));
  try {
    await h.settle(); h.layout(400, 230, 220); h.frames();
    assert.equal(h.sheet().props.collapsed, true);
    h.layout(400, 230, 72); h.frames();
    assert.ok(h.button('Ouvrir la recherche de lieux'));
    assert.equal(h.calls.length, 0, 'waits for compact search layout measurement');
    h.layout(400, 80, 72); h.frames();
    assert.equal(h.calls.length, 1);
    assert.equal(h.markers().length, 49);
    assert.equal(h.sheet().props.count, 1);
    h.button('Ouvrir la recherche de lieux').props.onPress(); h.render();
    h.layout(400, 230, 72); h.frames();
    assert.equal(h.button('Ouvrir la recherche de lieux'), undefined);
    assert.equal(h.calls.length, 1, 'reopening search never recenters');
  } finally { h.close(); }
});

test('add/replace nearby modal also exposes limited results and manual retry without changing its center', async () => {
  for (const mode of ['add', 'replace']) for (const status of ['complete', 'limited', 'error']) {
    let index = 0, loadNearby, values = [], calls = [];
    const version = { current: 0 };
    const hooks = { ...React, useEffect() {}, useRef: () => version, useCallback: fn => { loadNearby = fn; return fn; },
      useState: init => {
        const slot = index++;
        if (!(slot in values)) values[slot] = typeof init === 'function' ? init() : init;
        return [values[slot], value => { values[slot] = typeof value === 'function' ? value(values[slot]) : value; }];
      } };
    const RN = { Platform: { OS: 'ios' }, StyleSheet: { create: x => x }, Alert: { alert() {} },
      ...Object.fromEntries(['ActivityIndicator','KeyboardAvoidingView','Modal','ScrollView','Text','TextInput','TouchableOpacity','View'].map(x => [x, x])) };
    const Component = load('features/active_barathon/components/ReplaceOrAddStopModal.tsx', {
      react: hooks, 'react-native': RN, '@expo/vector-icons': { Ionicons: 'Icon' },
      'react-native-safe-area-context': { useSafeAreaInsets: () => insets },
      '../../../lib/authStorage': { getAccessToken: async () => 'test-token' },
      '../services/activeBarathon.service': {},
      '../../../lib/api': { fetchNearbyBarsWithDiagnostics: async (...args) => {
        calls.push(args);
        if (status === 'error') throw new Error('private-detail');
        return { items: replay.photon_limited.items, diagnostics: { ...diagnostics(), limited: status === 'limited' } };
      } },
    }).default;
    const props = { visible: true, mode, currentStop: center, lastStop: center,
      barathonId: 1, userLocation: { latitude: 0, longitude: 0 }, onClose() {}, onSuccess() {} };
    const render = () => { index = 0; return Component(props); };
    render(); await loadNearby(); const tree = render();
    const text = findAll(tree, node => node.type === 'Text').map(node => node.props.children).flat().join(' ');
    assert.equal(text.includes('Résultats limités'), status === 'limited');
    assert.equal(text.includes('Recherche indisponible'), status === 'error');
    assert.deepEqual(calls[0].slice(0, 3), [center.latitude, center.longitude, 15]);
    if (status !== 'complete') {
      const retry = findAll(tree, node => node.props.accessibilityLabel === 'Relancer la recherche à proximité')[0];
      await retry.props.onPress(); await Promise.resolve(); await Promise.resolve();
      assert.equal(calls.length, 2);
    }
  }
});

test('nearby API also times out consumers without their own cancellation controller', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const oldFetch = global.fetch;
  let signal;
  global.fetch = (url, options) => {
    signal = options.signal;
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  };
  try {
    const pending = api.fetchNearbyBarsWithDiagnostics(center.latitude, center.longitude, 12, 'test-token', 'bar');
    const rejected = assert.rejects(pending, /aborted/);
    context.mock.timers.tick(12000);
    await rejected;
    assert.equal(signal.aborted, true);
  } finally { global.fetch = oldFetch; }
});

test('selection opens one venue card and collapses the sheet; reopening hides the card', async () => {
  const item = { name: 'Nearby', latitude: center.latitude + .0001, longitude: center.longitude, stop_type: 'bar' };
  const h = screen(async () => ({ items: [item], diagnostics: diagnostics() }));
  try {
    await h.settle(); h.layout();
    h.markers()[0].props.onPress({ stopPropagation() {} }); h.render();
    assert.equal(h.sheet().props.collapsed, true);
    assert.equal(h.markers()[0].props.title, undefined);
    assert.ok(h.text().includes('Nearby'));
    assert.ok(h.text().includes('Ajouter'));
    h.sheet().props.onCollapsedChange(false); h.render();
    assert.equal(h.sheet().props.collapsed, false);
    assert.equal(h.text().includes('Nearby'), false);
    h.map().props.onPanDrag(); h.render();
    assert.equal(h.sheet().props.collapsed, true);
  } finally { h.close(); }
});
