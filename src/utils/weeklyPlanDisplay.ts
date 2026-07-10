/**
 * weeklyPlanDisplay — SINGLE owner of what a day is CALLED on the weekly
 * plan (Sam's taxonomy, signed off 2026-07-04).
 *
 * The weekly plan speaks in categories; the session screen speaks in
 * specifics. "Erg EMOM — 10-15 cal" is what you DO (inside the session);
 * "Hard Conditioning" is what your week LOOKS like (the plan row).
 *
 * Weekly labels:
 *   Strength      — Full Body Strength, Upper/Lower Body Strength,
 *                   Upper Push, Upper Pull, Lower Squat, Lower Hinge
 *                   (canonical names pass through unchanged)
 *   Accessories   — Prehab & Accessories renders as "Accessories";
 *                   Gunshow keeps its name (it earned it)
 *   Fixed days    — Game Day, Team Training, Rest (unchanged)
 *   Recovery      — any recovery-tier session renders as "Recovery"
 *   Conditioning  — one of four categories:
 *     Aerobic Base       easy engine building (nasal runs, zone 2, easy
 *                        erg/swim work)
 *     Flush Out          rejuvenation only (flush-out intervals, easy
 *                        aerobic flush)
 *     Sprint Work        quality speed, tiny volume, never fatigued
 *     Hard Conditioning  VO2 / lactate / work capacity — the stuff that
 *                        genuinely hurts
 *
 * Combined days keep the "<Strength title> + <conditioning category>"
 * pattern (context label handled by getConditioningContextLabel, whose
 * flavour map aligns with these categories).
 */

import type { Workout, WorkoutType } from '../types/domain';
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';
import { hasConditioningText, splitSessionName } from './sessionNaming';
import { getTemplateCategory } from './sessionBuilder';

export type ConditioningDisplayCategory =
  | 'Aerobic Base'
  | 'Flush Out'
  | 'Sprint Work'
  | 'Hard Conditioning';

interface WeeklyDisplayWorkout {
  name?: string | null;
  workoutType?: string | null;
  sessionTier?: string | null;
  hasCombinedConditioning?: boolean;
  conditioningFlavour?: string | null;
  conditioningCategory?: string | null;
  exercises?: Array<{ exercise?: { name?: string } | null } | null> | null;
}

// Flush Out is a weekly-plan presentation distinction inside the kernel's
// aerobic_base category, not a separate Bible exposure classification.
const FLUSH_OUT = /flush\s*out|easy aerobic flush/i;
// Old work-capacity cards can lack the typed conditioningCategory that new
// templates carry. Feed that one legacy display signal into the adapter.
const LEGACY_WORK_CAPACITY = /\bemom\b|work.?capacity/i;

function conditioningTextFor(workout: WeeklyDisplayWorkout): string {
  const names = (workout.exercises ?? [])
    .map((row) => row?.exercise?.name ?? '')
    .filter(Boolean);
  return [workout.name ?? '', ...names].join(' ');
}

function templateCategoryFor(
  workout: WeeklyDisplayWorkout,
): Workout['conditioningCategory'] | undefined {
  const names = [
    workout.name ?? '',
    ...(workout.exercises ?? []).map((row) => row?.exercise?.name ?? ''),
  ].filter(Boolean);
  for (const name of names) {
    const category = getTemplateCategory(name);
    if (category) return category;
  }
  return undefined;
}

function asVisibleWorkout(
  input: WeeklyDisplayWorkout,
  assumeConditioning: boolean,
): Workout {
  const name = String(input.name ?? '').trim() || 'Conditioning';
  const text = conditioningTextFor(input);
  const typedCategory = input.conditioningCategory as Workout['conditioningCategory'] | undefined;
  const conditioningCategory =
    typedCategory ??
    templateCategoryFor(input) ??
    (LEGACY_WORK_CAPACITY.test(text) ? 'glycolytic' : undefined);
  const hasConditioningSignal =
    assumeConditioning ||
    !!conditioningCategory ||
    !!input.conditioningFlavour ||
    hasConditioningText(text);
  const typedStandaloneConditioning =
    !input.hasCombinedConditioning &&
    (!!conditioningCategory || !!input.conditioningFlavour);
  const workoutType = (
    input.sessionTier === 'recovery' || input.workoutType === 'Recovery'
      ? 'Recovery'
      : typedStandaloneConditioning
        ? 'Conditioning'
        : input.workoutType ?? (hasConditioningSignal ? 'Conditioning' : 'Strength')
  ) as WorkoutType;
  const hardConditioning =
    conditioningCategory === 'vo2' ||
    conditioningCategory === 'glycolytic' ||
    conditioningCategory === 'sprint';

  return {
    id: 'weekly-plan-display-classification',
    microcycleId: 'weekly-plan-display-classification',
    dayOfWeek: 1,
    name,
    description: name,
    durationMinutes: 30,
    intensity: hardConditioning ? 'High' : input.sessionTier === 'recovery' ? 'Light' : 'Moderate',
    workoutType,
    sessionTier: input.sessionTier as Workout['sessionTier'],
    hasCombinedConditioning: input.hasCombinedConditioning,
    conditioningFlavour: input.conditioningFlavour as Workout['conditioningFlavour'],
    conditioningCategory,
    exercises: (input.exercises ?? []).filter(Boolean) as Workout['exercises'],
    createdAt: '',
    updatedAt: '',
  };
}

