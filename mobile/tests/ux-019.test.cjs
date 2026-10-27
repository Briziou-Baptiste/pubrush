const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { CommonActions, StackActions } = require('@react-navigation/routers');
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

function harness(initial, overrides = {}) {
  const effects = [], values = [], alerts = [];
  let cursor = 0, refCursor = 0; const refs = [];
  const hooks = {
    ...React,
    useState: init => {
      const index = cursor++;
      if (!(index in values)) values[index] = Object.hasOwn(overrides, index) ? overrides[index] : typeof init === 'function' ? init() : init;
      return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value; }];
    },
    useEffect: fn => effects.push(fn),
    useMemo: fn => fn(),
    useCallback: fn => fn,
    useRef: value => { const i = refCursor++; return refs[i] ||= { current: value }; }
  };
  return {
    effects, values, alerts, hooks,
    render: fn => { cursor = refCursor = 0; effects.length = 0; return fn(); },
    RN: {
      View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', Pressable: 'Pressable',
      Modal: 'Modal', ScrollView: 'ScrollView', TextInput: 'TextInput', ActivityIndicator: 'Spinner',
      FlatList: 'FlatList', useWindowDimensions: () => ({ width: 390, height: 844 }),
      KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: initial || 'ios' },
      StyleSheet: { create: x => x }, Alert: { alert: (...args) => alerts.push(args) }
    }
  };
}

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  return React.Children.toArray(node.props?.children).map(child => find(child, predicate)).find(Boolean) ?? null;
}

function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => nodes(child, predicate))];
}

const textOf = tree => nodes(tree, n => n.type === 'Text').map(n => n.props.children).flat().join(' ');
const button = (tree, label) => find(tree, n => n.type === 'TouchableOpacity' && textOf(n).includes(label));
const flush = () => new Promise(resolve => setImmediate(resolve));

function base(h) {
  return {
    react: h.hooks,
    'react-native': h.RN,
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }) }
  };
}

const statusUtil = load('features/barathon_past_planned/utils/barathon.status.ts');

test('UX-019: Ancien barathon interrompu (Pop) avec 100% des étapes conserve son statut interrompu et indique objectif atteint', async () => {
  const stops = [
    { id: 1, name: 'Bar 1', stop_type: 'bar', latitude: 48.85, longitude: 2.35, stop_order: 1, is_completed: true },
    { id: 2, name: 'Bar 2', stop_type: 'bar', latitude: 48.86, longitude: 2.36, stop_order: 2, is_completed: true },
    { id: 3, name: 'Bar 3', stop_type: 'bar', latitude: 48.87, longitude: 2.37, stop_order: 3, is_completed: true },
    { id: 4, name: 'Bar 4', stop_type: 'bar', latitude: 48.88, longitude: 2.38, stop_order: 4, is_completed: true },
  ];
  const barathonPop = {
    id: 101,
    name: 'Pop',
    status: 'stopped',
    stops,
    start_datetime: '2026-10-25T20:00:00Z',
    end_datetime: '2026-10-25T20:00:00Z', // identical placeholders from creation
  };

  const h = harness();
  const Summary = load('features/active_barathon/screens/BarathonStopSummaryScreen.tsx', {
    ...base(h),
    'expo-router': {
      useNavigation: () => ({ getState: () => null, reset: () => {} }),
      useLocalSearchParams: () => ({
        barathonId: '101',
        barathonName: 'Pop',
        status: 'stopped',
        totalStops: '4',
        completedStops: '4',
        stopsJson: JSON.stringify(stops),
      }),
    },
    '../../../lib/authStorage': { getCurrentUser: async () => ({ id: 1 }), getAccessToken: async () => 'jwt' },
    '../../../lib/api': {
      fetchBarathon: async () => barathonPop,
      fetchBarathonExpenses: async () => ({ expenses: [], balances: [] }),
      savePastBarathon: async () => {},
    },
  }).default;

  h.render(Summary);
  // Execute loadUserDataAndExpenses effect
  h.effects[1]();
  await flush();

  const content = textOf(h.render(Summary));

  // 1. Statut réel serveur affiché explicitement
  assert.match(content, /Statut : Tournée interrompue/);
  assert.doesNotMatch(content, /Tournée terminée/);

  // 2. Progression réelle affichée
  assert.match(content, /4 étapes sur 4 — 100 %/);

  // 3. Objectif de progression avec seuil requis de 70%
  assert.match(content, /Objectif atteint — seuil requis : 70 %/);

  // 4. Durée quand les timestamps sont identiques (diffMs = 0) -> Non disponible
  assert.match(content, /Non disponible/);
  assert.doesNotMatch(content, /0h 0min/);

  // 5. Distance vol d'oiseau
  assert.match(content, /Distance estimée \(vol d’oiseau\)/);
  assert.doesNotMatch(content, /Distance à pied/);
});

