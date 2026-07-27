(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import type { Microcycle, Workout, WorkoutExercise } from '../types/domain';
import type { MainStrengthPattern } from '../rules/strengthPatternContributions';
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
    // Rows carry their OWN typed evidence.
    //
    // They used to ship with none and rely on the safety layer's pattern
    // RESTORATION to classify them — restoration that only ran because a
    // low-readiness frequency ceiling forced it. Sam's readiness law retired that
    // ceiling, so the trigger is gone and unevidenced rows now classify as
    // nothing at all. The fixture was leaning on a side effect of the behaviour
    // under test; evidencing it directly makes these scenarios measure the safety
    // layer rather than the restoration that used to run beside it.
    section18Evidence: {
      protocolVersion: 1,
      role: 'main_strength',
      strengthPattern: patternForExerciseName(name),
      mainStrengthPattern: patternForExerciseName(name),
      provenance: 'canonical_row_classifier',
    },
  };
}

/** The fixture's own name -> pattern map; the production classifier owns the real one. */
function patternForExerciseName(name: string): MainStrengthPattern | null {
  const lowered = name.toLowerCase();
  if (lowered.includes('squat')) return 'squat';
  if (lowered.includes('deadlift') || lowered.includes('hinge') || lowered.includes('thrust')) return 'hinge';
  if (lowered.includes('bench') || lowered.includes('press') || lowered.includes('push')) return 'push';
  if (lowered.includes('pull') || lowered.includes('row') || lowered.includes('chin')) return 'pull';
  return null;
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
    participationProvenance: 'derived_healthy_unrestricted',
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

// Readiness is deloaded-or-not (Sam, 2026-07-27). The tiers and their four
// behavioural flags are retired; severity survives for display only.
function readinessContext(severity = 6): GenerationConstraintContext {
  const readiness: GenerationReadinessConstraint = {
    id: `readiness-deloaded-${severity}`,
    sourceType: 'fatigue',
    deloaded: true,
    sessionsOptional: false,
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

// INVERTED to THE DELOAD LAW (Sam, 2026-07-27): "Power/speed: KEEP a small
// sharp dose ... Power is not removed on a deload; a deload is not a reason to
// lose sharpness." This asserted the exact behaviour the law retires, so it is
// re-pinned to the law rather than deleted — the case still matters, the
// expected answer flipped.
run('scenario', '4 a deloaded readiness week KEEPS its power primers', () => {
  const result = finish(withSafety(baseContract(), readinessContext(6)), [
    workout('power-a', 1, ['Back Squat'], { power: 'lower' }),
    workout('power-b', 3, ['Bench Press'], { power: 'upper' }),
  ]);
  assert(result.evaluation.ledger.power.achievedPrimerCount > 0,
    'readiness removed power, which the deload law keeps');
});

// INVERTED to Sam's readiness law: "Readiness never REMOVES sessions ... session
// counts are structure, and structure does not change." This pinned the count
// cut itself — three strength sessions reduced to two, with a typed ceiling of
// 2 recorded as proof. Both the cut and its ceiling are gone; the assertion now
// proves the sessions SURVIVE.
run('scenario', '5 a deloaded readiness week keeps every strength session', () => {
  const result = finish(withSafety(baseContract(), readinessContext(6)), [
    workout('s1', 1, ['Back Squat']), workout('s2', 3, ['Bench Press']), workout('s3', 5, ['Pull-Ups']),
  ]);
  assert(result.evaluation.ledger.mainStrength.achievedCount === 3,
    `readiness cut the strength count to ${result.evaluation.ledger.mainStrength.achievedCount}`);
  assert(result.contract.safety.mainStrengthFrequencyCeiling === null,
    'readiness imposed a main-strength frequency ceiling, which is a count reduction');
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

// INVERTED with scenario 4: the SCHEDULED deload door keeps power for the same
// authored reason the readiness door does. One law, every door.
run('scenario', '7 a scheduled deload week KEEPS its power primers', () => {
  const result = finish(withSafety(baseContract({ weekKind: 'deload' })), [
    workout('deload', 1, ['Back Squat'], { power: 'lower' }),
  ]);
  assert(result.evaluation.ledger.power.achievedPrimerCount > 0,
    'a deload removed power; DELOAD_LAW.keepPower says otherwise');
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
  const contract = withSafety(baseContract(), readinessContext(6));
  contract.strengthPatterns.prohibitedPatterns = ['squat'];
  contract.strengthPatterns.requiredSafePatterns = ['hinge', 'push', 'pull'];
  const hydratedOnce = finish(withSafety(contract), [workout('hydrate', 1, ['Back Squat', 'Bench Press'], { power: 'lower' })]);
  const hydratedTwice = finish(withSafety(JSON.parse(JSON.stringify(hydratedOnce.contract))), JSON.parse(JSON.stringify(hydratedOnce.workouts)));
  assert(JSON.stringify(hydratedOnce.workouts) === JSON.stringify(hydratedTwice.workouts), 'hydration was not idempotent');
  assert(hydratedTwice.evaluation.ledger.power.achievedPrimerCount === 0 && !allPatterns(hydratedTwice).includes('squat'), 'hydration restored unsafe content');
});

// INVERTED to Sam's readiness law: "There is no full pause. The app never empties
// a week on readiness alone." This scenario drove readiness to severity 10 — the
// old `full_pause` tier — and asserted the week was emptied to Rest. Readiness
// can no longer produce a training pause at ANY severity, so the assertion is
// turned around rather than dropped: the sessions must SURVIVE.
run('scenario', '14 readiness never empties a week, at any severity', () => {
  const result = finish(withSafety(baseContract(), readinessContext(10)), [
    workout('cooked-strength', 1, ['Back Squat']),
    workout('cooked-anchor', 2, [], { anchor: true, sprint: true }),
  ]);
  assert(result.workouts.some((candidate) => candidate.workoutType !== 'Rest'),
    'readiness alone emptied the week to Rest, which the law forbids');
});

// The capability itself is NOT gone — it moved to its only legitimate owner. A
// genuine training pause still collapses every session, and that is what keeps
// scenario 14's inversion honest: the guarantee survives, its trigger narrowed.
run('scenario', '14b a genuine training pause DOES empty the week', () => {
  const paused = withSafety(baseContract());
  paused.safety.trainingPaused = true;
  const result = finish(paused, [
    workout('paused-strength', 1, ['Back Squat']),
    workout('paused-anchor', 2, [], { anchor: true, sprint: true }),
  ]);
  assert(result.workouts.every((candidate) => candidate.workoutType === 'Rest' && candidate.exercises.length === 0),
    'a training pause stored training content');
});

// RE-PINNED to the guarantee it actually owns. This asserted that an unsafe
// override collapses to Rest — but that collapse was an artefact of the fixture's
// unevidenced rows (the same artefact that made scenario 5 read zero): with no
// typed evidence, nothing could be restored, so the session emptied.
//
// Evidenced properly, the safety layer does the better thing the Bible asks for:
// it SUBSTITUTES a safe pattern rather than deleting the athlete's session. The
// guarantee is that nothing unsafe survives — not that nothing survives.
run('scenario', '15 explicit user override cannot bypass active safety', () => {
  const contract = withSafety(baseContract(), injuryContext('lower_body'));
  const unsafeOverride = workout('override', 6, ['Back Squat', 'Romanian Deadlift'], { sprint: true, power: 'lower' });
  const safe = finaliseSection18SafetyWorkout({ contract, workout: unsafeOverride }).workout;
  const patterns = (safe.exercises ?? [])
    .map((exercise) => exercise.section18Evidence?.strengthPattern)
    .filter(Boolean);
  assert(!patterns.includes('squat') && !patterns.includes('hinge'),
    `override kept a prohibited pattern: ${patterns.join(', ')}`);
  assert(!safe.speedBlock, 'override kept sprint work under a lower-body restriction');
  assert(!safe.powerBlock, 'override kept a prohibited lower power family');
});

console.log('\n-- Seven safety properties --');

run('property', 'P1 prohibited patterns never appear in the final effective content', () => {
  const contract = withSafety(baseContract(), injuryContext('lower_body'));
  for (let day = 0; day < 7; day++) {
    const result = finish(contract, [workout(`p1-${day}`, day, ['Back Squat', 'Romanian Deadlift', 'Bench Press'])]);
    assert(!allPatterns(result).includes('squat') && !allPatterns(result).includes('hinge'), `day ${day} leaked a pattern`);
  }
});

// RE-PINNED: the property still holds, but readiness no longer makes power
// ineligible, so it was proving the property against a case that is now eligible.
// An INJURY still makes it ineligible, and that is the honest fixture.
run('property', 'P2 ineligible power count is always zero', () => {
  for (const family of ['lower', 'upper'] as const) {
    const result = finish(withSafety(baseContract(), injuryContext(family === 'lower' ? 'lower_body' : 'upper_body')), [workout(`p2-${family}`, 1, [family === 'lower' ? 'Back Squat' : 'Bench Press'], { power: family })]);
    assert(result.evaluation.ledger.power.achievedPrimerCount === 0, `${family} power survived an injury prohibition`);
  }
});

run('property', 'P2b a deloaded readiness week keeps power in every family', () => {
  for (const family of ['lower', 'upper'] as const) {
    const result = finish(withSafety(baseContract(), readinessContext(6)), [workout(`p2b-${family}`, 1, [family === 'lower' ? 'Back Squat' : 'Bench Press'], { power: family })]);
    assert(result.evaluation.ledger.power.achievedPrimerCount > 0,
      `${family} power was removed by readiness; the deload law keeps it`);
  }
});

// RE-PINNED to an INJURY cap. Readiness no longer reduces a frequency target at
// all, so this property had no reduction left to defend; an injury restriction
// still caps strength frequency to the safely available patterns, which is a real
// cap and the right subject for "canonicalisation cannot raise it".
run('property', 'P3 canonicalisation cannot increase a safety-reduced frequency target', () => {
  const contract = withSafety(baseContract(), injuryContext('lower_body'));
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

// RE-PINNED to an injury reduction. The guarantee — a typed safety reduction is
// never weakened by re-writing the week — is unchanged and still worth proving;
// readiness simply no longer authors a reduction for it to defend.
run('property', 'P6 safety reductions survive every repeated write boundary', () => {
  let contract = withSafety(baseContract(), injuryContext('lower_body'));
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

// M3, redefined under the delivered-vs-remaining ownership (Addendum A §A5,
// Sam's D10). The OLD mutant asserted that a lower-body injury must zero the
// athlete's own TT/game exposure — exactly the silent credit withdrawal the
// ruling forbids, and the coupling that made every ≥6/10 injury unrecordable.
// The defect worth killing is the B4 violation: a contract that WITHDRAWS an
// anchor's production claims without authorising a matching reduction is
// unsatisfiable by construction and must be blocked, not accepted.
run('mutation', 'M3 withdrawing anchor credit without a matching reduction is killed', () => {
  const contract = withSafety(baseContract(), undefined);
  const mutated = JSON.parse(JSON.stringify(contract)) as WeeklyExposureContractV2;
  mutated.anchors = mutated.anchors.map((anchor) => ({
    ...anchor,
    participation: 'modified',
    currentProductionClaim: { conditioning: false, sprintHighSpeed: false, hardDay: false },
  }));
  const observed = evaluateSection18EffectiveWeek({ contract: mutated, workouts: [], weekStart: WEEK_START });
  assert(observed.blockingViolations.some((finding) =>
    finding.code === 'required_minimum_shortfall' || finding.code === 'reduction_contradiction'),
    'credit-withdrawal-without-reduction mutation escaped');
});

// INVERTED then RE-AIMED. Retaining power under low readiness is no longer a
// mutation to kill — it is the law. The mutation that still matters is retaining
// power under an INJURY prohibition, so the test now proves both halves: the
// readiness week raises no breach, and the injury week does.
run('mutation', 'M4 retaining power under an injury prohibition is killed', () => {
  const readinessWeek = withSafety(baseContract(), readinessContext(6));
  const withPower = canonicalWithoutSafety(workout('m4', 1, ['Back Squat'], { power: 'lower' }));
  const readinessObserved = evaluateSection18EffectiveWeek({ contract: readinessWeek, workouts: [withPower], weekStart: WEEK_START });
  assert(!readinessObserved.blockingViolations.some((finding) => finding.code === 'power_policy_breach'),
    'a deloaded readiness week reported power as a breach; the deload law keeps power');

  const injuryWeek = withSafety(baseContract(), injuryContext('lower_body'));
  const injuryObserved = evaluateSection18EffectiveWeek({ contract: injuryWeek, workouts: [withPower], weekStart: WEEK_START });
  assert(injuryObserved.blockingViolations.some((finding) => finding.code === 'power_policy_breach'),
    'injury-prohibited power escaped');
});

// RE-PINNED to an injury reduction, for the same reason as P6: the mutation —
// lowering the contract until the unsafe week passes — is still real, but the
// reduction it lowers must be one that still exists.
run('mutation', 'M5 lowering the contract to match unsafe output is killed', () => {
  const contract = withSafety(baseContract(), injuryContext('lower_body'));
  const unsafeWorkouts = [
    workout('m5-a', 1, ['Back Squat']),
    workout('m5-b', 3, ['Bench Press']),
    workout('m5-c', 5, ['Pull-Ups']),
  ];
  const conformed = finish(contract, unsafeWorkouts);
  assert(conformed.evaluation.ledger.mainStrength.achievedCount === 2,
    'source policy did not enforce the approved reduction');
  const mutated = JSON.parse(JSON.stringify(contract)) as WeeklyExposureContractV2;
  const reduction = mutated.authorisedReductions.find((entry) => entry.metric === 'main_strength_frequency' && entry.reason === 'injury_restriction');
  assert(!!reduction, 'fixture lacked the injury reduction');
  reduction.reducedTarget = 3;
  mutated.safety.mainStrengthFrequencyCeiling = 3;
  const unsafeAccepted = finish(mutated, unsafeWorkouts);
  assert(
    unsafeAccepted.evaluation.ledger.mainStrength.achievedCount >
      contract.safety.mainStrengthFrequencyCeiling!,
    'contract-lowering mutation did not violate the original approved ceiling',
  );
});

// RE-PINNED to an injury prohibition: hydrated power must still be stripped by
// the finaliser, but readiness is no longer what makes it unsafe.
run('mutation', 'M6 skipping post-hydration safety validation is killed', () => {
  const contract = withSafety(baseContract(), injuryContext('lower_body'));
  const rawHydrated = canonicalWithoutSafety(workout('m6', 1, ['Back Squat'], { power: 'lower' }));
  assert(!!rawHydrated.powerBlock, 'fixture did not contain unsafe hydrated power');
  const conformed = finish(contract, [rawHydrated]);
  assert(conformed.evaluation.ledger.power.achievedPrimerCount === 0, 'hydration finalizer did not kill mutation');
});

console.log(`\nsection18SafetyBoundaryTests: ${passed} passed, ${failed} failed`);
console.log(`SECTION18_SAFETY_TOTALS scenarios=${scenarios} rules=6 properties=${properties} mutations=${mutations}`);
if (failed > 0) process.exit(1);
