const { test } = require('node:test');
const assert = require('node:assert/strict');
const { React, createRoot, document, createHarness, deferred, flush, button, item, snapshot } = require('./helpers/photoMysteryHarness.cjs');
const tagged = (barathonId, state) => ({ barathonId, state });
const event = (id = 'A', version = 3, action = 'answered') => ({
  type: 'PHOTO_MYSTERY_UPDATE', barathon_id: 10, challenge_id: id, version, action,
});

for (const [label, b] of [['empty', snapshot()], ['with challenge', snapshot([item('B')])]]) {
  test(`mounted: late POST A cannot invalidate GET B (${label})`, async t => {
    const h = createHarness(), a = snapshot([item()]), post = deferred(), getB = deferred();
    h.api.fetch = async () => a; h.api.post = () => post.promise;
    const modal = await h.mount({ initialState: a, initialSnapshot: tagged(10, a) });
    t.after(() => modal.unmount());
    let answer;
    await flush(() => { answer = button(modal.container, 'ANSWER-A')(); });
    h.api.fetch = id => id === 20 ? getB.promise : Promise.resolve(a);
    // Parent still holds A while the navigation and B request are in progress.
    await modal.update({ barathonId: 20 });
    await flush(() => post.resolve(item('A', 3, 'closed'))); await answer;
    await flush(() => getB.resolve(b));
    assert.doesNotMatch(modal.container.textContent, /QUESTION-A/);
    assert.match(modal.container.textContent, label === 'empty' ? /Aucun défi en cours/ : /QUESTION-B/);
    assert.deepEqual(h.api.getCalls, [10, 20], 'no obsolete A reload may start');
  });
}

test('mounted: late GET A and untagged parent data cannot contaminate B', async t => {
  const h = createHarness(), a = snapshot([item()]), late = deferred();
  h.api.fetch = id => id === 10 ? late.promise : Promise.resolve(snapshot());
  const modal = await h.mount({ initialState: a, initialSnapshot: tagged(10, a) });
  t.after(() => modal.unmount());
  await modal.update({ barathonId: 20 });
  await flush(() => late.resolve(a));
  await modal.update({ initialState: { ...a }, initialSnapshot: tagged(10, { ...a }) });
  assert.doesNotMatch(modal.container.textContent, /QUESTION-A/);
  assert.match(modal.container.textContent, /Aucun défi en cours/);
});

test('mounted: delayed POST PUBLISHED v2 never replaces CLOSED v3, even if reload fails', async t => {
  const h = createHarness(), post = deferred(); let server = snapshot([item()]);
  h.api.fetch = async () => server; h.api.post = () => post.promise;
  const modal = await h.mount({ initialState: server, initialSnapshot: tagged(10, server) });
  t.after(() => modal.unmount()); let answer;
  await flush(() => { answer = button(modal.container, 'ANSWER-A')(); });
  server = snapshot([item('A', 3, 'closed')]);
  await flush(() => h.events.emitPhotoMysteryEvent(event('A', 3, 'closed')));
  assert.match(modal.container.textContent, /Résultats du défi/);
  h.api.fetch = async () => { throw Error('synthetic offline'); };
  await flush(() => post.resolve(item('A', 2, 'published', { can_answer: false })));
  await answer;
  assert.match(modal.container.textContent, /Résultats du défi/);
  assert.doesNotMatch(modal.container.textContent, /Défi en cours/);
});

test('mounted: authoritative can_create=false survives equal versions and partial audience', async t => {
  const h = createHarness(), s = snapshot([item('A', 3, 'closed')], { can_create: false });
  h.api.fetch = async () => s;
  const modal = await h.mount({ initialState: s, initialSnapshot: tagged(10, s) });
  t.after(() => modal.unmount());
  assert.match(modal.container.textContent, /Résultats du défi/);
  assert.doesNotMatch(modal.container.textContent, /Créer un nouveau défi/);
});

test('mounted parent/modal: seen count can decrease; no stale downgrade, notification loop or render update', async t => {
  const errors = [];
  t.mock.method(console, 'error', (...args) => errors.push(args.join(' ')));
  const h = createHarness(); let server = snapshot([item('A', 3, 'closed')], { unseen_results_count: 1 });
  h.api.fetch = async () => server;
  let updateParent, parentState, notifications = 0;
  function Parent() {
    const [value, set] = React.useState(tagged(10, server));
    updateParent = set; parentState = value;
    return React.createElement(h.Modal, { visible: true, barathonId: 10, onClose() {},
      initialState: value.state, initialSnapshot: value,
      onStateUpdated(next) { notifications++; set(next.state ? next : tagged(10, next)); } });
  }
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container); t.after(async () => { await flush(() => root.unmount()); document.body.removeChild(container); });
  await flush(() => root.render(React.createElement(React.StrictMode, null, React.createElement(Parent))));
  server = snapshot([item('A', 3, 'closed')], { server_time: '2026-10-28T09:00:10Z', unseen_results_count: 0 });
  await flush(() => h.events.emitPhotoMysteryEvent(event('A', 4, 'closed')));
  assert.equal(parentState.state.unseen_results_count, 0);
  const calls = h.api.getCalls.length;
  await flush(() => updateParent(tagged(10, snapshot([item('A', 2)], { server_time: '2026-10-28T09:00:01Z' }))));
  assert.match(container.textContent, /Résultats du défi/);
  assert.equal(h.api.getCalls.length, calls);
  assert.equal(notifications, 1);
  assert.equal(errors.length, 0, errors.join('\n'));
});

