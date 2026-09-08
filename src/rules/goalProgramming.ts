import { POOL_REGISTRY } from '../data/exercisePools';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import { SET_CEILING } from './weeklyLegality';
/** Bible §5 / §12: goals make a small change to an otherwise valid week.
 * Scheduling, exercise selection, loads and phase limits retain their owners.
 * A single weekly allowance prevents several selected goals stacking increases.
 */
import type { OnboardingData, Workout, WorkoutExercise } from '../types/domain';
import { resolveMotivation } from './motivationGoals';
import { displayReps } from './prescriptionDisplay';
import { getSessionComponentRows } from '../utils/sessionComponents';
import { getExerciseTags } from '../data/exerciseTags';
import { resolveTrainingAgePolicy } from './trainingAgePolicy';

export interface GoalProgrammingContext {
  profile: OnboardingData;
  /** Dates already reduced by fatigue, illness or the phase's recovery week. */
  protectedDays: readonly number[];
  daysToGameByDay: Readonly<Partial<Record<number, number | null>>>;
  /** Active injury work has already been prescribed by the injury owner. */
  injuryAdjusted: boolean;
}

export function applyGoalProgramming(workouts: readonly Workout[], context: GoalProgrammingContext): Workout[] {
  const goals = new Set(resolveMotivation(context.profile).goals);
  const fresh = goals.has('fresh_on_game_day');
  const consistent = goals.has('stay_consistent');
  const muscle = goals.has('build_muscle');
  const performance = goals.has('dominate_level');
  const robustness = goals.has('stay_injury_free');
  if (!fresh && !consistent && !muscle && !performance && !robustness) return [...workouts];
  const candidates: {workout: Workout; row: WorkoutExercise; main: boolean}[] = [];
  for (const workout of workouts) {
    if (workout.sessionTier === 'optional' || context.protectedDays.includes(workout.dayOfWeek)) continue;
    const parts = getSessionComponentRows(workout);
    for (const row of [...parts.strengthRows, ...parts.supportRows]) {
      if (row.athleteAdditionId || (row.prescriptionType && row.prescriptionType !== 'reps')) continue;
      candidates.push({workout, row, main: row.role === 'main_lift' || row.section18Evidence?.role === 'main_strength'});
    }
  }
  const totalSets = candidates.reduce((n, x) => n + x.row.prescribedSets, 0);
  const totalReps = candidates.reduce((n, x) => n + x.row.prescribedSets * (displayReps(x.row.prescribedRepsMin, x.row.prescribedRepsMax) ?? 0), 0);
  let setAllowance = Math.floor(totalSets * 0.10);
  let repAllowance = Math.floor(totalReps * 0.10);
  const changed = new Map<WorkoutExercise, WorkoutExercise>();
  const lower = (row: WorkoutExercise) => getExerciseTags(row.exercise.name)?.region === 'lower';
  const robustnessNames = new Set([
    ...POOL_REGISTRY.groin_adductors, ...POOL_REGISTRY.calves,
    ...POOL_REGISTRY.lower_prehab, ...POOL_REGISTRY.trunk_anti_rotation,
    ...POOL_REGISTRY.shoulder_health,
  ].map(entry => canonicalExerciseName(entry.name)));
  const support = (row: WorkoutExercise) => getExerciseTags(row.exercise.name)?.movement === 'core'
    || robustnessNames.has(canonicalExerciseName(row.exercise.name));
  // Freshness and manageable volume win when selected alongside an increase.
  if (fresh || consistent) {
    const ordered = [...candidates].sort((a,b) =>
      Number(fresh ? lower(b.row) : !b.main) - Number(fresh ? lower(a.row) : !a.main));
    for (const item of ordered) {
      if (setAllowance <= 0) break;
      if (item.row.prescribedSets <= (item.main ? 2 : 1)) continue;
      changed.set(item.row, {...item.row, prescribedSets: item.row.prescribedSets - 1});
      setAllowance--;
    }
  } else if (context.profile.seasonPhase !== 'In-season' && !context.injuryAdjusted && resolveTrainingAgePolicy(context.profile.experienceLevel).level !== 'new') {
    const eligible = candidates.filter(({workout}) => {
      const gap = context.daysToGameByDay[workout.dayOfWeek];
      return gap == null || gap > 2;
    });
    if (muscle && context.profile.seasonPhase === 'Off-season') {
      // Ten is inside Sam's muscle-goal 6–10 range. Changes are bounded over
      // the week's actual displayed repetitions, not hidden range maxima.
      const ordered = [...eligible].sort((a,b) => Number(a.main)-Number(b.main));
      for (const {row} of ordered) {
        const reps = displayReps(row.prescribedRepsMin, row.prescribedRepsMax);
        if (reps === null || reps < 6 || reps >= 10) continue;
        const extra = (10 - reps) * row.prescribedSets;
        if (extra > repAllowance) continue;
        changed.set(row, {...row, prescribedRepsMin:10, prescribedRepsMax:10});
        repAllowance -= extra;
      }
      // Multiple goals share one allowance; do not also add sets this week.
      if (changed.size) setAllowance = 0;
    }
    if (performance || robustness) {
      for (const item of eligible) {
        if (setAllowance <= 0) break;
        if (!(robustness ? !item.main && support(item.row) : item.main) || item.row.prescribedSets >= 4) continue;
        const parts = getSessionComponentRows(item.workout);
        const daySets = [...parts.strengthRows,...parts.supportRows,...parts.powerRows]
          .reduce((n,row) => n + (changed.get(row) ?? row).prescribedSets,0);
        if (daySets >= SET_CEILING) continue;
        // A combined muscle goal shares its repetition allowance with added
        // sets too; high-rep calf/prehab work cannot bypass the weekly limit.
        const extraReps = displayReps(item.row.prescribedRepsMin,item.row.prescribedRepsMax);
        if (muscle && (extraReps === null || extraReps > repAllowance)) continue;
        changed.set(item.row, {...item.row, prescribedSets:item.row.prescribedSets+1});
        setAllowance--;
        if (muscle) repAllowance -= extraReps ?? 0;
      }
    }
  }
  return workouts.map(workout => ({...workout, exercises:workout.exercises.map(row => changed.get(row) ?? row)}));
}
