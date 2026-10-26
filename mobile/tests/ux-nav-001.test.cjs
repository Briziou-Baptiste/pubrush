const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { StackRouter, CommonActions, StackActions } = require('@react-navigation/routers');
const src = path.resolve(__dirname, '../src');

function load(relative, mocks = {}) {
  const file = path.resolve(src, relative);
  const mod = new Module(file, module);
  mod.paths = module.paths;
  mod.require = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.endsWith('.png')) return name;
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(file), name);
      const found = ['.ts', '.tsx'].find(ext => fs.existsSync(target + ext));
      if (found) return load(path.relative(src, target + found), mocks);
    }
    return require(name);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, file);
  return mod.exports;
}
const policy = load('lib/navigation.ts');
function harness(initial, overrides = {}) {
  const effects = [], values = [], alerts = [];
  let cursor = 0;
  const hooks = { ...React, useState: init => {
    const index = cursor++;
    if (!(index in values)) values[index] = Object.hasOwn(overrides, index) ? overrides[index] : typeof init === 'function' ? init() : init;
    return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value; }];
  }, useEffect: fn => effects.push(fn), useMemo: fn => fn(), useCallback: fn => fn,
  useRef: value => ({ current: value }) };
  return { effects, values, alerts, hooks, render: fn => { cursor = 0; return fn(); },
    RN: { View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', Pressable: 'Pressable',
      Modal: 'Modal', ScrollView: 'ScrollView', TextInput: 'TextInput', ActivityIndicator: 'Spinner',
      KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: initial || 'ios' },
      StyleSheet: { create: x => x }, Alert: { alert: (...args) => alerts.push(args) } } };
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  return React.Children.toArray(node.props?.children).map(child => find(child, predicate)).find(Boolean);
}
function stack(routes) {
  const routeNames = ['index','login','home','active-barathon', ...Object.keys(policy.navigationTitles)];
  const options = { routeNames, routeParamList: {}, routeGetIdList: {} };
  const reducer = StackRouter({ initialRouteName: routes[0].name });
  let state = reducer.getInitialState(options);
  function dispatch(action) {
    const next = reducer.getStateForAction(state, action, options);
    assert.ok(next, `Unhandled navigation action ${action.type}`);
    state = reducer.getRehydratedState(next, options);
  }
  dispatch(CommonActions.reset({ index: routes.length - 1, routes }));
  return { dispatch, reset: payload => dispatch(CommonActions.reset(payload)), goBack: () => dispatch(StackActions.pop()),
    canGoBack: () => state.index > 0, getState: () => state, getCurrentRoute: () => state.routes[state.index], isReady: () => true };
}
function layout(nav) {
  const h = harness();
  let androidBack, removed = false;
  const Stack = Object.assign('Stack', { Screen: 'Screen' });
  const Root = load('app/_layout.tsx', {
    react: h.hooks, '@react-navigation/native': { CommonActions },
    'react-native': { ...h.RN, BackHandler: { addEventListener: (event, fn) => {
      assert.equal(event, 'hardwareBackPress'); androidBack = fn;
      return { remove: () => { removed = true; } };
    } } }, '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-router': { Stack, router: {}, useNavigationContainerRef: () => nav, usePathname: () => '/' + nav.getCurrentRoute().name },
    '../lib/authStorage': {}, '../features/active_barathon/services/webSocket.service': {},
    '../features/home/hooks/useUserLocation': {},
  }).default;
  const tree = h.render(Root);
  const cleanup = h.effects[0]();
  return { options: () => tree.props.screenOptions({ route: nav.getCurrentRoute(), navigation: nav }),
    androidBack: () => androidBack(), cleanup, removed: () => removed };
}

test('real StackRouter + header: recap returns to the same map, then updated configuration, without duplicate routes', () => {
  const bars = JSON.stringify([{ id: '1', name: 'Delirium', latitude: 43.607, longitude: 1.451 }]);
  const nav = stack([{ name: 'home' }, { name: 'create-barathon', params: { initialName: 'Vendredi' } },
    { name: 'create-barathon-map', params: { name: 'Vendredi' } }, { name: 'create-barathon-recap' }]);
  const originalMap = nav.getState().routes[2];
  const ui = layout(nav);
  const back = ui.options().headerLeft();
  assert.equal(back.props.accessibilityLabel, 'Retour');
  assert.deepEqual([back.props.style({ pressed: false }).width, back.props.style({ pressed: false }).height], [48, 48]);
  back.props.onPress();
  assert.equal(nav.getCurrentRoute().key, originalMap.key);
  const state = nav.getState();
  const update = policy.draftParentUpdate(state.routes, nav.getCurrentRoute().key, bars);
  nav.dispatch({ ...CommonActions.setParams(update.params), source: update.key });
  ui.options().headerLeft().props.onPress();
  assert.equal(nav.getCurrentRoute().name, 'create-barathon');
  assert.equal(nav.getCurrentRoute().params.initialName, 'Vendredi');
  assert.equal(nav.getCurrentRoute().params.initialStopsJson, bars);
  assert.equal(nav.getState().routes.length, 2);
});

