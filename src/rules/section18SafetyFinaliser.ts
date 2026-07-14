/**
 * Shared post-canonical Section 18 safety boundary.
 *
 * This is deliberately narrower than the future full Section 18 commit gate.
 * It conforms final visible workouts only to typed injury/readiness/participation
 * safety policy and rejects only unresolved safety contradictions. Phase-table,
 * optional-work, rest-day and equipment findings remain observe-only.
 */

import type { Workout, WorkoutExercise } from '../types/domain';
import { collapseWorkoutToRest, hasMeaningfulWorkoutContent } from '../utils/workoutContent';
import {
  finaliseWorkoutAfterMutation,
  type WorkoutCanonicalisationContext,
} from '../utils/workoutCanonicalisation';
import {
  evaluateSection18EffectiveWeek,
  type Section18EffectiveWeekEvaluation,
  type Section18Finding,
} from './section18EffectiveWeekEvaluator';
import type { WeeklyExposureContractV2 } from './weeklyExposureContractV2';
import type { MainStrengthPattern } from './strengthPatternContributions';

export type Section18SafetyAction =
  | 'prohibited_content_removed'
  | 'power_removed'
  | 'sprint_removed'
  | 'strength_frequency_capped'
  | 'conditioning_frequency_capped'
  | 'sprint_frequency_capped'
  | 'strength_dose_reduced'
  | 'full_pause_collapsed';

export interface Section18SafetyFinaliserResult {
  workouts: Workout[];
  contract: WeeklyExposureContractV2;
  evaluation: Section18EffectiveWeekEvaluation;
  actions: Section18SafetyAction[];
  enforcement: 'safety_only';
}

