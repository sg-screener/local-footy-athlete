/**
 * Canonical typed evidence for the Section 18 observer.
 *
 * Text/visible identity is allowed inside the existing canonical row owner,
 * but the independent evaluator consumes only the serialised evidence emitted
 * here. Legacy hydration can explicitly preserve unknown evidence.
 */

import type { Workout, WorkoutExercise } from '../types/domain';
import { classifyGeneratedWorkoutRow } from './generatedWorkoutRowClassification';
import { normalizeStrengthIntent } from './strengthPatternContributions';
import type {
  Section18ConditioningRole,
  Section18ConditioningStress,
  WorkoutExerciseSection18Evidence,
  WorkoutSection18Evidence,
} from './weeklyExposureContractV2';
import { countingIndices } from './sessionRowCounting';

export type Section18EvidenceMode = 'infer' | 'preserve_legacy_unknown';

function rowName(row: WorkoutExercise): string {
  return String(row.exercise?.name ?? row.exerciseId ?? '').trim();
}

function inferredRowEvidence(
  row: WorkoutExercise,
  index: number,
): WorkoutExerciseSection18Evidence {
  // AUTHORED ROLE FIRST — the same ordering rule the taxonomy's choke point
  // enforces, one layer down. `classifyGeneratedWorkoutRow` reads the NAME, and
  // `Explosive Push-up` classifies as a main lift; letting it answer here would
  // stamp main-strength §18 evidence on power work and hand it back every credit
  // its fence denies. Power is the only role with a Section 18 spelling today;
  // the rest still come from the classifier.
  if (row.role === 'power') {
    return {
      protocolVersion: 1,
      role: 'power',
      strengthPattern: null,
      mainStrengthPattern: null,
      provenance: 'canonical_row_classifier',
    };
  }
  const classification = classifyGeneratedWorkoutRow({
    name: rowName(row),
    sets: row.prescribedSets,
    repsMax: row.prescribedRepsMax,
    index,
  });
  const role: WorkoutExerciseSection18Evidence['role'] = classification.kind === 'recovery_addon'
    ? 'recovery_support'
    : classification.kind === 'strength_main'
      ? 'main_strength'
      : classification.kind;
  return {
    protocolVersion: 1,
    role,
    strengthPattern: classification.mainPattern,
    mainStrengthPattern: classification.kind === 'strength_main'
      ? classification.mainPattern
      : null,
    provenance: 'canonical_row_classifier',
  };
}

function hasConditioning(workout: Workout): boolean {
  return !!workout.conditioningBlock?.options.length ||
    !!workout.conditioningCategory ||
    workout.hasCombinedConditioning === true;
}

function conditioningRole(workout: Workout): Section18ConditioningRole {
  if (!hasConditioning(workout)) return 'none';
  if (
    workout.section18ConditioningRole === 'required_core' ||
    workout.section18ConditioningRole === 'planner_selected_core'
  ) {
    // The detailed planner owner remains serialised on the workout. Canonical
    // evidence keeps the existing aggregate `core` role consumed by the
    // unchanged Section 18 safety finaliser and effective-week observer.
    return 'core';
  }
  if (workout.section18ConditioningRole) return workout.section18ConditioningRole;
  if (workout.sessionTier === 'recovery') return 'optional_recovery_aerobic';
  if (workout.sessionTier === 'optional' && workout.conditioningCategory === 'aerobic_base') {
    return 'optional_flush';
  }
  if (workout.sessionTier === 'optional') return 'legacy_unknown';
  return 'planner_selected_core';
}

/**
 * The categories a stored `Workout` can actually carry. **It is an INLINE union
 * in `domain.ts`, not `AthleteConditioningCategory`** — the same word-list
 * spelled twice, once named and once by hand, differing by `recovery_flush`.
 * Deriving the key type from the field means this table cannot drift from the
 * field it reads, whichever of the two lists moves.
 */
type WorkoutConditioningCategory = NonNullable<Workout['conditioningCategory']>;

/**
 * CATEGORY → STRESS, TOTAL AND COMPILER-ENFORCED — SEAT_INBOX item 61.
 *
 * **THIS WAS A `switch` WITH A `default: return 'unknown'`**, and that is item
 * 61's defect in its own words: *"the gap is SILENT — an unmapped value becomes
 * an empty result or a plausible neighbour instead of an error."* It covered 5
 * of 6 categories, so `cod_decel` fell through the default and came back
 * `'unknown'` with nothing to say so. **A `Record<>` over the union makes the
 * compiler the enforcer; a switch with a default cannot.**
 *
 * ⚠ **OUTPUT-INERT ON PURPOSE. EVERY ANSWER BELOW IS WHAT THE SWITCH ALREADY
 * RETURNED, `cod_decel` INCLUDED.** Its `'unknown'` is not a new opinion — it is
 * the old default, said out loud. **Changing it is a RULING, not a tidy-up**:
 * `cod_decel` is tier `A` in Sam's own authored `TIER_FOR_QUALITY`, which would
 * argue `'hard'`, and R-078 (*"leave it"*, asked directly with the number in
 * front of him) settles the neighbouring COD question and carries **"do not
 * re-open without a new ruling from Sam"** after FOUR reverted attempts. So the
 * gap is now NAMED and STILL OPEN rather than quietly filled by this seat.
 */