test('UX-019: Nouveau barathon terminé avec objectif atteint (completed 3/3)', async () => {
  const stops = [
    { id: 1, name: 'Stop A', stop_type: 'bar', latitude: 48.85, longitude: 2.35, stop_order: 1, is_completed: true },
    { id: 2, name: 'Stop B', stop_type: 'bar', latitude: 48.86, longitude: 2.36, stop_order: 2, is_completed: true },
    { id: 3, name: 'Stop C', stop_type: 'food', latitude: 48.87, longitude: 2.37, stop_order: 3, is_completed: true },
  ];
  const barathonCompleted = {
    id: 102,
    name: 'Fiesta',
    status: 'completed',
    stops,
    started_at: '2026-10-30T20:00:00Z',
    ended_at: '2026-10-30T22:30:00Z',
  };

  const h = harness();
  const Summary = load('features/active_barathon/screens/BarathonStopSummaryScreen.tsx', {
    ...base(h),
    'expo-router': {
      useNavigation: () => ({ getState: () => null, reset: () => {} }),
      useLocalSearchParams: () => ({ barathonId: '102' }),
    },
    '../../../lib/authStorage': { getCurrentUser: async () => ({ id: 1 }), getAccessToken: async () => 'jwt' },
    '../../../lib/api': {
      fetchBarathon: async () => barathonCompleted,
      fetchBarathonExpenses: async () => ({ expenses: [], balances: [] }),
    },
  }).default;

  h.render(Summary);
  h.effects[1]();
  await flush();

  const content = textOf(h.render(Summary));
  assert.match(content, /Statut : Tournée terminée/);
  assert.match(content, /3 étapes sur 3 — 100 %/);
  assert.match(content, /Objectif atteint — seuil requis : 70 %/);
  // Valid duration: 2h 30min
  assert.match(content, /2h 30min/);
});

test('UX-019: Barathon interrompu avec progression partielle sous le seuil (1/3)', async () => {
  const stops = [
    { id: 1, name: 'Stop 1', stop_type: 'bar', latitude: 48.85, longitude: 2.35, stop_order: 1, is_completed: true },
    { id: 2, name: 'Stop 2', stop_type: 'bar', latitude: 48.86, longitude: 2.36, stop_order: 2, is_completed: false },
    { id: 3, name: 'Stop 3', stop_type: 'bar', latitude: 48.87, longitude: 2.37, stop_order: 3, is_completed: false },
  ];
  const barathonStopped = {
    id: 103,
    name: 'Sortie Courte',
    status: 'stopped',
    stops,
    started_at: '2026-10-30T20:00:00Z',
    ended_at: '2026-10-30T20:45:00Z',
  };

  const h = harness();
  const Summary = load('features/active_barathon/screens/BarathonStopSummaryScreen.tsx', {
    ...base(h),
    'expo-router': {
      useNavigation: () => ({ getState: () => null, reset: () => {} }),
      useLocalSearchParams: () => ({ barathonId: '103' }),
    },
    '../../../lib/authStorage': { getCurrentUser: async () => ({ id: 1 }), getAccessToken: async () => 'jwt' },
    '../../../lib/api': {
      fetchBarathon: async () => barathonStopped,
      fetchBarathonExpenses: async () => ({ expenses: [], balances: [] }),
    },
  }).default;

  h.render(Summary);
  h.effects[1]();
  await flush();

  const content = textOf(h.render(Summary));
  assert.match(content, /Statut : Tournée interrompue/);
  assert.match(content, /1 étape sur 3 — 33 %/);
  assert.match(content, /Objectif non atteint — seuil requis : 70 %/);
  assert.match(content, /45 min/);
});

