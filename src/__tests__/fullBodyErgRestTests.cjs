require('sucrase/register');
if(process.env.FULL_BODY_ERG_MUTATION) require('../../scripts/test-full-body-erg-rest-mutations.cjs').installMutation(process.env.FULL_BODY_ERG_MUTATION);
const assert=require('node:assert/strict');
global.__DEV__=true;process.env.TZ='Australia/Melbourne';const disk=new Map();global.window={localStorage:{getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k),clear:()=>disk.clear()}};global.fetch=()=>{throw Error('Offline full-body journey');};
const j=require('./support/athleteJourney'),{athleteAnswers}=require('./compilerYear/catalog');
const {deriveVisibleWeekLive}=require('../utils/deriveVisibleWeek'),{visibleSignature}=require('./compilerYear/invariants');
const {getSessionComponentRows}=require('../utils/sessionComponents'),{lowerBodyWorkloadForWeek}=require('../rules/lowerBodyWorkload');
const {CONDITIONING_TEMPLATES}=require('../data/conditioningTemplates');
const {conditioningAthletePrescription}=require('../rules/conditioningDisplay');
const {conditioningRowForDisplay}=require('../utils/conditioningVisibleIdentity');
const {composeConditioningRows}=require('../rules/conditioningSelection');
let passed=0;const failures=[];async function test(name,fn){try{await fn();passed++;console.log('PASS '+name);}catch(e){failures.push(name+': '+e.stack);console.error('FAIL '+name+': '+e.message);}}
const start='2026-09-28';
(async()=>{
for (const gender of ['female','male']) await test('real '+gender+' three-day pre-season spreads lower work across full-body days and retains Saturday Speed',async()=>{
 disk.clear();const profile={...athleteAnswers({id:'fullbody-erg-rest-'+gender,gender,days:['Monday','Wednesday','Friday'],experience:'2-5 years',equipment:'commercial',initialPhase:'Pre-season',clubDays:['Monday','Wednesday'],gameDay:null,extraGame:false}),sprintExposure:'2+ times per week'};
 const init=await j.quietAsync(()=>j.coldStartThroughOnboarding({profile,installDayISO:start}));assert.equal(init.onboardingRefusal,null);
 const days=j.quiet(()=>deriveVisibleWeekLive(start,start));const lifts=days.filter(d=>d.workout&&getSessionComponentRows(d.workout).strengthRows.length);assert.equal(lifts.length,3);assert.ok(lifts.every(d=>getSessionComponentRows(d.workout).strengthRows.length>=4),'every ordinary full-body session has useful supporting work');
 const doses=lowerBodyWorkloadForWeek({workouts:lifts.map(d=>d.workout),weekStartISO:start});console.log('ACTUAL LIFTING DAYS',JSON.stringify(lifts.map(d=>({date:d.date,shape:d.workout.composedDayShape,dose:doses[d.workout.dayOfWeek],rows:getSessionComponentRows(d.workout).strengthRows.map(r=>r.exercise?.name)}))));
 assert.ok(lifts.every(d=>String(d.workout.composedDayShape).startsWith('full_body')),'all three actual session shapes must be full body');
 assert.ok(doses[1].workingSets<10,'Monday no longer holds a concentrated ten-plus-set lower session');
 assert.ok(doses[5].workingSets<10,'Friday stays suitable for next-day Speed');
 assert.deepEqual(days.filter(d=>d.workout&&getSessionComponentRows(d.workout).speedRows.length).map(d=>d.date),['2026-10-03']);
 const before=visibleSignature(days);assert.ok((await j.quietAsync(()=>j.relaunchApp({storage:disk,todayISO:start}))).ok);assert.equal(visibleSignature(j.quiet(()=>deriveVisibleWeekLive(start,start))),before);
});
await test('long aerobic erg recovery is complete rest in direct prescriptions and actual row projection',()=>{
 const template=CONDITIONING_TEMPLATES.find(t=>t.name==='Steady Blocks (3×8 min or 4×6 min)');assert.ok(template,'authored steady aerobic template');
 for(const modality of ['ski','row','bike','running']){
  const direct=conditioningAthletePrescription(template,4,modality);const row=composeConditioningRows(template,start).find(r=>r.exercise?.name===template.name);assert.ok(row);
  const workout={conditioningBlock:{options:[{modality,exerciseIds:[row.id],category:'aerobic_base'}]}};
  const shown=conditioningRowForDisplay(workout,row);const expected=['ski','row'].includes(modality)?/complete rest/:/easy/;
  assert.match(direct.recovery,expected,modality+' direct');assert.match(shown.notes.match(/Recovery: (.*)/)[1],expected,modality+' displayed');assert.equal(row.notes.includes('complete rest'),false,'generic source remains modality-neutral');
  const dayProjection=require('../rules/projectVisibleWeek').project({weekStart:start,week:[{date:start,dayOfWeek:1,source:'generated',workout:{id:'erg-rest-day',workoutType:'Conditioning',exercises:[row],...workout}}]});
  const projected=dayProjection.days.flatMap(d=>d.parts.flatMap(p=>p.rows)).find(r=>r.id===row.id);assert.ok(projected);assert.match(projected.dose.find(line=>/^(Rest|Recovery):/.test(line)),expected,modality+' Day agrees with Session');
 }
});
await test('approved bike build ladder remains unchanged',()=>{
 const t=CONDITIONING_TEMPLATES.find(t=>t.name==='Controlled 10–20 min Blocks');for(const [week,minutes]of[[1,10],[2,15],[3,20]]){const r=conditioningAthletePrescription(t,2,'bike',{weekInBlock:week});assert.equal(r.work,minutes+' min controlled');assert.equal(r.setsRounds,'2 sets');}
});

await test('main lifts are reserved evenly across all three full-body days',()=>{
 const {createWeeklyStrengthBudget,WEEKLY_MAIN_STRENGTH_SLOTS}=require('../rules/weeklyStrengthBudget');
 const days=[0,1,2].map(i=>({planEntryId:'day'+i,strengthIntent:{archetype:'full_body',plannedPatterns:['squat','hinge','push','pull']}}));
 const budget=createWeeklyStrengthBudget(days);for(const day of days)assert.equal(WEEKLY_MAIN_STRENGTH_SLOTS.filter(s=>budget.reservedOwnerBySlot[s]===day.planEntryId).length,2);
 for(const slot of WEEKLY_MAIN_STRENGTH_SLOTS){const owner=budget.reservedOwnerBySlot[slot];assert.equal(budget.spend(slot,owner),true);assert.equal(budget.spend(slot,owner),false);}
});
await test('only long aerobic erg blocks switch to complete rest',()=>{
 const {conditioningRecoveryForModality}=require('../rules/conditioningDisplay');
 for(const mode of ['row','ski']){assert.equal(conditioningRecoveryForModality('2 min easy','7 min steady','aerobic_capacity',mode),'2 min complete rest');assert.equal(conditioningRecoveryForModality('1 min easy','2 min steady','aerobic_capacity',mode),'1 min easy');assert.equal(conditioningRecoveryForModality('3 min easy','4 min hard','aerobic_power',mode),'3 min easy');}
 assert.equal(conditioningRecoveryForModality('2 min easy','6 min steady','aerobic_capacity','mixed',['bike','ski']),'2 min complete rest');
 assert.equal(conditioningRecoveryForModality('2 min easy','6 min steady','aerobic_capacity','mixed',['bike','air_bike']),'2 min easy');
});
console.log('Full-body / erg-rest groups: '+passed+'/'+(passed+failures.length));if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
})();
