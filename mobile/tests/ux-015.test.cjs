const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), Module=require('node:module'), ts=require('typescript'), React=require('react');
const {BaseRouter}=require('expo-router/build/react-navigation/routers/BaseRouter');
const src=path.resolve(__dirname,'../src');
function load(relative,mocks={}) { const file=path.resolve(src,relative), mod=new Module(file,module); mod.paths=module.paths; mod.require=n=>{if(Object.hasOwn(mocks,n))return mocks[n]; if(n.startsWith('.')) {let f=path.resolve(path.dirname(file),n); let ext=['.ts','.tsx'].find(x=>fs.existsSync(f+x)); if(ext)return load(path.relative(src,f+ext),mocks);} return require(n);}; mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file); return mod.exports; }
function find(n,p) {if(!n||typeof n!=='object')return []; return [...(p(n)?[n]:[]),...React.Children.toArray(n.props?.children).flatMap(c=>find(c,p))];}
class Unknown extends Error {}
function screen(create) {
 const slots=[],effects=[],alerts=[],resets=[], pushes=[]; let cursor=0,dirty=true,tree;
 const diff=(a,b)=>!a||!b||a.length!==b.length||a.some((x,i)=>!Object.is(x,b[i]));
 const hooks={...React,useState(init){const i=cursor++; if(!slots[i])slots[i]={v:typeof init==='function'?init():init}; return [slots[i].v,v=>{v=typeof v==='function'?v(slots[i].v):v;if(!Object.is(v,slots[i].v)){slots[i].v=v;dirty=true;}}];},useRef(v){const i=cursor++;return slots[i]||=( {current:v});},useMemo(fn,d){const i=cursor++;if(!slots[i]||diff(slots[i].d,d))slots[i]={d,v:fn()};return slots[i].v;},useEffect(fn,d){const i=cursor++;if(!slots[i]||diff(slots[i].d,d))effects.push(()=>{slots[i]?.cleanup?.();slots[i]={d,cleanup:fn()};});}}; hooks.useCallback=(fn,d)=>hooks.useMemo(()=>fn,d);
 const state={key:'root',type:'stack',stale:false,index:3,routeKeySeq:4,routeNames:['home','planned','create-barathon','create-barathon-map','create-barathon-recap'],routes:['home','create-barathon','create-barathon-map','create-barathon-recap'].map((name,i)=>({name,key:`r${i}`}))};
 const nav={getState:()=>state,reset:p=>resets.push(p),dispatch(){}};
 const rn={StyleSheet:{create:x=>x},Platform:{OS:'ios'},Alert:{alert:(...v)=>alerts.push(v)},...Object.fromEntries(['View','Text','TextInput','TouchableOpacity','ScrollView','KeyboardAvoidingView','ActivityIndicator'].map(x=>[x,x]))};
 const stops=[{id:'a',name:'Alpha',stopType:'bar',latitude:43,longitude:1},{id:'b',name:'Beta',stopType:'restaurant',latitude:43.1,longitude:1.1}];
 const Component=load('features/barathon_recap/screens/BarathonRecapScreen.tsx',{
 react:hooks,'react-native':rn,'@react-navigation/elements':{useHeaderHeight:()=>44},'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'react-native-maps':{__esModule:true,default:'MapView',Marker:'Marker',Polyline:'Polyline'},'@expo/vector-icons':{Ionicons:'Icon'},
 'expo-router':{router:{push:path=>pushes.push(path)},useNavigation:()=>nav,usePreventRemove:()=>()=>{},useLocalSearchParams:()=>({name:'Vendredi',startDateTimeIso:'2026-10-30T19:00:00Z',maxTimeInBar:'45',travelTime:'12',stopsJson:JSON.stringify(stops)})},
 '../../create_barathon/services/createBarathon.service':{createBarathon:create,CreationOutcomeUnknownError:Unknown},'../services/barathonRecap.service':{searchUsers:async()=>[]},'../../../lib/authStorage':{getCurrentUser:async()=>({id:1,username:'moi'}),getAccessToken:async()=>null},'../../../lib/api':{},'../../create_barathon/components/RoutingAttribution':{__esModule:true,default:'RoutingAttribution'},'../../create_barathon/services/routing.service':{fetchWalkingRoutesInParallel:async()=>({}),getRouteSegmentKey:()=>''}}).default;
 function render(){for(let n=0;dirty&&n<30;n++){dirty=false;cursor=0;tree=Component();while(effects.length)effects.shift()();}}
 async function settle(){for(let i=0;i<8;i++){await Promise.resolve();render();}}
 const button=label=>find(tree,x=>x.type==='TouchableOpacity'&&find(x,y=>y.type==='Text'&&y.props.children===label).length)[0];
 return {render,settle,button,alerts,resets,pushes,state,tree:()=>tree,close:()=>slots.forEach(x=>x?.cleanup?.())};
}
test('SDK 58 rejects old partial RESET',()=>{const h=screen(async()=>{}),warn=console.warn;console.warn=()=>{};try{const result=BaseRouter().getStateForAction(h.state,{type:'RESET',payload:{index:1,routes:[{name:'home'},{name:'planned'}]}},{});assert.equal(result,require('expo-router/build/react-navigation/routers/types').RouterActionHandling.Unhandled);}finally{console.warn=warn;h.close();}});
test('slow success: one POST and full reset to planned',async()=>{let resolve,calls=0;const h=screen(()=>{calls++;return new Promise(r=>resolve=r);});try{h.render();await h.settle();const b=h.button('Confirmer le barathon');b.props.onPress();b.props.onPress();await h.settle();assert.equal(calls,1);assert.equal(h.resets.length,0);resolve({id:42});await h.settle();assert.equal(h.resets.length,1);const reset=h.resets[0];assert.equal(reset.stale,false);assert.equal(BaseRouter().getStateForAction(h.state,{type:'RESET',payload:reset},{}).state.routes[1].name,'planned');b.props.onPress();assert.equal(calls,1);}finally{h.close();}});
test('failure preserves stops and permits retry',async()=>{let calls=0;const h=screen(async()=>{calls++;throw new Error('Date invalide');});try{h.render();await h.settle();h.button('Confirmer le barathon').props.onPress();await h.settle();assert.equal(h.alerts.at(-1)[1],'Date invalide');assert.equal(h.resets.length,0);for(const name of ['Alpha','Beta'])assert.ok(find(h.tree(),x=>x.type==='Text'&&x.props.children===name).length);h.button('Confirmer le barathon').props.onPress();await h.settle();assert.equal(calls,2);}finally{h.close();}});
test('unknown outcome preserves draft, opens planned and permits only deliberate retry',async()=>{let calls=0;const h=screen(async()=>{calls++;if(calls===1)throw new Unknown();return {id:42};});try{h.render();await h.settle();const b=h.button('Confirmer le barathon');b.props.onPress();await h.settle();assert.match(h.alerts.at(-1)[1],/peut-être été créé/);b.props.onPress();assert.equal(calls,1);h.button('Voir mes barathons prévus').props.onPress();assert.deepEqual(h.pushes,['/planned']);assert.equal(h.resets.length,0);for(const name of ['Alpha','Beta'])assert.ok(find(h.tree(),x=>x.type==='Text'&&x.props.children===name).length);h.button('J’ai vérifié : réessayer').props.onPress();assert.equal(calls,1);h.alerts.at(-1)[2].find(x=>x.text==='J’ai vérifié, réessayer').onPress();await h.settle();assert.equal(calls,2);assert.equal(h.resets[0].routes[1].name,'planned');}finally{h.close();}});

