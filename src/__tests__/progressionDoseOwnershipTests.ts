/** Sam 2026-09-07: no soreness input, one-week reductions, one dose owner. */
(global as any).__DEV__ = true;
const storage = new Map<string, string>();
(globalThis as any).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key), clear: () => storage.clear(),
} };
import { coldStartThroughOnboarding, recordDay, rolloverIfDue, relaunchApp, quiet, quietAsync, setJourneyClock } from './support/athleteJourney';
import { athleteAnswers, plusDays } from './compilerYear/catalog';
import { presetEquipmentAnswer } from './support/equipmentAnswerFixture';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { useProgramStore } from '../store/programStore';
import { getVisibleFeedbackSections, buildSessionFeedbackPayload, canSaveFeedbackDraft } from '../utils/sessionFeedbackForm';
import { visibleSignature } from './compilerYear/invariants';
import { sessionEffortFromFeedback } from '../rules/effortScale';
import { historicalSorenessFact } from './support/historicalSorenessFact';
import { activeTemporarySourceFacts, normalizeTemporarySourceFacts, temporaryFactScope, createTemporaryFatigueFact, composeTemporarySourceFactCompatibility } from '../rules/temporarySourceFact';
import { factHorizonCoversDate } from '../rules/durableFactHorizon';
import { transactTemporarySourceFact } from '../store/temporarySourceFactTransaction';
import { readBlockHistory, progressionRoleForRow } from '../rules/blockBoundaryProgression';
import { readFileSync } from 'fs';
import { resolve } from 'path';
let passed = 0; let failed = 0;
function ok(label: string, condition: unknown, detail?: unknown) {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}${condition ? '' : ` ${JSON.stringify(detail)}`}`);
  condition ? passed++ : failed++;
}
const start = '2026-09-28';
function view(date: string) { return quiet(() => deriveVisibleWeekLive(date, date)); }
function rows(date: string) { return view(date).flatMap(day => (day.workout?.exercises ?? []).map(row => ({date: day.date, row}))); }
async function run() {
  ok('numeric seven wins over an old qualitative fatigue label',sessionEffortFromFeedback({difficulty:7,feeling:'very_hard'})===7);
  ok('historical hard means seven, never inferred soreness/eight',sessionEffortFromFeedback({feeling:'hard'})===7);
  const historical = historicalSorenessFact({observedDate:start,scope:temporaryFactScope({kind:'week',date:start}),athleteReportedLevel:'high',distribution:'general',sourceSurface:'test'});
  ok('historical fixture actually covers the report date',factHorizonCoversDate(historical,start));
  ok('old soreness record remains readable',normalizeTemporarySourceFacts({value:[historical]}).length===1);
  ok('old soreness record cannot become an active restriction',activeTemporarySourceFacts([historical],start).length===0);
  const oldOpenFatigue=createTemporaryFatigueFact({observedDate:start,scope:{kind:'open',from:start,until:null},athleteReportedLevel:'cooked',sourceSurface:'test'});
  ok('historical fatigue reaches day seven',factHorizonCoversDate(oldOpenFatigue,plusDays(start,6)));
  ok('historical open fatigue projects a bounded constraint',composeTemporarySourceFactCompatibility({temporarySourceFacts:[oldOpenFatigue]}).activeConstraints.some(c=>c.expiresAt===plusDays(start,6)));
  ok('historical fatigue cannot reach day eight',!factHorizonCoversDate(oldOpenFatigue,plusDays(start,7)));
  const runtimeIntegration=readFileSync(resolve(__dirname,'../utils/strengthProgressionIntegration.ts'),'utf8');
  ok('retired writer no longer exists in app integration', !/export function (applyStrengthProgression|buildProgressionContext)\b/.test(runtimeIntegration));
  const source=readFileSync(resolve(__dirname,'../rules/canonicalWeeklyProgressionCompiler.ts'),'utf8');
  ok('accepted compiler cannot call the retired per-session writer', !/\b(?:applyStrengthProgression|buildProgressionContext|materialiseBlockStrength)\s*\(/.test(source));

  for (const completion of ['full', 'partial'] as const) {
    const sections = getVisibleFeedbackSections(completion);
    ok(`${completion}: no soreness section`, !sections.some(s => /sore/i.test(s.id + s.label)), sections);
    const draft = { completion, feeling: 'hard' as const, partialReason: completion === 'partial' ? 'ran_out_of_time' as const : null, skipReason: null, soreness: null };
    ok(`${completion}: can save without soreness`, canSaveFeedbackDraft(draft));
    const payload = buildSessionFeedbackPayload({...draft, dateStr: start, difficulty: 7});
    ok(`${completion}: payload has no soreness property`, !!payload && !Object.hasOwn(payload, 'soreness'), payload);
  }
  for (const scenario of [{days:['Monday','Wednesday','Friday'],experience:'2-5 years',equipment:'commercial',gender:'female'}, {days:['Monday','Thursday'],experience:'2-5 years',equipment:'commercial',gender:'male'}, {days:['Monday','Tuesday','Thursday','Friday'],experience:'2-5 years',equipment:'home',gender:'male'}, {days:['Monday','Wednesday','Friday'],experience:'Complete beginner',equipment:'commercial',gender:'male'}] as const) {
  for (const fatigued of [false, true]) {
    console.log('COHORT', JSON.stringify({scenario,fatigued}));
    const profile = {...athleteAnswers({id:'dose-three-day', gender:scenario.gender, days:[...scenario.days],experience:scenario.experience,equipment:scenario.equipment,initialPhase:'Off-season',clubDays:[],gameDay:null,extraGame:false}),
      seasonFinishedOn: plusDays(start,-1), heightCm:168, weightKg:66, squatStrength:'Around bodyweight' as const, benchStrength:'Less than bodyweight' as const,
      equipmentAnswer:presetEquipmentAnswer(scenario.equipment==='home'?'home_gym':'commercial_gym',start)};
    const installed = await quietAsync(() => coldStartThroughOnboarding({profile,installDayISO:start}));
    ok(`${fatigued}: real onboarding`, !installed.onboardingRefusal, installed.onboardingRefusal);
    const retired=await quietAsync(()=>transactTemporarySourceFact({operation:'create',fact:historical,todayISO:start}));
    ok(`${fatigued}: durable writer refuses new soreness facts`, retired.outcome==='safely_rejected' && retired.reason==='retired_soreness_input',retired);
    let reduced = new Map<string,number>();
    let logged=0; let week4 = new Map<string,{sets:number;kg:number}>();
    for (let week=0; week<7; week++) {
      const date=plusDays(start,week*7);setJourneyClock(date);
      const rolled=quiet(()=>rolloverIfDue(date));ok(`${fatigued}: week ${week+1} rollover`,!rolled.refusal,rolled);
      const visible=rows(date);
      if(week===3)week4=new Map(visible.map(({row})=>[row.exercise.name,{sets:row.prescribedSets,kg:row.prescribedWeightKg??0}]));
      if(week>=4){
        const mains=visible.filter(({row})=>row.section18Evidence?.role==='main_strength');
        ok(`${fatigued}: week ${week+1} reaches actual main lifts`,mains.length>=4,mains.map(x=>x.row.exercise.name));
        if(fatigued && week>=5) ok(`fatigue expires: week ${week+1} normal main dose`, mains.every(({row})=>row.prescribedSets>=3), mains.map(({row})=>({name:row.exercise.name,sets:row.prescribedSets})));
        if(!fatigued || week>=5) {
          for(const name of ['Back Squat','RDLs','Bench Press','Chest-Supported DB Row']) {
            const lift=visible.find(x=>x.row.exercise.name===name)?.row;
            if(lift)ok(`${fatigued}: week ${week+1} ${name} retains normal sets`,lift.prescribedSets>=3,lift.prescribedSets);
          }
        }
        if(!fatigued && week===4 && scenario.gender==='female'){
          const bw=visible.filter(x=>['Pull-Ups','SL 45° Back Extension'].includes(x.row.exercise.name));
          ok('reaches earned first bodyweight load',bw.some(x=>(x.row.prescribedWeightKg??0)>0),bw.map(x=>({name:x.row.exercise.name,kg:x.row.prescribedWeightKg})));
          for(const {row}of bw){const prior=week4.get(row.exercise.name);ok(`${row.exercise.name}: no added load plus added set`,prior && !((row.prescribedWeightKg??0)>prior.kg && row.prescribedSets>prior.sets),{prior,sets:row.prescribedSets,kg:row.prescribedWeightKg});}
        }
        if(fatigued&&week===4) {
          reduced = new Map(visible.filter(({row})=> progressionRoleForRow(row)!==null && row.prescribedSets<(week4.get(row.exercise.name)?.sets??0)).map(({row})=>[row.exercise.name,week4.get(row.exercise.name)!.sets]));
          if(scenario.gender==='female')ok('recent high effort actually reduces first week',reduced.size>0,visible.map(x=>({name:x.row.exercise.name,sets:x.row.prescribedSets})));
        }
        if(fatigued&&week>=5 && reduced.size>0) {
          const returned = visible.filter(({row})=>reduced.has(row.exercise.name));
          ok(`week ${week+1}: actual reduced lifts return to their normal dose`,returned.length>0&&returned.every(({row})=>row.prescribedSets>=reduced.get(row.exercise.name)!),returned.map(({row})=>({name:row.exercise.name,sets:row.prescribedSets,previous:reduced.get(row.exercise.name)})));
        }
        const signature=visibleSignature(view(date));const reopened=await quietAsync(()=>relaunchApp({storage,todayISO:date}));
        ok(`${fatigued}: week ${week+1} reload succeeds`,reopened.ok,reopened.error);
        ok(`${fatigued}: week ${week+1} reload retains exact visible dose`,visibleSignature(view(date))===signature);
      }
      for(let day=0;day<7;day++){
        const on=plusDays(date,day);setJourneyClock(on);
        const result=await quietAsync(()=>recordDay(on,{record:true,completion:'full',feeling:fatigued&&week===3?'very_hard':'hard',difficulty:fatigued&&week===3?9:7,soreness:'none',logWeights:true,conditioningRpe:6}));
        ok(`${fatigued}: ${on} logging door`,!['refused','threw'].includes(result.result),result);
        if(result.result==='recorded')logged++;
      }
    }
    ok(`${fatigued}: accumulated real recorded sessions`,logged>=18,logged);
    const feedback=Object.values(useProgramStore.getState().sessionFeedback);
    ok(`${fatigued}: new saved records never contain soreness`,feedback.length>0&&feedback.every(f=>!Object.hasOwn(f,'soreness')));
  }
  }
  console.log(`Dose ownership: passed=${passed} failed=${failed}`);
  if(failed)process.exitCode=1;
}
run().catch(e=>{console.error(e);process.exitCode=1;});
