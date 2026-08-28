import { athleteAnswers, ARCHETYPES } from '../compilerYear/catalog';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './athleteJourney';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { visibleSignature } from '../compilerYear/invariants';
import { presetEquipmentAnswer } from './equipmentAnswerFixture';
import { getExerciseTags } from '../../data/exerciseTags';

export async function unilateralPriorityJourney(storage:Map<string,string>,ok:(label:string,value:boolean,detail?:string)=>void) {
  const date='2026-10-26';
  for(const gender of ['male','female'] as const) for(const missing of ['rack','barbell'] as const) {
    const preset=presetEquipmentAnswer('commercial_gym',date);
    const equipmentAnswer={...preset,tags:{...preset.tags,[missing]:'never' as const}};
    const profile={...athleteAnswers({...ARCHETYPES[6],gender,initialPhase:'Off-season',extraGame:false,
      clubDays:[],gameDay:null,days:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']}),
      seasonFinishedOn:'2026-09-27',equipmentAnswer};
    const installed=await quietAsync(()=>coldStartThroughOnboarding({profile,installDayISO:date}));
    if(installed.onboardingRefusal)throw Error(JSON.stringify(installed.onboardingRefusal));
    const view=()=>quiet(()=>deriveVisibleWeekLive(date,date));
    const rows=view().flatMap(d=>d.workout?.exercises??[]);
    const legPress=rows.filter(r=>r.exercise.name==='Leg Press');
    const knee=rows.filter(r=>{const t=getExerciseTags(r.exercise.name);return t?.movement==='lunge'||(t?.movement==='squat'&&t.unilateral);});
    ok(`unilateral/${gender}/no-${missing}: missing kit does not repeat a fallback Leg Press ahead of single-leg work`,legPress.length<=1&&knee.length>0,
      JSON.stringify(view().map(d=>({date:d.date,rows:d.workout?.exercises.map(r=>r.exercise.name)}))));
    ok(`unilateral/${gender}/no-${missing}: required bilateral squat coverage stays honestly bilateral`,rows.some(r=>{
      const t=getExerciseTags(r.exercise.name);return t?.movement==='squat'&&!t.unilateral;}));
    const before=visibleSignature(view());
    const boot=await quietAsync(()=>relaunchApp({storage,todayISO:date}));
    ok(`unilateral/${gender}/no-${missing}: selection and single-leg work survive restart`,boot.ok&&before===visibleSignature(view()));
  }
}
