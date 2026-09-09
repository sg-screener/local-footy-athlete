import { injuryAllowsContextExercise } from './datedAthleteContext';
import type { OnboardingData, UserRemovalConstraint, Workout } from '../types/domain';
import { canonicalWeeklyAthleteEditStateFrom } from './canonicalWeeklyAthleteEditState';
import type { ActiveConstraint } from '../store/coachUpdatesStore';
import { legalAutomaticAdditionCandidates } from '../utils/addExerciseCandidates';
import { resolveTapSwapEnvironment, assessTapSwapCandidateSafety } from '../utils/tapSwapHierarchy';
import { buildGenerationConstraintContext } from '../utils/generationConstraints';
import { buildAutomaticStrengthSupportRow } from '../utils/sessionBuilder';
import { getSessionComponentRows } from '../utils/sessionComponents';
import { exerciseIsAvailableWith } from '../data/exerciseEquipmentRequirement';
import { exerciseProgrammingAllows } from '../utils/exerciseFilter';
import { classifyPoolSlot } from '../data/exercisePoolsStrength';
import type { PoolExercise } from '../data/exercisePools';
import { resolveComposedDose } from './composedDose';
import { createAutomaticWeeklyExerciseSelector } from './automaticWeeklyExerciseSelection';
import { footballRobustnessCategoriesForExercise, suppliesAlternativeHamstringWork, weeklyLegStrengthCandidates } from './footballRobustnessFoundation';
import { stableDecisionOrder } from './stableDecisionDiversity';
import { completeWeeklyCore } from './canonicalWeeklyPlaneCompletion';
import { applyStrengthDeloadToExercises, type DeloadWeekPolicy } from './deloadWeekRules';
import { getExerciseTags } from '../data/exerciseTags';

/** R-394 (Sam, 2026-09-09): in-season the Nordic itself is owed; a curl does not stand in. */
export type WeeklyLegCoverageCategory = 'nordic' | 'hamstring_eccentric_or_isometric' | 'calf_or_soleus';

/** R-312's typed Nordic marker, never the word in a name (Reverse Nordic Curl is a quad exercise). */
export function isNordicExercise(name: string): boolean {
  return !!getExerciseTags(name)?.nordicCurlVariant
    && footballRobustnessCategoriesForExercise(name).includes('hamstring_eccentric_or_isometric');
}

function suppliesCoverage(name: string, category: WeeklyLegCoverageCategory): boolean {
  return category === 'nordic' ? isNordicExercise(name)
    : footballRobustnessCategoriesForExercise(name).includes(category);
}

function coverageCandidates(category: WeeklyLegCoverageCategory): readonly string[] {
  return category === 'nordic'
    ? weeklyLegStrengthCandidates('hamstring_eccentric_or_isometric').filter(isNordicExercise)
    : weeklyLegStrengthCandidates(category);
}

/** The Nordic minimum is in-season only (R-394); the year-round pair is R-393. */
export function weeklyLegCoverageCategories(seasonPhase: OnboardingData['seasonPhase']): readonly WeeklyLegCoverageCategory[] {
  return seasonPhase === 'In-season'
    ? ['nordic', 'hamstring_eccentric_or_isometric', 'calf_or_soleus']
    : ['hamstring_eccentric_or_isometric', 'calf_or_soleus'];
}

export interface WeeklyLegCoverageInput {
  weekStartISO: string;
  workoutsByDate: Readonly<Record<string, Workout>>;
  profile: OnboardingData;
  activeConstraints?: readonly ActiveConstraint[];
  gameDates?: readonly string[];
  placeableFromISO?: string;
  excludedExerciseNames?: readonly string[];
  excludedExerciseNamesByDate?: Readonly<Record<string, readonly string[]>>;
  /** Supply when checking an accepted week, after deliberate session edits. */
  userRemovalConstraints?: readonly UserRemovalConstraint[];
  /** Consume the compiler's dated answer; workout labels cannot author a dose. */
  dosePolicyForDate?: (dateISO: string) => DeloadWeekPolicy | null;
}