const CONDITIONING_STRESS_BY_CATEGORY: Readonly<Record<
  WorkoutConditioningCategory,
  (workout: Workout) => Section18ConditioningStress
>> = {
  vo2: () => 'hard',
  glycolytic: () => 'hard',
  sprint: () => 'hard',
  tempo: () => 'moderate',
  // Section 18 explicitly treats controlled long slow aerobic as moderate.
  aerobic_base: (workout) => (workout.sessionTier === 'recovery' ? 'light' : 'moderate'),
  cod_decel: () => 'unknown',
};

function conditioningStress(
  workout: Workout,
  role: Section18ConditioningRole,
): Section18ConditioningStress {
  if (role === 'none') return 'unknown';
  if (role === 'optional_flush' || role === 'optional_recovery_aerobic') return 'light';
  const category = workout.conditioningCategory;
  // A workout with NO category is a genuine absence, not an unmapped member.
  if (!category) return 'unknown';
  return CONDITIONING_STRESS_BY_CATEGORY[category](workout);
}

function legacyUnknownWorkoutEvidence(workout: Workout): WorkoutSection18Evidence {
  return {
    protocolVersion: 1,
    conditioningRole: hasConditioning(workout) ? 'legacy_unknown' : 'none',
    conditioningStress: hasConditioning(workout) ? 'unknown' : 'unknown',
    provenance: 'legacy_unknown',
  };
}

/** Attach or preserve typed evidence without changing prescriptions or layout. */
export function withSection18WorkoutEvidence(
  workout: Workout,
  mode: Section18EvidenceMode,
  provenance: WorkoutSection18Evidence['provenance'] = 'planner_and_canonical_content',
): Workout {
  if (mode === 'preserve_legacy_unknown') {
    return {
      ...workout,
      exercises: (workout.exercises ?? []).map((row) => row.section18Evidence
        ? row
        : {
            ...row,
            section18Evidence: {
              protocolVersion: 1,
              role: 'legacy_unknown',
              strengthPattern: null,
              mainStrengthPattern: null,
              provenance: 'legacy_unknown',
            },
          }),
      section18Evidence: workout.section18Evidence ?? legacyUnknownWorkoutEvidence(workout),
    };
  }

  const role = conditioningRole(workout);
  const plannedPatterns = workout.strengthIntent
    ? new Set(normalizeStrengthIntent(workout.strengthIntent).effectivePatterns)
    : null;
  const creditedPatterns = new Set<string>();
  // Position among COUNTED work — a leading power row must not renumber the
  // lifts behind it into losing their main-lift claim.
  const evidenceIndices = countingIndices(workout.exercises ?? []);
  return {
    ...workout,
    exercises: (workout.exercises ?? []).map((row, index) => {
      // ⚠ A COMPOSED DECLARATION IS NEVER RE-INFERRED AND NEVER DEMOTED.
      //
      // Both halves below are wrong for a composed row. `inferredRowEvidence`
      // reads the exercise NAME, so `Bodyweight Squat` and `Single-Arm DB Row`
      // come back `strength_accessory` and a dumbbell or bodyweight athlete
      // ends up with zero main lifts and a refused week. The demotion under it
      // then asks the PLAN which patterns the day carries — and the composer's
      // full-body shape (R-093) deliberately carries patterns the plan's own
      // upper-only answer never named, so every lower lift would be demoted by
      // the very decision Sam overruled.
      if (row.section18Evidence?.provenance === 'composer_declaration') {
        return row;
      }
      let evidence = inferredRowEvidence(row, evidenceIndices[index]);
      if (plannedPatterns && evidence.role === 'main_strength') {
        const pattern = evidence.mainStrengthPattern;
        const ownsContribution = !!pattern &&
          plannedPatterns.has(pattern) &&
          !creditedPatterns.has(pattern);
        if (ownsContribution) {
          creditedPatterns.add(pattern);
        } else {
          evidence = {
            ...evidence,
            role: 'strength_accessory',
            mainStrengthPattern: null,
          };
        }
      }
      return { ...row, section18Evidence: evidence };
    }),
    section18Evidence: {
      protocolVersion: 1,
      conditioningRole: role,
      conditioningStress: conditioningStress(workout, role),
      provenance,
    },
  };
}
