import { athleteAnswers, ARCHETYPES } from '../compilerYear/catalog';
import { visibleSignature } from '../compilerYear/invariants';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './athleteJourney';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { createTemporarySorenessFact, temporaryFactScope } from '../../rules/temporarySourceFact';
import { transactTemporarySourceFact } from '../../store/temporarySourceFactTransaction';
import { scheduleWeek, scheduleRefused, type WeeklySchedulerInputs } from '../../rules/weeklyScheduler';

export async function gPlusTwoFlushJourney(storage: Map<string,string>, ok:(label:string,value:boolean,detail?:string)=>void) {
  const date = '2026-07-13';
  const input: WeeklySchedulerInputs = {weekStartISO:date,phase:'In-season',offseasonBlock:null,
    gymAccessDays:[1,3],clubNights:[2,4],gameDay:6,fixtureRecurrence:'recurring',age:30,
    readiness:{lowReadiness:false,highReadiness:false,lowFatigue:false,consistentlyCompletesThree:false},
    unavailableDays:[],offLegAvailableDays:[0,1,2,3,4,5,6]};
  const schedule = (changes:Partial<WeeklySchedulerInputs>={}) => {
    const result=scheduleWeek({...input,...changes});
    if(scheduleRefused(result)) throw Error(result.detail);
    return result;
  };
  const base=schedule({offLegAvailableDays:[]}), offered=schedule(), required=schedule({mildSorenessDays:[1]});
  ok('G+2: optional flush attaches without replacing the existing strength session',
    offered.days[0].conditioningCategory==='recovery_flush' && offered.days[0].conditioningRole==='finisher'
    && offered.days[0].purpose===base.days[0].purpose);
  ok('G+2: mild report makes that flush a required component',required.days[0].conditioningRole==='component');
  ok('G+2: recovery does not manufacture conditioning credit or hard load',JSON.stringify(base.demand)===JSON.stringify(offered.demand)
    && JSON.stringify(base.demand)===JSON.stringify(required.demand));
  const standalone=schedule({gymAccessDays:[3,5]}),standaloneCore=schedule({gymAccessDays:[3,5],mildSorenessDays:[1]});
  ok('G+2: an otherwise empty day offers a standalone optional off-leg flush',standalone.days[0].conditioningCategory==='recovery_flush'
    && standalone.days[0].optional===true);
  ok('G+2: a mild report makes the standalone flush core without adding fitness credit',standaloneCore.days[0].conditioningCategory==='recovery_flush'
    && standaloneCore.days[0].optional===false && JSON.stringify(standaloneCore.demand)===JSON.stringify(standalone.demand));
  for(const [name,changes] of Object.entries({club:{clubNights:[1,4]},no_machine:{offLegAvailableDays:[]},
    unavailable:{unavailableDays:[1]},first_game:{fixtureRecurrence:'first_fixture_no_previous'},
    no_game:{gameDay:null},offseason:{phase:'Off-season',offseasonBlock:'normal_build'},preseason:{phase:'Pre-season'}})) {
    const result=schedule(changes as Partial<WeeklySchedulerInputs>);
    ok(`G+2/${name}: no unapproved flush placement`,!result.days.some(day=>day.conditioningCategory==='recovery_flush'));
  }
  for(const gender of ['male','female'] as const) {
    const profile=athleteAnswers({...ARCHETYPES[2],gender,days:['Monday','Wednesday'],initialPhase:'In-season'});
    const installed=await quietAsync(()=>coldStartThroughOnboarding({profile,installDayISO:date}));
    if(installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
    const view=()=>quiet(()=>deriveVisibleWeekLive(date,date));
    const target=()=>view().find(day=>day.date===date)!.workout!;
    const workout=target();
    ok(`G+2/${gender}: real delivered offer is off-leg flush, not running or aerobic-base credit`,
      workout?.conditioningCategory==='aerobic_base' && workout.section18ConditioningRole==='optional_flush' && workout.attachedConditioningKind==='finisher'
      && workout.conditioningBlock?.options.every(o=>o.modality && o.modality!=='running')===true,JSON.stringify({block:workout?.conditioningBlock,role:workout.section18ConditioningRole,category:workout.conditioningCategory,attached:workout.attachedConditioningKind}));
    const before=visibleSignature(view());
    const fact=createTemporarySorenessFact({observedDate:date,scope:temporaryFactScope({kind:'date',date}),
      athleteReportedLevel:'slight',distribution:'general',sourceSurface:'test'});
    const added=await quietAsync(()=>transactTemporarySourceFact({operation:'create',fact,todayISO:date}));
    ok(`G+2/${gender}: accepted mild soreness makes the existing offer core`,added.outcome==='created_and_recomposed'
      && target().attachedConditioningKind==='component',JSON.stringify({added,attached:target().attachedConditioningKind}));
    const active=visibleSignature(view());
    const boot=await quietAsync(()=>relaunchApp({storage,todayISO:date}));
    ok(`G+2/${gender}: soreness and flush survive restart`,boot.ok && active===visibleSignature(view()));
    const clear=await quietAsync(()=>transactTemporarySourceFact({operation:'resolve',factId:fact.factId,todayISO:date}));
    ok(`G+2/${gender}: Clear restores the optional offer`,clear.outcome==='resolved_and_recomposed' && before===visibleSignature(view()));
    const clearedBoot=await quietAsync(()=>relaunchApp({storage,todayISO:date}));
    ok(`G+2/${gender}: cleared offer survives restart`,clearedBoot.ok && before===visibleSignature(view()));
  }
}
