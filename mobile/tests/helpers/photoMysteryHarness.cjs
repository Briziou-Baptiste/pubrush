// Real React/ReactDOM renderer; only the native host views and external IO are mocked.
// A small in-memory DOM keeps these tests local without adding a native/test dependency.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

class HostNode {
  constructor(type, name, document) {
    Object.assign(this, { nodeType: type, nodeName: name, tagName: name,
      ownerDocument: document, parentNode: null, childNodes: [], attributes: {},
      namespaceURI: 'http://www.w3.org/1999/xhtml',
      style: { setProperty() {}, removeProperty() {} } });
  }
  appendChild(node) {
    node.parentNode?.removeChild(node);
    this.childNodes.push(node); node.parentNode = this; return node;
  }
  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) this.childNodes.splice(index, 1);
    node.parentNode = null; return node;
  }
  insertBefore(node, reference) {
    node.parentNode?.removeChild(node);
    const index = this.childNodes.indexOf(reference);
    if (index < 0) return this.appendChild(node);
    this.childNodes.splice(index, 0, node); node.parentNode = this; return node;
  }
  get firstChild() { return this.childNodes[0] || null; }
  get nextSibling() {
    return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this) + 1] || null;
  }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  removeAttribute(key) { delete this.attributes[key]; }
  getAttribute(key) { return this.attributes[key] ?? null; }
  addEventListener() {}
  removeEventListener() {}
  contains(node) { return node === this || this.childNodes.some(child => child.contains(node)); }
  get textContent() {
    return this.nodeType === 3 ? this.nodeValue : this.childNodes.map(child => child.textContent).join('');
  }
  set textContent(text) {
    if (this.nodeType === 3) { this.nodeValue = String(text); return; }
    this.childNodes.forEach(child => { child.parentNode = null; });
    this.childNodes = [];
    if (text) this.appendChild(this.ownerDocument.createTextNode(String(text)));
  }
  getRootNode() { let node = this; while (node.parentNode) node = node.parentNode; return node; }
}

const document = new HostNode(9, '#document', null);
document.ownerDocument = document;
document.createElement = name => new HostNode(1, name.toUpperCase(), document);
document.createElementNS = (_, name) => document.createElement(name);
document.createTextNode = text => Object.assign(new HostNode(3, '#text', document), { nodeValue: text });
document.documentElement = document.createElement('html');
document.body = document.createElement('body');
document.documentElement.appendChild(document.body);
document.appendChild(document.documentElement);
document.activeElement = document.body;
const window = { document, Node: HostNode, HTMLElement: HostNode, HTMLIFrameElement: class {},
  addEventListener() {}, removeEventListener() {}, getSelection() { return null; }, location: { protocol: 'http:' } };
document.defaultView = window;
Object.assign(global, { window, document, HTMLElement: HostNode, Node: HostNode, IS_REACT_ACT_ENVIRONMENT: true });
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = React;
const src = path.resolve(__dirname, '../../src');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function flush(fn) {
  await act(async () => { fn?.(); for (let i = 0; i < 6; i++) await Promise.resolve(); });
}
function nodes(node, predicate) {
  return [...(predicate(node) ? [node] : []), ...node.childNodes.flatMap(child => nodes(child, predicate))];
}
function props(node) { return node[Object.keys(node).find(key => key.startsWith('__reactProps$'))]; }
function button(container, text) {
  const node = nodes(container, node => node.nodeName === 'BUTTON' && node.textContent === text)[0];
  if (!node) throw new Error(`Button not rendered: ${text}\n${container.textContent}`);
  return props(node).onClick;
}