test('mounted: close/reopen and A-B-A invalidate old operations and remove listeners', async t => {
  const h = createHarness(), post = deferred(); h.api.post = () => post.promise;
  h.api.fetch = async id => snapshot([item(id === 10 ? 'A' : 'B')]);
  const modal = await h.mount(); t.after(() => modal.unmount()); let answer;
  await flush(() => { answer = button(modal.container, 'ANSWER-A')(); });
  for (const id of [20, 10]) { await modal.update({ barathonId: id }); assert.equal(h.appListeners.size, 1); }
  await modal.update({ visible: false }); assert.equal(h.appListeners.size, 0);
  const count = h.api.getCalls.length;
  await flush(() => h.events.emitPhotoMysteryEvent(event('Z', 1, 'published')));
  assert.equal(h.api.getCalls.length, count);
  await modal.update({ visible: true });
  const reopenCalls = h.api.getCalls.length;
  await flush(() => post.resolve(item('A', 3, 'closed'))); await answer;
  assert.equal(h.api.getCalls.length, reopenCalls, 'old A operation must not resume in the new A session');
  assert.match(modal.container.textContent, /Défi en cours/);
  await modal.update({ visible: false });
  await modal.update({ visible: true });
  const before = h.api.getCalls.length;
  await flush(() => h.events.emitPhotoMysteryEvent(event('A', 4)));
  assert.equal(h.api.getCalls.length, before + 1, 'one active listener only');
});

test('WebSocket: distinct votes at 100ms, interleaved transport copies, reconnect and legacy events', async t => {
  const h = createHarness(), seen = [], sockets = [], timers = new Map(); let timerId = 0;
  t.mock.method(Date, 'now', () => now); let now = 1000;
  t.mock.method(global, 'setTimeout', (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; });
  t.mock.method(global, 'clearTimeout', id => timers.delete(id));
  const previous = global.WebSocket;
  class Socket {
    static OPEN = 1;
    constructor() { this.readyState = 1; sockets.push(this); }
    close() { this.readyState = 3; this.onclose?.(); }
    deliver(value) { this.onmessage({ data: JSON.stringify(value) }); }
  }
  global.WebSocket = Socket; t.after(() => { global.WebSocket = previous; });
  const ws = h.load('features/active_barathon/services/webSocket.service.ts');
  const unsubscribe = h.events.subscribePhotoMysteryEvents(e => seen.push(e));
  t.after(() => { ws.disconnectUserSocket(); ws.disconnectBarathonSocket(); unsubscribe(); });
  const config = { apiBaseUrl: 'https://synthetic.invalid', token: 'synthetic', onMessage() {} };
  ws.connectUserSocket(config); ws.connectBarathonSocket({ ...config, barathonId: 10 });
  const [user, room] = sockets;
  user.deliver(event('A', 3)); now += 100; user.deliver(event('A', 4));
  assert.equal(seen.length, 2, 'both distinct votes must be delivered');
  room.deliver(event('A', 3)); room.deliver(event('A', 4));
  assert.equal(seen.length, 2, 'copies must deduplicate even when interleaved');
  user.deliver(event('B', 1)); room.deliver(event('A', 4));
  assert.equal(seen.length, 3);
  user.onclose(); const [id, retry] = timers.entries().next().value;
  timers.delete(id); now += retry.ms; retry.fn();
  sockets.at(-1).deliver(event('A', 5));
  assert.equal(seen.length, 4, 'new mutation survives reconnect');
  // Older staging backends may omit version: never discard an unidentified mutation.
  const legacy = event('A', undefined); delete legacy.version;
  sockets.at(-1).deliver(legacy); sockets.at(-1).deliver(legacy);
  assert.equal(seen.length, 6);
  ws.disconnectUserSocket(); ws.disconnectBarathonSocket(); assert.equal(timers.size, 0);
  unsubscribe(); h.events.emitPhotoMysteryEvent(event('A', 6)); assert.equal(seen.length, 6);
});

