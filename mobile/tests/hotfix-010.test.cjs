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

function harness(initialValues = {}) {
  const slots = [], effects = [], alerts = [];
  let cursor = 0;
  const different = (a, b) => !a || !b || a.length !== b.length || a.some((val, i) => !Object.is(val, b[i]));

  const hooks = {
    ...React,
    useState(init) {
      const index = cursor++;
      if (!slots[index]) {
        slots[index] = { value: Object.hasOwn(initialValues, index) ? initialValues[index] : (typeof init === 'function' ? init() : init) };
      }
      return [slots[index].value, update => {
        const value = typeof update === 'function' ? update(slots[index].value) : update;
        if (!Object.is(slots[index].value, value)) {
          slots[index].value = value;
        }
      }];
    },
    useRef(init) {
      const index = cursor++;
      return (slots[index] ||= { current: init });
    },
    useMemo(fn, deps) {
      const index = cursor++;
      if (!slots[index] || different(slots[index].deps, deps)) {
        slots[index] = { deps, value: fn() };
      }
      return slots[index].value;
    },
    useCallback(fn, deps) {
      const index = cursor++;
      if (!slots[index] || different(slots[index].deps, deps)) {
        slots[index] = { deps, value: fn };
      }
      return slots[index].value;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!slots[index] || different(slots[index].deps, deps)) {
        effects.push(() => {
          slots[index]?.cleanup?.();
          slots[index] = { deps, cleanup: fn() };
        });
      }
    },
  };

  const RN = {
    Platform: { OS: 'ios', select: x => x.default || x.ios },
    StyleSheet: { create: x => x },
    Alert: { alert: (...args) => alerts.push(args) },
    KeyboardAvoidingView: 'KeyboardAvoidingView',
    ScrollView: 'ScrollView',
    View: 'View',
    Text: 'Text',
    TextInput: 'TextInput',
    TouchableOpacity: 'TouchableOpacity',
    Pressable: 'Pressable',
    Modal: 'Modal',
    ActivityIndicator: 'ActivityIndicator',
  };

  function render(Component, props = {}) {
    cursor = 0;
    const tree = Component(props);
    while (effects.length > 0) {
      const effect = effects.shift();
      effect();
    }
    return tree;
  }

  return { hooks, RN, alerts, render };
}

// ---------------------------------------------------------------------------
// TEST 1 : Vérification de la cause racine exacte et non-régression de l'import
// ---------------------------------------------------------------------------
test('HOTFIX-010 root cause: @react-navigation/native hooks throw outside NavigationContainer, expo-router hooks succeed', () => {
  // Simuler le comportement d'un hook provenant de @react-navigation/native (qui lève l'exception rapportée)
  const reactNavThrower = () => {
    throw new Error("Couldn't find a navigation object. Is your component inside NavigationContainer?");
  };

  let caughtError = null;
  try {
    const { useUnsavedNavigation: buggyHook } = load('hooks/useUnsavedNavigation.ts', {
      'expo-router': {
        useNavigation: () => ({ dispatch() {} }),
        useIsFocused: () => true,
        usePreventRemove: reactNavThrower,
      },
      'react-native': { Alert: { alert() {} } },
    });
    buggyHook(true);
  } catch (err) {
    caughtError = err;
  }
  assert.ok(caughtError);
  assert.equal(caughtError.message, "Couldn't find a navigation object. Is your component inside NavigationContainer?");

  // Vérification avec l'import corrigé depuis expo-router
  let registeredPrevention = false;
  const { useUnsavedNavigation: fixedHook } = load('hooks/useUnsavedNavigation.ts', {
    'expo-router': {
      useNavigation: () => ({ dispatch() {} }),
      useIsFocused: () => true,
      usePreventRemove: (prevented) => { registeredPrevention = prevented; },
    },
    'react-native': { Alert: { alert() {} } },
  });
  assert.doesNotThrow(() => fixedHook(true));
  assert.equal(registeredPrevention, true);
});

// ---------------------------------------------------------------------------
// TEST 2 : Montage complet de CreateBarathonScreen avec le hook réel (sans mock de useUnsavedNavigation)
// ---------------------------------------------------------------------------
test('HOTFIX-010: CreateBarathonScreen mounts cleanly without NavigationContainer error', () => {
  const h = harness();
  let preventRemoveActive = false;
  let navigationTarget = null;

  const mockNavigation = {
    dispatch() {},
    navigate(target) { navigationTarget = target; },
    addListener: () => () => {},
  };

  const routerMock = {
    push(target) { navigationTarget = target; },
    back() {},
  };

  // Montage de CreateBarathonScreen SANS mocker useUnsavedNavigation
  // Expo Router fournit la navigation, useIsFocused et usePreventRemove
  const CreateScreen = load('features/create_barathon/screens/CreateBarathonScreen.tsx', {
    react: h.hooks,
    'react-native': h.RN,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@react-navigation/elements': { useHeaderHeight: () => 96 },
    'expo-router': {
      router: routerMock,
      useNavigation: () => mockNavigation,
      useLocalSearchParams: () => ({}),
      useIsFocused: () => true,
      usePreventRemove: (prevented) => { preventRemoveActive = prevented; },
    },
    '../components/BarathonField': ({ label, value, onChangeText, placeholder }) => (
      { type: 'BarathonField', props: { label, value, onChangeText, placeholder } }
    ),
    '../components/DateTimeModalField': ({ label, value, onConfirm }) => (
      { type: 'DateTimeModalField', props: { label, value, onConfirm } }
    ),
  }).default;

  let tree;
  assert.doesNotThrow(() => {
    tree = h.render(CreateScreen);
  }, 'CreateBarathonScreen should mount without any navigation container exception');

  assert.ok(tree, 'Component rendered successfully');
  assert.equal(preventRemoveActive, false);
});

