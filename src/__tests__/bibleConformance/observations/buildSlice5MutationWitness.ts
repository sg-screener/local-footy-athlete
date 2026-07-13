(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { ActiveEquipmentConstraint, ActiveInjuryConstraint } from '../../../store/coachUpdatesStore';
import { buildCoachingPlan, onboardingToCoachingInputs } from '../../../utils/coachingEngine';
import { finaliseWorkoutAfterMutation } from '../../../utils/workoutCanonicalisation';
import { validateWorkoutAgainstActiveConstraints } from '../../../utils/postGenerationConstraintValidation';
import { canonicalWeekLedger, pathExercise, pathWorkout } from './buildCanonicalPathLedger';
import type { MutationSpec } from '../types';

export interface Slice5MutationWitness {
  mutationId: string;
  invariantId: string;
  stage: string;
  observation: Record<string, unknown>;
}

const TODAY = '2026-03-23';

function injury(id: string, bucket: 'hamstring' | 'shoulder'): ActiveInjuryConstraint {
  return {
    id, type: 'injury', bodyPart: bucket, bucket: bucket as any, severity: 6,
    status: 'active', startDate: TODAY, lastUpdatedAt: `${TODAY}T00:00:00.000Z`,
    adjustmentLevel: 'moderate', seriousSymptoms: false, rules: [], safeFocus: [], advice: [],
  };
}

function equipment(id: string, tag: 'barbell' | 'machines'): ActiveEquipmentConstraint {
  return {
    id, type: 'equipment', mode: 'without', tags: [tag], severity: 0, status: 'active',
    startDate: TODAY, lastUpdatedAt: `${TODAY}T00:00:00.000Z`, source: 'system',
    modifierAffects: ['current_week'], rules: [], safeFocus: [], advice: [],
  };
}

function richWorkout() {
  const id = 'slice5-rich';
  const source = pathWorkout({
    id, dayOfWeek: 1, name: 'Rich Mixed', patterns: ['squat', 'hinge'], primary: 'squat',
    exercises: [pathExercise(id, 0, 'Back Squat', { weight: 80 }), pathExercise(id, 1, 'Romanian Deadlift', { weight: 70 })],
    conditioning: [{ title: 'Bike Zone 2 25min', modality: 'bike' }], recoveryAddon: 'Easy Calf Isometric',
  });
  return finaliseWorkoutAfterMutation(source, { phase: 'In-season', planIntentValid: true, referenceWorkout: source }).workout;
}

function constraintObservation(kind: 'injury' | 'equipment') {
  const id = `slice5-${kind}`;
  const source = pathWorkout({
    id, dayOfWeek: 1, name: 'Constrained Mixed', patterns: ['hinge', 'push'], primary: 'hinge',
    exercises: [
      pathExercise(id, 0, 'Barbell Deadlift', { equipment: ['Barbell'], weight: 100 }),
      pathExercise(id, 1, 'Machine Chest Press', { equipment: ['Machine'], weight: 50 }),
      pathExercise(id, 2, 'Push-Up'),
    ],
    conditioning: [{ title: 'Running intervals 20min', modality: 'running', intent: 'high-intensity' }],
  });
  const constraints = kind === 'injury'
    ? [injury('injury-hamstring', 'hamstring'), injury('injury-shoulder', 'shoulder')]
    : [equipment('equipment-barbell', 'barbell'), equipment('equipment-machines', 'machines')];
  const output = validateWorkoutAgainstActiveConstraints({
    workout: source, date: TODAY, todayISO: TODAY, activeConstraints: constraints,
    profile: { trainingLocation: 'Commercial gym', equipment: ['Full Gym'] },
    canonicalContext: { phase: 'Pre-season', planIntentValid: true, referenceWorkout: source },
  });
  return {
    activeConstraintIds: output.activeConstraintIds.slice().sort(),
    exerciseNames: (output.workout?.exercises ?? []).map((row) => row.exercise?.name ?? '').sort(),
  };
}

function plannedPatterns(args: { phase: 'In-season' | 'Off-season'; game?: 'Saturday'; week: number }): string[] {
  const plan = buildCoachingPlan(onboardingToCoachingInputs({
    firstName: 'Mutation', ageRange: '26-30', position: 'inside_mid', motivation: 'Build Strength',
    experienceLevel: '2-5 years', squatStrength: '1.5x bodyweight', benchStrength: 'Around bodyweight',
    conditioningLevel: 'Good', sprintExposure: 'Occasionally', recentTrainingLoad: 'Very consistent', injuries: [],
    seasonPhase: args.phase, trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [], usualGameDay: args.game, gameDay: args.game,
    sessionDurationMinutes: 60, trainingLocation: 'Commercial gym', equipment: ['Full Gym'],
  }, { weekInBlock: args.week, weekNumber: args.week, miniCycleNumber: args.week, weekKind: args.week === 4 ? 'deload' : 'build' }));
  return Array.from(new Set(plan.weeklyPlan.flatMap((entry) => entry.strengthIntent?.plannedPatterns ?? []))).sort();
}

export function buildSlice5MutationWitness(spec: MutationSpec): Slice5MutationWitness {
  const rich = richWorkout();
  const ledger = canonicalWeekLedger([rich]);
  let observation: Record<string, unknown>;
  if (spec.id === 'second_injury_ignored') observation = constraintObservation('injury');
  else if (spec.id === 'second_equipment_ignored') observation = constraintObservation('equipment');
  else if (spec.id === 'recovery_replaces_primary') observation = { components: ledger.workouts[0].components };
  else if (spec.id === 'weekly_projection_drops_component' || spec.id === 'detail_projection_drops_component') {
    observation = { canonical: ledger.workouts[0].components, week: ledger.visibleWeekComponents, detail: ledger.visibleDetailComponents };
  } else if (spec.id === 'exposure_uses_stale_workout_type') {
    observation = { components: ledger.workouts[0].components, mainStrength: ledger.exposure.mainStrength, workoutType: 'Recovery' };
  } else if (spec.id === 'planned_credit_after_effective_removal') {
    const id = 'slice5-effective';
    const source = pathWorkout({ id, dayOfWeek: 1, name: 'Planned Combined', patterns: ['squat', 'hinge'], primary: 'squat', exercises: [pathExercise(id, 0, 'Back Squat', { weight: 80 })] });
    const output = finaliseWorkoutAfterMutation(source, { phase: 'In-season', planIntentValid: true, referenceWorkout: source, restoreMissingPlanPatterns: false }).workout;
    const value = canonicalWeekLedger([output]).workouts[0];
    observation = { planned: value.plannedPatterns, effective: value.effectivePatterns };
  } else if (spec.id === 'canonical_restores_safety_removed_work') {
    observation = constraintObservation('injury');
  } else if (spec.id === 'deload_drops_pattern_presence') {
    observation = {
      patterns: Array.from(new Set([1, 2, 3, 4].flatMap((week) =>
        plannedPatterns({ phase: 'Off-season', week })))).sort(),
    };
  } else if (spec.id === 'bye_drops_strength_intent') {
    observation = { patterns: plannedPatterns({ phase: 'In-season', week: 1 }) };
  } else if (spec.id === 'duplicate_plan_entry_join') {
    const upper = pathWorkout({ id: 'slice5-upper', dayOfWeek: 2, name: 'Upper', patterns: ['push'], primary: 'push', exercises: [pathExercise('slice5-upper', 0, 'Bench Press')] });
    observation = { ids: canonicalWeekLedger([rich, upper]).workouts.map((workout) => workout.planEntryId) };
  } else if (spec.id === 'conditioning_duration_drops_on_store') {
    observation = { minutes: ledger.workouts[0].conditioning.map((entry) => entry.minutes) };
  } else throw new Error(`Unknown Slice 5 mutation witness: ${spec.id}`);
  return { mutationId: spec.id, invariantId: spec.expectedInvariantIds[0], stage: spec.expectedFirstStage ?? 'path_output', observation };
}

export function applySlice5Mutation(witness: Slice5MutationWitness): Slice5MutationWitness {
  const mutant = JSON.parse(JSON.stringify(witness)) as Slice5MutationWitness;
  const value = mutant.observation;
  if (witness.mutationId === 'second_injury_ignored' || witness.mutationId === 'second_equipment_ignored') {
    (value.activeConstraintIds as string[]).pop();
  } else if (witness.mutationId === 'recovery_replaces_primary') value.components = ['recovery'];
  else if (witness.mutationId === 'weekly_projection_drops_component') value.week = (value.week as string[]).filter((entry) => entry !== 'conditioning');
  else if (witness.mutationId === 'detail_projection_drops_component') value.detail = (value.detail as string[]).filter((entry) => entry !== 'conditioning');
  else if (witness.mutationId === 'exposure_uses_stale_workout_type') value.mainStrength = 0;
  else if (witness.mutationId === 'planned_credit_after_effective_removal') value.effective = value.planned;
  else if (witness.mutationId === 'canonical_restores_safety_removed_work') (value.exerciseNames as string[]).push('Barbell Deadlift');
  else if (witness.mutationId === 'deload_drops_pattern_presence') (value.patterns as string[]).splice(0, 1);
  else if (witness.mutationId === 'bye_drops_strength_intent') value.patterns = [];
  else if (witness.mutationId === 'duplicate_plan_entry_join') (value.ids as string[])[1] = (value.ids as string[])[0];
  else if (witness.mutationId === 'conditioning_duration_drops_on_store') value.minutes = (value.minutes as unknown[]).map(() => undefined);
  return mutant;
}

export function evaluateSlice5MutationWitness(witness: Slice5MutationWitness): { passed: boolean; expected: unknown; actual: unknown } {
  const value = witness.observation;
  let passed = false;
  let expected: unknown = 'canonical mutation invariant';
  if (witness.mutationId === 'second_injury_ignored') {
    expected = ['injury-hamstring', 'injury-shoulder'];
    passed = (expected as string[]).every((id) => (value.activeConstraintIds as string[]).includes(id));
  } else if (witness.mutationId === 'second_equipment_ignored') {
    expected = ['equipment-barbell', 'equipment-machines'];
    passed = (expected as string[]).every((id) => (value.activeConstraintIds as string[]).includes(id));
  } else if (witness.mutationId === 'recovery_replaces_primary') {
    expected = ['strength', 'conditioning', 'recovery'];
    passed = (expected as string[]).every((entry) => (value.components as string[]).includes(entry));
  } else if (witness.mutationId === 'weekly_projection_drops_component' || witness.mutationId === 'detail_projection_drops_component') {
    expected = value.canonical;
    passed = JSON.stringify(value.week) === JSON.stringify(value.canonical) && JSON.stringify(value.detail) === JSON.stringify(value.canonical);
  } else if (witness.mutationId === 'exposure_uses_stale_workout_type') {
    expected = 'mainStrength > 0 when typed strength exists';
    passed = (value.components as string[]).includes('strength') && Number(value.mainStrength) > 0;
  } else if (witness.mutationId === 'planned_credit_after_effective_removal') {
    expected = ['squat'];
    passed = JSON.stringify(value.effective) === JSON.stringify(expected) && (value.planned as string[]).includes('hinge');
  } else if (witness.mutationId === 'canonical_restores_safety_removed_work') {
    expected = 'no Barbell Deadlift after hamstring filter';
    passed = !(value.exerciseNames as string[]).some((name) => /deadlift/i.test(name));
  } else if (witness.mutationId === 'deload_drops_pattern_presence') {
    expected = ['squat', 'hinge', 'push', 'pull'];
    passed = (expected as string[]).every((entry) => (value.patterns as string[]).includes(entry));
  } else if (witness.mutationId === 'bye_drops_strength_intent') {
    expected = 'useful strength patterns remain';
    passed = (value.patterns as string[]).length > 0;
  } else if (witness.mutationId === 'duplicate_plan_entry_join') {
    expected = 'unique planEntryId values';
    passed = new Set(value.ids as string[]).size === (value.ids as string[]).length;
  } else if (witness.mutationId === 'conditioning_duration_drops_on_store') {
    expected = [25];
    passed = JSON.stringify(value.minutes) === JSON.stringify(expected);
  }
  return { passed, expected, actual: value };
}
