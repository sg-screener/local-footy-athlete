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

import { splitSessionName } from './sessionNaming';
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

// Taxonomy membership by name. Checked in this order — Flush Out before
// the generic easy patterns (flush names contain "easy"), Sprint before
// Hard ("Max Effort Sprint Accumulation" would otherwise match "max").
const FLUSH_OUT = /flush\s*out|easy aerobic flush/i;
const SPRINT = /sprint/i;
const HARD =
  /emom|metcon|tabata|mas\s*15|repeat|fartlek|4\s*x\s*4|vo2|1km|work.?capacity/i;
const AEROBIC =
  /nasal|zone\s*2|easy (?:bike|row|ski|swim|spin)|flush run|long run|aerobic/i;

function conditioningTextFor(workout: WeeklyDisplayWorkout): string {
  const names = (workout.exercises ?? [])
    .map((row) => row?.exercise?.name ?? '')
    .filter(Boolean);
  return [workout.name ?? '', ...names].join(' ');
}

/** Category for a conditioning-family workout, from its name + exercise
 *  names (registry + generation share these), the engine's internal
 *  energy-system classification as backstop, then intensity. */
export function classifyConditioningWorkout(
  workout: WeeklyDisplayWorkout,
): ConditioningDisplayCategory {
  const text = conditioningTextFor(workout);

  if (FLUSH_OUT.test(text)) return 'Flush Out';
  if (SPRINT.test(text)) return 'Sprint Work';
  if (HARD.test(text)) return 'Hard Conditioning';
  if (AEROBIC.test(text)) return 'Aerobic Base';

  // Engine classification (per-exercise template names).
  for (const row of workout.exercises ?? []) {
    const category = row?.exercise?.name
      ? getTemplateCategory(row.exercise.name)
      : null;
    if (category === 'sprint') return 'Sprint Work';
    if (category === 'vo2' || category === 'glycolytic') return 'Hard Conditioning';
    if (category === 'aerobic_base') return 'Aerobic Base';
  }
  const workoutCategory = workout.conditioningCategory;
  if (workoutCategory === 'sprint') return 'Sprint Work';
  if (workoutCategory === 'vo2' || workoutCategory === 'glycolytic') {
    return 'Hard Conditioning';
  }

  return 'Aerobic Base';
}

/** Is this a STANDALONE conditioning day (not combined, not recovery)? */
function isStandaloneConditioning(workout: WeeklyDisplayWorkout): boolean {
  if (workout.hasCombinedConditioning) return false;
  const workoutType = String(workout.workoutType ?? '');
  if (workoutType === 'Recovery') return false;
  return (
    /conditioning|aerobic|tempo|speed|hiit|flush|sprint|interval|run|metcon|mas/i.test(
      workoutType,
    ) || !!workout.conditioningFlavour
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
