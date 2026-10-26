const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const base = path.resolve(__dirname, '../src/features/create_barathon');
function load(relative, mocks = {}) {
  const file = path.resolve(base, relative);
  const mod = new Module(file, module);
  mod.paths = module.paths;
  mod.require = name => mocks[name] || (name.startsWith('.')
    ? load(path.relative(base, path.resolve(path.dirname(file), name)) + '.ts', mocks)
    : require(name));
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, file);
  return mod.exports;
}
const { selectNearbySuggestions, isSameVenue } = load('services/nearbyPlaces.service.ts');
const { getWalkingDirectionsUrl } = load('services/mapLinks.service.ts');
const { getMapControlsLayout, isSheetDrag, sheetCollapsedAfterDrag } = load('services/mapLayout.service.ts');
const center = { name: 'Delirium Café', latitude: 43.6070791, longitude: 1.4512943 };
const source = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../docs/places-005/toulouse-overpass.json')));

test('Toulouse: real OSM Tito Jean Jaures remains visible after selecting Delirium', () => {
  const candidates = source.elements.filter(e => e.tags?.amenity === 'bar' && e.tags.name).map(e => ({
    name: e.tags.name, latitude: e.lat ?? e.center.lat, longitude: e.lon ?? e.center.lon,
  }));
  const result = selectNearbySuggestions(candidates, [center], center, 15);
  assert.equal(result[0].name, 'El Tío Mojito');
  assert.equal(result[0].distanceMeters, 84);
  assert.equal(result.some(p => p.name === center.name), false);
  const branches = candidates.filter(p => /mojito/i.test(p.name));
  assert.equal(selectNearbySuggestions(branches, [center], center, 15).length, 2);
});

test('neighbouring bars, shared names at different addresses, and substring names stay distinct', () => {
  const selected = { ...center, name: 'Tito Mojito' };
  const duplicate = { ...selected, name: 'Títo Mojito', latitude: selected.latitude + .00001 };
  const adjacent = { ...selected, name: 'Other bar', latitude: selected.latitude + .00002 };
  const branch = { ...selected, latitude: selected.latitude + .005 };
  const substring = { ...selected, name: 'Tito Mojito Club' };
  const snapshot = structuredClone([selected, duplicate, adjacent, branch, substring]);
  assert.equal(isSameVenue(selected, duplicate), true);
  const result = selectNearbySuggestions([duplicate, adjacent, branch, substring], [selected], center, 15);
  assert.deepEqual(result.map(p => p.name), ['Tito Mojito Club', 'Other bar', 'Tito Mojito']);
  assert.deepEqual([selected, duplicate, adjacent, branch, substring], snapshot);
});

test('closest candidates survive beyond index 50 with unknown durations; radius is enforced', () => {
  const far = Array.from({ length: 60 }, (_, i) => ({ ...center, name: `Far ${i}`, latitude: center.latitude + .006 }));
  const nearest = { ...center, name: 'Nearest', latitude: center.latitude + .0001 };
  const out = { ...center, name: 'Outside', latitude: center.latitude + .02 };
  const result = selectNearbySuggestions([...far, out, nearest], [], center, 15);
  assert.equal(result.length, 50);
  assert.equal(result[0].name, 'Nearest');
  assert.equal(result.some(p => p.name === 'Outside'), false);
});

test('external pedestrian navigation works without a routing API or device origin', () => {
  const dest = { latitude: 43.6078306, longitude: 1.4512561 };
  const url = new URL(getWalkingDirectionsUrl(center, dest));
  assert.equal(url.hostname, 'www.google.com');
  assert.equal(url.searchParams.get('api'), '1');
  assert.equal(url.searchParams.get('travelmode'), 'walking');
  assert.equal(url.searchParams.get('origin'), '43.6070791,1.4512943');
  assert.equal(url.searchParams.get('destination'), '43.6078306,1.4512561');
  assert.equal(url.searchParams.has('key'), false);
  assert.equal(new URL(getWalkingDirectionsUrl(null, dest)).searchParams.has('origin'), false);
  assert.equal(getWalkingDirectionsUrl(center, { latitude: NaN, longitude: 1 }), null);
});

test('sheet claims vertical drags only and collapses/reopens beyond the threshold', () => {
  for (const [dx, dy] of [[25, 2], [2, 8], [30, 35]]) assert.equal(isSheetDrag(dx, dy), false);
  assert.equal(isSheetDrag(3, 60), true);
  assert.equal(sheetCollapsedAfterDrag(false, 60), true);
  assert.equal(sheetCollapsedAfterDrag(true, -60), false);
  assert.equal(sheetCollapsedAfterDrag(false, 20), false);
  assert.equal(sheetCollapsedAfterDrag(true, 20), true);
});

test('actual sheet header wires drag/tap to controlled state and retains mounted content', () => {
  const React = require('react');
  let handlers;
  const RN = {
    View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity',
    StyleSheet: { create: x => x },
    Animated: { View: 'AnimatedView', Value: class { setValue() {} }, spring: () => ({ start() {} }) },
    PanResponder: { create: config => { handlers = config; return { panHandlers: {} }; } },
  };
  const Component = load('components/RouteSummarySheet.tsx', {
    react: { ...React, useRef: value => ({ current: value }), useMemo: fn => fn() },
    'react-native': RN,
  }).default;
  const form = React.createElement('Form', { selection: [center], name: 'Friday' });
  let collapsed = false;
  const props = { collapsed, count: 1, children: form, style: {}, attribution: null,
    onCollapsedChange: value => { collapsed = value; }, onLayout() {} };
  let tree = Component(props);
  handlers.onPanResponderRelease(null, { dy: 70 });
  assert.equal(collapsed, true);
  tree = Component({ ...props, collapsed });
  const content = tree.props.children[1];
  assert.equal(content.props.style.display, 'none');
  assert.equal(content.props.children, form);
  const button = tree.props.children[0].props.children;
  assert.equal(button.props.accessibilityState.expanded, false);
  button.props.onPress();
  assert.equal(collapsed, false);
  assert.equal(Component({ ...props, collapsed }).props.children[1].props.children, form);
});

for (const [device, width, height, topInset, bottomInset] of [
  ['small iPhone', 320, 568, 20, 0], ['iPhone with home indicator', 375, 667, 44, 34],
  ['small Android', 320, 480, 24, 24], ['Android', 360, 640, 24, 24],
  ['landscape', 667, 375, 0, 21],
]) test(`${device}: measured controls clear both overlays and touch targets stay in the viewport`, () => {
  const available = height - topInset - bottomInset - 24;
  const headerBottom = topInset + 12 + available * .30;
  const bottomTop = height - bottomInset - 12 - available * .40;
  const layout = getMapControlsLayout(bottomTop, headerBottom);
  assert.ok(layout.fits);
  assert.ok(layout.top - 4 > headerBottom);
  assert.ok(layout.top + (layout.horizontal ? 48 : 108) + 4 < bottomTop);
  assert.ok((layout.horizontal ? 108 : 48) + 14 + 4 <= width);
});