/** Complete missing categories only on existing automatic strength days. */
export function completeWeeklyLegCoverage(args: WeeklyLegCoverageInput) {
  let workoutsByDate = args.workoutsByDate;
  const receipts: Array<{category:string; status:'present'|'added'|'unavailable'|'athlete_removed'; dateISO?:string; exercise?:string}> = [];
  const edits = canonicalWeeklyAthleteEditStateFrom({weekStartISO:args.weekStartISO,constraints:args.userRemovalConstraints});
  // In-season the Nordic is answered FIRST, so the Nordic it places also
  // satisfies the ordinary hamstring pair; a curl-first order would add both.
  for (const category of weeklyLegCoverageCategories(args.profile.seasonPhase)) {
    const rows = Object.values(workoutsByDate).flatMap(w => w.exercises).filter(r =>
      r.prescribedSets > 0 && !r.unavailableForInjury && !r.optionalNoPenalty);
    if (rows.some(row => suppliesCoverage(row.exercise.name, category))) {
      receipts.push({category,status:'present'}); continue;
    }
    // Credit only the category removed by the latest accepted deletion on that
    // date. Moves, other weeks, restored decisions and unrelated removals do not
    // waive automatic coverage. The automatic compiler runs before these edits.
    const removed = edits.placements.some(placement => {
      const decision = args.userRemovalConstraints?.find(item => item.id === placement.constraintId);
      if (!decision || decision.mutationKind === 'move'
        || !['whole_session','strength_component'].includes(decision.scope)) return false;
      const carries = (workout: Workout | null) => workout?.exercises.some(row =>
        row.prescribedSets > 0 && !row.unavailableForInjury && !row.optionalNoPenalty
        && suppliesCoverage(row.exercise.name, category));
      return carries(decision.originalWorkout) && !carries(decision.remainingWorkout);
    });
    if (removed) { receipts.push({category,status:'athlete_removed'}); continue; }
    const dates = Object.entries(workoutsByDate).filter(([date,workout]) =>
      (!args.placeableFromISO || date >= args.placeableFromISO)
      && !workout.athletePlacement && !workout.composedOptionalKind
      && workout.workoutType !== 'Game'
      && getSessionComponentRows(workout).strengthRows.length > 0)
      .sort(([a,wa],[b,wb]) => getSessionComponentRows(wa).strengthRows.reduce((n,r)=>n+r.prescribedSets,0)
        - getSessionComponentRows(wb).strengthRows.reduce((n,r)=>n+r.prescribedSets,0) || a.localeCompare(b));
    // Equipment must be checked against choices this athlete can actually be
    // prescribed. An experience-blocked unassisted Nordic does not make a
    // missing curl machine available. Injury/fixture restrictions stay separate.
    const normalHamstringChoices = weeklyLegStrengthCandidates('hamstring_eccentric_or_isometric')
      .filter(name => exerciseProgrammingAllows(name,{experienceLevel:args.profile.experienceLevel,route:'automatic'}));
    const kneeFlexionOnKit = dates.some(([date]) => {
      const environment = resolveTapSwapEnvironment({date,profile:args.profile,activeConstraints:args.activeConstraints ?? []});
      return normalHamstringChoices.some(name =>
        exerciseIsAvailableWith(name,environment.availableEquipmentTags));
    });
    const equipmentRequiresAlternative = normalHamstringChoices.length > 0 && !kneeFlexionOnKit;
    const candidatesByDate = dates.map(([date,workout]) => {
      const environment = resolveTapSwapEnvironment({date,profile:args.profile,
        activeConstraints:args.activeConstraints ?? [],gameDates:args.gameDates});
      const health = buildGenerationConstraintContext({activeConstraints:args.activeConstraints,todayISO:date});
      const exempt = environment.medicalStop || health?.readiness?.deloaded || health?.readiness?.sessionsOptional || !!health?.illness;
      const names = coverageCandidates(category);
      const candidates = exempt ? [] : legalAutomaticAdditionCandidates({environment,profile:args.profile,
        leaf:'lower_accessories', existingExerciseNames:workout.exercises.map(r=>r.exercise.name)})
        .filter(c => (names.includes(c.name) || (category==='hamstring_eccentric_or_isometric' && equipmentRequiresAlternative
          && suppliesAlternativeHamstringWork(c.name))) && !args.excludedExerciseNames?.includes(c.name)
          && !args.excludedExerciseNamesByDate?.[date]?.includes(c.name)
          && assessTapSwapCandidateSafety(c.name,environment,{route:'automatic'}).safe
          && injuryAllowsContextExercise(c.name,{onboardingData:args.profile,injuries:args.profile.injuries??[],equipmentTags:environment.availableEquipmentTags,activeConstraints:args.activeConstraints},date));
      return {date,workout,environment,candidates};
    });
    if(category==='hamstring_eccentric_or_isometric' && equipmentRequiresAlternative
      && rows.some(row=>suppliesAlternativeHamstringWork(row.exercise.name))) {
      receipts.push({category,status:'present'}); continue;
    }
    let added=false;
    for(const {date,workout,environment,candidates} of candidatesByDate) {
      const selector=createAutomaticWeeklyExerciseSelector(rows.map(r=>r.exercise.name));
      const ordered=stableDecisionOrder(candidates,`weekly-leg:${args.weekStartISO}:${category}`,c=>c.name);
      const choice=selector.chooseFallback({sameCategory:ordered.map(c=>c.name),accessories:[],prehab:[],
        requestedSlot:'football_robustness',dayKind:workout.composedDayShape??null,requestedAsMain:false});
      const candidate=ordered.find(c=>c.name===choice?.identity);
      if(!candidate)continue;
      const dose=resolveComposedDose({identity:candidate.name,isMainLift:false,
        poolSlot:classifyPoolSlot(candidate.name)?.slot??null,seasonPhase:args.profile.seasonPhase,offseasonSubphase:null,
        authoredFallback:[candidate.sets,candidate.repsMin,candidate.repsMax]});
      const entry={...candidate,...dose,id:`weekly-leg-${candidate.name}`,equipment:[],contraindications:[],fatigue:'low'} as PoolExercise;
      let row=buildAutomaticStrengthSupportRow(entry,workout.id,Math.max(0,...workout.exercises.map(r=>r.exerciseOrder))+1,'football_robustness');
      row={...row,id:`${workout.id}-weekly-leg-${category}`,prescribedWeightKg:candidate.weightKg??undefined};
      const policy=args.dosePolicyForDate?.(date) ?? null;
      if(policy)row=applyStrengthDeloadToExercises([row],{...policy,preserveExerciseSelection:true})[0];
      workoutsByDate={...workoutsByDate,[date]:{...workout,exercises:[...workout.exercises,row]}};
      receipts.push({category,status:'added',dateISO:date,exercise:candidate.name});added=true;break;
    }
    if(!added)receipts.push({category,status:'unavailable'});
  }
  return {workoutsByDate,receipts};
}

/** Existing final support stage shared by generation, fixture and injury paths. */
export function completeWeeklySupport(args: WeeklyLegCoverageInput) {
  const core=completeWeeklyCore(args);
  return completeWeeklyLegCoverage({...args,workoutsByDate:core.workoutsByDate});
}
