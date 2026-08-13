(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
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
import { addDays } from '../utils/sessionResolver';
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
import { hasPowerRow } from '../rules/sessionRowCounting';

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
    // Power is a ROW with a typed role, leading the list.
    exercises: [
      ...(options.power
        ? [{
            id: `${id}-power`,
            workoutId: id,
            exerciseId: `${id}-power-ex`,
            exerciseOrder: 0,
            prescribedSets: 3,
            prescribedRepsMin: 3,
            prescribedRepsMax: 3,
            restSeconds: 120,
            role: 'power' as const,
            power: { family: options.power, kind: 'primer' as const },
            section18Evidence: {
              protocolVersion: 1 as const,
              role: 'power' as const,
              strengthPattern: null,
              mainStrengthPattern: null,
              provenance: 'canonical_row_classifier' as const,
            },
            exercise: {
              id: `${id}-power-ex`,
              name: options.power === 'lower' ? 'Vertical Jump' : 'Explosive Push-up',
              description: 'Power',
              muscleGroups: [],
              exerciseType: 'Plyometric' as const,
              equipmentRequired: [],
              difficultyLevel: 'Intermediate' as const,
              createdAt: NOW, updatedAt: NOW,
            },
            createdAt: NOW, updatedAt: NOW,
          }]
        : []),
      ...names.map((name, index) => row(id, index, name)),
    ],

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
  /**
   * THE FIXTURE HELD THE HOMONYM TOO, AND SPLITTING IT IS FREE.
   *
   * One `readiness` argument used to feed BOTH `capacity` (the standing band)
   * and `cookedReadiness` (the declaration) — so a fixture asking for a
   * detrained athlete silently also declared him wrecked, which is the exact
   * conflation Sam cut in production on 2026-07-27.
   *
   * The split is behaviour-identical, not a judgement call: NO caller passes
   * the old argument, so both arms were already `'medium'` and `false`.
   */
  capacity?: 'low' | 'medium' | 'high';
  cookedReadiness?: boolean;
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
    fixtureDays: [],
    capacity: args.capacity ?? 'medium',
    cookedReadiness: args.cookedReadiness ?? false,
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

/**
 * A restriction that leaves NO safe main pattern — the only world that still
 * authorises a main-strength FREQUENCY reduction.
 *
 * WHICH SIDE MOVED, asked and answered. Three cells below (P3, P6, M5) used to
 * reach their frequency reduction through `injuryContext('lower_body')`, a
 * PARTIAL restriction: squat and hinge prohibited, push and pull still safe.
 * Ruled 2026-08-06 (`docs/FINDING_3_RULING_2026-08-06.md`, Bible `:4755`) that a
 * partially-restricted week HOLDS its frequency and substitutes safe work, so
 * that world no longer authorises the reduction those cells defend.
 *
 * Their invariants did not weaken and are not weakened here — a typed reduction
 * must never be escaped, re-derived away, or lowered to match unsafe output. The
 * FIXTURE was what moved, so the fixture is what changed: `:1913` at 8-10/10
 * ("pause affected training entirely… clearly unaffected work only") is where
 * the reduction is authored, and that is where these cells now stand. Editing
 * the assertions to match the new behaviour instead would have been the
 * regression writing its own expectation.
 *
 * Two pause-band injuries are needed, matching `resolveRestrictedMainStrengthPatterns`:
 * a lower-body one takes squat and hinge, and an upper-body one takes push AND
 * pull only when it pauses affected training.
 */
function wholeBodyInjuryContext(): GenerationConstraintContext {
  const lower = injuryContext('lower_body').injuries![0];
  const upper: GenerationInjuryConstraint = {
    ...injuryContext('upper_body').injuries![0],
    id: 'upper-body-pause-injury',
    severity: 9,
    effectiveSeverity: 9,
    // `severityBand` is deliberately INHERITED rather than restated.
    // `resolveRestrictedMainStrengthPatterns` reads `pauseAffectedTraining` and
    // `effectiveSeverity ?? severity` — never the band — so restating it would
    // add a typecheck error against the ratchet for a field nothing consults.
    pauseAffectedTraining: true,
  };
  return {
    activeConstraintIds: [lower.id, upper.id],
    injuries: [lower, upper],
    activeInjuryKeys: [...(lower.injuryKeys ?? []), ...(upper.injuryKeys ?? [])],
  };
}

// Readiness is deloaded-or-not (Sam, 2026-07-27). The tiers and their four
// behavioural flags are retired; severity survives for display only.
/**
 * THE ALL-OPTIONAL WEEK — the world the R-073 lock below is built to defend.
 *
 * `early_offseason` is the ONE mode whose `policy.strength.required` is 0 (Sam,
 * 2026-07-28: *"weeks 1-2 are the optional block and zero completed sessions is
 * a valid honest week"*). Because `weeklyExposureContractV2` builds
 * `requiredSafePatterns` as `policy.balance && policy.strength.required > 0 ? … : []`,
 * this week's required-safe set is EMPTY **for reasons that have nothing to do
 * with safety, and with no injury anywhere in the world.**
 *
 * That is precisely the shape that once zeroed the frequency, and it is why the
 * lock needs an off-season fixture: every in-season mode has `required > 0`, so
 * an in-season-only lock could not tell the two emptiness reasons apart and
 * would pass over the defect it exists to catch.
 */
function earlyOffseasonContract(): WeeklyExposureContractV2 {
  return buildSection18WeeklyExposureContractV2({
    seasonPhase: 'Off-season',
    declaredSubphase: 'early_offseason',
    mode: 'early_offseason',
    blockNumber: 1,
    weekInBlock: 2,
    globalWeek: 2,
    weekKind: 'build',
    anchorState: 'none',
    teamTrainingDays: [],
    participationProvenance: 'derived_healthy_unrestricted',
    fixtureDays: [],
    capacity: 'medium',
    cookedReadiness: false,
    plannerSelected: {
      mainStrength: 0,
      coreConditioning: 0,
      sprintHighSpeed: 0,
      powerPrimers: 0,
    },
    currentProductionClaimsAnchorCredit: true,
  });
}

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
    offseasonSubphase: 'not_off_season',
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

run('scenario', '11 a week-overlay copy cannot copy prohibited content into the target week', () => {
  // Local stand-in for the retired repeat-week overlay builder (HOME_SCREEN_
  // REDESIGN ruling 1 — the athlete-facing repeat-week writer is gone). The
  // safety boundary this proves applies to the week-overlay-copy mechanism
  // itself, not the retired button, so the fixture reproduces an equivalent
  // sparse copy without the deleted module.
  const contract = withSafety(baseContract(), injuryContext('lower_body'));
  const targetWeekStart = '2026-07-20';
  const source = workout('repeat-source', 1, ['Back Squat', 'Romanian Deadlift', 'Bench Press']);
  const targetDate = addDays(targetWeekStart, source.dayOfWeek === 0 ? 6 : source.dayOfWeek - 1);
  const result = finaliseSection18SafetyWeek({
    contract,
    workouts: [{ ...source, id: `${source.id}:week-overlay-copy:${targetDate}` }],
    weekStart: targetWeekStart,
  });
  assert(!allPatterns(result).includes('squat') && !allPatterns(result).includes('hinge'), 'week-overlay copy copied prohibited work');
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
  assert(!hasPowerRow(safe), 'override kept a prohibited lower power family');
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
// SAM'S RULING (2026-07-27): "The deload law changes dose and intensity inside
// sessions, never session identity or count."
//
// A team training session and a game are not app-prescribed sessions — the app
// cannot dose them. Demoting the athlete's participation in them is the app
// asserting a FACT about what the athlete will do on Saturday, and it withdraws
// their conditioning and sprint production with it.
//
// The comment that authorised this justified it explicitly: low readiness
// "authors matching main-strength, conditioning and sprint reductions in the
// same pass, so its contracts stay satisfiable". The readiness law DELETED
// exactly those reductions. What was left withdrew the credit and kept the
// requirement, so the contract asserted both "the athlete's game produced no
// sprint" and "this week requires a sprint exposure" — unsatisfiable before the
// gate even ran. That is the identical shape as the D10 injury defect
// documented in `section18SafetyPolicy`, whose resolution was that no injury
// region silently withdraws field participation.
run('property', 'P2c a readiness deload never withdraws the athlete\'s field participation', () => {
  for (const severity of [4, 6, 8, 10]) {
    const contract = withSafety(baseContract(), readinessContext(severity));
    for (const anchor of contract.anchors) {
      assert(anchor.participation === 'normal_unrestricted',
        `severity ${severity} demoted the ${anchor.kind} anchor to ${anchor.participation}`);
      assert(anchor.currentProductionClaim.conditioning,
        `severity ${severity} withdrew ${anchor.kind} conditioning production`);
      assert(anchor.currentProductionClaim.sprintHighSpeed,
        `severity ${severity} withdrew ${anchor.kind} sprint production`);
    }
  }
});

// The capability is not gone — it moved to the doors that own a medical stop.
run('property', 'P2d a genuine training pause DOES withdraw field participation', () => {
  const paused = applyGenerationSafetyToSection18Contract({
    contract: baseContract(), generationConstraints: readinessContext(9), forceFullPause: true,
  });
  assert(paused.anchors.every((anchor) => anchor.participation !== 'normal_unrestricted'),
    'a training pause left field participation untouched');
});

run('property', 'P3 canonicalisation cannot increase a safety-reduced frequency target', () => {
  const contract = withSafety(baseContract(), wholeBodyInjuryContext());
  const ceiling = contract.safety.mainStrengthFrequencyCeiling;
  assert(ceiling === 0,
    'this cell needs a world with an authorised frequency ceiling to defend, and the '
    + `whole-body restriction produced ${ceiling}. Without one it would pass vacuously.`);
  for (let count = 0; count <= 6; count++) {
    const result = finish(contract, Array.from({ length: count }, (_, index) => workout(`p3-${count}-${index}`, index, [index % 2 ? 'Bench Press' : 'Back Squat'])));
    assert(result.evaluation.ledger.mainStrength.achievedCount <= ceiling, `frequency ${count} escaped cap`);
  }

  // THE OTHER SIDE OF THE RULING, pinned in the same cell so the fixture move
  // above can never be mistaken for a relaxation: a PARTIAL restriction must
  // author no frequency ceiling at all. A regression that reinstated the
  // pattern-count cap under any name would fail here.
  const partial = withSafety(baseContract(), injuryContext('lower_body'));
  assert(partial.strengthPatterns.requiredSafePatterns.length > 0,
    'the partial fixture left no safe pattern, so it is the whole-body case and proves nothing');
  assert(partial.safety.mainStrengthFrequencyCeiling === null ||
    partial.safety.mainStrengthFrequencyCeiling === undefined,
    'a partially-restricted week authored a main-strength frequency ceiling of '
    + `${partial.safety.mainStrengthFrequencyCeiling} while `
    + `${JSON.stringify(partial.strengthPatterns.requiredSafePatterns)} remained safe. `
    + 'Bible :4755 — substitute before reducing frequency (ruled 2026-08-06).');
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
  let contract = withSafety(baseContract(), wholeBodyInjuryContext());
  let workouts = [workout('p6-a', 1, ['Back Squat']), workout('p6-b', 3, ['Bench Press']), workout('p6-c', 5, ['Pull-Ups'])];
  for (let pass = 0; pass < 6; pass++) {
    const result = finish(contract, workouts);
    assert(result.contract.safety.mainStrengthFrequencyCeiling === 0 && result.evaluation.ledger.mainStrength.achievedCount <= 0, `pass ${pass} weakened reduction`);
    contract = withSafety(JSON.parse(JSON.stringify(result.contract)));
    workouts = JSON.parse(JSON.stringify(result.workouts));
  }
});

run('property', 'P7 explicit overrides cannot weaken active safety rules', () => {
  const contract = withSafety(baseContract(), injuryContext('lower_body'));
  for (let day = 0; day < 7; day++) {
    const safe = finaliseSection18SafetyWorkout({ contract, workout: workout(`p7-${day}`, day, ['Back Squat'], { sprint: true, power: 'lower' }) }).workout;
    assert(!safe.speedBlock && !hasPowerRow(safe) && !safe.exercises.some((exercise) => exercise.section18Evidence?.strengthPattern === 'squat'), `override ${day} escaped`);
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
  // THE KILL CRITERION MOVED TO THE BOUNDARY THIS MODULE ACTUALLY DEFENDS, and
  // the reason is a property of the ruling rather than a convenience.
  //
  // The old criterion was "the lowered contract lets the week exceed the original
  // ceiling". That needs a reduction which BINDS ON ITS OWN. After the 2026-08-06
  // ruling an injury-authored `main_strength_frequency` reduction exists only
  // when NO main pattern is safe — and in that world every strength row is
  // already stripped by the pattern prohibition, so raising the frequency ceiling
  // changes nothing observable. Measured, not assumed: with the whole-body
  // fixture the mutated contract still achieved 0. A cell that cannot observe its
  // own mutant is not a witness, so leaving it pointed there would have been a
  // gate passing on coordinates it never builds.
  //
  // What this module promises in its own docstring is the stronger claim anyway:
  // "The post-canonical finaliser must conform to this policy; it must never
  // lower the policy to match unsafe output." So the mutant to kill is a LOWERED
  // POLICY, and the kill is that it does not survive re-projection from the typed
  // source of truth. Generation constraints are that source; the contract is a
  // projection of them, and a projection cannot outrank what it projects.
  const contract = withSafety(baseContract(), wholeBodyInjuryContext());
  const approvedCeiling = contract.safety.mainStrengthFrequencyCeiling;
  assert(approvedCeiling === 0,
    `this cell needs an approved frequency ceiling to defend, and got ${approvedCeiling}`);
  const unsafeWorkouts = [
    workout('m5-a', 1, ['Back Squat']),
    workout('m5-b', 3, ['Bench Press']),
    workout('m5-c', 5, ['Pull-Ups']),
  ];
  const conformed = finish(contract, unsafeWorkouts);
  assert(conformed.evaluation.ledger.mainStrength.achievedCount === 0,
    'source policy did not enforce the approved reduction');

  const mutated = JSON.parse(JSON.stringify(contract)) as WeeklyExposureContractV2;
  const reduction = mutated.authorisedReductions.find((entry) =>
    entry.metric === 'main_strength_frequency' && entry.reason === 'injury_restriction');
  assert(!!reduction, 'fixture lacked the injury reduction');
  reduction.reducedTarget = 3;
  mutated.safety.mainStrengthFrequencyCeiling = 3;
  assert(mutated.safety.mainStrengthFrequencyCeiling === 3,
    'the mutation did not take, so the kill below would be vacuous');

  const reprojected = withSafety(mutated);
  assert(reprojected.safety.mainStrengthFrequencyCeiling === approvedCeiling,
    'a contract lowered to match unsafe output SURVIVED re-projection — the ceiling came '
    + `back as ${reprojected.safety.mainStrengthFrequencyCeiling} instead of `
    + `${approvedCeiling}. The policy is projected from the typed constraints and must never `
    + 'be lowered to match whatever output happened to survive.');
  const afterReprojection = finish(reprojected, unsafeWorkouts);
  assert(afterReprojection.evaluation.ledger.mainStrength.achievedCount <= approvedCeiling,
    'the re-projected contract still admitted work the approved reduction forbids');
});

// RE-PINNED to an injury prohibition: hydrated power must still be stripped by
// the finaliser, but readiness is no longer what makes it unsafe.
run('mutation', 'M6 skipping post-hydration safety validation is killed', () => {
  const contract = withSafety(baseContract(), injuryContext('lower_body'));
  const rawHydrated = canonicalWithoutSafety(workout('m6', 1, ['Back Squat'], { power: 'lower' }));
  assert(hasPowerRow(rawHydrated), 'fixture did not contain unsafe hydrated power');
  const conformed = finish(contract, [rawHydrated]);
  assert(conformed.evaluation.ledger.power.achievedPrimerCount === 0, 'hydration finalizer did not kill mutation');
});

// ── The subphase is carried, never guessed ──
//
// This boundary rebuilds the canonicalisation context from the contract, and it
// used to drop `offseasonSubphase`. `updatePowerForPhase` then read the absence
// as `early_offseason` and deleted the power block with the reason
// `early_offseason_power_blocked` — on a LATE off-season week, where power is
// exactly what the athlete should be getting.
//
// It surfaced on deload weeks because a deload always sets
// `lighterStrengthRequired`, so this pass always re-canonicalises there. But the
// deload was never the trigger: ANY safety transformation in off-season hit the
// same guess, through five builders including hydration, the coach command
// executor and the plan-change producer. The context field is now REQUIRED, so
// the compiler asks every builder the question; these two tests pin the
// behaviour at the boundary where it was found.
run('property', 'P8 a late off-season safety transformation keeps power', () => {
  const contract = withSafety({
    ...baseContract({ weekKind: 'deload' }),
    identity: {
      ...baseContract().identity,
      seasonPhase: 'Off-season',
      declaredSubphase: 'late_offseason',
      weekKind: 'deload',
    },
  });
  assert(contract.safety.lighterStrengthRequired, 'fixture did not trigger a safety transformation');
  assert(!contract.safety.prohibitedPower, 'fixture prohibited power for an unrelated reason');
  const before = workout('late-off', 1, ['Back Squat', 'Bench Press'], { power: 'lower' });
  assert(hasPowerRow(before), 'fixture did not contain power');
  const result = finish(contract, [before]);
  assert(
    hasPowerRow(result.workouts.find((candidate) => candidate.id === 'late-off')!),
    'late off-season power was removed by the safety boundary',
  );
});

// The complement, so the pin above cannot pass by the boundary simply never
// removing power any more: a genuine EARLY off-season week must still lose it.
run('property', 'P9 an early off-season safety transformation still removes power', () => {
  const contract = withSafety({
    ...baseContract({ weekKind: 'deload' }),
    identity: {
      ...baseContract().identity,
      seasonPhase: 'Off-season',
      declaredSubphase: 'early_offseason',
      weekKind: 'deload',
    },
  });
  const result = finish(contract, [workout('early-off', 1, ['Back Squat', 'Bench Press'], { power: 'lower' })]);
  assert(
    !hasPowerRow(result.workouts.find((candidate) => candidate.id === 'early-off')!),
    'early off-season power survived, so the subphase is not being read at all',
  );
});

// ── R-073 · A CUT MUST BE PROVEN, NEVER INFERRED ──────────────────────────
//
// **Sam, 2026-08-13, on a main-strength cut made without proof: *"yeah well that
// sounds shit and not good"*.** That is the ruling. `R-073` carried `UNENFORCED`
// with the note **"the LAW has no gate (nothing PREVENTS an inferred cut), but
// the DEFECT does not reproduce"** — 28 weeks over 7 worlds, zero unexplained
// shortfalls. **So what is owed here is a LOCK, not a repair, and these cells
// are that lock.** The producer is left exactly as it is; nothing below changes
// behaviour.
//
// WHY A LOCK IS WORTH BUILDING OVER A DEFECT THAT DOES NOT REPRODUCE: the cut it
// forbids ALREADY SHIPPED ONCE. `section18SafetyPolicy.ts:299-310` records it —
// the producer once tested `requiredSafe`, which is `[]` whenever the MODE needs
// no strength, and read that mode fact as a whole-body restriction. Measured at
// the time, the restricted early-off-season week's strength exposures went
// 1 -> 0 while the healthy control kept 3. It was caught by a differential
// golden, by luck of what that golden happened to cover, and nothing has stood
// between the repo and its return since.
//
// AND THE STATE THE PRODUCER *DOES* FIRE IN IS PROVEN, NOT GUESSED — measured
// 2026-08-13 by calling `resolveRestrictedMainStrengthPatterns` directly:
//   three SEVERE single-area (knee + back_midline + shoulder) -> ["pull"] safe
//   lower_body + upper_body WITH pauseAffectedTraining        -> []   <- fires
//   one multi-area severe injury + pause, alone               -> ["squat","hinge"]
//   profileInjuries only, every area, all Severe              -> ["pull"] safe
// `pull` is restricted by EXACTLY ONE condition in the whole map
// (`weeklyExposureContractBuilders.ts:244-246`, `region === 'upper_body' &&
// pauseAffectedTraining`). **It takes TWO active injuries to empty the set, and
// no number of profile injuries can ever empty it at any severity** — which is
// why 28 weeks never saw it, and why more of the same worlds never would. In
// that state all four patterns are named by a live injury, so the reason is
// PROVEN and it is NOT what Sam's ruling forbids. **Gate the producer; do not
// "fix" it.**
run('property', 'R-073a a proven cut is still emitted — the lock is not a ban', () => {
  // NON-VACUITY FIRST. A lock whose subject never appears forbids nothing, and
  // this arm is what stops R-073b below from passing over a producer that has
  // simply stopped producing.
  const contract = withSafety(baseContract(), wholeBodyInjuryContext());
  const cut = contract.authorisedReductions.find((entry) =>
    entry.metric === 'main_strength_frequency');
  assert(!!cut, 'the proven world emitted NO main-strength cut, so R-073b guards nothing');
  assert(cut.reason === 'injury_restriction',
    `a proven cut must name its proof; got reason ${cut.reason}`);
  assert(cut.reducedTarget === 0, `expected the proven cut to zero the target, got ${cut.reducedTarget}`);
});

run('mutation', 'R-073b an all-optional week with a PARTIAL injury is never cut', () => {
  // ── THE LOCK, AND THE FIXTURE IS THE WHOLE OF IT ────────────────────────
  //
  // **THE FIRST VERSION OF THIS CELL WAS A BLIND GATE AND ITS MUTANT SURVIVED.**
  // It fed an all-optional week with NO injury at all and asserted no cut. That
  // passes, and it proves nothing: the producer sits inside
  // `if (prohibited.length > 0)` (`section18SafetyPolicy.ts:269`), so a world
  // with no prohibition never reaches the line the ruling is about. Reinstating
  // the historical defect left it GREEN. Recorded rather than quietly corrected,
  // because "the mutant survived" is the only reason the fixture below looks the
  // way it does.
  //
  // **THE DEFECT NEEDS BOTH HALVES AT ONCE**, which is why it was hard to see:
  //   - an injury that prohibits SOME patterns, so the producer is entered;
  //   - a mode whose `strength.required` is 0, so `requiredSafe` collapses to
  //     `[]` for reasons that have nothing to do with safety.
  // A lower-body injury takes squat and hinge. **Push and pull are still safe**,
  // so the honest answer is NO CUT — the week substitutes. The mutant reads the
  // empty `requiredSafe` as "nothing is safe" and zeroes the frequency instead.
  const partial = withSafety(earlyOffseasonContract(), injuryContext('lower_body'));

  // NON-VACUITY, BOTH SIDES — without these the assertion below could pass on a
  // world that never entered the producer (the first version's exact failure) or
  // on one where a cut really would be correct.
  assert((partial.strengthPatterns.prohibitedPatterns ?? []).length > 0,
    'nothing is prohibited, so the producer is never entered and this cell is blind — '
    + 'the precise way the first version of it passed over the defect');
  const stillSafe = ['squat', 'hinge', 'push', 'pull'].filter((pattern) =>
    !(partial.strengthPatterns.prohibitedPatterns ?? []).includes(pattern as MainStrengthPattern));
  assert(stillSafe.length > 0,
    `every pattern is prohibited, so a cut would be PROVEN here and the lock would be `
    + `asserting the wrong thing; safe patterns: ${JSON.stringify(stillSafe)}`);

  const inferred = partial.authorisedReductions.filter((entry) =>
    entry.metric === 'main_strength_frequency');
  assert(inferred.length === 0,
    'AN INFERRED CUT. An all-optional early-off-season week with a PARTIAL '
    + `lower-body injury carries a main_strength_frequency reduction: ${JSON.stringify(inferred)}. `
    + `But ${JSON.stringify(stillSafe)} remain safe, so there IS work to substitute and `
    + 'nothing proves a cut. R-073 — a cut must be PROVEN, never inferred. This is the '
    + 'defect that shipped once already: the producer read `requiredSafe`, which is empty '
    + 'whenever the MODE needs no strength, as a whole-body restriction. Fix the producer, '
    + 'never this cell — and never by lowering the contract to match.');
});

run('property', 'R-073c the outer arm — no healthy week of any mode is cut', () => {
  // THE WEAKER, WIDER ARM, AND ITS LIMIT IS STATED RATHER THAN LEFT TO BE FOUND:
  // no injury means the producer is never entered, so this CANNOT kill the
  // `requiredSafe` mutant — R-073b is what does that. It is kept because it
  // catches a different and cruder regression: a cut appearing on a week with no
  // constraint in it at all, from any future producer that does not sit behind
  // the prohibition check.
  const modes = [
    'in_season_game_week', 'in_season_bye_build', 'in_season_bye_recovery',
  ] as const;
  const worlds: [string, WeeklyExposureContractV2][] = [
    ...modes.map((mode) => [mode, withSafety(baseContract({ mode }), {
      activeConstraintIds: [], injuries: [], activeInjuryKeys: [],
    })] as [string, WeeklyExposureContractV2]),
    ['early_offseason', withSafety(earlyOffseasonContract(), {
      activeConstraintIds: [], injuries: [], activeInjuryKeys: [],
    })],
  ];
  for (const [label, healthy] of worlds) {
    const inferred = healthy.authorisedReductions.filter((entry) =>
      entry.metric === 'main_strength_frequency');
    assert(inferred.length === 0,
      `a healthy ${label} week carries a main-strength cut: ${JSON.stringify(inferred)}`);
  }
});

console.log(`\nsection18SafetyBoundaryTests: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
console.log(`SECTION18_SAFETY_TOTALS scenarios=${scenarios} rules=6 properties=${properties} mutations=${mutations}`);
if (failed > 0) process.exit(1);