test('creation service distinguishes validation errors and uncertain network or server outcomes', async()=>{
  const svc=load('features/create_barathon/services/createBarathon.service.ts',{'expo-secure-store':{getItemAsync:async()=> 'token'}});
  const previous=global.fetch;
  try {
    global.fetch=async()=>({ok:false,status:400,json:async()=>({detail:'Date invalide'})});
    await assert.rejects(svc.createBarathon({}),{message:'Date invalide'});
    for (const status of [408,500]) {
      global.fetch=async()=>({ok:false,status,json:async()=>({})});
      await assert.rejects(svc.createBarathon({}),svc.CreationOutcomeUnknownError);
    }
    global.fetch=async()=>{throw new TypeError('network');};
    await assert.rejects(svc.createBarathon({}),svc.CreationOutcomeUnknownError);
    global.fetch=async()=>({ok:true,status:201,json:async()=>({id:42})});
    assert.equal((await svc.createBarathon({})).id,42);
  } finally {global.fetch=previous;}
});

test('planned screen refresh on focus exposes the newly created barathon', async()=>{
  const values=[],effects=[],refs=[]; let cursor=0,refCursor=0,focus,tree;
  const hooks={...React,useState(init){const i=cursor++;if(!(i in values))values[i]=typeof init==='function'?init():init;return [values[i],v=>{values[i]=typeof v==='function'?v(values[i]):v;}];},useRef(v){const i=refCursor++;return refs[i]||={current:v};},useEffect:fn=>effects.push(fn),useCallback:fn=>fn};
  const item={id:42,name:'Vendredi'}; let calls=0;
  const rn={StyleSheet:{create:x=>x},Alert:{alert(){}},...Object.fromEntries(['View','Text','FlatList','ActivityIndicator'].map(x=>[x,x]))};
  const Component=load('features/planned/screens/PlannedScreen.tsx',{
    react:hooks,'react-native':rn,'expo-router':{router:{},useFocusEffect:fn=>{focus=fn;}},
    'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},
    '../../../lib/authStorage':{getCurrentUserId:async()=>1},
    '../services/planned.service':{getMyUpcomingBarathons:async()=>{calls++;return [item];}},
    '../../barathon_past_planned/components/BarathonCard':{__esModule:true,default:'BarathonCard'},
    '../components/ChangeStartTimeModal':{__esModule:true,default:'ChangeStartTimeModal'},
    '../components/ManageParticipantsModal':{__esModule:true,default:'ManageParticipantsModal'},
  }).default;
  const render=()=>{cursor=refCursor=0;tree=Component();};render();focus();await Promise.resolve();await Promise.resolve();render();
  assert.equal(calls,1);assert.deepEqual(find(tree,x=>x.type==='FlatList')[0].props.data,[item]);
  focus();await Promise.resolve();await Promise.resolve();render();assert.equal(calls,2);
});
