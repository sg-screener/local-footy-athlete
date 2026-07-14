(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import type { Microcycle, Workout, WorkoutExercise } from '../types/domain';
import type { ActiveInjuryConstraint } from '../store/coachUpdatesStore';
import type {
  GenerationConstraintContext,
  GenerationInjuryConstraint,
  GenerationReadinessConstraint,
} from '../utils/generationConstraints';
import { finaliseWorkoutAfterMutation } from '../utils/workoutCanonicalisation';
import { validateMicrocycleAgainstActiveConstraints } from '../utils/postGenerationConstraintValidation';
import { buildRepeatWeekOverlay } from '../utils/repeatWeek';
import {
  buildSection18WeeklyExposureContractV2,
  type AnchorParticipationState,
  type Section18AuthorisedReduction,
  type WeeklyExposureContractV2,
} from '../rules/weeklyExposureContractV2';
import { applyGenerationSafetyToSection18Contract } from '../rules/section18SafetyPolicy';
import {
  finaliseSection18SafetyWeek,
  finaliseSection18SafetyWorkout,
} from '../rules/section18SafetyFinaliser';
import { evaluateSection18EffectiveWeek } from '../rules/section18EffectiveWeekEvaluator';

const WEEK_START = '2026-07-13';
const NOW = '2026-07-13T00:00:00.000Z';
let passed = 0;
let failed = 0;
let scenarios = 0;
let properties = 0;
let mutations = 0;

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(kind: 'scenario' | 'property' | 'mutation', name: string, test: () => void): void {
  if (kind === 'scenario') scenarios += 1;
  if (kind === 'property') properties += 1;
  if (kind === 'mutation') mutations += 1;
  try {
    test();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function row(workoutId: string, index: number, name: string): WorkoutExercise {
  const exerciseId = `exercise-${name.toLowerCase().replace(/\W+/g, '-')}`;
  return {
    id: `${workoutId}-row-${index}`,
    workoutId,
    exerciseId,
    exerciseOrder: index + 1,
    prescribedSets: 4,
    prescribedRepsMin: 5,
    prescribedRepsMax: 8,
    restSeconds: 90,
    exercise: {
      id: exerciseId,
      name,
      description: name,
      exerciseType: 'Compound',
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: NOW,
      updatedAt: NOW,
    },
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function workout(
  id: string,
  dayOfWeek: number,
  names: readonly string[] = [],
  options: { power?: 'lower' | 'upper'; sprint?: boolean; anchor?: boolean; intensity?: Workout['intensity'] } = {},
): Workout {
  return {
    id,
    microcycleId: 'safety-week',
    dayOfWeek,
    name: options.anchor ? 'Team Training' : names.length > 0 ? 'Strength Session' : 'Recovery Session',
    description: '',
    durationMinutes: 50,
    intensity: options.intensity ?? 'High',
    workoutType: options.anchor ? 'Team Training' : names.length > 0 ? 'Strength' : 'Recovery',
    sessionTier: names.length > 0 ? 'core' : 'recovery',
    exercises: names.map((name, index) => row(id, index, name)),
    ...(options.power
      ? {
          powerBlock: {
            id: `${id}-power`, kind: 'primer' as const, family: options.power,
            title: 'Power Primer', prescription: '3 x 3', placement: 'pre_lift' as const,
            options: [{ name: options.power === 'lower' ? 'Vertical Jump' : 'Explosive Push-up', sets: 3, repsMin: 3, repsMax: 3, equipmentRequired: [] }],
            notes: [],
            counting: { hardExposure: false as const, mainStrength: false as const, conditioningCredit: 'none' as const, isFinisher: false as const },
          },
        }
      : {}),
    ...(options.sprint
      ? {
          speedBlock: {
            kind: 'true_speed' as const,
            title: 'Max Velocity',
            label: 'Sprint',
            prescription: '4 x 30m',
            intent: 'max_velocity' as const,
          } as Workout['speedBlock'],
        }
      : {}),
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function baseContract(args: {
  mode?: WeeklyExposureContractV2['identity']['mode'];
  weekKind?: Microcycle['weekKind'];
  teamParticipation?: Record<number, AnchorParticipationState>;
  readiness?: 'low' | 'medium' | 'high';
  reductions?: Section18AuthorisedReduction[];
} = {}): WeeklyExposureContractV2 {
  const mode = args.mode ?? 'in_season_game_week';
  return buildSection18WeeklyExposureContractV2({
    seasonPhase: 'In-season',
    declaredSubphase: mode === 'in_season_bye_recovery'
      ? 'bye_recovery'
      : mode === 'in_season_bye_build'
        ? 'bye_build'
        : 'game_week',
    mode,
    blockNumber: 1,
    weekInBlock: 2,
    globalWeek: 2,
    weekKind: args.weekKind ?? 'build',
    anchorState: mode.startsWith('in_season_bye') ? 'bye' : 'game',
    teamTrainingDays: [2],
    teamParticipation: args.teamParticipation,
    fixtureDay: null,
    readiness: args.readiness ?? 'medium',
    cookedReadiness: args.readiness === 'low',
    plannerSelected: {
      mainStrength: mode === 'in_season_bye_recovery' ? 2 : 3,
      coreConditioning: 1,
      sprintHighSpeed: 1,
      powerPrimers: 1,
    },
    reductions: args.reductions,
    currentProductionClaimsAnchorCredit: true,
  });
}

function injuryContext(region: 'lower_body' | 'upper_body'): GenerationConstraintContext {
  const injury: GenerationInjuryConstraint = {
    id: `${region}-injury`,
    sourceType: 'injury',
    bodyPart: region === 'lower_body' ? 'knee' : 'shoulder',
    bucket: region === 'lower_body' ? 'knee' : 'shoulder',
    region,
    severity: region === 'lower_body' ? 8 : 6,
    effectiveSeverity: region === 'lower_body' ? 8 : 6,
    severityBand: region === 'lower_body' ? 'avoid' : 'moderate',
    onboardingSeverity: 'Severe',
    triggers: [],
    reduceAffectedWork: true,
    removeRiskyWork: true,
    pauseAffectedTraining: region === 'lower_body',
    injuryKeys: [region === 'lower_body' ? 'knee' : 'shoulder'],
  };
  return { activeConstraintIds: [injury.id], injuries: [injury], activeInjuryKeys: injury.injuryKeys };
}

function readinessContext(tier: GenerationReadinessConstraint['tier']): GenerationConstraintContext {
  const readiness: GenerationReadinessConstraint = {
    id: `readiness-${tier}`,
    sourceType: 'fatigue',
    severity: tier === 'full_pause' ? 10 : tier === 'major_reduction' ? 8 : 6,
    tier,
    avoidSprint: true,
    avoidHardConditioning: true,
    reduceHardExtras: true,
    preferRecovery: tier !== 'moderate_reduction',
    fullPause: tier === 'full_pause',
  };
  return { activeConstraintIds: [readiness.id], injuries: [], activeInjuryKeys: [], readiness };
}

function withSafety(
  contract: WeeklyExposureContractV2,
  context?: GenerationConstraintContext,
): WeeklyExposureContractV2 {
  return applyGenerationSafetyToSection18Contract({ contract, generationConstraints: context });
}

function finish(contract: WeeklyExposureContractV2, workouts: readonly Workout[]) {
  return finaliseSection18SafetyWeek({ contract, workouts, weekStart: WEEK_START });
}

function allPatterns(result: ReturnType<typeof finish>): string[] {
  return result.workouts.flatMap((candidate) =>
    candidate.exercises.map((exercise) => exercise.section18Evidence?.strengthPattern).filter(Boolean) as string[]);
}

function canonicalWithoutSafety(candidate: Workout): Workout {
  return finaliseWorkoutAfterMutation(candidate, {
    phase: 'In-season',
    restoreMissingPlanPatterns: false,
  }).workout;
}

console.log('\n-- Fifteen fixed Section 18 safety scenarios --');

run('scenario', '1 lower-body injury removes squat and hinge without canonical restoration', () => {
  const contract = withSafety(baseContract(), injuryContext('lower_body'));
  const result = finish(contract, [workout('lower', 1, ['Back Squat', 'Romanian Deadlift', 'Bench Press'])]);
  assert(!allPatterns(result).includes('squat') && !allPatterns(result).includes('hinge'), 'lower patterns returned');
  assert(allPatterns(result).includes('push'), 'unaffected push was not preserved');
});

run('scenario', '2 modified lower-body TT receives no automatic sprint credit', () => {
  const contract = withSafety(baseContract({ teamParticipation: { 2: 'modified' } }), injuryContext('lower_body'));
  const result = finish(contract, [workout('tt', 2, [], { anchor: true })]);
  assert(result.evaluation.ledger.sprintHighSpeed.achievedCount === 0, 'modified TT received sprint credit');
});

run('scenario', '3 upper-body injury removes affected push and preserves safe lower work', () => {
  const contract = withSafety(baseContract(), injuryContext('upper_body'));
  const result = finish(contract, [workout('upper', 1, ['Back Squat', 'Romanian Deadlift', 'Bench Press'])]);
  const patterns = allPatterns(result);
  assert(!patterns.includes('push'), 'affected push returned');
  assert(patterns.includes('squat') && patterns.includes('hinge'), 'safe lower work was lost');
});

run('scenario', '4 low/cooked readiness removes every power primer', () => {
  const result = finish(withSafety(baseContract(), readinessContext('moderate_reduction')), [
    workout('power-a', 1, ['Back Squat'], { power: 'lower' }),
    workout('power-b', 3, ['Bench Press'], { power: 'upper' }),
  ]);
  assert(result.evaluation.ledger.power.achievedPrimerCount === 0, 'power survived low readiness');
});

run('scenario', '5 low-readiness strength frequency reduction survives final canonical construction', () => {
  const result = finish(withSafety(baseContract(), readinessContext('moderate_reduction')), [
    workout('s1', 1, ['Back Squat']), workout('s2', 3, ['Bench Press']), workout('s3', 5, ['Pull-Ups']),
  ]);
  assert(result.evaluation.ledger.mainStrength.achievedCount === 2, 'strength target exceeded two');
  assert(result.contract.safety.mainStrengthFrequencyCeiling === 2, 'typed ceiling was rewritten');
});

run('scenario', '6 bye recovery retains exactly two lighter strength sessions and no power', () => {
  const result = finish(withSafety(baseContract({ mode: 'in_season_bye_recovery' })), [
    workout('bye-a', 1, ['Back Squat', 'Bench Press'], { power: 'lower', intensity: 'High' }),
    workout('bye-b', 4, ['Romanian Deadlift', 'Pull-Ups'], { power: 'upper', intensity: 'Maximal' }),
  ]);
  assert(result.evaluation.ledger.mainStrength.achievedCount === 2, 'bye recovery did not retain two strength sessions');
  assert(result.evaluation.ledger.power.achievedPrimerCount === 0, 'bye recovery retained power');
  assert(result.workouts.every((candidate) => candidate.intensity !== 'High' && candidate.intensity !== 'Maximal'), 'bye strength was not lighter');
  assert(result.workouts.flatMap((candidate) => candidate.exercises).filter((exercise) => exercise.section18Evidence?.role === 'main_strength').every((exercise) => exercise.prescribedSets <= 2), 'bye strength set dose exceeded two');
});

run('scenario', '7 deload power behavior remains zero primers', () => {
  const result = finish(withSafety(baseContract({ weekKind: 'deload' })), [
    workout('deload', 1, ['Back Squat'], { power: 'lower' }),
  ]);
  assert(result.evaluation.ledger.power.achievedPrimerCount === 0, 'deload retained power');
});

run('scenario', '8 constrained TT participation states receive no automatic sprint credit', () => {
  const constrained: AnchorParticipationState[] = ['modified', 'rehab', 'restricted', 'non_contact', 'reduced_running'];
  for (const participation of constrained) {
    const result = finish(withSafety(baseContract({ teamParticipation: { 2: participation } })), [workout(`tt-${participation}`, 2, [], { anchor: true })]);
    assert(result.evaluation.ledger.sprintHighSpeed.achievedCount === 0, `${participation} received sprint credit`);
  }
});

run('scenario', '9 healthy unrestricted TT retains approved anchor credit', () => {
  const result = finish(withSafety(baseContract()), [workout('healthy-tt', 2, [], { anchor: true })]);
  assert(result.contract.anchors[0].participation === 'normal_unrestricted', 'healthy TT was not resolved normally');
  assert(result.evaluation.ledger.conditioning.anchorCoreCount === 1 && result.evaluation.ledger.sprintHighSpeed.achievedCount === 1, 'healthy anchor credit was lost');
});

run('scenario', '10 Coach edit cannot reinsert a prohibited pattern', () => {
  const contract = withSafety(baseContract(), injuryContext('lower_body'));
  const edited = finaliseSection18SafetyWorkout({ contract, workout: workout('coach-edit', 1, ['Back Squat', 'Bench Press']) }).workout;
  assert(!edited.exercises.some((exercise) => exercise.section18Evidence?.strengthPattern === 'squat'), 'Coach edit restored squat');
});

run('scenario', '11 Repeat Week cannot copy prohibited content into the target week', () => {
  const contract = withSafety(baseContract(), injuryContext('lower_body'));
  const overlay = buildRepeatWeekOverlay({
    sourceWorkouts: [workout('repeat-source', 1, ['Back Squat', 'Romanian Deadlift', 'Bench Press'])],
    targetWeekStart: '2026-07-20',
    targetExposureContractV2: contract,
  });
  const result = finaliseSection18SafetyWeek({
    contract,
    workouts: Object.values(overlay.workoutsByDate).filter((value): value is Workout => !!value),
    weekStart: overlay.weekStart,
  });
  assert(!allPatterns(result).includes('squat') && !allPatterns(result).includes('hinge'), 'Repeat Week copied prohibited work');
});

run('scenario', '12 rebuild and rollover-style revalidation reject a deficient final week', () => {
  const contract = baseContract();
  const microcycle: Microcycle = {
    id: 'rebuild', programId: 'program', weekNumber: 2, miniCycleNumber: 1,
    startDate: `${WEEK_START}T12:00:00.000Z`, endDate: '2026-07-19T12:00:00.000Z',
    intensityMultiplier: 1, workouts: [workout('rebuilt', 1, ['Back Squat', 'Romanian Deadlift', 'Bench Press'])],
    exposureContractV2: contract, createdAt: NOW, updatedAt: NOW,
  };
  const active: ActiveInjuryConstraint = {
    id: 'active-knee', type: 'injury', bodyPart: 'knee', bucket: 'knee', severity: 8,
    status: 'active', startDate: WEEK_START, lastUpdatedAt: NOW, seriousSymptoms: false,
    rules: [], safeFocus: [], advice: [],
  };
  let rejected = false;
  try {
    validateMicrocycleAgainstActiveConstraints({ microcycle, todayISO: WEEK_START, activeConstraints: [active] });
  } catch (error) {
    rejected = (error as { code?: string }).code === 'section18_week_rejected';
  }
  assert(rejected, 'rebuild/rollover stored a week that was safe-filtered below its approved core targets');
});

run('scenario', '13 rehydration cannot restore prohibited content or power', () => {
  const contract = withSafety(baseContract(), readinessContext('moderate_reduction'));
  contract.strengthPatterns.prohibitedPatterns = ['squat'];
  contract.strengthPatterns.requiredSafePatterns = ['hinge', 'push', 'pull'];
  const hydratedOnce = finish(withSafety(contract), [workout('hydrate', 1, ['Back Squat', 'Bench Press'], { power: 'lower' })]);
  const hydratedTwice = finish(withSafety(JSON.parse(JSON.stringify(hydratedOnce.contract))), JSON.parse(JSON.stringify(hydratedOnce.workouts)));
  assert(JSON.stringify(hydratedOnce.workouts) === JSON.stringify(hydratedTwice.workouts), 'hydration was not idempotent');
  assert(hydratedTwice.evaluation.ledger.power.achievedPrimerCount === 0 && !allPatterns(hydratedTwice).includes('squat'), 'hydration restored unsafe content');
});

run('scenario', '14 full-pause/red-flag state cannot store training content', () => {
  const result = finish(withSafety(baseContract(), readinessContext('full_pause')), [
    workout('paused-strength', 1, ['Back Squat']),
    workout('paused-anchor', 2, [], { anchor: true, sprint: true }),
  ]);
  assert(result.workouts.every((candidate) => candidate.workoutType === 'Rest' && candidate.exercises.length === 0), 'full pause stored training');
});

run('scenario', '15 explicit user override cannot bypass active safety', () => {
  const contract = withSafety(baseContract(), injuryContext('lower_body'));
  const unsafeOverride = workout('override', 6, ['Back Squat', 'Romanian Deadlift'], { sprint: true, power: 'lower' });
  const safe = finaliseSection18SafetyWorkout({ contract, workout: unsafeOverride }).workout;
  assert(safe.workoutType === 'Rest' && !safe.speedBlock && !safe.powerBlock, 'override bypassed safety');
});

console.log('\n-- Seven safety properties --');

run('property', 'P1 prohibited patterns never appear in the final effective content', () => {
  const contract = withSafety(baseContract(), injuryContext('lower_body'));
  for (let day = 0; day < 7; day++) {
    const result = finish(contract, [workout(`p1-${day}`, day, ['Back Squat', 'Romanian Deadlift', 'Bench Press'])]);
    assert(!allPatterns(result).includes('squat') && !allPatterns(result).includes('hinge'), `day ${day} leaked a pattern`);
  }
});

run('property', 'P2 ineligible power count is always zero', () => {
  for (const family of ['lower', 'upper'] as const) {
    const result = finish(withSafety(baseContract(), readinessContext('moderate_reduction')), [workout(`p2-${family}`, 1, [family === 'lower' ? 'Back Squat' : 'Bench Press'], { power: family })]);
    assert(result.evaluation.ledger.power.achievedPrimerCount === 0, `${family} power survived`);
  }
});

run('property', 'P3 canonicalisation cannot increase a safety-reduced frequency target', () => {
  const contract = withSafety(baseContract(), readinessContext('moderate_reduction'));
  for (let count = 0; count <= 6; count++) {
    const result = finish(contract, Array.from({ length: count }, (_, index) => workout(`p3-${count}-${index}`, index, [index % 2 ? 'Bench Press' : 'Back Squat'])));
    assert(result.evaluation.ledger.mainStrength.achievedCount <= 2, `frequency ${count} escaped cap`);
  }
});

run('property', 'P4 constrained participation never receives automatic sprint credit', () => {
  const states: AnchorParticipationState[] = ['modified', 'rehab', 'restricted', 'non_contact', 'reduced_running', 'did_not_participate', 'unknown'];
  for (const state of states) {
    const result = finish(withSafety(baseContract({ teamParticipation: { 2: state } })), [workout(`p4-${state}`, 2, [], { anchor: true })]);
    assert(result.evaluation.ledger.sprintHighSpeed.achievedCount === 0, `${state} received credit`);
  }
});

run('property', 'P5 healthy unrestricted anchor credit remains stable', () => {
  let contract = withSafety(baseContract());
  for (let pass = 0; pass < 4; pass++) {
    const result = finish(contract, [workout(`p5-${pass}`, 2, [], { anchor: true })]);
    assert(result.evaluation.ledger.sprintHighSpeed.achievedCount === 1, `pass ${pass} lost healthy credit`);
    contract = withSafety(result.contract);
  }
});

run('property', 'P6 safety reductions survive every repeated write boundary', () => {
  let contract = withSafety(baseContract(), readinessContext('moderate_reduction'));
  let workouts = [workout('p6-a', 1, ['Back Squat']), workout('p6-b', 3, ['Bench Press']), workout('p6-c', 5, ['Pull-Ups'])];
  for (let pass = 0; pass < 6; pass++) {
    const result = finish(contract, workouts);
    assert(result.contract.safety.mainStrengthFrequencyCeiling === 2 && result.evaluation.ledger.mainStrength.achievedCount <= 2, `pass ${pass} weakened reduction`);
    contract = withSafety(JSON.parse(JSON.stringify(result.contract)));
    workouts = JSON.parse(JSON.stringify(result.workouts));
  }
});

run('property', 'P7 explicit overrides cannot weaken active safety rules', () => {
  const contract = withSafety(baseContract(), injuryContext('lower_body'));
  for (let day = 0; day < 7; day++) {
    const safe = finaliseSection18SafetyWorkout({ contract, workout: workout(`p7-${day}`, day, ['Back Squat'], { sprint: true, power: 'lower' }) }).workout;
    assert(!safe.speedBlock && !safe.powerBlock && !safe.exercises.some((exercise) => exercise.section18Evidence?.strengthPattern === 'squat'), `override ${day} escaped`);
  }
});

console.log('\n-- Six safety mutation witnesses --');

run('mutation', 'M1 dropping prohibited-pattern filtering is killed', () => {
  const contract = withSafety(baseContract(), injuryContext('lower_body'));
  const unsafe = canonicalWithoutSafety(workout('m1', 1, ['Back Squat', 'Bench Press']));
  const observed = evaluateSection18EffectiveWeek({ contract, workouts: [unsafe], weekStart: WEEK_START });
  assert(observed.blockingViolations.some((finding) => finding.code === 'prohibited_pattern_breach'), 'observer missed dropped filter');
});

run('mutation', 'M2 restoring default squat/hinge rows is killed', () => {
  const contract = withSafety(baseContract(), injuryContext('lower_body'));
  const unsafe = canonicalWithoutSafety(workout('m2', 1, ['Back Squat', 'Romanian Deadlift']));
  const observed = evaluateSection18EffectiveWeek({ contract, workouts: [unsafe], weekStart: WEEK_START });
  assert(observed.findings.filter((finding) => finding.code === 'prohibited_pattern_breach').length >= 2, 'restored defaults escaped observer');
});

run('mutation', 'M3 treating every TT as unrestricted is killed', () => {
  const contract = withSafety(baseContract({ teamParticipation: { 2: 'modified' } }), injuryContext('lower_body'));
  const mutated = JSON.parse(JSON.stringify(contract)) as WeeklyExposureContractV2;
  mutated.anchors = mutated.anchors.map((anchor) => ({
    ...anchor,
    participation: 'normal_unrestricted',
    currentProductionClaim: { conditioning: true, sprintHighSpeed: true, hardDay: true },
  }));
  const observed = evaluateSection18EffectiveWeek({ contract: mutated, workouts: [], weekStart: WEEK_START });
  assert(observed.blockingViolations.some((finding) => finding.code === 'reduction_contradiction'), 'unrestricted TT mutation escaped');
});

run('mutation', 'M4 retaining power under low readiness is killed', () => {
  const contract = withSafety(baseContract(), readinessContext('moderate_reduction'));
  const unsafe = canonicalWithoutSafety(workout('m4', 1, ['Back Squat'], { power: 'lower' }));
  const observed = evaluateSection18EffectiveWeek({ contract, workouts: [unsafe], weekStart: WEEK_START });
  assert(observed.blockingViolations.some((finding) => finding.code === 'power_policy_breach'), 'low-readiness power escaped');
});

run('mutation', 'M5 lowering the contract to match unsafe output is killed', () => {
  const contract = withSafety(baseContract(), readinessContext('moderate_reduction'));
  const unsafeWorkouts = [
    workout('m5-a', 1, ['Back Squat']),
    workout('m5-b', 3, ['Bench Press']),
    workout('m5-c', 5, ['Pull-Ups']),
  ];
  const conformed = finish(contract, unsafeWorkouts);
  assert(conformed.evaluation.ledger.mainStrength.achievedCount === 2,
    'source policy did not enforce the approved reduction');
  const mutated = JSON.parse(JSON.stringify(contract)) as WeeklyExposureContractV2;
  const reduction = mutated.authorisedReductions.find((entry) => entry.metric === 'main_strength_frequency' && entry.reason === 'low_readiness');
  assert(!!reduction, 'fixture lacked readiness reduction');
  reduction.reducedTarget = 3;
  mutated.safety.mainStrengthFrequencyCeiling = 3;
  const unsafeAccepted = finish(mutated, unsafeWorkouts);
  assert(
    unsafeAccepted.evaluation.ledger.mainStrength.achievedCount >
      contract.safety.mainStrengthFrequencyCeiling!,
    'contract-lowering mutation did not violate the original approved ceiling',
  );
});

run('mutation', 'M6 skipping post-hydration safety validation is killed', () => {
  const contract = withSafety(baseContract(), readinessContext('moderate_reduction'));
  const rawHydrated = canonicalWithoutSafety(workout('m6', 1, ['Back Squat'], { power: 'lower' }));
  assert(!!rawHydrated.powerBlock, 'fixture did not contain unsafe hydrated power');
  const conformed = finish(contract, [rawHydrated]);
  assert(conformed.evaluation.ledger.power.achievedPrimerCount === 0, 'hydration finalizer did not kill mutation');
});

console.log(`\nsection18SafetyBoundaryTests: ${passed} passed, ${failed} failed`);
console.log(`SECTION18_SAFETY_TOTALS scenarios=${scenarios} rules=6 properties=${properties} mutations=${mutations}`);
if (failed > 0) process.exit(1);
