const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('../../mobile/node_modules/typescript');
const { React, createRoot, document, flush, nodes } = require('../../mobile/tests/helpers/photoMysteryHarness.cjs');

global.HTMLElement.prototype.focus = function () {};

test('invitation renders API preview and joins using the real response shape', async t => {
  const store = new Map(), calls = [];
  global.localStorage = { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v) };
  global.WebSocket = class { close() {} };
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/by-code/ABC123')) return { ok: true, json: async () => ({ id: 30, name: 'Fête', creator_username: 'Bat', status: 'started', stops_count: 1, participants_count: 2 }) };
    if (url.endsWith('/join-guest')) return { ok: true, json: async () => ({ access_token: 'test', user: { id: 19, username: 'Alice' }, barathon: { id: 30, name: 'Fête', stops: [{ id: 2, name: 'Bar test', is_completed: false }] } }) };
    if (url.endsWith('/barathons/30')) return { ok: true, json: async () => ({ stops: [{ id: 2, name: 'Bar test', is_completed: false }] }) };
    throw Error(`unexpected URL ${url}`);
  };
  const file = path.resolve(__dirname, '../src/app/join/[code]/page.tsx');
  const mod = new Module(file, module); mod.paths = module.paths;
  mod.require = name => {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return require('../../mobile/node_modules/react/jsx-runtime');
    if (name === 'next/navigation') return { useParams: () => ({ code: 'ABC123' }) };
    if (name === 'next/link') return { __esModule: true, default: ({ children }) => children };
    if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
    return require(name);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container);
  t.after(async () => { await flush(() => root.unmount()); document.body.removeChild(container); });
  await flush(() => root.render(React.createElement(mod.exports.default)));
  assert.match(container.textContent, /Fête/); assert.match(container.textContent, /Bat/);
  const input = nodes(container, n => n.nodeName === 'INPUT')[0];
  const form = nodes(container, n => n.nodeName === 'FORM')[0];
  const props = n => n[Object.keys(n).find(k => k.startsWith('__reactProps$'))];
  await flush(() => props(input).onChange({ target: { value: 'Alice' } }));
  await flush(() => props(form).onSubmit({ preventDefault() {} }));
  assert.deepEqual(JSON.parse(calls.find(c => c.url.endsWith('/join-guest')).options.body), { join_code: 'ABC123', username: 'Alice' });
  assert.equal(JSON.parse(store.get('pubrush_guest_ABC123')).user_id, 19);
  assert.match(container.textContent, /Bar test/);
});