export class Section18SafetyContradictionError extends Error {
  constructor(public readonly findings: readonly Section18Finding[]) {
    super(`Section 18 safety contradiction: ${findings.map((finding) => finding.code).join(', ')}`);
    this.name = 'Section18SafetyContradictionError';
  }
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function stripMainStrength(workout: Workout): Workout {
  return {
    ...workout,
    exercises: (workout.exercises ?? []).filter((row) =>
      row.section18Evidence?.role !== 'main_strength' &&
      row.section18Evidence?.role !== 'legacy_unknown'),
    planEntryId: undefined,
    strengthIntent: undefined,
    strengthIntentDiagnostics: undefined,
    strengthPatternContributions: undefined,
    powerBlock: undefined,
  };
}

function conditioningRowIds(workout: Workout): Set<string> {
  return new Set((workout.conditioningBlock?.options ?? []).flatMap((option) => option.exerciseIds));
}

function stripConditioning(workout: Workout): Workout {
  const linked = conditioningRowIds(workout);
  return {
    ...workout,
    exercises: (workout.exercises ?? []).filter((row) => !linked.has(row.id)),
    conditioningBlock: undefined,
    conditioningCategory: undefined,
    conditioningFlavour: undefined,
    hasCombinedConditioning: false,
    attachedConditioningKind: undefined,
    coachAddedConditioningLabel: undefined,
  };
}

function reduceStrengthDose(
  rows: readonly WorkoutExercise[],
  setCeiling: number | null,
): WorkoutExercise[] {
  if (setCeiling === null) return [...rows];
  return rows.map((row) => row.section18Evidence?.role === 'main_strength'
    ? { ...row, prescribedSets: Math.min(row.prescribedSets, setCeiling) }
    : row);
}

const SAFE_PATTERN_FALLBACK: Record<MainStrengthPattern, string> = {
  squat: 'Back Squat',
  hinge: 'Romanian Deadlift',
  push: 'Bench Press',
  pull: 'Pull-Ups',
};

function safePatternFallbackRow(
  workout: Workout,
  pattern: MainStrengthPattern,
): WorkoutExercise {
  const name = SAFE_PATTERN_FALLBACK[pattern];
  const id = `${workout.id}:safety-fallback:${pattern}`;
  return {
    id,
    workoutId: workout.id,
    exerciseId: `section18-safe-${pattern}`,
    exerciseOrder: workout.exercises.length + 1,
    prescribedSets: 3,
    prescribedRepsMin: 6,
    prescribedRepsMax: 10,
    prescribedWeightKg: 0,
    restSeconds: 90,
    notes: 'Safe pattern coverage retained while the active reduction remains in force.',
    exercise: {
      id: `section18-safe-${pattern}`,
      name,
      description: name,
      exerciseType: 'Compound',
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: workout.createdAt,
      updatedAt: workout.updatedAt,
    },
    createdAt: workout.createdAt,
    updatedAt: workout.updatedAt,
  };
}

function canonicalContextFor(
  contract: WeeklyExposureContractV2,
  workout: Workout,
  base: WorkoutCanonicalisationContext | undefined,
): WorkoutCanonicalisationContext {
  return {
    ...base,
    phase: base?.phase ?? contract.identity.seasonPhase,
    weekKind: base?.weekKind ?? contract.identity.weekKind,
    planIntentValid: base?.planIntentValid ?? !!workout.planEntryId,
    referenceWorkout: base?.referenceWorkout ?? workout,
    restoreMissingPlanPatterns: false,
    prohibitedStrengthPatterns: contract.safety.prohibitedPatterns,
    prohibitPower: contract.safety.prohibitedPower,
    prohibitSprintHighSpeed: contract.safety.prohibitedSprintHighSpeed,
  };
}

function hasWorkoutSafetyTransformation(contract: WeeklyExposureContractV2): boolean {
  return contract.safety.fullPause ||
    contract.safety.prohibitedPatterns.length > 0 ||
    contract.safety.prohibitedPower ||
    contract.safety.prohibitedPowerFamilies.length > 0 ||
    contract.safety.prohibitedSprintHighSpeed ||
    contract.safety.lighterStrengthRequired;
}

function conformWorkout(args: {
  workout: Workout;
  contract: WeeklyExposureContractV2;
  canonicalContext?: WorkoutCanonicalisationContext;
}): { workout: Workout; actions: Section18SafetyAction[] } {
  const { contract } = args;
  const actions: Section18SafetyAction[] = [];
  if (contract.safety.fullPause) {
    return { workout: collapseWorkoutToRest(args.workout), actions: ['full_pause_collapsed'] };
  }
  // This boundary owns safety conformance only. A healthy, unrestricted week
  // must retain its already-canonical visible identity and prescription.
  if (!hasWorkoutSafetyTransformation(contract)) {
    return { workout: args.workout, actions };
  }
  const before = args.workout;
  const canonical = finaliseWorkoutAfterMutation(before, canonicalContextFor(
    contract,
    before,
    args.canonicalContext,
  ));
  let workout = canonical.workout;
  if (canonical.actions.some((action) =>
    action.kind === 'row_removed' && action.reason.startsWith('section18_prohibited_pattern'))) {
    actions.push('prohibited_content_removed');
  }
  if (
    contract.safety.requiredSafePatterns.length > 0 &&
    mainStrengthSession(before) &&
    !mainStrengthSession(workout)
  ) {
    const pattern = contract.safety.requiredSafePatterns[
      before.dayOfWeek % contract.safety.requiredSafePatterns.length
    ];
    workout = {
      ...workout,
      name: before.name,
      workoutType: before.workoutType === 'Mixed' && workout.conditioningBlock
        ? 'Mixed'
        : 'Strength',
      sessionTier: before.sessionTier,
      intensity: before.intensity,
      planEntryId: undefined,
      strengthIntent: undefined,
      strengthIntentDiagnostics: undefined,
      strengthPatternContributions: undefined,
      exercises: [...(workout.exercises ?? []), safePatternFallbackRow(workout, pattern)],
    };
  }
  if (before.powerBlock && !workout.powerBlock) actions.push('power_removed');
  if (before.speedBlock && !workout.speedBlock) actions.push('sprint_removed');

  if (
    workout.powerBlock &&
    contract.safety.prohibitedPowerFamilies.includes(workout.powerBlock.family)
  ) {
    workout = { ...workout, powerBlock: undefined };
    actions.push('power_removed');
  }

  if (contract.safety.lighterStrengthRequired) {
    const exercises = reduceStrengthDose(
      workout.exercises ?? [],
      contract.safety.meaningfulMainLiftSetCeiling,
    );
    const intensity = contract.safety.strengthIntensityCeiling === 'Light'
      ? 'Light'
      : workout.intensity === 'High' || workout.intensity === 'Maximal'
        ? 'Moderate'
        : workout.intensity;
    if (JSON.stringify(exercises) !== JSON.stringify(workout.exercises) || intensity !== workout.intensity) {
      workout = { ...workout, exercises, intensity };
      actions.push('strength_dose_reduced');
    }
  }

  const final = finaliseWorkoutAfterMutation(workout, canonicalContextFor(
    contract,
    workout,
    args.canonicalContext,
  )).workout;
  return {
    workout: hasMeaningfulWorkoutContent(final) ? final : collapseWorkoutToRest(final),
    actions: unique(actions),
  };
}

/** Apply row/component/dose safety to one workout without inventing a week ledger. */
export function finaliseSection18SafetyWorkout(args: {
  contract: WeeklyExposureContractV2;
  workout: Workout;
  canonicalContext?: WorkoutCanonicalisationContext;
}): { workout: Workout; actions: Section18SafetyAction[] } {
  return conformWorkout(args);
}

function mainStrengthSession(workout: Workout): boolean {
  const rows = workout.exercises ?? [];
  if (rows.some((row) => row.section18Evidence?.role === 'main_strength')) return true;
  return rows.some((row) => !row.section18Evidence || row.section18Evidence.role === 'legacy_unknown') &&
    (workout.strengthIntent?.effectivePatterns.length ?? 0) > 0;
}

function coreConditioningSession(workout: Workout): boolean {
  return workout.section18Evidence?.conditioningRole === 'core';
}

function safetyFindings(
  evaluation: Section18EffectiveWeekEvaluation,
  contract: WeeklyExposureContractV2,
  workouts: readonly Workout[],
): Section18Finding[] {
  const safetyCodes = new Set([
    'prohibited_pattern_breach',
    'unjustified_anchor_credit',
    'power_policy_breach',
  ]);
  const safetyReductionDetails = new Set(contract.authorisedReductions
    .filter((entry) => contract.safety.reasons.includes(entry.reason))
    .map((entry) => entry.detail));
  const findings = evaluation.blockingViolations.filter((finding) =>
    safetyCodes.has(finding.code) || (
      finding.code === 'reduction_contradiction' && (
        finding.evidence.some((detail) => safetyReductionDetails.has(detail)) ||
        (finding.domain === 'sprint_high_speed' && contract.safety.prohibitedSprintHighSpeed)
      )
    ));

  const prohibited = new Set(contract.safety.prohibitedPatterns);
  for (const workout of workouts) {
    for (const row of workout.exercises ?? []) {
      const pattern = row.section18Evidence?.strengthPattern;
      if (!pattern || !prohibited.has(pattern)) continue;
      findings.push({
        code: 'prohibited_pattern_breach',
        severity: 'blocking',
        domain: 'strength_patterns',
        expected: 0,
        actual: pattern,
        detail: `Safety-prohibited ${pattern} content remains after canonicalisation.`,
        evidence: [workout.id, row.id],
      });
    }
    if (contract.safety.prohibitedPower && workout.powerBlock) {
      findings.push({
        code: 'power_policy_breach', severity: 'blocking', domain: 'power',
        expected: 0, actual: workout.powerBlock.family,
        detail: 'An ineligible power primer remains after safety conformance.',
        evidence: [workout.id],
      });
    }
    if (workout.powerBlock &&
        contract.safety.prohibitedPowerFamilies.includes(workout.powerBlock.family)) {
      findings.push({
        code: 'power_policy_breach', severity: 'blocking', domain: 'power',
        expected: `not ${workout.powerBlock.family}`, actual: workout.powerBlock.family,
        detail: 'A power primer from an injury-prohibited family remains.',
        evidence: [workout.id],
      });
    }
  }
  if (
    contract.identity.mode === 'in_season_bye_recovery' &&
    contract.safety.mainStrengthFrequencyCeiling === 2 &&
    evaluation.ledger.mainStrength.achievedCount !== 2
  ) {
    findings.push({
      code: 'reduction_contradiction', severity: 'blocking', domain: 'main_strength',
      expected: 2, actual: evaluation.ledger.mainStrength.achievedCount,
      detail: 'Bye recovery must retain exactly two lighter main-strength sessions.',
      evidence: evaluation.ledger.mainStrength.sessionDays.map(String),
    });
  }
  return findings;
}

/** Conform and assess a complete canonical week against safety policy only. */
export function finaliseSection18SafetyWeek(args: {
  contract: WeeklyExposureContractV2;
  workouts: readonly Workout[];
  weekStart: string;
  canonicalContext?: WorkoutCanonicalisationContext;
}): Section18SafetyFinaliserResult {
  const actions: Section18SafetyAction[] = [];
  let workouts = args.workouts.map((workout) => {
    const result = conformWorkout({
      workout,
      contract: args.contract,
      canonicalContext: args.canonicalContext,
    });
    actions.push(...result.actions);
    return result.workout;
  });

  const mainCeiling = args.contract.safety.mainStrengthFrequencyCeiling;
  if (mainCeiling !== null) {
    const mainIndexes = workouts
      .map((workout, index) => ({ workout, index }))
      .filter(({ workout }) => mainStrengthSession(workout))
      .map(({ index }) => index);
    const safeStructureIndexes = workouts
      .map((workout, index) => ({ workout, index }))
      .filter(({ workout, index }) =>
        !mainIndexes.includes(index) &&
        (workout.workoutType === 'Strength' || workout.workoutType === 'Mixed') &&
        workout.sessionTier !== 'recovery')
      .map(({ index }) => index);
    const keepIndexes = [...mainIndexes, ...safeStructureIndexes].slice(0, mainCeiling);
    if (keepIndexes.length > 0) {
      const represented = new Set(keepIndexes.flatMap((index) =>
        workouts[index].exercises
          .filter((row) => row.section18Evidence?.role === 'main_strength')
          .map((row) => row.section18Evidence!.mainStrengthPattern)
          .filter((pattern): pattern is NonNullable<typeof pattern> => !!pattern)));
      let destinationOffset = 0;
      for (const pattern of args.contract.safety.requiredSafePatterns) {
        if (represented.has(pattern)) continue;
        const destinationIndex = keepIndexes[destinationOffset % keepIndexes.length];
        destinationOffset += 1;
        const destination = workouts[destinationIndex];
        const source = workouts.flatMap((workout) => workout.exercises)
          .find((row) => row.section18Evidence?.role === 'main_strength' &&
            row.section18Evidence.mainStrengthPattern === pattern) ??
          safePatternFallbackRow(destination, pattern);
        const cloned = {
          ...source,
          id: `${destination.id}:safety-consolidated:${pattern}`,
          workoutId: destination.id,
          exerciseOrder: destination.exercises.length + 1,
        };
        workouts[destinationIndex] = conformWorkout({
          workout: {
            ...destination,
            planEntryId: undefined,
            strengthIntent: undefined,
            strengthIntentDiagnostics: undefined,
            strengthPatternContributions: undefined,
            exercises: [...destination.exercises, cloned],
          },
          contract: args.contract,
          canonicalContext: args.canonicalContext,
        }).workout;
        represented.add(pattern);
      }
    }
    let retained = 0;
    workouts = workouts.map((workout) => {
      if (!mainStrengthSession(workout)) return workout;
      if (retained < mainCeiling) {
        retained += 1;
        return workout;
      }
      actions.push('strength_frequency_capped');
      return conformWorkout({
        workout: stripMainStrength(workout),
        contract: args.contract,
        canonicalContext: args.canonicalContext,
      }).workout;
    });
  }

  const capSessions = (
    ceiling: number | null,
    isCounted: (workout: Workout) => boolean,
    strip: (workout: Workout) => Workout,
    action: Section18SafetyAction,
  ) => {
    if (ceiling === null) return;
    let kept = 0;
    workouts = workouts.map((workout) => {
      if (!isCounted(workout)) return workout;
      if (kept < ceiling) {
        kept += 1;
        return workout;
      }
      actions.push(action);
      return conformWorkout({
        workout: strip(workout),
        contract: args.contract,
        canonicalContext: args.canonicalContext,
      }).workout;
    });
  };
  capSessions(
    args.contract.safety.conditioningFrequencyCeiling,
    coreConditioningSession,
    stripConditioning,
    'conditioning_frequency_capped',
  );

  const anchorSprintCredit = args.contract.anchors.filter((anchor) =>
    anchor.participation === 'normal_unrestricted').length;
  const sprintCeiling = args.contract.safety.sprintHighSpeedFrequencyCeiling;
  if (sprintCeiling !== null) {
    let appSprintKept = Math.min(anchorSprintCredit, sprintCeiling);
    workouts = workouts.map((workout) => {
      if (workout.speedBlock?.kind !== 'true_speed') return workout;
      if (appSprintKept < sprintCeiling) {
        appSprintKept += 1;
        return workout;
      }
      actions.push('sprint_frequency_capped');
      return conformWorkout({
        workout: { ...workout, speedBlock: undefined },
        contract: args.contract,
        canonicalContext: args.canonicalContext,
      }).workout;
    });
  }

  // Legacy rows can carry unknown evidence while typed strength intent still
  // earns observer credit. Use the independent ledger as the final counting
  // fence as well, so that representation cannot evade a frequency ceiling.
  if (mainCeiling !== null) {
    let provisional = evaluateSection18EffectiveWeek({
      contract: args.contract,
      workouts,
      weekStart: args.weekStart,
    });
    const excessDays = new Set(
      provisional.ledger.mainStrength.sessionDays.slice(mainCeiling),
    );
    if (provisional.ledger.mainStrength.achievedCount > mainCeiling && excessDays.size > 0) {
      workouts = workouts.map((workout) => {
        if (!excessDays.has(workout.dayOfWeek)) return workout;
        actions.push('strength_frequency_capped');
        return conformWorkout({
          workout: stripMainStrength(workout),
          contract: args.contract,
          canonicalContext: args.canonicalContext,
        }).workout;
      });
      provisional = evaluateSection18EffectiveWeek({
        contract: args.contract,
        workouts,
        weekStart: args.weekStart,
      });
    }
    const retainedDays = provisional.ledger.mainStrength.sessionDays.slice(0, mainCeiling);
    if (retainedDays.length > 0) {
      const represented = new Set(args.contract.safety.requiredSafePatterns.filter((pattern) =>
        provisional.ledger.strengthPatterns.meaningfulMainLiftCount[pattern] > 0));
      let destinationOffset = 0;
      for (const pattern of args.contract.safety.requiredSafePatterns) {
        if (represented.has(pattern)) continue;
        const day = retainedDays[destinationOffset % retainedDays.length];
        destinationOffset += 1;
        const destinationIndex = workouts.findIndex((workout) => workout.dayOfWeek === day);
        if (destinationIndex < 0) continue;
        const destination = workouts[destinationIndex];
        workouts[destinationIndex] = conformWorkout({
          workout: {
            ...destination,
            planEntryId: undefined,
            strengthIntent: undefined,
            strengthIntentDiagnostics: undefined,
            strengthPatternContributions: undefined,
            exercises: [
              ...destination.exercises,
              safePatternFallbackRow(destination, pattern),
            ],
          },
          contract: args.contract,
          canonicalContext: args.canonicalContext,
        }).workout;
        represented.add(pattern);
      }
    }
  }

  const evaluation = evaluateSection18EffectiveWeek({
    contract: args.contract,
    workouts,
    weekStart: args.weekStart,
  });
  const unresolved = safetyFindings(evaluation, args.contract, workouts);
  if (unresolved.length > 0) throw new Section18SafetyContradictionError(unresolved);
  return {
    workouts,
    contract: evaluation.contract,
    evaluation,
    actions: unique(actions),
    enforcement: 'safety_only',
  };
}