test('UX-019: Durée du barathon - calcul, timestamps invalides ou manquants', () => {
  const stops = [{ is_completed: true }, { is_completed: true }];
  const h = harness();
  const Summary = load('features/active_barathon/screens/BarathonStopSummaryScreen.tsx', {
    ...base(h),
    'expo-router': {
      useNavigation: () => ({ getState: () => null, reset: () => {} }),
      useLocalSearchParams: () => ({
        barathonId: '104',
        totalStops: '2',
        completedStops: '2',
        startDateTimeIso: '2026-10-30T20:00:00Z',
        endDateTimeIso: '2026-10-30T20:00:00Z', // identical
      }),
    },
    '../../../lib/authStorage': { getCurrentUser: async () => null, getAccessToken: async () => null },
    '../../../lib/api': { fetchBarathon: async () => ({}), fetchBarathonExpenses: async () => ({}) },
  }).default;

  const content = textOf(h.render(Summary));
  assert.match(content, /Non disponible/);
  assert.doesNotMatch(content, /0h 0min/);
});

test('UX-019: Distance à vol d oiseau calculée et affichée honnêtement', () => {
  const stops = [
    { id: 1, name: 'Place du Capitole', stop_type: 'bar', latitude: 43.6047, longitude: 1.4442, stop_order: 1, is_completed: true },
    { id: 2, name: 'Jean Jaurès', stop_type: 'bar', latitude: 43.6060, longitude: 1.4520, stop_order: 2, is_completed: true },
  ];
  const h = harness();
  const Summary = load('features/active_barathon/screens/BarathonStopSummaryScreen.tsx', {
    ...base(h),
    'expo-router': {
      useNavigation: () => ({ getState: () => null, reset: () => {} }),
      useLocalSearchParams: () => ({
        barathonId: '105',
        totalStops: '2',
        completedStops: '2',
        stopsJson: JSON.stringify(stops),
      }),
    },
    '../../../lib/authStorage': { getCurrentUser: async () => null, getAccessToken: async () => null },
    '../../../lib/api': { fetchBarathon: async () => ({ stops }), fetchBarathonExpenses: async () => ({}) },
  }).default;

  const content = textOf(h.render(Summary));
  assert.match(content, /Distance estimée \(vol d’oiseau\)/);
  assert.match(content, /~0\.6 km/);
  assert.doesNotMatch(content, /Distance à pied/);
});

test('UX-019: Liste d étapes vide affiche un message explicite', () => {
  const h = harness();
  const Summary = load('features/active_barathon/screens/BarathonStopSummaryScreen.tsx', {
    ...base(h),
    'expo-router': {
      useNavigation: () => ({ getState: () => null, reset: () => {} }),
      useLocalSearchParams: () => ({ barathonId: '106', stopsJson: '[]' }),
    },
    '../../../lib/authStorage': { getCurrentUser: async () => null, getAccessToken: async () => null },
    '../../../lib/api': { fetchBarathon: async () => ({ stops: [] }), fetchBarathonExpenses: async () => ({}) },
  }).default;

  const content = textOf(h.render(Summary));
  assert.match(content, /Aucune étape enregistrée\./);
});

test('UX-019: Bouton retour discret sur bilan du barathon respecte la zone tactile 44x44', () => {
  let navResetCalled = false, navGoBackCalled = false;
  const mockNav = {
    canGoBack: () => true,
    goBack: () => { navGoBackCalled = true; },
    reset: () => { navResetCalled = true; },
    getState: () => ({ index: 0, routes: [{ name: 'barathon-stop-summary' }] }),
    getCurrentRoute: () => ({ name: 'barathon-stop-summary' }),
    isReady: () => true,
  };

  const h = harness();
  const Stack = Object.assign('Stack', { Screen: 'Screen' });
  const Root = load('app/_layout.tsx', {
    ...base(h),
    '@react-navigation/native': { CommonActions },
    'expo-router': {
      Stack,
      router: {},
      useNavigationContainerRef: () => mockNav,
      usePathname: () => '/barathon-stop-summary',
    },
    '../lib/authStorage': { getAccessToken: async () => null, subscribeToAuthChanges: () => () => {} },
    '../features/active_barathon/services/webSocket.service': { connectUserSocket: () => {}, disconnectUserSocket: () => {} },
    '../features/home/hooks/useUserLocation': { initializeLocationCache: async () => {} },
  }).default;

  const tree = h.render(Root);
  const options = tree.props.screenOptions({ route: { name: 'barathon-stop-summary' }, navigation: mockNav });
  const backButton = options.headerLeft();

  assert.equal(backButton.props.accessibilityLabel, 'Retour');
  const styleObj = backButton.props.style({ pressed: false });
  // Exactly 44x44 touch dimensions
  assert.equal(styleObj.width, 44);
  assert.equal(styleObj.height, 44);
  assert.equal(styleObj.borderRadius, 22);
  assert.equal(styleObj.backgroundColor, '#FFFFFF');

  // Trigger onPress
  backButton.props.onPress();
  assert.equal(navGoBackCalled, true);
});

