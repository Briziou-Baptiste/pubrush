const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { StackRouter, CommonActions, StackActions } = require('@react-navigation/routers');
const src = process.env.BUGFIX018_SOURCE || path.resolve(__dirname, '../src');

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
  let cursor = 0, refCursor = 0; const refs = [];
  const hooks = { ...React, useState: init => {
    const index = cursor++;
    if (!(index in values)) values[index] = Object.hasOwn(overrides, index) ? overrides[index] : typeof init === 'function' ? init() : init;
    return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value; }];
  }, useEffect: fn => effects.push(fn), useMemo: fn => fn(), useCallback: fn => fn,
  useRef: value => { const i = refCursor++; return refs[i] ||= { current: value }; } };
  return { effects, values, alerts, hooks, render: fn => { cursor = refCursor = 0; effects.length = 0; return fn(); },
    RN: { View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', Pressable: 'Pressable',
      Modal: 'Modal', ScrollView: 'ScrollView', TextInput: 'TextInput', ActivityIndicator: 'Spinner', FlatList: 'FlatList', useWindowDimensions: () => ({ width: 390, height: 844 }),
      KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: initial || 'ios' },
      StyleSheet: { create: x => x }, Alert: { alert: (...args) => alerts.push(args) } } };
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
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
const item = { id: 42, name: 'Fixture vendredi', status: 'planned', join_code: 'RUSH-TEST', created_by_user_id: 1, start_datetime: '2026-10-30T19:00:00Z', participants_count: 1, participants: [{ user: { id: 1 } }], stops: [] };
function base(h) { return { react: h.hooks, 'react-native': h.RN, '@expo/vector-icons': { Ionicons: 'Icon' }, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top:44,bottom:34,left:0,right:0 }) } }; }
for (const status of ['planned','started','completed','stopped','failed','deleted']) test(`QR ${status}: revalidates server state and uses a single native modal`, async () => {
  const h = harness('ios', { 6: item, 7: [{ user: { id:1 } }, { user: { id:3 } }], 8: [1] });
  const content = () => null;
  const Screen = load('features/planned/components/ManageParticipantsModal.tsx', { ...base(h),
    '../services/planned.service': { getBarathonDetails: async id => { assert.equal(id,42); if (status === 'deleted') throw new Error('Barathon introuvable'); return { ...item, status, join_code: 'RUSH-FRESH' }; } },
    '../../active_barathon/components/InviteFriendsModal': { InviteFriendsContent: content },
  }).default;
  const render = () => h.render(() => Screen({ visible:true,barathon:item,currentUserId:1,onClose() {},onUpdated() {} }));
  await button(render(), 'Inviter des amis via QR Code').props.onPress();
  let tree = render();
  assert.equal(nodes(tree,n => n.type === 'Modal').length,1);
  const qr = find(tree,n => n.type === content);
  if (['planned','started'].includes(status)) {
    assert.ok(qr,'QR content must be rendered inside the existing native modal');
    assert.equal(qr.props.joinCode,'RUSH-FRESH'); assert.equal(qr.props.barathonName,item.name);
    qr.props.onClose(); tree = render(); assert.ok(button(tree,"Valider l'ajout"));
    assert.deepEqual(h.values[7].map(p => p.user.id),[1,3]);
  } else { assert.equal(qr,null); assert.equal(h.alerts.at(-1)[0],'Invitation indisponible'); }
});
test('shared QR encodes and shares the actual URL; image failure ends loading; missing code cannot invite', async () => {
  const h = harness(), shared=[]; h.RN.Share = { share: async value => shared.push(value) };
  const { InviteFriendsContent, default: Modal } = load('features/active_barathon/components/InviteFriendsModal.tsx', { ...base(h), 'expo-image': { Image:'Image' } });
  const props={ joinCode:'RUSH-TEST',barathonName:item.name,onClose() {} };
  let tree = h.render(() => InviteFriendsContent(props));
  const img = find(tree,n => n.type === 'Image');
  const url = new URL(img.props.source.uri);
  assert.equal(url.searchParams.get('data'),'https://pubrush.com/join/RUSH-TEST');
  await button(tree,'Partager le lien').props.onPress(); assert.equal(shared[0].url,url.searchParams.get('data'));
  img.props.onError(); tree=h.render(() => InviteFriendsContent(props));
  assert.match(textOf(tree),/QR indisponible/); assert.equal(find(tree,n => n.type === 'Spinner'),null);
  tree=h.render(() => InviteFriendsContent({ ...props,joinCode:'' }));
  assert.equal(find(tree,n => n.type === 'Image'),null); assert.equal(button(tree,'Partager le lien').props.disabled,true);
  await button(tree,'Partager le lien').props.onPress(); assert.equal(shared.length,1);
  assert.equal(h.render(() => Modal({ ...props,visible:true })).type,'Modal');
});
function planned(getList,remove) {
  const h=harness('ios',{ 0:[item],1:false,2:1 }); let focus;
  const Screen=load('features/planned/screens/PlannedScreen.tsx',{ ...base(h),
    'expo-router': { router:{},useFocusEffect: fn => { focus=fn; } },
    '../../../lib/authStorage': { getCurrentUserId: async () => 1 },
    '../../barathon_past_planned/components/BarathonCard':'Card', '../components/ManageParticipantsModal':'Participants', '../components/ChangeStartTimeModal':'ChangeTime',
    '../services/planned.service': { getMyUpcomingBarathons:getList,deleteBarathon:remove },
  }).default;
  const render=() => h.render(Screen), list=() => find(render(),n => n.type === 'FlatList');
  const deleteAction=() => { list().props.renderItem({ item }).props.onDelete(item); return h.alerts.at(-1)[2][1].onPress; };
  return { ...h,render,list,deleteAction,focus:() => focus() };
}
test('deletion waits for confirmation, suppresses duplicates and survives stale GET, return and refresh',async () => {
  const get=deferred(),del=deferred(); let calls=0,next=get.promise;
  const p=planned(() => next,async id => { calls++; assert.equal(id,42); return del.promise; });
  const confirm=p.deleteAction(); p.render(); const cleanup=p.focus();
  const op=confirm(),duplicate=confirm(); assert.equal(calls,1);
  assert.equal(p.alerts.some(a => a[0] === 'Suppression réussie'),false); assert.equal(p.values[0].length,1);
  del.resolve(); await Promise.all([op,duplicate]); assert.equal(p.values[0].length,0); assert.equal(p.alerts.at(-1)[0],'Suppression réussie');
  get.resolve([item]); await flush(); assert.equal(p.list().props.data.length,0);
  next=Promise.resolve([]); cleanup(); p.render(); p.focus(); await flush();
  assert.equal(p.list().props.data.length,0); p.list().props.onRefresh(); await flush(); assert.equal(p.list().props.data.length,0);
  await confirm(); assert.equal(calls,1);
});
test('deletion failure retains the row and unlocks retry without displaying success',async () => {
  let attempts=0; const p=planned(async () => [item],async () => { if (++attempts === 1) throw new Error('offline'); });
  await p.deleteAction()(); assert.equal(p.list().props.data.length,1); assert.equal(p.alerts.at(-1)[0],'Suppression impossible'); assert.equal(p.values[3],null);
  await p.deleteAction()(); assert.equal(p.list().props.data.length,0); assert.equal(attempts,2);
});
test('older GET cannot overwrite a newer GET and unfocused responses are ignored',async () => {
  const first=deferred(),second=deferred(),third=deferred(); let count=0;
  const p=planned(() => [first,second,third][count++].promise,async () => {});
  p.render(); p.focus(); p.render(); p.focus(); second.resolve([{ ...item,id:99 }]); await flush();
  first.resolve([item]); await flush(); assert.equal(p.values[0][0].id,99);
  p.render(); const cleanup=p.focus(); cleanup(); third.resolve([item]); await flush(); assert.equal(p.values[0][0].id,99);
});
test('DELETE service accepts 204 and propagates HTTP/network failures',async () => {
  const service=load('features/planned/services/planned.service.ts',{ 'expo-secure-store':{ getItemAsync:async () => 'test-token' }, '../../../lib/apiClient':{} });
  const original=global.fetch;
  try {
    global.fetch=async (url,options) => { assert.match(url,/\/barathons\/42$/); assert.equal(options.method,'DELETE'); return { ok:true,status:204,json() { throw Error('no JSON'); } }; };
    await service.deleteBarathon(42);
    for (const status of [202,403,404,500]) { global.fetch=async () => ({ ok:status<300,status,json:async () => ({ detail:`HTTP ${status}` }) }); await assert.rejects(service.deleteBarathon(42),new RegExp(`HTTP ${status}`)); }
    global.fetch=async () => { throw Error('offline'); }; await assert.rejects(service.deleteBarathon(42),/offline/);
  } finally { global.fetch=original; }
});
const { getBarathonOutcome }=load('features/barathon_past_planned/utils/barathon.status.ts');
for (const [status,done,total,target,label] of [
  ['completed',7,10,true,'Tournée terminée'],['completed',6,10,false,'Tournée terminée'],
  ['stopped',10,10,true,'Tournée interrompue'],['stopped',1,10,false,'Tournée interrompue'],
  ['failed',0,10,false,'Non démarré à temps'],[undefined,0,0,null,'Statut indisponible'],['completed',0,0,null,'Tournée terminée'],
]) test(`outcome ${status} ${done}/${total}: lifecycle is independent of stop target`,() => {
  const outcome=getBarathonOutcome(status,Array.from({ length:total },(_,i) => ({ is_completed:i<done })));
  assert.equal(outcome.label,label); assert.equal(outcome.targetReached,target); assert.equal(outcome.completedNormally,status==='completed');
});
test('historical missing flags remain unknown and 69.56 percent is not promoted to success',() => {
  assert.equal(getBarathonOutcome('stopped',[{ is_completed:true },{}]).targetReached,null);
  assert.equal(getBarathonOutcome('completed',Array.from({ length:23 },(_,i) => ({ is_completed:i<16 }))).targetReached,false);
});
for (const status of ['completed','stopped','failed',undefined]) test(`list and summary agree for ${status}, even with failed expenses`,async () => {
  const stops=[{ ...item,is_completed:true }],h=harness();
  const Summary=load('features/active_barathon/screens/BarathonStopSummaryScreen.tsx',{ ...base(h),
    'expo-router':{ useNavigation:() => ({ getState:() => null }),useLocalSearchParams:() => ({ barathonId:'42' }) },
    '../../../lib/authStorage':{ getCurrentUser:async () => ({ id:1 }),getAccessToken:async () => 'test-token' },
    '../../../lib/api':{ fetchBarathon:async () => ({ ...item,stops,status }),fetchBarathonExpenses:async () => { throw Error('expense failure'); } },
  }).default;
  h.render(Summary); h.effects[1](); await flush(); const detailText=textOf(h.render(Summary));
  const c=harness(),Card=load('features/barathon_past_planned/components/BarathonCard.tsx',{ ...base(c),'./StartBarathonSlider':'Slider' }).default;
  const cardText=textOf(c.render(() => Card({ item:{ ...item,stops,status },variant:'past',currentUserId:1 })));
  const outcome=getBarathonOutcome(status,stops);
  assert.ok(detailText.includes(outcome.label)); assert.ok(cardText.includes(outcome.label));
  assert.ok(detailText.includes(outcome.progressLabel)); assert.ok(cardText.includes(outcome.progressLabel));
  assert.doesNotMatch(detailText+cardText,/Mission failed|Tournée accomplie/);
});
function active({ failCompletion=false,invitationState='started' }={}) {
  const data={ ...item,status:'started',stops:[{ id:5,name:'Dernier bar',is_completed:false }] };
  const h=harness('ios',{ 2:data,3:false }),calls=[],navigations=[];
  const Screen=load('features/active_barathon/screens/ActiveBarathonScreen.tsx',{ ...base(h),
    'react-native':{ ...h.RN,useWindowDimensions:() => ({ width:390,height:844 }) },
    'expo-router':{ useNavigation:() => ({ getState:() => null }),useLocalSearchParams:() => ({ barathonId:'42' }),router:{ replace:value => navigations.push(value) } },
    '../services/activeBarathon.service':{
      getBarathonById:async () => { if (invitationState==='deleted') throw Error('Barathon introuvable'); return { ...data,status:invitationState,join_code:'RUSH-FRESH' }; },
      completeBarathonStop:async () => { calls.push('complete'); if (failCompletion) throw Error('completion failed'); },
      markBarathonFinished:async () => { calls.push('finish'); return { status:'completed',ended_at:'2026-10-30T23:00:00Z' }; },
      stopBarathon:async () => { calls.push('stop'); return { status:'stopped',ended_at:'2026-10-30T23:00:00Z' }; },
    },
    '../hooks/useActiveBarathonTracking':{ useActiveBarathonTracking:() => ({ state:{ activeStopIndex:0,phase:'en_route' },activeStop:data.stops[0],stopTracking:async () => calls.push('trackingStopped') }) },
    '../components/ActiveBarathonHeader':'Header','../components/ActiveBarathonBottomPanel':'Panel','../components/ActiveBarathonMap':'Map','../components/BarathonRolesModal':'Roles','../components/ReplaceOrAddStopModal':'Modify','../components/InviteFriendsModal':'Invite',
    '../../../lib/api':{},'../../../lib/authStorage':{},'../services/webSocket.service':{},'../services/offlineSync.service':{},
    '../../create_barathon/components/RoutingAttribution':'Attribution','../../create_barathon/services/mapLayout.service':{ getMapControlsLayout:() => ({}) },
  }).default;
  return { ...h,calls,navigations,render:() => h.render(Screen) };
}
test('last-stop Finish validates the stop then calls /finish once and navigates on confirmation',async () => {
  const a=active(); find(a.render(),n => n.type==='Panel').props.onNextStep();
  const tree=a.render(),confirm=(button(tree,'Terminer') || button(tree,'Arrêter')).props.onPress; await Promise.all([confirm(),confirm()]);
  assert.deepEqual(a.calls,['complete','finish','trackingStopped']); assert.equal(a.navigations.length,1); assert.equal(a.navigations[0].pathname,'/barathon-stop-summary');
});
test('explicit Stop at last stop calls /stop without fabricating completion',async () => {
  const a=active(); find(a.render(),n => n.type==='Header').props.onStopPress(); await button(a.render(),'Arrêter').props.onPress();
  assert.deepEqual(a.calls,['stop','trackingStopped']);
});
test('failed final-stop validation prevents finish and summary navigation',async () => {
  const a=active({ failCompletion:true }); find(a.render(),n => n.type==='Panel').props.onNextStep(); await button(a.render(),'Terminer').props.onPress();
  assert.deepEqual(a.calls,['complete']); assert.equal(a.navigations.length,0); assert.equal(a.alerts.at(-1)[0],'Erreur');
});