function createHarness() {
  const cache = new Map(), appListeners = new Set(), alerts = [];
  const api = { getCalls: [], postCalls: [], fetch: async () => snapshot(),
    post: async () => item('A', 2), headers: async () => ({}) };
  const native = { StyleSheet: { create: value => value }, Platform: { OS: 'ios' },
    Alert: { alert: (...args) => alerts.push(args) },
    AppState: { addEventListener(_, listener) {
      appListeners.add(listener); return { remove() { appListeners.delete(listener); } };
    } } };
  for (const name of ['ActivityIndicator', 'KeyboardAvoidingView', 'Modal', 'SafeAreaView',
    'ScrollView', 'Text', 'TextInput', 'TouchableOpacity', 'View']) {
    native[name] = function Host({ children, onPress, disabled }) {
      return React.createElement(name === 'TouchableOpacity' ? 'button' : 'div',
        { 'data-rn': name, disabled, onClick: onPress }, children);
    };
  }
  const service = {
    fetchPhotoMysteryState(id) { api.getCalls.push(id); return api.fetch(id); },
    submitPhotoAnswer(...args) { api.postCalls.push(args); return api.post(...args); },
    getAuthHeadersForPhoto: () => api.headers(), getPhotoMediaUrl: (id, challenge) => `/synthetic/${id}/${challenge}`,
    createPhotoChallengeDraft: (...args) => api.create(...args),
    cancelPhotoChallenge: (...args) => api.cancel(...args),
    publishPhotoChallenge: (...args) => api.publish(...args),
  };
  const mocks = { 'react-native': native,
    'expo-image': { Image: p => React.createElement('div', { 'data-rn': 'Image', 'data-uri': p.source?.uri }) },
    '@expo/vector-icons': { Ionicons: () => null },
    'expo-web-browser': { openBrowserAsync: async () => {} },
    'expo-clipboard': { setStringAsync: async () => true } };
  function load(relativePath) {
    const file = path.resolve(src, relativePath);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = new Module(file, module); mod.paths = module.paths; cache.set(file, mod);
    mod.require = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.endsWith('/navigation.styles')) return { navigationControlStyles: { close: {} } };
      if (name.endsWith('/photoMysteryService')) return service;
      if (name.startsWith('.')) {
        const base = path.resolve(path.dirname(file), name);
        for (const ext of ['.ts', '.tsx', '']) {
          if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return load(base + ext);
        }
      }
      return require(name);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText, file);
    return mod.exports;
  }
  const Modal = load('features/active_barathon/components/PhotoMysteryModal.tsx').default;
  const events = load('features/active_barathon/services/photoMysteryEvents.ts');
  async function mount(overrides = {}) {
    const container = document.createElement('div'); document.body.appendChild(container);
    const root = createRoot(container);
    let current = { visible: true, barathonId: 10, onClose() {}, ...overrides };
    await flush(() => root.render(React.createElement(Modal, current)));
    return { container, get props() { return current; },
      async update(overrides) {
        current = { ...current, ...overrides };
        await flush(() => root.render(React.createElement(Modal, current)));
      },
      async unmount() { await flush(() => root.unmount()); document.body.removeChild(container); },
    };
  }
  return { api, appListeners, alerts, Modal, events, load, mount };
}

function item(id = 'A', version = 2, state = 'published', overrides = {}) {
  return { id, version, state, question: `QUESTION-${id}`, options: ['ANSWER-A', 'ANSWER-B'],
    correct_index: state === 'closed' ? 0 : null, expires_at: '2026-10-28T09:03:00Z',
    my_submission: null, can_answer: state === 'published', photo_available: true,
    results: state === 'closed' ? { closed_at: '2026-10-28T09:00:03Z', reason: 'all_handled',
      expected_count: 3, correct_count: 2, incorrect_count: 1, passed_count: 0,
      creator_dare: false, my_dare_assigned: false } : null, ...overrides };
}
function snapshot(items = [], overrides = {}) {
  return { server_time: '2026-10-28T09:00:05Z', enabled: true,
    can_create: !items.some(i => i.state === 'published' || i.state === 'draft'),
    pending_count: items.filter(i => i.can_answer).length, unseen_results_count: 0, items, ...overrides };
}
module.exports = { React, createRoot, document, createHarness, deferred, flush, nodes, button, item, snapshot };
