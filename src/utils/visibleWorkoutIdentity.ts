import type { Workout, WorkoutType } from '../types/domain';
import { classifyExerciseExposures, type Exposure } from './exposureEngine';
import { projectConditioningVisibleIdentity } from './conditioningVisibleIdentity';
import { getSessionComponentRows } from './sessionComponents';

export interface VisibleWorkoutIdentity {
  title: string;
  subtitle: WorkoutType | string;
  isConditioningOnly: boolean;
}

const CONDITIONING_WORKOUT_TYPES = new Set<string>([
  'Conditioning',
  'Flush-Out',
  'Sprint-Intervals',
  'Hill-Sprints',
  'MAS-Training',
  'Quality-Sprints',
  'MetCon',
  'Flog-Friday',
  'Long-Run',
  '6x1km',
  'Tempo-Run',
]);

const STRENGTH_EXPOSURES = new Set<Exposure>([
  'heavy_lower_strength',
  'heavy_squat',
  'heavy_hinge',
  'knee_dominant',
  'hip_dominant',
  'posterior_chain',
  'hamstring_dominant',
  'loaded_carry',
  'lunge',
  'squat',
  'hinge',
  'horizontal_press',
  'vertical_press',
  'overhead_loading',
  'explosive_push',
  'shoulder_isolation',
  'horizontal_pull',
  'vertical_pull',
  'heavy_pull',
  'grip_heavy',
  'low_load_accessory',
  'max_effort_strength',
  'high_volume_accessory',
]);

const CONDITIONING_EXPOSURES = new Set<Exposure>([
  'easy_erg',
  'hard_erg',
  'running',
  'sprint',
  'high_speed_running',
  'acceleration',
  'change_of_direction',
]);

function exerciseNames(workout: Workout): string[] {
  return (workout.exercises ?? [])
    .map((ex: any) => ex.exercise?.name)
    .filter((name: unknown): name is string => typeof name === 'string' && name.trim().length > 0);
}

function conditioningRows(workout: Workout): any[] {
  return getSessionComponentRows(workout).conditioningRows;
}

function strengthRows(workout: Workout): any[] {
  return getSessionComponentRows(workout).strengthRows;
}

function isConditioningTypedWorkout(workout: Workout): boolean {
  return CONDITIONING_WORKOUT_TYPES.has(workout.workoutType) ||
    (!!workout.conditioningFlavour && !workout.hasCombinedConditioning);
}

function hasVisibleConditioningContent(workout: Workout): boolean {
  const rows = getSessionComponentRows(workout);
  return (workout.conditioningBlock?.options ?? []).length > 0 ||
    rows.conditioningRows.length > 0 ||
    rows.speedRows.length > 0 ||
    isConditioningTypedWorkout(workout);
}

export function isConditioningOnlyWorkout(workout: Workout): boolean {
  /* `'Mobility'` JOINS THE TWO THAT WERE ALREADY HERE (2026-08-21). It split
     off `'Recovery'` when Mobility became its own type, and this line is a
     "never conditioning" guard — a mobility flow is no more conditioning-only
     than a recovery flow was the day before. Leaving it out would have
     re-typed every composed Mobility session as conditioning. */
  if (
    workout.workoutType === 'Recovery' ||
    workout.workoutType === 'Mobility' ||
    workout.workoutType === 'Game'
  ) return false;
  if (
    workout.workoutType === 'Team Training' ||
    (workout as any).isTeamDay === true ||
    /\bteam training\b/i.test(workout.name || '')
  ) {
    return false;
  }

  const names = exerciseNames(workout);
  const hasConditioningType = isConditioningTypedWorkout(workout);
  const nameHintsConditioning = names.some((name) =>
    /\b(zone\s*2|aerobic|conditioning|tempo|interval|run|rower|rowing\s*erg|\brow\b|bike|ski[-\s]?erg|assault\s*bike)\b/i.test(name),
  );
  const hasStrengthContent = strengthRows(workout).length > 0;
  const hasConditioningContent = hasVisibleConditioningContent(workout);

  if (hasConditioningContent && !hasStrengthContent) return true;

  if (!hasConditioningType && !nameHintsConditioning) return false;
  if (names.length === 0) return hasConditioningType;

  let hasConditioningExposure = false;
  for (const name of names) {
    const exposures = classifyExerciseExposures(name);
    if (exposures.some((e) => STRENGTH_EXPOSURES.has(e))) return false;
    if (exposures.some((e) => CONDITIONING_EXPOSURES.has(e))) {
      hasConditioningExposure = true;
    }
  }
  return hasConditioningExposure || hasConditioningType;
}