test('UX-019: Masquage du bouton flottant expo-dev-menu sur le bilan et restauration au démontage', () => {
  let devMenuVisible = true;
  const mockDevMenu = {
    setToolsButtonVisible: (visible) => { devMenuVisible = visible; },
  };

  const h = harness();
  const Summary = load('features/active_barathon/screens/BarathonStopSummaryScreen.tsx', {
    ...base(h),
    'expo-dev-menu': mockDevMenu,
    'expo-router': {
      useNavigation: () => ({ getState: () => null, reset: () => {} }),
      useLocalSearchParams: () => ({ barathonId: '107' }),
    },
    '../../../lib/authStorage': { getCurrentUser: async () => null, getAccessToken: async () => null },
    '../../../lib/api': { fetchBarathon: async () => ({}), fetchBarathonExpenses: async () => ({}) },
  }).default;

  h.render(Summary);
  // Effect 0: summaryHistory, Effect 1: loadUserDataAndExpenses, Effect 2: expo-dev-menu hide
  assert.equal(h.effects.length >= 3, true);
  const cleanup = h.effects[2]();
  assert.equal(devMenuVisible, false);

  // When unmounted, cleanup restores the tools button
  if (typeof cleanup === 'function') cleanup();
  assert.equal(devMenuVisible, true);
});

test('UX-019: Tolérance si expo-dev-menu est indisponible ou lève une exception (mode production / web)', () => {
  const mockDevMenuThrowing = {
    setToolsButtonVisible: () => { throw new Error('WebUnsupportedError: native module missing'); },
  };

  const h = harness();
  const Summary = load('features/active_barathon/screens/BarathonStopSummaryScreen.tsx', {
    ...base(h),
    'expo-dev-menu': mockDevMenuThrowing,
    'expo-router': {
      useNavigation: () => ({ getState: () => null, reset: () => {} }),
      useLocalSearchParams: () => ({ barathonId: '107b' }),
    },
    '../../../lib/authStorage': { getCurrentUser: async () => null, getAccessToken: async () => null },
    '../../../lib/api': { fetchBarathon: async () => ({}), fetchBarathonExpenses: async () => ({}) },
  }).default;

  assert.doesNotThrow(() => {
    h.render(Summary);
    const cleanup = h.effects[2]();
    if (typeof cleanup === 'function') cleanup();
  });
});

test('UX-019: Bouton Enregistrer ce barathon ouvre la modale de sauvegarde', async () => {
  let savedNameArg = '';
  const h = harness();
  const Summary = load('features/active_barathon/screens/BarathonStopSummaryScreen.tsx', {
    ...base(h),
    'expo-router': {
      useNavigation: () => ({ getState: () => null, reset: () => {} }),
      useLocalSearchParams: () => ({ barathonId: '108', barathonName: 'Pop' }),
    },
    '../../../lib/authStorage': { getCurrentUser: async () => ({ id: 1 }), getAccessToken: async () => 'valid-jwt' },
    '../../../lib/api': {
      fetchBarathon: async () => ({ id: 108, name: 'Pop', stops: [] }),
      fetchBarathonExpenses: async () => ({ expenses: [], balances: [] }),
      savePastBarathon: async (id, name, token) => {
        savedNameArg = name;
        assert.equal(id, 108);
        assert.equal(token, 'valid-jwt');
      },
    },
  }).default;

  let tree = h.render(Summary);
  const saveBtn = button(tree, 'Enregistrer ce barathon');
  assert.ok(saveBtn, 'Le bouton Enregistrer ce barathon doit être présent');

  saveBtn.props.onPress();
  tree = h.render(Summary);

  const confirmBtn = find(tree, n => n.type === 'TouchableOpacity' && textOf(n).trim() === 'Enregistrer');
  assert.ok(confirmBtn, 'Le bouton de confirmation de sauvegarde doit être affiché');
  await confirmBtn.props.onPress();
  await flush();

  assert.equal(savedNameArg, 'Pop');
});
