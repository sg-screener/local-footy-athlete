/** Actual form body and callbacks with native hosts/hooks driven in Node.
 * This verifies the save/reopen path, not native layout or keyboard behaviour. */
require('sucrase/register');
global.__DEV__ = true;
const storage = new Map();
global.window = {localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k),clear:()=>storage.clear()}};
const prime=(name,exports)=>require.cache[require.resolve(name)]={id:name,filename:name,loaded:true,exports};
prime('react-native',new Proxy({StyleSheet:{create:x=>x,flatten:x=>x},Platform:{OS:'ios',select:x=>x.ios??x.default},Dimensions:{get:()=>({width:390,height:844})}},{get:(o,k)=>k in o?o[k]:k}));
prime('react-native-reanimated',{__esModule:true,default:new Proxy({},{get:()=>props=>props}),useAnimatedStyle:f=>f(),useSharedValue:v=>({value:v}),withTiming:x=>x,runOnJS:x=>x});
prime('react-native-keyboard-controller',{useKeyboardContext:()=>({reanimated:{height:{value:0}}})});
const React=require('react');
let slots=[],cursor=0,effects=[];
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
const memo=(f,deps)=>{const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,value:f()};return slots[i].value;};
const hooks={useState:init=>{const i=cursor++;if(!(i in slots))slots[i]={value:typeof init==='function'?init():init};return[slots[i].value,v=>slots[i].value=typeof v==='function'?v(slots[i].value):v];},
useMemo:memo,useCallback:(f,d)=>memo(()=>f,d),useRef:v=>memo(()=>({current:v}),[]),
useEffect:(f,deps)=>{const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps)){slots[i]={deps};effects.push(f);}},
useSyncExternalStore:(_subscribe,get)=>get(),useDebugValue:()=>{},useContext:c=>c._currentValue};
const {SessionFeedbackPanel}=require('../components/SessionFeedbackPanel');
const {coldStartThroughOnboarding,quiet,quietAsync,relaunchApp,setJourneyClock}=require('./support/athleteJourney');
const {athleteAnswers,ARCHETYPES}=require('./compilerYear/catalog');
const {deriveVisibleWeekLive}=require('../utils/deriveVisibleWeek');
const {useProgramStore}=require('../store/programStore');
let passed=0;
const ok=(label,value)=>{if(!value)throw Error(label);console.log('PASS '+label);passed++;};
function nodes(root){const out=[];const visit=x=>{if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(visit);return;}if(x.props){out.push(x);visit(x.props.children);}};visit(root);return out;}
function render(props){cursor=0;effects=[];const internals=React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;const prior=internals.H;internals.H=hooks;try{const routed=SessionFeedbackPanel(props);const tree=routed.type(routed.props);effects.forEach(f=>f());return tree;}finally{internals.H=prior;}}
async function main(){
 const date='2026-09-28';const profile={...athleteAnswers({...ARCHETYPES[2],initialPhase:'Off-season',clubDays:[],gameDay:null}),seasonFinishedOn:'2026-09-27'};
 const installed=await quietAsync(()=>coldStartThroughOnboarding({profile,installDayISO:date}));ok('real onboarding accepted',!installed.onboardingRefusal);setJourneyClock(date);
 const workout=quiet(()=>deriveVisibleWeekLive(date,date)).find(d=>d.date===date)?.workout;ok('actual selected day contains strength',!!workout?.exercises.some(r=>r.section18Evidence?.role==='main_strength'));
 let saves=0;const props={date,workout,onSave:()=>saves++};let tree=render(props);tree=render(props);
 const completions=nodes(tree).filter(n=>/feedback-.*completion-full$/.test(n.props.testID??''));ok('real form asks component completion',completions.length>0);for(const id of completions.map(n=>n.props.testID)){nodes(tree).find(n=>n.props.testID===id).props.onPress();tree=render(props);}
 const feeling=nodes(tree).find(n=>n.props.testID==='feedback-feeling-hard');ok('real form offers hard feedback',!!feeling);feeling.props.onPress();tree=render(props);
 ok('rendered form has no soreness question or choice',!nodes(tree).some(n=>/sore/i.test(String(n.props.testID??'')+' '+String(n.props.label??'')+' '+(typeof n.props.children==='string'?n.props.children:''))));
 const save=nodes(tree).find(n=>n.props.label==='Save & Finish'&&typeof n.props.onPress==='function');ok('actual Save is enabled without soreness',save&&!save.props.disabled);
 await quietAsync(()=>save.props.onPress());ok('actual Save reports success once',saves===1);
 const stored=useProgramStore.getState().sessionFeedback[date];ok('actual form saved hard without a soreness field',stored?.feeling==='hard'&&!Object.hasOwn(stored,'soreness'));
 const reopened=await quietAsync(()=>relaunchApp({storage,todayISO:date}));ok('save survives real persistence and production boot',reopened.ok&&useProgramStore.getState().sessionFeedback[date]?.feeling==='hard');
 slots=[];tree=render(props);tree=render(props);ok('reopened form still has no soreness controls',!nodes(tree).some(n=>/sore/i.test(n.props.testID??'')));
 const {buildSessionExecutionPlan,buildSessionExecutionSummary}=require('../utils/sessionExecutionChecklist');
 const {buildSessionTemplate}=require('../utils/sessionTemplate');
 const plan=buildSessionExecutionPlan({workout,template:buildSessionTemplate(workout),mobilityFlow:null});
 const ids=plan.sections.flatMap(section=>section.items.map(item=>item.id));
 ok('actual checklist contains multiple exercises',ids.length>2);
 for(const completion of ['full','partial']){
   const executionSummary=buildSessionExecutionSummary(plan,new Set(completion==='full'?ids:ids.slice(0,Math.ceil(ids.length/2))));
   const checklistProps={...props,executionSummary};slots=[];tree=render(checklistProps);tree=render(checklistProps);
   const effort=nodes(tree).find(n=>n.props.testID==='session-feedback-rpe-grid');ok(`${completion}: actual checklist form exposes effort`,!!effort);effort.props.onChange(7);tree=render(checklistProps);
   const button=nodes(tree).find(n=>n.props.label==='Save & Finish');ok(`${completion}: Save works without a soreness answer`,button&&!button.props.disabled);
   await quietAsync(()=>button.props.onPress());
   const feedback=useProgramStore.getState().sessionFeedback[date];ok(`${completion}: actual handler saves numeric seven and no soreness`,feedback?.difficulty===7&&feedback.completion===completion&&!Object.hasOwn(feedback,'soreness'));
   const boot=await quietAsync(()=>relaunchApp({storage,todayISO:date}));ok(`${completion}: checklist feedback survives boot`,boot.ok&&useProgramStore.getState().sessionFeedback[date]?.completion===completion);
 }
 // Historical storage ingress: no current writer is used to manufacture it.
 await require('../store/asyncStorageCompat').flushPendingStorageWrites();
 const {historicalSorenessFact}=require('./support/historicalSorenessFact');
 const {temporaryFactScope,activeTemporarySourceFacts}=require('../rules/temporarySourceFact');
 const historical=historicalSorenessFact({observedDate:date,scope:temporaryFactScope({kind:'week',date}),athleteReportedLevel:'high',distribution:'general',sourceSurface:'test'});
 const key=require('../store/programStore').PROGRAM_STORE_PERSISTENCE_KEY;
 const envelope=JSON.parse(storage.get(key));ok('reached actual persisted input envelope',!!envelope.state?.inputs);
 envelope.state.inputs.temporarySourceFacts.push(historical);storage.set(key,JSON.stringify(envelope));
 const historicalBoot=await quietAsync(()=>relaunchApp({storage,todayISO:date}));
 const facts=useProgramStore.getState().acceptedMaterialContext.temporarySourceFacts;
 ok('production boot preserves historical soreness record',historicalBoot.ok&&facts.some(f=>f.factId===historical.factId));
 ok('historical soreness remains inactive after production boot',!activeTemporarySourceFacts(facts,date).some(f=>f.factId===historical.factId));
 console.log(`Feedback screen journey: ${passed} passed`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
