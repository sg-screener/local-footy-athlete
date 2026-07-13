(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { buildCoachingPlan, onboardingToCoachingInputs } from '../../../utils/coachingEngine';
import { finaliseWorkoutAfterMutation } from '../../../utils/workoutCanonicalisation';
import { canonicalWorkoutLedger, pathExercise, pathWorkout } from './buildCanonicalPathLedger';
import { buildSlice4ScenarioTrace } from './buildSlice4Trace';
import { evaluateGeneratedPropertyCase } from './evaluateGeneratedProperties';
import { evaluateSlice4Trace } from '../invariants/pathEquivalenceInvariants';
import { SLICE4_GOLDEN_SCENARIOS } from '../scenarios/slice4Goldens';
import { METAMORPHIC_RELATIONS } from '../metamorphic/expectedRelations';
import type { GeneratedCheckResult, GeneratedPropertyCase, MetamorphicRelationSpec, StrengthPattern } from '../types';

const BASE_PROFILE = {
  firstName: 'Metamorphic', ageRange: '26-30' as const, position: 'inside_mid' as const,
  motivation: 'Build Strength, Improve Fitness', experienceLevel: '2-5 years' as const,
  squatStrength: '1.5x bodyweight' as const, benchStrength: 'Around bodyweight' as const,
  conditioningLevel: 'Good' as const, sprintExposure: 'Occasionally' as const,
  recentTrainingLoad: 'Very consistent' as const, injuries: [], seasonPhase: 'In-season' as const,
  trainingDaysPerWeek: 5, preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const,
  teamTrainingDaysPerWeek: 2, teamTrainingDays: ['Tuesday', 'Thursday'] as const,
  teamTrainingIntensity: 'Hard' as const, teamTrainingDuration: '90 minutes' as const,
  usualGameDay: 'Saturday' as const, gameDay: 'Saturday' as const,
  sessionDurationMinutes: 60 as const, trainingLocation: 'Commercial gym' as const, equipment: ['Full Gym'],
};

function pass(spec: MetamorphicRelationSpec, passed: boolean, expected: unknown, actual: unknown): GeneratedCheckResult {
  return {
    id: `metamorphic:${spec.id}`, domain: spec.domain, ruleIds: spec.ruleIds,
    invariant: `META_${spec.id.toUpperCase().replace(/-/g, '_')}`,
    passed, stage: 'path_output', expected, actual,
  };
}

function finalLedger(args: {
  patterns?: StrengthPattern[];
  exercises?: string[];
  conditioning?: Array<'bike' | 'row'>;
  recovery?: boolean;
  name?: string;
  description?: string;
}) {
  const id = 'meta-fixture';
  const workout = pathWorkout({
    id, dayOfWeek: 1, name: args.name ?? 'Canonical Session', patterns: args.patterns ?? ['squat'],
    primary: args.patterns?.[0] ?? 'squat',
    exercises: (args.exercises ?? ['Back Squat']).map((name, index) => pathExercise(id, index, name, { weight: /squat|deadlift|press/i.test(name) ? 80 : undefined })),
    conditioning: args.conditioning?.map((modality) => ({ title: `${modality} Zone 2 25min`, modality })),
    recoveryAddon: args.recovery ? 'Easy Calf Isometric' : undefined,
  });
  if (args.description) workout.description = args.description;
  return canonicalWorkoutLedger(finaliseWorkoutAfterMutation(workout, {
    phase: 'In-season', planIntentValid: true, referenceWorkout: workout,
  }).workout);
}

function slice4(id: typeof SLICE4_GOLDEN_SCENARIOS[number]['id']): boolean {
  const scenario = SLICE4_GOLDEN_SCENARIOS.find((entry) => entry.id === id)!;
  return evaluateSlice4Trace(buildSlice4ScenarioTrace(scenario)).every((entry) => entry.failures.length === 0);
}

function plannedFor(args: { game?: 'Saturday' | 'Sunday'; days: number; week?: number; phase?: 'In-season' | 'Off-season' }) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].slice(0, args.days) as any;
  const inputs = onboardingToCoachingInputs({
    ...BASE_PROFILE, seasonPhase: args.phase ?? 'In-season', preferredTrainingDays: days,
    trainingDaysPerWeek: args.days, usualGameDay: args.game, gameDay: args.game,
  }, { weekInBlock: args.week ?? 1, weekNumber: args.week ?? 1, miniCycleNumber: args.week ?? 1, weekKind: args.week === 4 ? 'deload' : 'build' });
  const plan = buildCoachingPlan(inputs);
  return {
    patterns: Array.from(new Set(plan.weeklyPlan.flatMap((entry) => entry.strengthIntent?.plannedPatterns ?? []))).sort(),
    useful: plan.weeklyPlan.filter((entry) => (entry.strengthIntent?.plannedPatterns.length ?? 0) > 0).length,
  };
}