test('cold/direct screen openings: header and Android system back use the same destination', () => {
  const cases = { register: 'login', 'forgot-password': 'login', 'reset-password': 'forgot-password',
    profile: 'home', 'profile-details': 'profile', planned: 'home', past: 'home',
    expenses: 'profile', 'barathon-expenses': 'expenses', 'barathon-details': 'planned',
    'saved-barathons': 'profile', 'start-barathon-roles': 'planned', events: 'home', 'partner-event-map': 'events' };
  for (const [name, target] of Object.entries(cases)) for (const method of ['header','hardware']) {
    const nav = stack([{ name }]);
    const ui = layout(nav);
    if (method === 'header') ui.options().headerLeft().props.onPress();
    else assert.equal(ui.androidBack(), true);
    assert.equal(nav.getCurrentRoute().name, target, `${name} ${method}`);
    assert.equal(nav.getState().routes.length, 1);
    ui.cleanup(); assert.equal(ui.removed(), true);
  }
});

test('direct recap → map → configuration restores bars, schedule and entered parameters', () => {
  const params = { name: 'Vendredi', startDateTimeIso: '2026-10-30T19:00:00.000Z',
    travelTime: '12', maxTimeInBar: '45', stopsJson: '[{"id":"bar-1"}]' };
  const nav = stack([{ name: 'create-barathon-recap', params }]);
  const ui = layout(nav);
  ui.options().headerLeft().props.onPress();
  assert.equal(nav.getCurrentRoute().params.initialStopsJson, params.stopsJson);
  ui.options().headerLeft().props.onPress();
  assert.deepEqual(nav.getCurrentRoute().params, { initialName: 'Vendredi', initialStartDateTimeIso: params.startDateTimeIso,
    initialTravelTime: '12', initialMaxTimeInBar: '45', initialStopsJson: params.stopsJson });
  assert.equal(policy.draftParentUpdate([{ name: 'create-barathon-map', key: 'direct' }], 'direct', '[]'), null);
});

test('summary after active session, history or deep link returns to its list and never setup/active', () => {
  for (const source of ['active', 'past', undefined]) {
    const nav = stack([{ name: 'home' }, { name: 'start-barathon-roles' },
      { name: 'barathon-stop-summary', params: { source, barathonId: '42' } }]);
    const current = nav.getCurrentRoute();
    const routes = policy.summaryHistory(nav.getState().routes, current);
    nav.reset({ index: routes.length - 1, routes });
    assert.equal(nav.getCurrentRoute().key, current.key);
    const normal = nav.getState().routes;
    assert.equal(policy.summaryHistory(normal, nav.getCurrentRoute()), normal);
    const ui = layout(nav);
    ui.options().headerLeft().props.onPress();
    assert.equal(nav.getCurrentRoute().name, policy.summaryDestination({ source }));
    assert.equal(nav.getState().routes.some(r => ['start-barathon-roles','active-barathon'].includes(r.name)), false);
  }
});

test('normal history keeps Android/native gesture handling; home/login/active have no artificial return', () => {
  const nav = stack([{ name: 'home' }, { name: 'profile' }, { name: 'profile-details' }]);
  const ui = layout(nav);
  assert.equal(ui.androidBack(), false);
  ui.options().headerLeft().props.onPress();
  assert.equal(nav.getCurrentRoute().name, 'profile');
  for (const name of ['home','login','active-barathon']) {
    const root = layout(stack([{ name }]));
    assert.equal(root.options().headerShown, false);
    assert.equal(root.androidBack(), false);
  }
});

test('unsaved guard: cancel retains data, discard replays the exact native action, busy blocks departure', () => {
  let blocked, callback, focused = true;
  const dispatched = [], h = harness();
  const { useUnsavedNavigation } = load('hooks/useUnsavedNavigation.ts', {
    'expo-router': {
      useNavigation: () => ({ dispatch: action => dispatched.push(action) }),
      useIsFocused: () => focused,
      usePreventRemove: (value, cb) => { blocked = value; callback = cb; },
    },
    'react-native': h.RN,
  });
  const action = StackActions.pop();
  useUnsavedNavigation(true); assert.equal(blocked, true); callback({ data: { action } });
  assert.equal(h.alerts[0][2][0].style, 'cancel'); assert.equal(dispatched.length, 0);
  h.alerts[0][2][1].onPress(); assert.equal(dispatched[0], action);
  useUnsavedNavigation(true, true); callback({ data: { action } });
  assert.equal(h.alerts[1][0], 'Enregistrement en cours'); assert.equal(h.alerts[1][2], undefined);
  focused = false; useUnsavedNavigation(true); assert.equal(blocked, false);
  focused = true; useUnsavedNavigation(false); assert.equal(blocked, false);
});