test('mounted: real socket transports refresh for each mutation, not for interleaved copies', async t => {
  const h = createHarness(), sockets = []; let server = snapshot([item()]);
  h.api.fetch = async () => server;
  const modal = await h.mount(); t.after(() => modal.unmount());
  const previous = global.WebSocket;
  class Socket {
    constructor() { sockets.push(this); }
    close() { this.onclose?.(); }
    deliver(value) { this.onmessage({ data: JSON.stringify(value) }); }
  }
  global.WebSocket = Socket; t.after(() => { global.WebSocket = previous; });
  const ws = h.load('features/active_barathon/services/webSocket.service.ts');
  t.after(() => { ws.disconnectUserSocket(); ws.disconnectBarathonSocket(); });
  const config = { apiBaseUrl: 'https://synthetic.invalid', token: 'synthetic', onMessage() {} };
  ws.connectUserSocket(config); ws.connectBarathonSocket({ ...config, barathonId: 10 });
  const [user, room] = sockets, before = h.api.getCalls.length;
  server = snapshot([item('A', 3, 'published', { question: 'First vote' })]);
  await flush(() => user.deliver(event('A', 3)));
  assert.match(modal.container.textContent, /First vote/);
  server = snapshot([item('A', 4, 'published', { question: 'Second vote' })]);
  await flush(() => user.deliver(event('A', 4)));
  await flush(() => { room.deliver(event('A', 3)); room.deliver(event('A', 4)); });
  assert.match(modal.container.textContent, /Second vote/);
  assert.equal(h.api.getCalls.length, before + 2);
});

for (const operation of ['publish', 'cancel']) {
  test(`mounted: old ${operation} continuation cannot reload A or alter B`, async t => {
    const h = createHarness(), pending = deferred(), bGet = deferred();
    h.api.fetch = async () => snapshot([item('A', 1, 'draft')]);
    h.api[operation] = () => pending.promise;
    const modal = await h.mount(); t.after(() => modal.unmount()); let action;
    const label = operation === 'publish' ? 'Publier le défi' : 'Abandonner ce brouillon';
    await flush(() => { action = button(modal.container, label)(); });
    h.api.fetch = id => id === 20 ? bGet.promise : Promise.reject(Error('obsolete A request'));
    await modal.update({ barathonId: 20 });
    await flush(() => pending.resolve(item('A', 2))); await action;
    await flush(() => bGet.resolve(snapshot([item('B')])));
    assert.match(modal.container.textContent, /QUESTION-B/);
    assert.deepEqual(h.api.getCalls, [10, 20]);
    assert.equal(h.alerts.length, 0);
  });
}

test('mounted: stale empty snapshot cannot erase results, current deletion can', async t => {
  const h = createHarness(), oldGet = deferred(); h.api.fetch = () => oldGet.promise;
  const closed = snapshot([item('A', 3, 'closed')], { server_time: '2026-10-28T09:00:10Z' });
  const modal = await h.mount({ initialSnapshot: tagged(10, closed) });
  t.after(() => modal.unmount());
  await flush(() => oldGet.resolve(snapshot([], { server_time: '2026-10-28T09:00:01Z' })));
  assert.match(modal.container.textContent, /Résultats du défi/);
  await modal.update({ initialSnapshot: tagged(10, snapshot([], { server_time: '2026-10-28T09:00:20Z' })) });
  assert.match(modal.container.textContent, /Aucun défi en cours/);
  assert.doesNotMatch(modal.container.textContent, /QUESTION-A/);
});

test('mounted parent/modal: pending_count follows full server snapshots, not POST item guesses', async t => {
  const h = createHarness(), reload = deferred(); let server = snapshot([item()]);
  h.api.fetch = async () => server;
  h.api.post = async () => item('A', 3, 'published', { can_answer: false,
    my_submission: { choice_index: 0, passed: false, submitted_at: '2026-10-28T09:00:06Z' } });
  let parentState;
  function Parent() {
    const [value, set] = React.useState(tagged(10, server)); parentState = value;
    return React.createElement(h.Modal, { visible: true, barathonId: 10,
      initialSnapshot: value, onClose() {}, onStateUpdated: set });
  }
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container); t.after(async () => { await flush(() => root.unmount()); document.body.removeChild(container); });
  await flush(() => root.render(React.createElement(Parent)));
  h.api.fetch = () => reload.promise; let answer;
  await flush(() => { answer = button(container, 'ANSWER-A')(); });
  assert.equal(parentState.state.pending_count, 1, 'POST has no authoritative room counters');
  assert.match(container.textContent, /Ta réponse est enregistrée/);
  server = snapshot([item('A', 3, 'published', { can_answer: false })], {
    server_time: '2026-10-28T09:00:10Z', pending_count: 0, can_create: false });
  await flush(() => reload.resolve(server)); await answer;
  assert.equal(parentState.state.pending_count, 0);
  assert.equal(parentState.state.can_create, false);
});