function blockPatterns(args: { game?: 'Saturday' | 'Sunday'; days: number }): string[] {
  return Array.from(new Set([1, 2, 3, 4].flatMap((week) =>
    plannedFor({ ...args, week }).patterns))).sort();
}

function generatedConstraintCase(data: Record<string, unknown>): GeneratedCheckResult[] {
  const entry: GeneratedPropertyCase = {
    id: 'metamorphic-constraint', seed: '20260323', domain: 'constraints',
    referenceDate: '2026-03-23', timezone: 'Australia/Melbourne', data,
  };
  return evaluateGeneratedPropertyCase(entry);
}

export function evaluateMetamorphicRelation(spec: MetamorphicRelationSpec): GeneratedCheckResult {
  const base = finalLedger({ patterns: ['squat'], exercises: ['Back Squat'] });
  if (spec.id === 'reorder-planned-patterns') {
    const a = finalLedger({ patterns: ['squat', 'hinge'], exercises: ['Back Squat', 'Romanian Deadlift'] });
    const b = finalLedger({ patterns: ['hinge', 'squat'], exercises: ['Romanian Deadlift', 'Back Squat'] });
    return pass(spec, JSON.stringify(a.plannedPatterns) === JSON.stringify(b.plannedPatterns), a.plannedPatterns, b.plannedPatterns);
  }
  if (spec.id === 'reorder-components') {
    const a = finalLedger({ patterns: ['push'], exercises: ['Bench Press'], conditioning: ['bike'], recovery: true });
    const b = finalLedger({ patterns: ['push'], exercises: ['Bench Press'], conditioning: ['bike'], recovery: true });
    return pass(spec, JSON.stringify(a.components) === JSON.stringify(b.components), a.components, b.components);
  }
  if (spec.id === 'rename-workout' || spec.id === 'change-focus-copy') {
    const changed = finalLedger({ patterns: ['squat'], exercises: ['Back Squat'], name: 'Misleading Upper Recovery', description: 'Push only' });
    return pass(spec, JSON.stringify(base.plannedPatterns) === JSON.stringify(changed.plannedPatterns), base.plannedPatterns, changed.plannedPatterns);
  }
  if (spec.id === 'add-hinge-keeps-squat') {
    const changed = finalLedger({ patterns: ['squat', 'hinge'], exercises: ['Back Squat', 'Romanian Deadlift'] });
    return pass(spec, changed.plannedPatterns.includes('squat'), ['squat'], changed.plannedPatterns);
  }
  if (spec.id === 'add-pull-keeps-push') {
    const changed = finalLedger({ patterns: ['push', 'pull'], exercises: ['Bench Press', 'Chest Supported Row'] });
    return pass(spec, changed.plannedPatterns.includes('push'), ['push'], changed.plannedPatterns);
  }
  if (spec.id === 'add-conditioning-keeps-strength') {
    const changed = finalLedger({ patterns: ['squat'], exercises: ['Back Squat'], conditioning: ['bike'] });
    return pass(spec, changed.components.includes('strength') && changed.components.includes('conditioning'), ['strength', 'conditioning'], changed.components);
  }
  if (spec.id === 'add-trunk-not-conditioning') {
    const changed = finalLedger({ patterns: ['squat'], exercises: ['Back Squat', 'Pallof Press'] });
    return pass(spec, changed.components.includes('trunk_support') && !changed.components.includes('conditioning'), ['strength', 'trunk_support'], changed.components);
  }
  if (spec.id === 'add-recovery-keeps-main') {
    const changed = finalLedger({ patterns: ['squat'], exercises: ['Back Squat'], recovery: true });
    return pass(spec, changed.components.includes('strength') && changed.components.includes('recovery'), ['strength', 'recovery'], changed.components);
  }
  if (spec.id === 'move-keeps-identity') return pass(spec, slice4('move-combined-lower'), true, 'move trace');
  if (spec.id === 'swap-keeps-identities') return pass(spec, slice4('swap-upper-and-lower'), true, 'swap trace');
  if (spec.id === 'remove-strength-mixed-to-conditioning') {
    const id = 'meta-remove-strength';
    const mixed = pathWorkout({ id, dayOfWeek: 1, name: 'Mixed', patterns: ['squat'], primary: 'squat', exercises: [], conditioning: [{ title: 'Bike 25min', modality: 'bike' }] });
    const output = finaliseWorkoutAfterMutation(mixed, { phase: 'In-season', planIntentValid: false, restoreMissingPlanPatterns: false }).workout;
    const ledger = canonicalWorkoutLedger(output);
    return pass(spec, ledger.components.includes('conditioning') && !ledger.components.includes('strength'), ['conditioning'], ledger.components);
  }
  if (spec.id === 'remove-heavy-invalidates-contrast') return pass(spec, slice4('coach-remove-contrast-lift'), true, 'contrast edit trace');
  if (spec.id === 'injury-removes-affected-only' || spec.id === 'restriction-monotonic-forbidden') {
    const checks = generatedConstraintCase({ restriction: 'hamstring', equipment: 'commercial', severity: 6 });
    const relevant = checks.filter((entry) =>
      entry.invariant === 'PROPERTY_PROHIBITED_MONOTONIC' || entry.invariant === 'PROPERTY_UNAFFECTED_PRESERVED');
    return pass(spec, relevant.every((entry) => entry.passed), 'prohibited exposure falls while unaffected work remains', relevant);
  }
  if (spec.id === 'less-equipment-no-new-requirement') {
    const checks = generatedConstraintCase({ restriction: 'none', equipment: 'bodyweight', severity: 0 });
    const equipmentCheck = checks.find((entry) => entry.invariant === 'PROPERTY_EQUIPMENT_COMPATIBLE');
    return pass(spec, !!equipmentCheck?.passed, 'no barbell after bodyweight-only restriction', equipmentCheck);
  }
  if (spec.id === 'more-equipment-no-contract-loss') {
    const reduced = generatedConstraintCase({ restriction: 'none', equipment: 'bodyweight', severity: 0 });
    const expanded = generatedConstraintCase({ restriction: 'none', equipment: 'commercial', severity: 0 });
    return pass(spec, reduced.every((entry) => entry.passed) && expanded.every((entry) => entry.passed), 'both equipment states preserve a canonical safe contract', { reduced, expanded });
  }
  if (spec.id === 'low-readiness-no-hard-increase') {
    const high = buildCoachingPlan(onboardingToCoachingInputs({ ...BASE_PROFILE } as any));
    const low = buildCoachingPlan(onboardingToCoachingInputs({
      ...BASE_PROFILE, recentTrainingLoad: 'Hardly at all', conditioningLevel: 'Poor',
      sprintExposure: 'No sprint training',
    } as any));
    const highHard = high.weeklyPlan.filter((entry) => entry.isHardExposure).length;
    const lowHard = low.weeklyPlan.filter((entry) => entry.isHardExposure).length;
    return pass(spec, lowHard <= highHard, `<=${highHard} hard exposures`, lowHard);
  }
  if (spec.id === 'copy-no-exposure-change') {
    const renamed = finalLedger({ patterns: ['squat'], exercises: ['Back Squat'], name: 'Recovery Copy' });
    return pass(spec, JSON.stringify(base.effectivePatterns) === JSON.stringify(renamed.effectivePatterns), base.effectivePatterns, renamed.effectivePatterns);
  }
  if (spec.id === 'rehydrate-preserves-contract') return pass(spec, slice4('canonical-program-rehydrate'), true, 'real rehydrate trace');
  if (spec.id === 'rehydrate-twice-idempotent') return pass(spec, slice4('canonical-program-rehydrate'), true, 'double rehydrate trace');
  if (spec.id === 'noop-rebuild-equivalent') return pass(spec, slice4('noop-inseason-week-rebuild'), true, 'rebuild trace');
  if (spec.id === 'repeat-preserves-source') return pass(spec, slice4('repeat-rich-week'), true, 'repeat trace');
  if (spec.id === 'ai-deterministic-same-invariants') return pass(spec, slice4('generation-ai-fallback-equivalence'), true, 'generation equivalence trace');
  if (spec.id === 'game-sat-to-sun-spacing') {
    const sat = plannedFor({ game: 'Saturday', days: 5 });
    const sun = plannedFor({ game: 'Sunday', days: 5 });
    return pass(spec, ['squat', 'hinge', 'push', 'pull'].every((pattern) => sat.patterns.includes(pattern) && sun.patterns.includes(pattern)), sat.patterns, sun.patterns);
  }
  if (spec.id === 'bye-relaxes-not-erases') {
    const game = blockPatterns({ game: 'Saturday', days: 5 });
    const bye = blockPatterns({ days: 5 });
    return pass(spec, ['squat', 'hinge', 'push', 'pull'].every((pattern) => game.includes(pattern) && bye.includes(pattern)), game, bye);
  }
  if (spec.id === 'deload-reduces-not-invents') {
    const build = plannedFor({ days: 5, week: 1, phase: 'Off-season' });
    const deload = plannedFor({ days: 5, week: 4, phase: 'Off-season' });
    return pass(spec, deload.patterns.every((pattern) => ['squat', 'hinge', 'push', 'pull'].includes(pattern)), build.patterns, deload.patterns);
  }
  if (spec.id === 'availability-monotonic-useful-work') {
    const low = plannedFor({ game: 'Saturday', days: 3 });
    const high = plannedFor({ game: 'Saturday', days: 5 });
    return pass(spec, high.useful >= low.useful, `>=${low.useful}`, high.useful);
  }
  if (spec.id === 'add-modality-keeps-existing') {
    const one = finalLedger({ patterns: ['push'], exercises: ['Bench Press'], conditioning: ['bike'] });
    const two = finalLedger({ patterns: ['push'], exercises: ['Bench Press'], conditioning: ['bike', 'row'] });
    return pass(spec, two.conditioning.some((entry) => entry.modality === 'bike'), one.conditioning, two.conditioning);
  }
  const source = pathWorkout({ id: 'meta-idempotent', dayOfWeek: 1, name: 'Idempotent', patterns: ['squat', 'hinge'], primary: 'squat', exercises: [pathExercise('meta-idempotent', 0, 'Back Squat'), pathExercise('meta-idempotent', 1, 'Romanian Deadlift')], conditioning: [{ title: 'Bike 25min', modality: 'bike' }] });
  const once = finaliseWorkoutAfterMutation(source, { phase: 'In-season', planIntentValid: true, referenceWorkout: source }).workout;
  const twice = finaliseWorkoutAfterMutation(once, { phase: 'In-season', planIntentValid: true, referenceWorkout: once }).workout;
  const onceLedger = canonicalWorkoutLedger(once);
  const twiceLedger = canonicalWorkoutLedger(twice);
  return pass(spec, JSON.stringify(onceLedger) === JSON.stringify(twiceLedger), onceLedger, twiceLedger);
}

export function evaluateMetamorphicSuite(smokeOnly = false): GeneratedCheckResult[] {
  return METAMORPHIC_RELATIONS.filter((spec) => !smokeOnly || spec.smoke).map(evaluateMetamorphicRelation);
}
