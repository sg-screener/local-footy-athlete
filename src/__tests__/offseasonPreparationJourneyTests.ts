/** R-381: four preparation weeks, with only the first two optional. */
(global as any).__DEV__ = true;
const storage = new Map<string,string>();
(globalThis as any).window={localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k),clear:()=>storage.clear()}};
import { coldStartThroughOnboarding,recordDay,rolloverIfDue,relaunchApp,quiet,quietAsync,setJourneyClock } from './support/athleteJourney';
import type { DayOfWeek } from '../types/domain';
import { athleteAnswers,plusDays } from './compilerYear/catalog';
import { presetEquipmentAnswer } from './support/equipmentAnswerFixture';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { visibleSignature } from './compilerYear/invariants';
import { buildDayWorkoutProjectedDay } from '../utils/visibleProgramReadModel';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { buildSessionTemplate } from '../utils/sessionTemplate';
import { decidePowerPrimer } from '../rules/powerPrimerPolicy';
import { OFFSEASON_PREPARATION } from '../rules/offseasonSubphasePolicy';
import { buildSessionExecutionPlan, buildSessionExecutionSummary, deriveSessionExecutionCompletion } from '../utils/sessionExecutionChecklist';
import { getSessionComponents } from '../utils/sessionComponents';
import { OFFSEASON_OVERLAYS } from '../rules/weeklyProgrammingContract';
import { commitSessionOutcomeTransaction, createRecordSessionOutcomeIntentFromFeedback } from '../store/sessionOutcomeTransaction';
import { buildSessionFeedbackPayload } from '../utils/sessionFeedbackForm';
import { useProgramStore } from '../store/programStore';
let passed=0,failed=0;
const check=(name:string,ok:unknown,detail?:unknown)=>{ok?passed++:failed++;console.log(`${ok?'PASS':'FAIL'} ${name}${ok?'':` ${JSON.stringify(detail)}`}`);};
const start='2026-09-28';
async function main(){
 for(const subphase of ['early_offseason','mid_offseason'] as const){
  const power=decidePowerPrimer({phase:'Off-season',offseasonSubphase:subphase,strengthPattern:'lower',hasGame:false,gOffset:-99,isTeamDay:false,capacity:'high',isBeginner:false,experienced:true,injuries:[],powerGoalNudge:true});
  check(`preparation policy vetoes power: ${subphase}`,power===null);
 }
 for(const block of ['early_optional','transition'] as const){
  check(`preparation scheduler owes no conditioning: ${block}`,OFFSEASON_OVERLAYS[block].conditioningTarget.min===0&&!OFFSEASON_OVERLAYS[block].runningRequired);
 }
 check('preparation body-armour prescription is shared',OFFSEASON_PREPARATION.strength.repsMin===8&&OFFSEASON_PREPARATION.strength.repsMax===12);
 check('preparation permits only light off-feet aerobic work',OFFSEASON_PREPARATION.conditioning.allowedCategories.length===1&&OFFSEASON_PREPARATION.conditioning.allowedCategories[0]==='aerobic_base'&&OFFSEASON_PREPARATION.conditioning.hardSessionCap===0&&OFFSEASON_PREPARATION.conditioning.modalityBias==='off_feet'&&OFFSEASON_PREPARATION.exposureConditioning.permittedHardCoreMaximum===0);

 for(const days of [['Monday','Wednesday','Friday'],['Monday','Thursday'],['Monday','Tuesday','Thursday','Friday']]){
 const profile={...athleteAnswers({id:'preparation',gender:'female',days:days as DayOfWeek[],experience:'2-5 years',equipment:'commercial',initialPhase:'Off-season',clubDays:[],gameDay:null,extraGame:false}),seasonFinishedOn:plusDays(start,-1),equipmentAnswer:presetEquipmentAnswer('commercial_gym',start)};
 const installed=await quietAsync(()=>coldStartThroughOnboarding({profile,installDayISO:start}));check(`${days.length} days: onboarding`,!installed.onboardingRefusal,installed.onboardingRefusal);
 for(let week=1;week<=5;week++){
  const date=plusDays(start,(week-1)*7);setJourneyClock(date);const rolled=quiet(()=>rolloverIfDue(date));check(`week ${week}: rollover`,!rolled.refusal,rolled);
  const view=()=>quiet(()=>deriveVisibleWeekLive(date,date));const visible=view();const rows=visible.flatMap(d=>d.workout?.exercises??[]);
  const power=rows.filter(r=>r.role==='power'||r.section18Evidence?.role==='power');
  const mains=rows.filter(r=>r.section18Evidence?.role==='main_strength');
  const lifting=visible.filter(d=>d.workout?.exercises.some(r=>r.section18Evidence?.role==='main_strength'));
  check(`week ${week}: participation stays optional only in weeks one/two`, lifting.every(d=>(d.workout?.sessionTier==='optional')===(week<=2)));
  for(const day of visible){
   const opened=quiet(()=>buildDayWorkoutProjectedDay({date:day.date,todayISO:date,state:buildScheduleStateImperative()}));
   check(`week ${week}/${day.date}: actual day reader agrees`,JSON.stringify(opened.workout?.exercises)===JSON.stringify(day.workout?.exercises));
   if(week<=4&&opened.workout){const template=buildSessionTemplate(opened.workout);check(`week ${week}/${day.date}: rendered exercise rows contain no power`,!template.items.some(item=>item.kind==='exercise'&&item.row.role==='power'));}
  }
  check(`week ${week}: reaches main lifting`,mains.length>0);
  if(week<=4){
   check(`week ${week}: preparation has no power`,power.length===0,power.map(r=>r.exercise.name));
   const conditioning=visible.filter(d=>d.workout?.exercises.some(r=>r.role==='conditioning'));
   if(week===3||week===4) check(`week ${week}: actual aerobic offer exists`,conditioning.length>0);
   check(`week ${week}: no compulsory conditioning top-up`,conditioning.every(d=>{const parts=getSessionComponents(d.workout!).filter(c=>c.kind==='conditioning'||c.kind==='finisher');return parts.length>0&&(d.workout?.sessionTier==='optional'||parts.every(c=>c.completionPolicy==='optional_no_penalty'));}),conditioning.map(d=>({date:d.date,tier:d.workout?.sessionTier})));
   check(`week ${week}: aerobic rows are visibly optional`,conditioning.every(d=>{const rows=buildSessionTemplate(d.workout!).items.filter(item=>item.kind==='exercise'&&item.role==='conditioning');return rows.length>0&&rows.every(item=>item.kind==='exercise'&&item.optional);}));
   check(`week ${week}: skipping the aerobic offer still completes prescribed lifting`,conditioning.every(d=>{
    const workout=d.workout!, template=buildSessionTemplate(workout);
    const plan=buildSessionExecutionPlan({workout,template,mobilityFlow:null});
    const aerobic=plan.items.filter(item=>item.componentId==='finisher'||item.componentId==='conditioning');
    const liftingOnly=new Set(plan.items.filter(item=>!aerobic.includes(item)).map(item=>item.id));
    return aerobic.length>0&&aerobic.every(item=>item.sectionId==='optional')&&deriveSessionExecutionCompletion(buildSessionExecutionSummary(plan,liftingOnly))==='full';
   }));
   check(`week ${week}: aerobic offers use a selected gym day`,conditioning.every(d=>days.includes(new Date(d.date+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'long',timeZone:'UTC'}))));
   check(`week ${week}: any aerobic work stays light and off-feet`,conditioning.every(d=>d.workout?.conditioningCategory==='aerobic_base'&&d.workout.conditioningBlock?.options.every(option=>['bike','row','ski','mixed'].includes(option.modality??''))));
   check(`week ${week}: body-armour main reps`,mains.every(r=>(r.prescribedRepsMin??0)>=8&&(r.prescribedRepsMax??99)<=12),mains.map(r=>({name:r.exercise.name,min:r.prescribedRepsMin,max:r.prescribedRepsMax})));
   check(`week ${week}: no unrequested Saturday session`,!visible.find(d=>d.date===plusDays(date,5))?.workout?.exercises.some(r=>r.role==='conditioning'));
  }else {
   check('week five: power becomes eligible again',power.length>0);
   check('week five: actual delivered aerobic base survives the COD exchange',visible.some(d=>d.workout?.conditioningCategory==='aerobic_base'&&d.workout.conditioningBlock?.options.length&&buildSessionTemplate(d.workout).items.some(item=>item.role==='conditioning')));
  }
  const signature=visibleSignature(visible);const boot=await quietAsync(()=>relaunchApp({storage,todayISO:date}));check(`week ${week}: exact visible program survives boot`,boot.ok&&signature===visibleSignature(view()),boot.error);
  for(let d=0;d<7;d++){const on=plusDays(date,d);setJourneyClock(on);const result=await quietAsync(()=>recordDay(on,{record:true,completion:'full',difficulty:7,feeling:'hard',soreness:'none',logWeights:true,conditioningRpe:6}));check(`${on}: actual logging`,!['refused','threw'].includes(result.result),result);
   if(week===3&&d===0){
    const workout=quiet(()=>buildDayWorkoutProjectedDay({date:on,todayISO:on,state:buildScheduleStateImperative()})).workout!;
    const plan=buildSessionExecutionPlan({workout,template:buildSessionTemplate(workout),mobilityFlow:null});
    const summary=buildSessionExecutionSummary(plan,new Set(plan.items.filter(item=>item.sectionId!=='optional').map(item=>item.id)));
    const feedback=buildSessionFeedbackPayload({dateStr:on,completion:deriveSessionExecutionCompletion(summary),components:plan.components,componentCompletions:summary.componentCompletions,executionItems:summary.items,difficulty:7,feeling:'good',partialReason:null,skipReason:null});
    check('optional base skip: real feedback form accepts full lifting',feedback?.completion==='full');
    if(feedback){
     const saved=await quietAsync(()=>commitSessionOutcomeTransaction(createRecordSessionOutcomeIntentFromFeedback({date:on,workout,feedback,source:{entryPoint:'tap',surface:'athlete_journey',interpretedIntent:'record_session_outcome'} as never})));
     check('optional base skip: real save accepts full lifting',saved.ok&&saved.feedback.completion==='full',saved.ok?null:saved);
     const before=JSON.stringify(useProgramStore.getState().sessionFeedback[on]);
     const reopened=await quietAsync(()=>relaunchApp({storage,todayISO:on}));
     check('optional base skip: full lifting and skipped optional ticks survive reopen',reopened.ok&&before===JSON.stringify(useProgramStore.getState().sessionFeedback[on])&&useProgramStore.getState().sessionFeedback[on]?.completion==='full');
    }
   }
  }
 }
 check('accumulated logs remain stored',Object.keys(useProgramStore.getState().sessionFeedback).length>=10);
 }
 console.log(`Preparation journey: ${passed} passed, ${failed} failed`);if(failed)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