test('native Android date picker: dismissal cancels, selection confirms once and closes; iOS waits for validation', () => {
  for (const os of ['android','ios']) {
    const h = harness(os), confirmations = [];
    const DateField = load('features/create_barathon/components/DateTimeModalField.tsx', {
      react: h.hooks, 'react-native': h.RN, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      '@react-native-community/datetimepicker': 'DateTimePicker',
    }).default;
    const props = { label: 'Date', mode: 'date', value: null, onConfirm: date => confirmations.push(date) };
    const render = () => h.render(() => DateField(props));
    let tree = render();
    find(tree, n => n.type === 'DateTimePicker').props.onChange({ type: 'dismissed' });
    assert.equal(confirmations.length, 0);
    const date = new Date('2026-10-30T19:00:00Z');
    find(tree, n => n.type === 'DateTimePicker').props.onChange({ type: 'set' }, date);
    if (os === 'ios') {
      assert.equal(confirmations.length, 0);
      tree = render();
      find(tree, n => n.type === 'TouchableOpacity' && find(n, child => child.type === 'Text' && child.props.children === 'Valider')).props.onPress();
    }
    assert.deepEqual(confirmations, [date]);
    assert.equal(h.values[0], false);
  }
});

test('successful login and registration clear the auth stack instead of returning to an obsolete form', async () => {
  for (const screen of ['Login','Register']) {
    const registering = screen === 'Register';
    const h = harness('ios', registering
      ? { 0: 'navigation@example.test', 1: 'Navigation', 2: 'test-password-only' }
      : { 0: 'navigation@example.test', 1: 'test-password-only' });
    const nav = stack([{ name: 'login' }, ...(registering ? [{ name: 'register' }] : [])]);
    let stored = false;
    const Screen = load(`features/auth/screens/${screen}Screen.tsx`, {
      react: h.hooks, 'react-native': { ...h.RN, SafeAreaView: 'SafeAreaView', Image: 'Image' },
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      '@react-navigation/native': {}, '@react-navigation/elements': { useHeaderHeight: () => 96 },
      'expo-router': { Link: 'Link', useNavigation: () => nav }, 'expo-web-browser': {}, 'expo-secure-store': {},
      '../../../hooks/useUnsavedNavigation': { useUnsavedNavigation() {} },
      '../../../lib/api': { loginUser: async () => ({ access_token: 'fake-session' }), registerUser: async () => {}, checkUsernameAvailability: async () => true },
      '../../../lib/authStorage': { saveSession: async () => { stored = true; } },
    }).default;
    const tree = h.render(Screen);
    const submit = find(tree, n => n.type === 'TouchableOpacity' && find(n, c => c.type === 'Text' && c.props.children === (registering ? 'Créer mon compte' : 'Se connecter')));
    assert.ok(submit);
    await submit.props.onPress();
    if (registering) { h.effects.length = 0; h.render(Screen); h.effects[0](); }
    assert.equal(stored, true);
    assert.equal(h.alerts.length, 0);
    assert.deepEqual(nav.getState().routes.map(r => r.name), ['home']);
  }
});

test('participants modal uses the same guarded closure for the top close button and Android back', () => {
  const h = harness('ios', { 7: [{ user: { id: 2, username: 'Invité' } }], 8: [1] });
  let closed = 0;
  const Screen = load('features/planned/components/ManageParticipantsModal.tsx', {
    react: h.hooks, 'react-native': h.RN, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/vector-icons': { Ionicons: 'Icon' }, '../services/planned.service': {},
    '../../active_barathon/components/InviteFriendsModal': () => null,
  }).default;
  const tree = h.render(() => Screen({ visible: true, barathon: { id: 42, name: 'Vendredi' }, currentUserId: 1,
    onClose: () => { closed++; }, onUpdated() {} }));
  const modal = find(tree, n => n.type === 'Modal');
  const button = find(tree, n => n.props.accessibilityLabel === 'Fermer');
  assert.equal(modal.props.onRequestClose, button.props.onPress);
  button.props.onPress();
  assert.equal(closed, 0);
  assert.equal(h.alerts[0][2][0].style, 'cancel');
  h.alerts[0][2][1].onPress(); assert.equal(closed, 1);
});

test('role setup accepts completion navigation from the server while blocking an unrelated back during submit', () => {
  let callback;
  const dispatched = [], h = harness();
  const { useUnsavedNavigation } = load('hooks/useUnsavedNavigation.ts', {
    'expo-router': {
      useNavigation: () => ({ dispatch: action => dispatched.push(action) }),
      useIsFocused: () => true,
      usePreventRemove: (_, cb) => { callback = cb; },
    },
    'react-native': h.RN,
  });
  useUnsavedNavigation(true, true, 'active-barathon');
  const completion = StackActions.replace('active-barathon', { barathonId: '42' });
  callback({ data: { action: completion } });
  assert.equal(dispatched[0], completion);
  assert.equal(h.alerts.length, 0);
  callback({ data: { action: StackActions.pop() } });
  assert.equal(dispatched.length, 1);
  assert.equal(h.alerts[0][0], 'Enregistrement en cours');
});
