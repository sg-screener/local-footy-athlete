/**
 * lighterDayTrim — the Bible §9 "tired today" / Slice 4.2 `slight` tier transform,
 * verbatim: volume-first, KEEP THE MAIN LIFT AT WEIGHT.
 *
 * Methodology (docs/LFA_PROGRAMMING_BIBLE.md §9 lines 2494-2503;
 * docs/SLICE_4_2_READINESS_SUBSTITUTION_PLAN_2026-07-09.md C1 `slight`):
 *   • Reduce volume — halve accessory sets (ceil(n/2), floor 1), the same
 *     halving rule as the existing go-lighter transforms (applyReduceStrengthBlock
 *     / lightenSession).
 *   • Remove the hard finisher.
 *   • Swap hard conditioning for easy.
 *   • Keep the main lift if it can still move well — main-strength rows are
 *     byte-identical (sets AND weight). NEVER reduced or removed at this tier.
 *   • Session stays intact (never collapses to rest); session count unchanged.
 *
 * This transform does not itself decide load progression — see the progression
 * guard: it is applied as a dateOverride, which the baseline builder
 * (`buildLastPerformedWeights`, which reads only `weightOverrides`) never reads,
 * so a trimmed day cannot drag the athlete's future baseline down.
 */

import type { Workout, WorkoutExercise } from '../types/domain';

export interface LighterDayTrimResult {
  workout: Workout;
  /** Athlete-facing disclosure lines — one per change actually made. */
  changes: string[];
}

/** A main-strength row is protected. Prefer the canonical §18 role; fall back to
 *  the session's first strength row when role evidence is absent. */
function isMainStrengthRow(row: WorkoutExercise): boolean {
  const role = (row as { section18Evidence?: { role?: string }; section18ConditioningRole?: string })
    .section18Evidence?.role ?? (row as { section18ConditioningRole?: string }).section18ConditioningRole;
  return role === 'main_strength';
}

function halveSets(sets: number): number {
  return Math.max(1, Math.ceil(sets / 2));
}

/**
 * Apply the `slight`-tier lighter-day trim to a single day's workout. Pure —
 * returns a new workout plus the list of changes made (empty list = nothing to
 * trim, e.g. a rest/recovery day).
 */
export function applyLighterDayTrim(workout: Workout): LighterDayTrimResult {
  const changes: string[] = [];
  const rows = (workout.exercises ?? []) as WorkoutExercise[];

  // If no §18 role evidence anywhere, protect the first strength row positionally
  // (Slice 4.2: "never remove the session's first/main lift").
  const anyRoleEvidence = rows.some((row) => isMainStrengthRow(row) ||
    !!(row as { section18Evidence?: unknown }).section18Evidence);
  const firstStrengthIndex = rows.findIndex((row) =>
    (row.prescribedWeightKg ?? 0) >= 0 && (row.prescribedSets ?? 0) > 0);

  const trimmedExercises = rows.map((row, index) => {
    const isMain = anyRoleEvidence ? isMainStrengthRow(row) : index === firstStrengthIndex;
    if (isMain) return row; // main lift kept byte-identical (sets AND weight)
    const sets = Number(row.prescribedSets ?? 0);
    if (!Number.isFinite(sets) || sets <= 1) return row; // nothing to halve
    const nextSets = halveSets(sets);
    if (nextSets === sets) return row;
    changes.push(`${row.exercise?.name ?? 'Accessory'} ${sets}→${nextSets} sets`);
    return { ...row, prescribedSets: nextSets };
  });

  let conditioningBlock = workout.conditioningBlock;
  let hasCombinedConditioning = workout.hasCombinedConditioning;

  // Remove the hard finisher.
  if (conditioningBlock?.attachedKind === 'finisher') {
    changes.push('Dropped the finisher');
    conditioningBlock = undefined;
    hasCombinedConditioning = false;
  } else if (conditioningBlock && conditioningBlock.intent === 'high-intensity') {
    // Ease hard conditioning → easy aerobic.
    changes.push('Eased the hard conditioning');
    conditioningBlock = { ...conditioningBlock, intent: 'aerobic' };
  }

  const accessoryHalved = changes.some((line) => /→/.test(line));
  const summaryChanges = accessoryHalved && !changes.some((l) => /volume/i.test(l))
    ? ['Trimmed accessory volume', ...changes.filter((l) => !/→/.test(l))]
    : changes;

  return {
    workout: {
      ...workout,
      exercises: trimmedExercises,
      conditioningBlock,
      hasCombinedConditioning,
    },
    changes: summaryChanges,
  };
}
