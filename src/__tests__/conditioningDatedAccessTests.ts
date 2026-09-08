/** Dated capability matrix; athlete-facing delivery is guarded by the cohort journey. */
(global as any).__DEV__ = true;
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import assert from 'node:assert/strict';
import { conditioningEquipmentOnDate, canonicalWeeklyAvailabilityStateFrom } from '../rules/canonicalWeeklyAvailabilityState';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';
import { presetEquipmentAnswer } from './support/equipmentAnswerFixture';
import { athleteAnswers, plusDays } from './compilerYear/catalog';
import type { DayOfWeek } from '../types/domain';
const weekdays:DayOfWeek[]=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
let dates=0,profiles=0;
for(const days of [[],['Monday','Thursday'],['Monday','Wednesday','Friday'],['Monday','Tuesday','Thursday','Friday'],weekdays] as DayOfWeek[][]){
 for(const preset of ['commercial_gym','club_gym','home_gym'] as const){
  const profile={...athleteAnswers({id:'dated-conditioning',gender:'male',days,experience:'2-5 years',equipment:'commercial',initialPhase:'Off-season',clubDays:[],gameDay:null,extraGame:false}),equipmentAnswer:presetEquipmentAnswer(preset,'2026-09-28')};
  const saved=JSON.stringify(profile), owned=resolveEquipmentCapabilities(profile,[],'2026-09-28');
  const state=canonicalWeeklyAvailabilityStateFrom({profile,weekStartISO:'2026-09-28'});
  for(let d=0;d<7;d++){
   const date=plusDays('2026-09-28',d), expected=days.includes(weekdays[d])?owned.conditioningModalities:[];
   assert.deepEqual(conditioningEquipmentOnDate(profile,date,owned).conditioningModalities,expected,`${preset}/${days.length}/${date}: dated helper`);
   assert.deepEqual(state.equipmentByDayOfWeek[(d+1)%7].conditioningModalities,expected,`${preset}/${days.length}/${date}: compiler availability`);
   if (!days.includes(weekdays[d])) {
    assert.deepEqual(state.equipmentByDayOfWeek[(d+1)%7].tags,['bodyweight'],`${preset}/${date}: unselected day has no gym equipment`);
   }
   dates++;
  }
  assert.equal(JSON.stringify(profile),saved,'Dated access must never rewrite owned equipment or selected days');profiles++;
 }
}
console.log(`PASS dated machine access: ${dates} distinct profile/date cases across ${profiles} profiles; stored answers preserved`);

// The fixture-replacement caller has no compiler machine map: it must still
// consume dated access, rather than reviving the owned-every-day assumption.
const fixtureProfile={...athleteAnswers({id:'fixture-access',gender:'male',days:['Monday','Wednesday','Friday'],experience:'2-5 years',equipment:'commercial',initialPhase:'In-season',clubDays:[],gameDay:null,extraGame:false}),equipmentAnswer:presetEquipmentAnswer('commercial_gym','2026-07-01')};
const savedProfile=JSON.stringify(fixtureProfile);
const oldLog=console.log, oldWarn=console.warn;console.log=()=>{};console.warn=()=>{};
let replacement;
try {
 [replacement]=buildWorkoutsFromCoach([], 'fixture-access', [{tier:'core',focus:'Aerobic Conditioning',dayOfWeek:'Saturday',isHardExposure:false,conditioningFlavour:'aerobic',conditioningCategory:'aerobic_base',section18ConditioningRole:'required_core',conditioningVariant:'standard',stressLevel:'medium',planEntryId:'fixture-access:Saturday'}] as never,fixtureProfile,{miniCycleNumber:2,weekInBlock:1,weekStartISO:'2026-10-26'});
} finally {console.log=oldLog;console.warn=oldWarn;}
assert(replacement?.conditioningBlock?.options.length,'Fixture adapter must deliver actual conditioning');
assert(replacement.conditioningBlock.options.every(option=>option.modality==='running'),'Fixture adapter without a machine map must not resurrect Saturday machines');
assert.equal(JSON.stringify(fixtureProfile),savedProfile);
console.log('PASS fixture adapter: standalone conditioning uses dated access without a compiler map');