for (const state of ['started','completed','stopped','failed','deleted']) test(`active invitation ${state} revalidates lifecycle and code`,async () => {
  const a=active({ invitationState:state }); await find(a.render(),n => n.type==='Header').props.onInvitePress();
  const invite=find(a.render(),n => n.type==='Invite');
  assert.equal(invite.props.visible,state==='started');
  if (state==='started') assert.equal(invite.props.joinCode,'RUSH-FRESH');
  else assert.equal(a.alerts.at(-1)[0],'Invitation indisponible');
});

test('deletion confirmed cannot be resurrected by a GET started before DELETE',async () => {
  const get=deferred(),p=planned(() => get.promise,async () => {});
  const confirm=p.deleteAction(); p.render(); p.focus();
  await confirm(); assert.equal(p.values[0].length,0);
  get.resolve([item]); await flush(); assert.equal(p.values[0].length,0);
});
test('unavailable detail shows incomplete historical data without inventing success or failure',async () => {
  const h=harness();
  const Summary=load('features/active_barathon/screens/BarathonStopSummaryScreen.tsx',{ ...base(h),
    'expo-router':{ useNavigation:() => ({ getState:() => null }),useLocalSearchParams:() => ({ barathonId:'42',stopsJson:'[{"id":5,"name":"Archive"}]' }) },
    '../../../lib/authStorage':{ getCurrentUser:async () => ({ id:1 }),getAccessToken:async () => 'test-token' },
    '../../../lib/api':{ fetchBarathon:async () => { throw Error('unavailable'); },fetchBarathonExpenses:async () => ({ expenses:[],balances:[] }) },
  }).default;
  h.render(Summary); h.effects[1](); await flush();
  const content=textOf(h.render(Summary));
  assert.match(content,/Statut indisponible/); assert.match(content,/Résultat des étapes indisponible/);
  assert.match(content,/Actualisation impossible/); assert.match(content,/Inconnu/);
});
test('mobile closure services preserve the API endpoint and HTTP method contract',async () => {
  const requests=[];
  const svc=load('features/active_barathon/services/activeBarathon.service.ts',{
    '../../../lib/apiClient':{ authenticatedJsonRequest:async (url,options) => { requests.push([url,options.method]); return {}; } },
  });
  await svc.markBarathonFinished(42); await svc.stopBarathon(42); await svc.getBarathonById(42);
  assert.deepEqual(requests,[['/barathons/42/finish','POST'],['/barathons/42/stop','POST'],['/barathons/42/active-view','GET']]);
});