export function deriveVisibleWorkoutIdentity(workout: Workout): VisibleWorkoutIdentity {
  const isConditioningOnly = isConditioningOnlyWorkout(workout);
  if (!isConditioningOnly) {
    return {
      title: workout.name || workout.workoutType || 'Session',
      subtitle: workout.workoutType || 'Workout',
      isConditioningOnly: false,
    };
  }
  const conditioningIdentity = projectConditioningVisibleIdentity(workout);
  return {
    title: conditioningIdentity?.primaryLabel ?? 'Aerobic Conditioning',
    subtitle: conditioningIdentity?.doseLabel ?? 'Conditioning',
    isConditioningOnly: true,
  };
}

export function normalizeVisibleWorkoutIdentity(workout: Workout): Workout {
  const identity = deriveVisibleWorkoutIdentity(workout);
  const finalRows = getSessionComponentRows(workout);
  const isSpeedOnly = finalRows.speedRows.length > 0
    && finalRows.conditioningRows.length === 0
    && finalRows.strengthRows.length === 0;
  const hasConditioningContent = hasVisibleConditioningContent(workout);
  const hasStrengthContent = strengthRows(workout).length > 0;

  /* ── A CONDITIONING SESSION THAT CARRIES NO CONDITIONING (R-378 fallout) ───
   *
   * ⚠ **`hasVisibleConditioningContent` COUNTS THE TYPE ITSELF AS CONTENT** —
   * `isConditioningTypedWorkout` is one of its arms — so a session typed
   * `Conditioning` vouches for its own conditioning and every repair below is
   * unreachable for it. That circularity is why the husk survived
   * canonicalisation untouched.
   *
   * MEASURED on `female-5-home` week 11: a session named "Aerobic Conditioning"
   * holding Single-Arm DB Row, Dead Bug and Side Plank — no block, no speed, no
   * conditioning row — which `energy_session_content` red-flags as promising an
   * energy session and delivering none. It appeared once the scheduler stopped
   * assigning that day a strength purpose the athlete's injury prohibited: the
   * strength half went, the conditioning label stayed, and completion rows
   * landed on what was left.
   *
   * This asks the ROWS, never the type. A session is what it contains. */
  const carriesRealConditioning = (workout.conditioningBlock?.options ?? []).length > 0
    || finalRows.conditioningRows.length > 0
    || finalRows.speedRows.length > 0;
  if (!carriesRealConditioning && hasStrengthContent
    && (workout.workoutType === 'Conditioning' || workout.hasCombinedConditioning)) {
    const stripped = stripConditioningSuffix(workout.name) || workout.name;
    return {
      ...workout,
      // A strength session still wearing a bare conditioning label is the same
      // lie in a different field, so the label goes too.
      name: looksLikeConditioningLabel(stripped) ? 'Strength' : stripped,
      workoutType: 'Strength' as WorkoutType,
      hasCombinedConditioning: false,
      conditioningFlavour: undefined,
      conditioningCategory: undefined,
      conditioningBlock: undefined,
      coachAddedConditioningLabel: undefined,
    };
  }

  if (!identity.isConditioningOnly) {
    if (!hasConditioningContent && hasStrengthContent && workout.hasCombinedConditioning) {
      return {
        ...workout,
        name: stripConditioningSuffix(workout.name) || workout.name,
        workoutType: workout.workoutType === 'Conditioning'
          ? 'Strength' as WorkoutType
          : workout.workoutType,
        hasCombinedConditioning: false,
        conditioningFlavour: undefined,
        conditioningCategory: undefined,
        conditioningBlock: undefined,
        coachAddedConditioningLabel: undefined,
      };
    }
    return workout;
  }
  if (
    workout.name === identity.title &&
    workout.workoutType === 'Conditioning' &&
    !workout.hasCombinedConditioning
  ) {
    return workout;
  }
  return {
    ...workout,
    name: identity.title,
    workoutType: isSpeedOnly
      ? (workout.workoutType || 'Sprint-Intervals') as WorkoutType
      : 'Conditioning' as WorkoutType,
    hasCombinedConditioning: false,
    coachAddedConditioningLabel: undefined,
  };
}

function stripConditioningSuffix(name: string): string {
  const parts = String(name ?? '').split(' + ').map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) return String(name ?? '').trim();
  const [left, right] = parts;
  if (looksLikeConditioningLabel(right)) return left;
  if (looksLikeConditioningLabel(left)) return right;
  return String(name ?? '').trim();
}

function looksLikeConditioningLabel(value: string): boolean {
  return /\b(?:conditioning|aerobic|flush|zone\s*2|tempo|interval|run|row|rower|bike|sprint|metcon)\b/i.test(value);
}