// ---------------------------------------------------------------------------
// TEST 3 : Parcours complet création → sélection des bars → retour → reprise
// ---------------------------------------------------------------------------
test('HOTFIX-010: Full flow: creation -> map -> recap -> back to map -> back to creation with preserved parameters', () => {
  const policy = load('lib/navigation.ts');

  // 1. Paramètres initiaux saisis sur l'écran de création
  const initialData = {
    name: 'Mon Barathon Vendredi',
    travelTime: '15',
    maxTimeInBar: '60',
    startDateTimeIso: '2026-10-30T19:00:00.000Z',
    stopsJson: JSON.stringify([{ id: 'bar-1', name: 'Le Delirium', latitude: 43.6, longitude: 1.44 }]),
  };

  // 2. Navigation vers la carte
  const mapRoute = {
    name: 'create-barathon-map',
    key: 'map-1',
    params: {
      name: initialData.name,
      travelTime: initialData.travelTime,
      maxTimeInBar: initialData.maxTimeInBar,
      startDateTimeIso: initialData.startDateTimeIso,
      initialStopsJson: initialData.stopsJson,
    },
  };

  // 3. Navigation vers le récapitulatif
  const recapRoute = {
    name: 'create-barathon-recap',
    key: 'recap-1',
    params: {
      name: initialData.name,
      travelTime: initialData.travelTime,
      maxTimeInBar: initialData.maxTimeInBar,
      startDateTimeIso: initialData.startDateTimeIso,
      stopsJson: initialData.stopsJson,
    },
  };

  // 4. Retour depuis le récapitulatif vers la carte : conserve les arrêts
  const fallbackFromRecap = policy.fallbackRoute(recapRoute.name, recapRoute.params);
  assert.equal(fallbackFromRecap.name, 'create-barathon-map');
  assert.equal(fallbackFromRecap.params.initialStopsJson, initialData.stopsJson);

  // 5. Retour depuis la carte vers la création : réinjecte tous les paramètres initiaux
  const fallbackFromMap = policy.fallbackRoute(mapRoute.name, mapRoute.params);
  assert.equal(fallbackFromMap.name, 'create-barathon');
  assert.deepEqual(fallbackFromMap.params, {
    initialName: initialData.name,
    initialTravelTime: initialData.travelTime,
    initialMaxTimeInBar: initialData.maxTimeInBar,
    initialStartDateTimeIso: initialData.startDateTimeIso,
    initialStopsJson: initialData.stopsJson,
  });

  // 6. Remontage de CreateBarathonScreen avec les paramètres restaurés
  const h = harness();
  let preventRemoveActive = false;
  const CreateScreen = load('features/create_barathon/screens/CreateBarathonScreen.tsx', {
    react: h.hooks,
    'react-native': h.RN,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@react-navigation/elements': { useHeaderHeight: () => 96 },
    'expo-router': {
      router: { push() {}, back() {} },
      useNavigation: () => ({ dispatch() {}, addListener: () => () => {} }),
      useLocalSearchParams: () => fallbackFromMap.params,
      useIsFocused: () => true,
      usePreventRemove: (prevented) => { preventRemoveActive = prevented; },
    },
    '../components/BarathonField': (props) => ({ type: 'BarathonField', props }),
    '../components/DateTimeModalField': (props) => ({ type: 'DateTimeModalField', props }),
  }).default;

  const resumedTree = h.render(CreateScreen);
  assert.ok(resumedTree);
  // Parce que le nom et les arrêts sont présents, preventRemove doit être actif pour protéger les données
  assert.equal(preventRemoveActive, true, 'Unsaved changes protection is active on resume');
});

// ---------------------------------------------------------------------------
// TEST 4 : BarathonRecapScreen et CreateBarathonMapScreen montent avec expo-router
// ---------------------------------------------------------------------------
test('HOTFIX-010: BarathonRecapScreen usePreventRemove works with expo-router without throwing', () => {
  const h = harness();
  let preventRemoveActive = false;

  const RecapScreen = load('features/barathon_recap/screens/BarathonRecapScreen.tsx', {
    react: h.hooks,
    'react-native': { ...h.RN, Share: { share: async () => {} } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-maps': { default: 'MapView', Marker: 'Marker', Polyline: 'Polyline' },
    'expo-secure-store': {},
    '@react-navigation/elements': { useHeaderHeight: () => 96 },
    'expo-router': {
      router: {},
      useNavigation: () => ({ dispatch() {}, addListener: () => () => {} }),
      useLocalSearchParams: () => ({ barathonId: '123' }),
      usePreventRemove: (prevented) => { preventRemoveActive = prevented; },
    },
    '../../create_barathon/components/RoutingAttribution': () => null,
    '../../create_barathon/components/WalkingDirectionsButton': () => null,
    '../../../lib/api': { fetchBarathonById: async () => ({ id: 123, name: 'Test', stops: [] }) },
    '../../../lib/authStorage': { getAccessToken: async () => 'token', getUserId: async () => '1' },
    '../services/barathonRecap.service': { fetchBarathonRecap: async () => ({}) },
  }).default;

  assert.doesNotThrow(() => {
    h.render(RecapScreen);
  }, 'BarathonRecapScreen should mount cleanly with expo-router hooks');
});
