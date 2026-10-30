const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { React, createRoot, document, flush } = require('./helpers/photoMysteryHarness.cjs');

test('reconnecting to the current stop preserves the countdown and restores it on remount', async t => {
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  const saved = new Map(); let tracking; let onAppState;
  const file = path.resolve(__dirname, '../src/features/active_barathon/hooks/useActiveBarathonTracking.ts');
  const mod = new Module(file, module); mod.paths = module.paths;
  mod.require = name => {
    if (name === 'react') return React;
    if (name === 'react-native') return { AppState: { addEventListener: (_, cb) => { onAppState = cb; return { remove() {} }; } } };
    if (name === 'expo-location') return { Accuracy: { High: 1 }, requestForegroundPermissionsAsync: async () => ({ granted: false }), getCurrentPositionAsync: async () => ({ coords: { latitude: 1, longitude: 1 } }) };
    if (name === 'expo-secure-store') return { getItemAsync: async k => saved.get(k) || null, setItemAsync: async (k, v) => { saved.set(k, v); } };
    if (name.includes('activeBarathon.distance')) return { getDistanceMeters: () => 1000 };
    if (name.includes('activeBarathon.timer')) return { secondsFromMinutes: m => m * 60 };
    if (name.includes('activeBarathonNotifications')) return { cancelStopNotifications: async () => {}, ensureNotificationPermissions: async () => {}, scheduleFiveMinutesLeftNotification: async () => null, scheduleOvertimeNotification: async () => null };
    if (name.includes('activeBarathonNavigation')) return { openWalkingDirectionsInGoogleMaps: async () => {} };
    if (name.includes('activeBarathon.service')) return { completeBarathonStop: async () => {} };
    return require(name);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
  const barathon = { id: 30, max_time_in_bar_minutes: 10, stops: [{ id: 2, name: 'Bar', latitude: 1, longitude: 1, is_completed: false }] };
  function App() { tracking = mod.exports.useActiveBarathonTracking({ barathon }); return null; }
  const container = document.createElement('div'); document.body.appendChild(container);
  let root = createRoot(container);
  t.after(async () => { await flush(() => root.unmount()); document.body.removeChild(container); });
  await flush(() => root.render(React.createElement(App)));
  await flush(() => tracking.startStopTimer());
  const deadline = saved.get('stop_timer_30_2'); assert.ok(deadline);
  now += 90_000;
  await flush(() => { void tracking.advanceToStop(0); onAppState('active'); });
  assert.equal(tracking.state.phase, 'in_stop');
  assert.equal(tracking.state.remainingSeconds, 510);
  assert.equal(saved.get('stop_timer_30_2'), deadline);
  await flush(() => root.unmount());
  root = createRoot(container);
  await flush(() => root.render(React.createElement(App)));
  assert.equal(tracking.state.phase, 'in_stop');
  assert.equal(tracking.state.remainingSeconds, 510);
  assert.equal(saved.get('stop_timer_30_2'), deadline);
});
