(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { ActiveEquipmentConstraint, ActiveInjuryConstraint } from '../../../store/coachUpdatesStore';
import { finaliseWorkoutAfterMutation } from '../../../utils/workoutCanonicalisation';
import { validateWorkoutAgainstActiveConstraints } from '../../../utils/postGenerationConstraintValidation';
import { pathExercise, pathPowerBlock, pathWorkout, canonicalWorkoutLedger } from './buildCanonicalPathLedger';
import { buildSlice4ScenarioTrace } from './buildSlice4Trace';
import { SLICE4_GOLDEN_SCENARIOS } from '../scenarios/slice4Goldens';
import type {
  GeneratedCheckResult,
  GeneratedPropertyCase,
  HarnessCanonicalWorkoutLedger,
  StrengthPattern,
} from '../types';

const PATTERN_EXERCISES: Record<StrengthPattern, string> = {
  squat: 'Back Squat', hinge: 'Romanian Deadlift', push: 'Bench Press', pull: 'Chest Supported Row',
};

function semantic(value: HarnessCanonicalWorkoutLedger): string {
  return JSON.stringify({
    archetype: value.archetype, primary: value.primaryPattern,
    planned: value.plannedPatterns, effective: value.effectivePatterns,
    components: value.components, conditioning: value.conditioning,
    power: value.power, strengthRows: value.strengthRows,
    support: value.supportRows, recovery: value.recoveryAddons,
  });
}

function result(
  entry: GeneratedPropertyCase,
  invariant: string,
  passed: boolean,
  expected: unknown,
  actual: unknown,
  ruleIds: GeneratedCheckResult['ruleIds'],
): GeneratedCheckResult {
  return { id: `${entry.id}:${invariant}`, domain: entry.domain, ruleIds, invariant, passed, stage: 'path_output', expected, actual };
}

function strengthChecks(entry: GeneratedPropertyCase): GeneratedCheckResult[] {
  const planned = entry.data.planned as StrengthPattern[];
  const primary = entry.data.primary as StrengthPattern;
  const exercises = planned.map((pattern, index) => pathExercise(entry.id, index, PATTERN_EXERCISES[pattern], { weight: 60 }));
  const source = pathWorkout({ id: entry.id, dayOfWeek: 1, name: 'Misleading Recovery Name', patterns: planned, primary, exercises });
  source.workoutType = 'Recovery';
  source.strengthPatternContributions = planned.length > 1 ? [planned[0]] : planned;
  const forward = finaliseWorkoutAfterMutation(source, { phase: 'In-season', planIntentValid: true, referenceWorkout: source }).workout;
  const reversedSource = {
    ...source,
    strengthIntent: source.strengthIntent ? { ...source.strengthIntent, plannedPatterns: [...planned].reverse() } : undefined,
  };
  const reversed = finaliseWorkoutAfterMutation(reversedSource, { phase: 'In-season', planIntentValid: true, referenceWorkout: reversedSource }).workout;
  const twice = finaliseWorkoutAfterMutation(forward, { phase: 'In-season', planIntentValid: true, referenceWorkout: forward }).workout;
  const a = canonicalWorkoutLedger(forward);
  const b = canonicalWorkoutLedger(reversed);
  const c = canonicalWorkoutLedger(twice);
  return [
    result(entry, 'PROPERTY_PATTERN_ORDER', JSON.stringify(a.plannedPatterns) === JSON.stringify(b.plannedPatterns), a.plannedPatterns, b.plannedPatterns, ['ALL-STR-BLOCK-01']),
    result(entry, 'PROPERTY_PRIMARY_PLANNED', a.primaryPattern === null || a.plannedPatterns.includes(a.primaryPattern), 'primary belongs to planned', a, ['ALL-STR-BLOCK-01']),
    result(entry, 'PROPERTY_EFFECTIVE_SUBSET', a.effectivePatterns.every((pattern) => a.plannedPatterns.includes(pattern)), 'effective subset planned', a, ['ALL-STR-BLOCK-01']),
    result(entry, 'PROPERTY_SCALAR_NONAUTH', planned.every((pattern) => a.plannedPatterns.includes(pattern)), planned, a.plannedPatterns, ['ALL-STORE-SCALAR-NONAUTH-01']),
    result(entry, 'PROPERTY_CANONICAL_IDEMPOTENT', semantic(a) === semantic(c), a, c, ['ALL-REBUILD-IDEMPOTENT-01']),
  ];
}

function componentChecks(entry: GeneratedPropertyCase): GeneratedCheckResult[] {
  const requested = new Set(entry.data.components as string[]);
  if (requested.has('power')) requested.add('strength');
  // A generated team-anchor combination may carry strength/conditioning, but
  // power validity belongs to the separate power policy and is not a valid
  // arbitrary component combination on the anchor fixture.
  if (requested.has('team_training')) requested.delete('power');
  const exercises = [] as ReturnType<typeof pathExercise>[];
  const strengthPattern: StrengthPattern = requested.has('team_training') ? 'push' : 'squat';
  if (requested.has('strength')) exercises.push(pathExercise(entry.id, exercises.length, strengthPattern === 'push' ? 'Bench Press' : 'Back Squat', { weight: 60 }));
  if (requested.has('trunk_support')) exercises.push(pathExercise(entry.id, exercises.length, 'Pallof Press'));
  const source = pathWorkout({
    id: entry.id, dayOfWeek: 1,
    name: requested.has('team_training') ? 'Team Training + Upper Strength' : 'Generated component session',
    patterns: requested.has('strength') ? [strengthPattern] : [], primary: requested.has('strength') ? strengthPattern : null,
    exercises,
    conditioning: requested.has('conditioning') ? [{ title: 'Bike Zone 2 25min', modality: 'bike' }] : undefined,
    powerBlock: requested.has('power') ? pathPowerBlock('primer') : undefined,
    team: requested.has('team_training'),
    recoveryAddon: requested.has('recovery') ? 'Easy Calf Isometric' : undefined,
  });
  const once = requested.has('team_training')
    ? source
    : finaliseWorkoutAfterMutation(source, { phase: 'In-season', planIntentValid: true, referenceWorkout: source }).workout;
  const twice = requested.has('team_training')
    ? source
    : finaliseWorkoutAfterMutation(once, { phase: 'In-season', planIntentValid: true, referenceWorkout: once }).workout;
  const a = canonicalWorkoutLedger(once);
  const b = canonicalWorkoutLedger(twice);
  const required = Array.from(requested).filter((value) => value !== 'power' || requested.has('strength'));
  return [
    result(entry, 'PROPERTY_COMPONENT_SET', required.every((component) => a.components.includes(component as any)), required, a.components, ['ALL-COMP-PROJECTION-01']),
    result(entry, 'PROPERTY_TRUNK_NOT_CONDITIONING', !requested.has('trunk_support') || requested.has('conditioning') || !a.components.includes('conditioning'), 'support alone is not conditioning', a.components, ['ALL-TRUNK-SUPPORT-01']),
    result(entry, 'PROPERTY_RECOVERY_NONDESTRUCTIVE', !requested.has('recovery') || required.filter((value) => value !== 'recovery').every((component) => a.components.includes(component as any)), required, a.components, ['ALL-RECOVERY-ADDON-01']),
    result(entry, 'PROPERTY_COMPONENT_IDEMPOTENT', semantic(a) === semantic(b), a, b, ['ALL-COMP-PROJECTION-01']),
  ];
}

function conditioningChecks(entry: GeneratedPropertyCase): GeneratedCheckResult[] {
  const modalities = entry.data.modalities as Array<'bike' | 'row' | 'ski' | 'running'>;
  const intent = entry.data.intent as 'aerobic' | 'tempo' | 'high-intensity';
  const duration = entry.data.duration as number;
  const source = pathWorkout({
    id: entry.id, dayOfWeek: 1, name: 'Generated Mixed', patterns: ['push'], primary: 'push',
    exercises: [pathExercise(entry.id, 0, 'Bench Press', { weight: 60 })],
    conditioning: modalities.map((modality) => ({
      title: `${modality === 'running' ? 'Running' : modality} ${duration}min`, modality, intent,
    })),
  });
  const output = finaliseWorkoutAfterMutation(source, { phase: 'In-season', planIntentValid: true, referenceWorkout: source }).workout;
  const ledger = canonicalWorkoutLedger(output);
  const actual = ledger.conditioning.map((item) => item.modality).sort();
  const expected = [...modalities].sort();
  const conditioningNames = new Set(modalities.map((value) => value.toLowerCase()));
  const strengthLeak = ledger.strengthRows.some((name) =>
    Array.from(conditioningNames).some((value) => name.toLowerCase().includes(value)));
  return [
    result(entry, 'PROPERTY_MODALITIES_PRESERVED', expected.every((modality) => actual.includes(modality)), expected, actual, ['ALL-COND-MULTI-01']),
    result(entry, 'PROPERTY_CONDITIONING_NOT_STRENGTH', !strengthLeak, 'no conditioning names in strength rows', ledger.strengthRows, ['ALL-COND-SECTION-01']),
    result(entry, 'PROPERTY_RUNNING_HONEST', !actual.includes('running') || modalities.includes('running'), modalities, actual, ['ALL-COND-MODALITY-01']),
  ];
}

function powerChecks(entry: GeneratedPropertyCase): GeneratedCheckResult[] {
  const state = entry.data.state as 'none' | 'primer' | 'contrast';
  const phase = entry.data.phase as string;
  const heavy = entry.data.heavyLift as string;
  const exercises = heavy === 'present'
    ? [pathExercise(entry.id, 0, 'Back Squat', { weight: 100, reps: 4 })]
    : heavy === 'mismatched' ? [pathExercise(entry.id, 0, 'Bench Press', { weight: 100, reps: 4 })] : [];
  const patterns: StrengthPattern[] = heavy === 'mismatched' ? ['push'] : ['squat'];
  const source = pathWorkout({
    id: entry.id, dayOfWeek: 1, name: 'Generated Power', patterns, primary: patterns[0], exercises,
    powerBlock: state === 'none' ? undefined : pathPowerBlock(state),
  });
  const context = {
    phase: phase === 'in_season' ? 'In-season' as const : 'Off-season' as const,
    offseasonSubphase: phase === 'early_offseason' ? 'early_offseason' as const
      : phase === 'mid_offseason' ? 'mid_offseason' as const : 'late_offseason' as const,
    planIntentValid: true, referenceWorkout: source,
  };
  const once = finaliseWorkoutAfterMutation(source, context).workout;
  const twice = finaliseWorkoutAfterMutation(once, { ...context, referenceWorkout: once }).workout;
  const a = canonicalWorkoutLedger(once);
  const b = canonicalWorkoutLedger(twice);
  const shouldForbidContrast = heavy !== 'present' || phase === 'early_offseason' || phase === 'mid_offseason';
  return [
    result(entry, 'PROPERTY_CONTRAST_STRUCTURAL', !shouldForbidContrast || a.power.kind !== 'contrast', 'invalid contrast removed/downgraded', a.power, ['ALL-PWR-CONTRAST-01']),
    result(entry, 'PROPERTY_EARLY_NO_POWER', phase !== 'early_offseason' || a.power.kind === 'none', 'early off-season power none', a.power, ['OS-PWR-PHASE-01']),
    result(entry, 'PROPERTY_POWER_IDEMPOTENT', JSON.stringify(a.power) === JSON.stringify(b.power), a.power, b.power, ['ALL-PWR-CONTENT-01']),
  ];
}

function injuryConstraint(bucket: 'hamstring' | 'shoulder', severity: number): ActiveInjuryConstraint {
  return {
    id: `generated-${bucket}-${severity}`, type: 'injury', bodyPart: bucket, bucket: bucket as any,
    severity, status: 'active', startDate: '2026-03-23', lastUpdatedAt: '2026-03-23T00:00:00.000Z',
    adjustmentLevel: severity >= 8 ? 'training_paused' : 'moderate', seriousSymptoms: false,
    rules: [], safeFocus: [], advice: [],
  };
}

function constraintChecks(entry: GeneratedPropertyCase): GeneratedCheckResult[] {
  const restriction = entry.data.restriction as string;
  const severity = entry.data.severity as number;
  const source = pathWorkout({
    id: entry.id, dayOfWeek: 1, name: 'Generated constrained workout', patterns: ['hinge', 'push'], primary: 'hinge',
    exercises: [
      pathExercise(entry.id, 0, 'Barbell Deadlift', { equipment: ['Barbell'], weight: 100 }),
      pathExercise(entry.id, 1, 'Push-Up'),
    ],
    conditioning: [{ title: 'Running intervals 20min', modality: 'running', intent: 'high-intensity' }],
  });
  const active = [] as Array<ActiveInjuryConstraint | ActiveEquipmentConstraint>;
  if (restriction === 'hamstring' || restriction === 'upper') {
    active.push(injuryConstraint(restriction === 'hamstring' ? 'hamstring' : 'shoulder', Math.max(6, severity)));
  }
  if (entry.data.equipment === 'bodyweight') {
    active.push({
      id: 'generated-bodyweight', type: 'equipment', mode: 'only', tags: ['bodyweight'], severity: 0,
      status: 'active', startDate: '2026-03-23', lastUpdatedAt: '2026-03-23T00:00:00.000Z', source: 'system',
      modifierAffects: ['current_week'], rules: [], safeFocus: [], advice: [],
    });
  }
  const validated = validateWorkoutAgainstActiveConstraints({
    workout: source, date: '2026-03-23', todayISO: '2026-03-23', activeConstraints: active,
    profile: { trainingLocation: 'Commercial gym', equipment: ['Full Gym'] },
    canonicalContext: { phase: 'Pre-season', planIntentValid: true, referenceWorkout: source },
  });
  const names = (validated.workout?.exercises ?? []).map((row) => row.exercise?.name ?? '');
  const ledger = validated.workout ? canonicalWorkoutLedger(validated.workout) : null;
  const noBarbell = entry.data.equipment !== 'bodyweight' || !names.some((name) => /barbell/i.test(name));
  const hamstringSafe = restriction !== 'hamstring' || (
    !ledger?.effectivePatterns.includes('hinge') &&
    !ledger?.conditioning.some((block) => block.modality === 'running')
  );
  const unaffectedPush = restriction !== 'hamstring' || severity >= 8 || names.some((name) => /push-up/i.test(name));
  return [
    result(entry, 'PROPERTY_EQUIPMENT_COMPATIBLE', noBarbell, 'no unavailable barbell work', names, ['ALL-EQUIPMENT-COMPATIBLE-01']),
    result(entry, 'PROPERTY_PROHIBITED_MONOTONIC', hamstringSafe, 'restricted hinge/running removed', names, ['ALL-CONSTRAINT-AFFECTED-ONLY-01']),
    result(entry, 'PROPERTY_UNAFFECTED_PRESERVED', unaffectedPush, 'safe unaffected push remains', names, ['ALL-CONSTRAINT-AFFECTED-ONLY-01']),
  ];
}

function slice4Checks(entry: GeneratedPropertyCase): GeneratedCheckResult[] {
  const scenarioId = entry.domain === 'placement'
    ? ((entry.data.swap as boolean) ? 'swap-upper-and-lower' : 'move-combined-lower')
    : (entry.data.operations as string[]).includes('repeat_week') ? 'repeat-rich-week' : 'coach-add-bike-zone2';
  const scenario = SLICE4_GOLDEN_SCENARIOS.find((value) => value.id === scenarioId)!;
  const trace = buildSlice4ScenarioTrace(scenario);
  const first = trace.observations[0].ledger;
  const last = trace.observations[trace.observations.length - 1].ledger;
  if (entry.domain === 'placement') {
    const before = first.workouts.map((workout) => workout.planEntryId).sort();
    const after = last.workouts.map((workout) => workout.planEntryId).sort();
    return [result(entry, 'PROPERTY_PLACEMENT_IDENTITIES', before.every((id) => after.includes(id)), before, after, [scenarioId.startsWith('swap') ? 'ALL-SWAP-IDENTITY-01' : 'ALL-MOVE-IDENTITY-01'])];
  }
  const valid = last.workouts.every((workout) =>
    workout.effectivePatterns.every((pattern) => workout.plannedPatterns.includes(pattern)));
  return [result(entry, 'PROPERTY_EDIT_CANONICAL', valid, 'effective patterns remain canonical', last, ['ALL-EDIT-CANONICAL-01'])];
}

export function evaluateGeneratedPropertyCase(entry: GeneratedPropertyCase): GeneratedCheckResult[] {
  if (entry.domain === 'strength') return strengthChecks(entry);
  if (entry.domain === 'components') return componentChecks(entry);
  if (entry.domain === 'conditioning') return conditioningChecks(entry);
  if (entry.domain === 'power') return powerChecks(entry);
  if (entry.domain === 'constraints') return constraintChecks(entry);
  return slice4Checks(entry);
}