function conditioningClassification(
  workout: WeeklyDisplayWorkout,
  assumeConditioning: boolean,
) {
  const visibleWorkout = asVisibleWorkout(workout, assumeConditioning);
  const hasStructuredClassification =
    !!workout.conditioningCategory ||
    !!workout.conditioningFlavour ||
    !!templateCategoryFor(workout) ||
    LEGACY_WORK_CAPACITY.test(conditioningTextFor(workout));
  if (hasStructuredClassification) {
    return classifyVisibleSession(visibleWorkout);
  }

  // Legacy display inputs can have only a descriptive name plus the generic
  // Conditioning type. Probe the name through the kernel before its generic
  // intensity fallback; typed fields above always take priority.
  const nameClassification = classifyVisibleSession({
    ...visibleWorkout,
    workoutType: 'Technical',
    conditioningCategory: undefined,
    conditioningFlavour: undefined,
  });
  if (nameClassification.units.some((unit) =>
    unit.category === 'aerobic_base' ||
    unit.category === 'tempo_conditioning' ||
    unit.category === 'hard_conditioning' ||
    unit.category === 'sprint'
  )) {
    return nameClassification;
  }
  return classifyVisibleSession(visibleWorkout);
}

/** Category for a conditioning-family workout, from its name + exercise
 *  names (registry + generation share these), the engine's internal
 *  energy-system classification as backstop, then intensity. */
export function classifyConditioningWorkout(
  workout: WeeklyDisplayWorkout,
): ConditioningDisplayCategory {
  const text = conditioningTextFor(workout);

  if (FLUSH_OUT.test(text)) return 'Flush Out';
  const categories = conditioningClassification(workout, true).categories;
  if (categories.includes('sprint')) return 'Sprint Work';
  if (categories.includes('hard_conditioning')) return 'Hard Conditioning';

  return 'Aerobic Base';
}

/** Is this a STANDALONE conditioning day (not combined, not recovery)? */
function isStandaloneConditioning(workout: WeeklyDisplayWorkout): boolean {
  if (workout.hasCombinedConditioning) return false;
  if (workout.workoutType === 'Recovery' || workout.sessionTier === 'recovery') return false;
  return conditioningClassification(workout, false).units.some((unit) =>
    unit.category === 'aerobic_base' ||
    unit.category === 'tempo_conditioning' ||
    unit.category === 'hard_conditioning' ||
    unit.category === 'sprint'
  );
}

/**
 * Category label for the conditioning HALF of a combined day — the
 * "+ Hard Conditioning" context under a strength title. Classifies from
 * the conditioning block's option titles (the real sessions), falling
 * back to the flavour for legacy combined days.
 */
export function combinedConditioningCategoryLabel(
  workout: WeeklyDisplayWorkout & {
    conditioningBlock?: {
      options?: Array<{ title?: string; description?: string }>;
    } | null;
    coachAddedConditioningLabel?: string | null;
  },
): ConditioningDisplayCategory | null {
  if (!workout?.hasCombinedConditioning) return null;
  const optionText = (workout.conditioningBlock?.options ?? [])
    .map((option) => `${option.title ?? ''} ${option.description ?? ''}`)
    .join(' ');
  const text = `${workout.coachAddedConditioningLabel ?? ''} ${optionText}`.trim();
  return classifyConditioningWorkout({
    name: text || workout.conditioningFlavour || 'aerobic',
  });
}

/**
 * The title a workout shows on the WEEKLY PLAN. Strength splits, games
 * and team days pass through canonically; recovery-tier days read
 * "Recovery"; standalone conditioning reads as its category; the prehab
 * day reads "Accessories". The session screen keeps the real name.
 */
export function weeklyPlanTitle(workout: WeeklyDisplayWorkout): string {
  const name = String(workout.name ?? '').trim();
  if (!name) return '';

  const isRecovery =
    workout.workoutType === 'Recovery' || workout.sessionTier === 'recovery';
  if (isRecovery) return 'Recovery';

  if (name === 'Prehab & Accessories') return 'Accessories';

  if (isStandaloneConditioning(workout)) {
    return classifyConditioningWorkout(workout);
  }

  return splitSessionName(name).title || name;
}
