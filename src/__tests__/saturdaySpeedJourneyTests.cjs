require('sucrase/register');
const assert = require('node:assert/strict');
if (process.env.SATURDAY_SPEED_MUTATION) require('../../scripts/test-saturday-speed-mutations.cjs').installMutation(process.env.SATURDAY_SPEED_MUTATION);
global.__DEV__=true; process.env.TZ='Australia/Melbourne';
const disk=new Map(); global.window={localStorage:{getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k),clear:()=>disk.clear()}};
global.fetch=()=>{throw Error('Offline Speed journey');};
const j=require('./support/athleteJourney'), {athleteAnswers}=require('./compilerYear/catalog');
const {deriveVisibleWeekLive}=require('../utils/deriveVisibleWeek'), {visibleSignature}=require('./compilerYear/invariants');
const {lowerBodyWorkloadForWeek}=require('../rules/lowerBodyWorkload');
const {getSessionComponentRows}=require('../utils/sessionComponents');
const {getExerciseTags}=require('../data/exerciseTags');
const {scheduleWeek, selectFreshSpeedDay}=require('../rules/weeklyScheduler');
let passed=0;const failures=[];
async function test(name,fn){if(process.env.SATURDAY_SPEED_FILTER && !name.includes(process.env.SATURDAY_SPEED_FILTER))return;try{await fn();passed++;console.log('PASS '+name);}catch(e){failures.push(name+': '+e.stack);console.error('FAIL '+name+': '+e.message);}}
const monday='2026-09-28';
const layouts={2:['Monday','Thursday'],3:['Monday','Wednesday','Friday'],4:['Monday','Tuesday','Thursday','Friday'],5:['Monday','Tuesday','Wednesday','Thursday','Friday']};
function profile(n=3,phase='Pre-season',club=['Monday','Wednesday']){return {...athleteAnswers({id:'saturday-speed-'+n,gender:'female',days:layouts[n],experience:'2-5 years',equipment:'commercial',initialPhase:phase,clubDays:club,gameDay:phase==='In-season'?'Saturday':null,extraGame:false}), sprintExposure:'2+ times per week',seasonFinishedOn:'2026-08-01'};}
async function install(p=profile()){disk.clear();const r=await j.quietAsync(()=>j.coldStartThroughOnboarding({profile:p,installDayISO:monday}));assert.equal(r.onboardingRefusal,null);return r;}
const view=()=>j.quiet(()=>deriveVisibleWeekLive(monday,monday));
const speedDates=days=>days.filter(d=>d.workout && getSessionComponentRows(d.workout).speedRows.length).map(d=>d.date);
const dose=(workouts,extra={})=>lowerBodyWorkloadForWeek({workouts,weekStartISO:monday,...extra});
(async()=>{
await test('real three-day generation separates Saturday Speed and survives restart',async()=>{
 await install();const days=view();
 const fri=days.find(d=>d.date==='2026-10-02').workout;
 assert.equal(fri.conditioningCategory,'aerobic_base','Friday bike must not become new hard work');
 assert.deepEqual(speedDates(days),['2026-10-03']);
 assert.ok(getSessionComponentRows(fri).strengthRows.length>0);assert.ok(getSessionComponentRows(fri).conditioningRows.length>0);assert.equal(getSessionComponentRows(fri).speedRows.length,0);
 assert.ok(!days.find(d=>d.date==='2026-10-04').workout);
 const before=visibleSignature(days);assert.ok((await j.quietAsync(()=>j.relaunchApp({storage:disk,todayISO:monday}))).ok);assert.equal(visibleSignature(view()),before);
});
await test('real rows count legs once, exclude upper power mobility and use actual completion',async()=>{
 await install();const workouts=view().flatMap(d=>d.workout?[d.workout]:[]);
 const fri=workouts.find(w=>w.dayOfWeek===5);const lower=getSessionComponentRows(fri).strengthRows.filter(r=>getExerciseTags(r.exercise.name)?.region==='lower');
 assert.equal(lower.length,2);assert.equal(lower.reduce((n,r)=>n+r.prescribedSets,0),6,'reached two three-set lower rows');
 assert.deepEqual(dose(workouts)[5],{workingSets:6,unknown:false});
 assert.deepEqual(dose(workouts.map(w=>({...w,name:'Any session title',strengthIntent:undefined})))[5],dose(workouts)[5]);
 const upper=getSessionComponentRows(fri).strengthRows.filter(r=>getExerciseTags(r.exercise.name)?.region==='upper');
 const added={...fri,exercises:[...fri.exercises,...upper.map((r,i)=>({...r,id:'upper-extra-'+i,prescribedSets:20}))]};
 assert.equal(dose([added])[5].workingSets,6,'upper sets do not inflate leg dose');
 const mobility={...fri,exercises:lower.map(r=>({...r,sessionSection:'mobility',prescribedSets:20}))};
 assert.equal(dose([mobility])[5].workingSets,0,'mobility is not working volume');
 const extra={...fri,exercises:[...fri.exercises,{...lower[0],id:'manual-leg',athleteAdditionId:'manual',prescribedSets:4}]};
 assert.equal(dose([extra])[5].workingSets,10,'accepted manual lower sets count');
 const logs=lower.map(r=>({exerciseId:r.exerciseId,workoutExerciseId:r.id,exerciseName:r.exercise.name,prescribedSets:r.prescribedSets,prescribedRepsMin:r.prescribedRepsMin,prescribedRepsMax:r.prescribedRepsMax,completion:'partial',completedSets:1}));
 const feedback={friday:{dateStr:'2026-10-02',completion:'partial',strength:logs}};
 assert.deepEqual(dose([fri],{completedBeforeISO:'2026-10-03',feedback})[5],{workingSets:2,unknown:false});
 assert.equal(dose([fri],{completedBeforeISO:'2026-10-03',feedback:{friday:{...feedback.friday,completion:'skipped'}}})[5].workingSets,0);
 assert.equal(dose([fri],{completedBeforeISO:'2026-10-03',feedback:{}})[5].unknown,true,'missing log is not a rested day');
 assert.equal(dose([fri],{completedBeforeISO:'2026-10-03',feedback:{friday:{...feedback.friday,strength:logs.map(r=>({...r,completedSets:undefined}))}}})[5].unknown,true);
 assert.equal(dose([],{completedBeforeISO:'2026-10-03',feedback})[5].workingSets,2,'completed additions remain real after their draft rows disappear');
 // Real outcome writer supplies the same record shape used by the compiler.
 j.setJourneyClock('2026-10-02'); const result=await j.quietAsync(()=>j.recordDay('2026-10-02',{record:true,completion:'full',feeling:'hard',soreness:'none',difficulty:7,logWeights:true,conditioningRpe:6}));assert.equal(result.result,'recorded');
 const saved=require('../store/programStore').useProgramStore.getState().sessionFeedback;
 assert.deepEqual(dose([fri],{completedBeforeISO:'2026-10-03',feedback:saved})[5],{workingSets:6,unknown:false});
});
for(const n of [2,3,4,5])for(const phase of ['Off-season','Pre-season','In-season'])await test(`generated ${n}-day ${phase} fixture and restart`,async()=>{
 await install(profile(n,phase,phase==='Off-season'?[]:['Tuesday','Thursday'])); const days=view(),speed=speedDates(days);assert.ok(speed.length<=1);
 if(phase==='In-season')assert.ok(speed.every(date=>!['2026-10-01','2026-10-02','2026-10-03','2026-10-04'].includes(date)),'game and protected dates stay clear');
 assert.ok(speed.every(date=>!['2026-09-29','2026-10-01'].includes(date))||phase==='Off-season','club dates stay clear');
 const before=visibleSignature(days);assert.ok((await j.quietAsync(()=>j.relaunchApp({storage:disk,todayISO:monday}))).ok);assert.equal(visibleSignature(view()),before);
});
console.log(`Saturday Speed journeys: ${passed}/${passed+failures.length} groups passed`);if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
})();
