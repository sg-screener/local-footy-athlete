(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type { OnboardingData, Workout, WorkoutExercise } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import {
  evaluateSection18EffectiveWeek,
  type Section18EffectiveWeekEvaluation,
  type Section18FindingCode,
} from '../rules/section18EffectiveWeekEvaluator';
import {
  buildSection18WeeklyExposureContractV2,
  section18PhaseTableSignature,
  type AnchorParticipationState,
  type Section18AuthorisedReduction,
  type Section18ConditioningRole,
  type Section18ConditioningStress,
  type Section18ContractV2Input,
  type Section18Subphase,
  isFixtureWeekMode,
  type Section18WeekMode,
  type WeeklyExposureContractV2,
} from '../rules/weeklyExposureContractV2';
import { buildWeeklyExposureContract } from '../rules/weeklyExposureContractBuilders';
import { evaluateMicrocycleForTests } from './support/evaluateMicrocycle';
import { finaliseWorkoutAfterMutation } from '../utils/workoutCanonicalisation';
import type { MainStrengthPattern } from '../rules/strengthPatternContributions';
import { canonicaliseAcceptedStateCandidate } from '../store/programStore';
import { ensureProgramSeasonPhaseClock } from '../rules/seasonPhaseClock';
import { athleteAnswers, ARCHETYPES } from './compilerYear/catalog';
import { presetEquipmentAnswer } from './support/equipmentAnswerFixture';
import { athletePlacementFor } from '../rules/athletePlacement';
import { auditWeekAgainstCaps, countWeeklyExposures } from '../rules/weeklyExposureCounts';

let pass = 0;
let fail = 0;

function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${name}`);
  } else {
    fail += 1;
    console.error(`  FAIL ${name}`, detail ?? '');
  }
}

function has(
  evaluation: Section18EffectiveWeekEvaluation,
  code: Section18FindingCode,
  domain?: string,
): boolean {
  return evaluation.findings.some((finding) =>
    finding.code === code && (!domain || finding.domain === domain));
}

function row(
  workoutId: string,
  index: number,
  role: WorkoutExercise['section18Evidence']['role'],
  pattern: MainStrengthPattern | null = null,
): WorkoutExercise {
  return {
    id: `${workoutId}-row-${index}`,
    workoutId,
    exerciseId: `${role}-${pattern ?? index}`,
    exerciseOrder: index + 1,
    prescribedSets: 3,
    prescribedRepsMin: 5,
    prescribedRepsMax: 8,
    restSeconds: 90,
    notes: '',
    section18Evidence: {
      protocolVersion: 1,
      role,
      strengthPattern: pattern,
      mainStrengthPattern: role === 'main_strength' ? pattern : null,
      provenance: 'canonical_row_classifier',
    },
  } as WorkoutExercise;
}

function baseWorkout(id: string, dayOfWeek: number): Workout {
  return {
    id,
    microcycleId: 'section18-v2-test',
    dayOfWeek,
    name: 'Typed fixture',
    description: '',
    durationMinutes: 45,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [],
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
    section18Evidence: {
      protocolVersion: 1,
      conditioningRole: 'none',
      conditioningStress: 'unknown',
      provenance: 'planner_and_canonical_content',
    },
  };
}

function strength(
  dayOfWeek: number,
  patterns: readonly MainStrengthPattern[],
  opts: { power?: boolean; hard?: boolean; repeated?: Partial<Record<MainStrengthPattern, number>> } = {},
): Workout {
  const workout = baseWorkout(`strength-${dayOfWeek}-${patterns.join('-')}`, dayOfWeek);
  const expanded = patterns.flatMap((pattern) =>
    Array.from({ length: opts.repeated?.[pattern] ?? 1 }, () => pattern));
  workout.exercises = expanded.map((pattern, index) => row(workout.id, index, 'main_strength', pattern));
  workout.strengthIntent = {
    archetype: patterns.some((pattern) => pattern === 'squat' || pattern === 'hinge')
      ? 'lower' : 'upper',
    primaryPattern: patterns[0] ?? null,
    plannedPatterns: [...patterns],
    effectivePatterns: [...patterns],
  };
  workout.intensity = opts.hard ? 'High' : 'Moderate';
  if (opts.power) {
    // Power is a ROW with a typed role now, not a block beside the list.
    workout.exercises = [
      {
        id: `power-${dayOfWeek}`,
        workoutId: workout.id,
        exerciseId: `power-${dayOfWeek}-ex`,
        exerciseOrder: 0,
        prescribedSets: 2,
        prescribedRepsMin: 3,
        prescribedRepsMax: 3,
        restSeconds: 120,
        role: 'power',
        power: { family: 'lower', kind: 'primer' },
        section18Evidence: {
          protocolVersion: 1,
          role: 'power',
          strengthPattern: null,
          mainStrengthPattern: null,
          provenance: 'canonical_row_classifier',
        },
        exercise: {
          id: `power-${dayOfWeek}-ex`,
          name: 'Vertical Jump',
          description: 'Vertical Jump',
          muscleGroups: [],
          exerciseType: 'Plyometric',
          equipmentRequired: [],
          difficultyLevel: 'Intermediate',
          createdAt: '', updatedAt: '',
        },
        createdAt: '', updatedAt: '',
      },
      ...workout.exercises,
    ];
  }
  return workout;
}

function conditioning(
  dayOfWeek: number,
  role: Section18ConditioningRole,
  stress: Section18ConditioningStress,
): Workout {
  const workout = baseWorkout(`conditioning-${dayOfWeek}-${role}-${stress}`, dayOfWeek);
  workout.workoutType = 'Conditioning';
  workout.intensity = stress === 'hard' ? 'High' : stress === 'light' ? 'Light' : 'Moderate';
  workout.exercises = [row(workout.id, 0, 'conditioning')];
  workout.section18Evidence = {
    protocolVersion: 1,
    conditioningRole: role,
    conditioningStress: stress,
    provenance: 'planner_and_canonical_content',
  };
  return workout;
}

function recovery(dayOfWeek: number): Workout {
  const workout = baseWorkout(`recovery-${dayOfWeek}`, dayOfWeek);
  workout.workoutType = 'Recovery';
  workout.sessionTier = 'recovery';
  workout.intensity = 'Light';
  workout.exercises = [row(workout.id, 0, 'recovery_support')];
  return workout;
}

function rest(dayOfWeek: number): Workout {
  const workout = baseWorkout(`rest-${dayOfWeek}`, dayOfWeek);
  workout.workoutType = 'Rest';
  workout.sessionTier = 'recovery';
  workout.durationMinutes = 0;
  workout.exercises = [];
  return workout;
}

const ALL_WEEK_MODES: readonly Section18WeekMode[] = [
  'in_season_game_week', 'practice_match_week', 'in_season_bye_build',
  'in_season_bye_recovery', 'optional_week', 'early_offseason', 'mid_offseason',
  'late_offseason', 'early_preseason', 'mid_preseason', 'late_preseason',
];

function identityFor(mode: Section18WeekMode): {
  phase: OnboardingData['seasonPhase'];
  subphase: Section18Subphase;
  anchorState: Section18ContractV2Input['anchorState'];
} {
  if (mode === 'in_season_game_week') return { phase: 'In-season', subphase: 'game_week', anchorState: 'game' };
  if (mode === 'in_season_bye_build') return { phase: 'In-season', subphase: 'bye_build', anchorState: 'bye' };
  if (mode === 'in_season_bye_recovery') return { phase: 'In-season', subphase: 'bye_recovery', anchorState: 'bye' };
  if (mode === 'practice_match_week') return { phase: 'Pre-season', subphase: 'practice_match_week', anchorState: 'practice_match' };
  // An optional week is not a season position — it DECORATES one. The fixture
  // gives it a real in-season game week to decorate; the old code let the mode
  // name double as a subphase, which is the conflation this unit removed.
  if (mode === 'optional_week') return { phase: 'In-season', subphase: 'game_week', anchorState: 'game' };
  if (mode.endsWith('_preseason')) return { phase: 'Pre-season', subphase: mode as Section18Subphase, anchorState: 'none' };
  return { phase: 'Off-season', subphase: mode as Section18Subphase, anchorState: 'none' };
}

function contract(
  mode: Section18WeekMode,
  overrides: Partial<Section18ContractV2Input> = {},
): WeeklyExposureContractV2 {
  const identity = identityFor(mode);
  return buildSection18WeeklyExposureContractV2({
    seasonPhase: identity.phase!,
    capacity: 'medium',
    declaredSubphase: identity.subphase,
    mode,
    blockNumber: mode === 'late_offseason' ? 2 : 1,
    weekInBlock: mode === 'mid_offseason' ? 3 : 1,
    globalWeek: mode === 'late_offseason' ? 5 : mode === 'mid_offseason' ? 3 : 1,
    phaseWeek: mode === 'late_offseason' ? 5 : mode === 'mid_offseason' ? 3 : 1,
    phaseWeekProvenance: 'explicit_user_phase_change',
    weekKind: 'build',
    anchorState: identity.anchorState,
    teamTrainingDays: [],
    fixtureDays: [],
    plannerSelected: {
      mainStrength: 4,
      coreConditioning: 4,
      optionalFlush: 0,
      sprintHighSpeed: 1,
      powerPrimers: 0,
    },
    prohibitedPatterns: [],
    prohibitedPatternProvenance: 'explicit_none',
    equipment: {
      appConditioningFeasible: true,
      substitutionStatus: 'not_required',
      consideredSubstitutions: [],
    },
    ...overrides,
  });
}

function evaluate(
  value: WeeklyExposureContractV2,
  workouts: Workout[],
  legacyReportedFullRestCount?: number,
): Section18EffectiveWeekEvaluation {
  return evaluateSection18EffectiveWeek({
    contract: value,
    workouts,
    weekStart: '2026-07-13',
    legacyReportedFullRestCount,
  });
}

function normalParticipation(day: number): Record<number, AnchorParticipationState> {
  return { [day]: 'normal_unrestricted' };
}

console.log('\n-- Contract v2 integration and deterministic migration --');
{
  const profile: OnboardingData = {
    ...athleteAnswers({ ...ARCHETYPES[6], initialPhase: 'Pre-season', extraGame: false }),
    seasonPhase: 'Pre-season',
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    equipmentAnswer: presetEquipmentAnswer('commercial_gym', '2026-07-13'),
    experienceLevel: '2-5 years',
    conditioningLevel: 'Elite',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
  };
  const originalWarn = console.warn;
  const originalLog = console.log;
  console.warn = () => undefined;
  console.log = () => undefined;
  const generated = generateProgramLocally(profile, { todayISO: '2026-07-13', activeConstraints: [] });
  console.warn = originalWarn;
  console.log = originalLog;
  const week = generated.microcycles[0];
  ok('initial generation emits Contract v2', week.exposureContractV2?.protocolVersion === 2);
  ok('edge-authored Week 1 and deterministic Weeks 2-4 all emit Contract v2',
    generated.microcycles.length === 4 &&
    generated.microcycles.every((candidate) => candidate.exposureContractV2?.protocolVersion === 2));
  ok('shared microcycle observer consumes generated v2 contract', !!evaluateMicrocycleForTests(week));
  ok('healthy generated TT resolves to normal unrestricted participation',
    week.exposureContractV2?.anchors.every((anchor) =>
      anchor.participation === 'normal_unrestricted' &&
      anchor.participationProvenance === 'derived_healthy_unrestricted') === true);
  ok('generated Contract v2 independently satisfies every planner-selected core target',
    generated.microcycles.every((candidate) => {
      const observation = evaluateMicrocycleForTests(candidate);
      return observation !== null && [
        observation.contract.mainStrength.exposure,
        observation.contract.conditioning.core,
        observation.contract.sprintHighSpeed.exposure,
      ].every((policy) => policy.plannerSelectionKind !== 'core' ||
        policy.unresolvedPlannerSelectedShortfall === 0);
    }));

  const beforeHydrationSignatures = generated.microcycles.map((candidate) =>
    section18PhaseTableSignature(candidate.exposureContractV2));
  // THE LIVE RE-ENTRY DOOR. This was `canonicaliseHydratedProgram`, deleted
  // 2026-08-14 with the legacy hydration-migration pipeline (nothing reads a
  // stored program back — `partialize` persists inputs only). The SUBJECT is
  // unchanged and still live: a program that goes back through the install
  // boundary must come out with the same phase-owned Contract v2 signature.
  // `setCurrentProgram` is that boundary, and it is these two steps.
  const roundTripped = ensureProgramSeasonPhaseClock(
    JSON.parse(JSON.stringify(generated)) as typeof generated);
  const rehydrated = canonicaliseAcceptedStateCandidate({ currentProgram: roundTripped }, {
    profile,
  }).currentProgram as typeof generated;
  ok('rehydration preserves every phase-owned Contract v2 selected-target signature',
    JSON.stringify(rehydrated.microcycles.map((candidate) =>
      section18PhaseTableSignature(candidate.exposureContractV2))) ===
      JSON.stringify(beforeHydrationSignatures));

  // ── ITEM 7a: STRENGTH CAPACITY MUST NOT COUNT THE GAME DAY ───────────────
  //
  // Conditioning is capped at anchorCredit + its placement days, sprint likewise.
  // Strength alone was capped at raw `selected.length` — every selected day, THE
  // GAME DAY INCLUDED — so its capacity counted a day no strength session can be
  // placed on.
  //
  // ⚠ THIS IS AN ATTRIBUTION FIX, NOT A BEHAVIOURAL ONE, AND THE CELLS SAY SO.
  // Measured against HEAD on five week shapes: the strength TARGET NUMBER is
  // IDENTICAL either way (2, 2, 3, 3, 1) because `spacing_safety_conflict` was
  // already cutting the same week to the same number. What changes is WHICH RULE
  // TAKES THE CREDIT. So these cells assert the REDUCTION REASON — the only thing
  // that actually moves. An earlier draft asserted `targetCount <= 2` and PASSED
  // AT HEAD; its own non-vacuity cell caught it, which is why that cell existed.
  //
  // IT IS STILL WORTH FIXING: the reduction now names its true cause, and if the
  // spacing rule ever changes, capacity still holds the line instead of the week
  // silently gaining a strength slot it has no day for.
  //
  // THE COORDINATE IS BUILT HERE BECAUSE NO FIXTURE HAS IT. Across all 34 QA
  // weeks the game day is never among the selected training days. Nothing
  // prevents the overlap — `selectedDays` and `gameDay` are independent
  // onboarding answers with no filter between them — so it is reachable and
  // merely unexercised.
  {
    const contractFor = (selectedDayNumbers: number[], teamTrainingDayNumbers: number[] = []) =>
      buildWeeklyExposureContract({
        seasonPhase: 'In-season', readiness: 'medium', selectedDayNumbers,
        teamTrainingDayNumbers, hasGame: true, gameDay: 6,
        weekKind: 'game', appConditioningFeasible: true,
      } as never);
    const strengthReasons = (contract: ReturnType<typeof contractFor>) =>
      (contract.reductions as Array<{ domain?: string; reason?: string }>)
        .filter((entry) => entry.domain === 'main_strength')
        .map((entry) => entry.reason);

    // Three training days, and SATURDAY (6) — the game day — is one of them.
    // Strength can use two, so the shortfall is a CAPACITY shortfall.
    const overlapping = contractFor([1, 3, 6]);
    ok('[7a] a selected game day is charged to capacity, not to spacing',
      strengthReasons(overlapping).includes('insufficient_availability'),
      strengthReasons(overlapping).join(',') || '(none)');

    // NON-VACUITY, AND IT IS THE CELL THAT MAKES THE ONE ABOVE MEAN ANYTHING:
    // the same three-day count with the game day NOT among them must NOT report
    // a capacity shortfall. Without this, a builder that always blamed capacity
    // would pass.
    const disjoint = contractFor([1, 3, 5]);
    ok('[7a] three days that exclude the game day report no capacity shortfall',
      !strengthReasons(disjoint).includes('insufficient_availability'),
      strengthReasons(disjoint).join(',') || '(none)');

    // TEAM DAYS ARE STILL COUNTED — strength STACKS on a team night ("Team
    // Training + Upper Pull" is a real generated session), so the fix must not
    // have quietly adopted `nonTeamDays`, which drops those too.
    ok('[7a] a team day still counts toward strength capacity — strength stacks on it',
      !strengthReasons(contractFor([1, 2, 3], [2])).includes('insufficient_availability'),
      strengthReasons(contractFor([1, 2, 3], [2])).join(',') || '(none)');
  }

  ok('retired contract migration cannot author current output',
    !('migrateLegacyWeeklyExposureContractV2' in require('../rules/weeklyExposureContractV2')));

  const sourceWorkout = week.workouts[0];
  const editedWorkout = finaliseWorkoutAfterMutation({
    ...sourceWorkout,
    intensity: sourceWorkout.intensity === 'High' ? 'Moderate' : 'High',
  }, {
    offseasonSubphase: 'not_off_season',
    phase: 'Pre-season',
    weekKind: week.weekKind,
    planIntentValid: false,
    referenceWorkout: sourceWorkout,
  }).workout;
  const editedObservation = evaluateMicrocycleForTests(week, [
    editedWorkout,
    ...week.workouts.slice(1),
  ]);
  ok('Coach-style final canonical mutations are observable from final visible workouts',
    editedWorkout.section18Evidence?.provenance === 'explicit_mutation' && !!editedObservation);

  console.warn = () => undefined;
  console.log = () => undefined;
  const constrained = generateProgramLocally(profile, {
    todayISO: '2026-07-13',
    generationConstraints: {
      activeConstraintIds: ['section18-v2-readiness'],
      injuries: [],
      activeInjuryKeys: [],
      readiness: {
        id: 'section18-v2-readiness',
        sourceType: 'fatigue',
        deloaded: true,
        sessionsOptional: false,
      },
    },
  });
  console.warn = originalWarn;
  console.log = originalLog;
  ok('active-constraint generation still emits observable Contract v2 ledgers',
    constrained.microcycles.every((candidate) =>
      candidate.exposureContractV2?.protocolVersion === 2 && !!evaluateMicrocycleForTests(candidate)));
}

console.log('\n-- Twelve permanent Section 18 violation witnesses --');
const witnesses: Record<string, Section18EffectiveWeekEvaluation> = {};

// 1. Pre-season TT creates a fifth strength exposure.
{
  const c = contract('early_preseason', {
    teamTrainingDays: [2, 4], teamParticipation: normalParticipation(2),
    plannerSelected: { mainStrength: 4, coreConditioning: 4, optionalFlush: 0, sprintHighSpeed: 1, powerPrimers: 0 },
  });
  c.anchors[1].participation = 'normal_unrestricted';
  const workouts = [
    strength(1, ['push']), strength(2, ['hinge']), strength(3, ['pull']),
    strength(5, ['squat']), strength(6, ['push']),
  ];
  witnesses.preseasonFifthStrength = evaluate(c, workouts);
  ok('1. pre-season fifth strength is a maximum breach',
    has(witnesses.preseasonFifthStrength, 'maximum_breach', 'main_strength'));

  const athleteFifth = strength(6, ['push']);
  athleteFifth.athletePlacement = athletePlacementFor({
    constraintId: 'athlete-add-fifth',
    placedDate: '2026-07-18',
    origin: 'session_add',
  });
  const athleteOwned = evaluate(c, [
    strength(1, ['push']), strength(2, ['hinge']), strength(3, ['pull']),
    strength(5, ['squat']), athleteFifth,
  ]);
  ok('1b. an athlete-added fifth remains total training workload',
    athleteOwned.ledger.mainStrength.achievedCount === 5,
    athleteOwned.ledger.mainStrength);
  ok('1c. the planner frequency excludes that athlete-owned fifth',
    athleteOwned.ledger.mainStrength.plannerAchievedCount === 4 &&
      athleteOwned.contract.mainStrength.exposure.achievedCount === 4,
    { ledger: athleteOwned.ledger.mainStrength, contract: athleteOwned.contract.mainStrength.exposure });
  ok('1d. Section 18 does not report the athlete-owned fifth as app over-programming',
    !has(athleteOwned, 'maximum_breach', 'main_strength'),
    athleteOwned.findings);
  const athleteWeeklyCounts = countWeeklyExposures([
    strength(1, ['push']), strength(2, ['hinge']), strength(3, ['pull']),
    strength(5, ['squat']), athleteFifth,
  ].map((workout) => ({ date: `2026-07-${12 + workout.dayOfWeek}`, workout })));
  ok('1d-ii. the weekly cap audit keeps five total but governs four app sessions',
    athleteWeeklyCounts.mainStrengthExposures === 5 &&
      athleteWeeklyCounts.athleteAddedMainStrengthExposures === 1 &&
      !auditWeekAgainstCaps(athleteWeeklyCounts)
        .some((finding) => finding.cap === 'maxMainStrengthSessions' && finding.kind === 'over'),
    { athleteWeeklyCounts, findings: auditWeekAgainstCaps(athleteWeeklyCounts) });

  const completedContract = JSON.parse(JSON.stringify(c)) as WeeklyExposureContractV2;
  completedContract.governedFromISO = '2026-07-20';
  const completedAthleteOwned = evaluateSection18EffectiveWeek({
    contract: completedContract,
    workouts: [
      strength(1, ['push']), strength(2, ['hinge']), strength(3, ['pull']),
      strength(5, ['squat']), athleteFifth,
    ],
    weekStart: '2026-07-13',
    deliveredDates: new Set(['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-17', '2026-07-18']),
  });
  ok('1e. completed athlete-added work stays in history without entering planner frequency',
    completedAthleteOwned.ledger.mainStrength.split.delivered === 5 &&
      completedAthleteOwned.ledger.mainStrength.split.appDelivered === 4 &&
      completedAthleteOwned.ledger.mainStrength.achievedCount === 5 &&
      completedAthleteOwned.ledger.mainStrength.plannerAchievedCount === 4,
    completedAthleteOwned.ledger.mainStrength);
  const strippedOwnership = { ...athleteFifth, athletePlacement: undefined };
  const ownershipMutation = evaluate(c, [
    strength(1, ['push']), strength(2, ['hinge']), strength(3, ['pull']),
    strength(5, ['squat']), strippedOwnership,
  ]);
  ok('MUTATION KILLED stripping athlete ownership makes the fifth an app breach',
    has(ownershipMutation, 'maximum_breach', 'main_strength'),
    ownershipMutation.ledger.mainStrength);
  const editedExisting = {
    ...athleteFifth,
    athletePlacement: { ...athleteFifth.athletePlacement!, origin: 'session_edit' as const },
  };
  const editedExistingEvaluation = evaluate(c, [
    strength(1, ['push']), strength(2, ['hinge']), strength(3, ['pull']),
    strength(5, ['squat']), editedExisting,
  ]);
  ok('1f. athlete ownership on an existing programmed session does not exempt app frequency',
    editedExistingEvaluation.ledger.mainStrength.plannerAchievedCount === 5 &&
      has(editedExistingEvaluation, 'maximum_breach', 'main_strength'),
    editedExistingEvaluation.ledger.mainStrength);
}

// 2. Injury-prohibited squat returns during canonical output.
{
  const c = contract('mid_offseason', {
    prohibitedPatterns: ['squat', 'hinge'], prohibitedPatternProvenance: 'active_constraints',
    plannerSelected: { mainStrength: 2, coreConditioning: 3, optionalFlush: 0, sprintHighSpeed: 0, powerPrimers: 0 },
  });
  witnesses.prohibitedPattern = evaluate(c, [
    strength(1, ['squat', 'push']), strength(3, ['pull']), strength(5, ['push']),
  ]);
  ok('2. restored prohibited squat is detected',
    has(witnesses.prohibitedPattern, 'prohibited_pattern_breach'));
}

// 3. Low readiness target two lifts/no power; final has three lifts and primers.
{
  const reductions: Section18AuthorisedReduction[] = [{
    metric: 'main_strength_frequency', originalApprovedTarget: 4, reducedTarget: 2,
    reason: 'low_readiness', scope: 'week', change: 'frequency',
    detail: 'Cooked readiness reduced weekly strength.', provenance: 'live_typed_reduction',
  }];
  const c = contract('mid_offseason', {
    capacity: 'medium', cookedReadiness: true, reductions,
    plannerSelected: { mainStrength: 2, coreConditioning: 1, optionalFlush: 0, sprintHighSpeed: 0, powerPrimers: 0 },
  });
  witnesses.reductionAndPower = evaluate(c, [
    strength(1, ['squat', 'push'], { power: true }),
    strength(3, ['hinge', 'pull'], { power: true }),
    strength(5, ['push', 'pull'], { power: true }),
  ]);
  ok('3a. readiness reduction overshoot is detected',
    has(witnesses.reductionAndPower, 'reduction_contradiction'));
  // 3a-ii. AN AUTHORISED REDUCTION IS A FLOOR THE ATHLETE MAY EXCEED, NOT A
  // CEILING THAT KILLS THEIR DOORS. Launch audit 2026-08-25: a stored
  // strength_pattern_count reduction (frozen when a session was MOVED off its
  // day) sat below the week the athlete actually has, and because the
  // overshoot was a BLOCKING violation, every later transaction on that week
  // — including a one-exercise swap — was rejected and rolled back with "try
  // again". Exceeding a reduced minimum means the athlete is training MORE
  // than the authorised worst case; the finding stays (3a proves detection,
  // the mutation arm still kills its deletion) but it is disclosed, never
  // blocking.
  ok('3a-ii. reduction overshoot is advisory — it may not block the week',
    !witnesses.reductionAndPower.blockingViolations.some(
      (finding) => finding.code === 'reduction_contradiction'),
    witnesses.reductionAndPower.blockingViolations.map((finding) => finding.code));
  ok('3b. cooked-readiness primers are detected',
    has(witnesses.reductionAndPower, 'power_policy_breach'));
}

// 4. Early off-season optional conditioning reaches five against maximum three.
{
  const c = contract('early_offseason', {
    plannerSelected: { mainStrength: 0, coreConditioning: 5, optionalFlush: 5, sprintHighSpeed: 0, powerPrimers: 0 },
  });
  witnesses.earlyOptionalFive = evaluate(c, [1, 2, 3, 4, 5].map((day) =>
    conditioning(day, 'optional_flush', 'light')));
  ok('4. five optional early-off-season conditioning sessions breach maximum three',
    has(witnesses.earlyOptionalFive, 'maximum_breach', 'conditioning'));
}

// 5. Bye recovery has one lift instead of exactly two.
{
  const c = contract('in_season_bye_recovery', {
    plannerSelected: { mainStrength: 1, coreConditioning: 0, optionalFlush: 1, sprintHighSpeed: 0, powerPrimers: 0 },
  });
  witnesses.byeRecoveryOneLift = evaluate(c, [
    strength(1, ['squat', 'hinge', 'push', 'pull']), conditioning(3, 'optional_flush', 'light'),
  ]);
  ok('5. one-lift bye recovery is below exactly two',
    has(witnesses.byeRecoveryOneLift, 'required_minimum_shortfall', 'main_strength'));
}

// 6. Practice match with 0 TT finishes below the authored strength/C3 floors.
//
// RE-POINTED (Sam, 2026-07-28). This witness built TWO strength sessions and
// expected a shortfall, because `practice_match_week` used to require three.
// The practice-match ruling makes a fixture week structurally an in-season game
// week, which requires TWO — so two sessions is now a legal week and the
// witness was testing the old floor. It builds ONE, which is below the floor
// the ruling actually authored.
//
// The conditioning half (6b) is unchanged: a fixture week still requires three.
{
  const c = contract('practice_match_week', {
    fixtureDays: [6], fixtureParticipation: 'normal_unrestricted', currentProductionClaimsAnchorCredit: true,
    plannerSelected: { mainStrength: 2, coreConditioning: 1, optionalFlush: 0, sprintHighSpeed: 1, powerPrimers: 2 },
  });
  witnesses.practiceMatchUnder = evaluate(c, [strength(1, ['push', 'pull'])]);
  ok('6a. PM 0TT strength below the authored minimum is detected',
    has(witnesses.practiceMatchUnder, 'required_minimum_shortfall', 'main_strength'));
  ok('6b. PM 0TT conditioning below three is detected',
    has(witnesses.practiceMatchUnder, 'required_minimum_shortfall', 'conditioning'));
}

// 7. Equipment-constrained conditioning deleted before substitution.
{
  const c = contract('late_offseason', {
    equipment: { appConditioningFeasible: false, substitutionStatus: 'not_attempted', consideredSubstitutions: [] },
    plannerSelected: { mainStrength: 4, coreConditioning: 0, optionalFlush: 0, sprintHighSpeed: 1, powerPrimers: 0 },
  });
  witnesses.equipmentDeletion = evaluate(c, [
    strength(1, ['push']), strength(2, ['squat']), strength(4, ['pull']), strength(6, ['hinge']),
  ]);
  ok('7. deletion before equipment substitution is detected',
    has(witnesses.equipmentDeletion, 'equipment_substitution_missing'));
}

// 8. THE REST LAW (Sam, 2026-07-30) — replacing "recovery is excluded from rest".
//
// WHAT 8a/8b/P5 USED TO ASSERT, and why the replacement is STRONGER rather than
// looser. They pinned a real defect: a week LOOKING compliant on rest because
// recovery inflated the achieved count. But the recovery inflating it was the
// APP'S OWN — nine placement sites in `coachingEngine.ts` that cited no authored
// source — and the assertion could not tell the app's recovery from the
// athlete's. So it also fired on an athlete who chose to foam-roll on their
// Sunday, and raised a BLOCKING finding against them for accepting an offer the
// Bible makes explicitly (":122 — you can always add a recovery or mobility flow
// to any day as optional").
//
// Sam's ruling resolves it upstream instead of downstream:
//
//   THE REST QUOTA COUNTS DAYS WITH NO REQUIRED WORK.
//   THE GENERATOR MAY PLACE OPTIONAL WORK — but ONLY under a Sam-authored
//   placement rule, with Sam-authored composition, rendered visibly optional,
//   binnable in one tap, and NEVER counted toward compliance, load or rest.
//
// THE SECOND LINE WAS WRITTEN WRONG ONCE AND IS RECORDED HERE CORRECTED. It read
// "the generator never places optional work uninvited" — my generalisation of a
// finding about Recovery, which Sam WITHDREW on 2026-07-30 as an overreach
// (docs/OPTIONAL_PLACEMENT_LAW_SUPERSESSION_2026-07-30.md). A blanket ban would
// have red-flagged the early off-season all-optional contracts he names as the
// standing precedent, and would have said nothing if an authored gunshow later
// acquired invented composition.
//
// Under the refined law the old defect is still UNREPRESENTABLE rather than
// detected — recovery fails three of the five conditions (no rule, invented
// composition, rest interference), so there is no app-inflated rest count left
// to catch. That is why these cells assert the law rather than the symptom: a
// detector for a condition that cannot arise is a cell that can only ever fire
// on the athlete.
//
// THE UPSTREAM HALF IS ASSERTED WHERE THE GENERATOR IS. This suite builds
// synthetic witnesses and never runs generation, so "the generator places no
// recovery" is proven by `section18RecoveryNeutralityTests` (which generates a
// real program and asserts zero generator-placed recovery) and by
// `sessionTypeCharterTests` group E. Both are in `test:bible`. Neither of the
// two halves is worth anything alone, and this comment exists so nobody removes
// one without the other.
{
  const c = contract('in_season_bye_recovery', {
    plannerSelected: { mainStrength: 2, coreConditioning: 0, optionalFlush: 0, sprintHighSpeed: 0, powerPrimers: 0 },
  });
  witnesses.recoveryRest = evaluate(c, [
    strength(1, ['squat', 'push']), strength(4, ['hinge', 'pull']),
    recovery(2), recovery(3), recovery(5), recovery(6), rest(0),
  ], 5);
  ok('8a. a day of recovery is still a REST day',
    witnesses.recoveryRest.ledger.restStress.trueFullRestDays.length === 5 &&
    witnesses.recoveryRest.ledger.restStress.activeRecoveryDays.length === 4,
    witnesses.recoveryRest.ledger.restStress);
  ok('8b. and the athlete is not blocked for choosing it',
    !has(witnesses.recoveryRest, 'full_rest_miscount') &&
    !has(witnesses.recoveryRest, 'required_minimum_shortfall', 'full_rest'),
    witnesses.recoveryRest.findings);
  // NON-VACUITY. Both cells above would pass on a build that had stopped
  // measuring rest at all, so the two strength days must still take theirs.
  ok('8c. REQUIRED work still breaks rest',
    !witnesses.recoveryRest.ledger.restStress.trueFullRestDays.includes(1) &&
    !witnesses.recoveryRest.ledger.restStress.trueFullRestDays.includes(4),
    witnesses.recoveryRest.ledger.restStress.trueFullRestDays);
}

// 9. Modified TT receives automatic sprint claim.
{
  const c = contract('in_season_bye_build', {
    teamTrainingDays: [2], teamParticipation: { 2: 'modified' },
    currentProductionClaimsAnchorCredit: true,
    plannerSelected: { mainStrength: 3, coreConditioning: 3, optionalFlush: 0, sprintHighSpeed: 1, powerPrimers: 0 },
  });
  witnesses.modifiedTt = evaluate(c, [
    strength(1, ['squat', 'push']), strength(4, ['hinge', 'pull']), strength(6, ['push', 'pull']),
  ]);
  ok('9a. modified TT receives no sprint credit', witnesses.modifiedTt.ledger.sprintHighSpeed.achievedCount === 0);
  ok('9b. modified TT automatic claim is detected', has(witnesses.modifiedTt, 'unjustified_anchor_credit'));
}

// 9c-9f. R-079: THE SPRINT UNIT IS NIGHTS, NOT CREDIT SOURCES.
//
// **Sam, 2026-08-13: *"yes we do nights"*.** One evening can raise TWO sprint
// credit sources — a team-training anchor and a typed `true_speed` block on the
// SAME day — and `achievedCount` used to be `sprintSources.length`, so the
// athlete was charged twice for one night out.
//
// AND IT IS THE PRECONDITION FOR HIS PRE-SEASON RULING: *"in pre season you can
// do flying sprints when there is team training because you will get
// accelerations at footy"*. That is deliberate doubling up on ONE night; under a
// source count his own instruction reads as a breach.
{
  const withSpeedBlock = (dayOfWeek: number): Workout => {
    const w = strength(dayOfWeek, ['push']);
    (w as unknown as { speedBlock: { kind: string } }).speedBlock = { kind: 'true_speed' };
    return w;
  };
  const c = () => contract('in_season_bye_build', {
    teamTrainingDays: [2], teamParticipation: { 2: 'normal_unrestricted' },
    currentProductionClaimsAnchorCredit: true,
    plannerSelected: { mainStrength: 3, coreConditioning: 3, optionalFlush: 0, sprintHighSpeed: 1, powerPrimers: 0 },
  });

  // BOTH CREDITS LAND ON DAY 2 — the team night AND the flying sprints.
  const sameNight = evaluate(c(), [withSpeedBlock(2), strength(4, ['hinge']), strength(6, ['pull'])]);
  ok('9c. [R-079] a team night carrying flying sprints is ONE night, not two',
    sameNight.ledger.sprintHighSpeed.achievedCount === 1,
    sameNight.ledger.sprintHighSpeed);
  // NON-VACUITY, AND IT IS THE CELL THAT MATTERS: this must be TWO sources, or
  // 9c passes on a build that simply stopped counting the speed block at all.
  ok('9d. [R-079] ...and both credits are still RECORDED, only the count changed unit',
    sameNight.ledger.sprintHighSpeed.sources.length === 2
      && sameNight.ledger.sprintHighSpeed.sources.every((source) => source.dayOfWeek === 2),
    sameNight.ledger.sprintHighSpeed.sources);

  // TWO SEPARATE NIGHTS STILL COUNT TWO — the guard against "nights" collapsing
  // into "one".
  const twoNights = evaluate(c(), [withSpeedBlock(4), strength(6, ['pull'])]);
  ok('9e. [R-079] a team night and a SEPARATE sprint night are two nights',
    twoNights.ledger.sprintHighSpeed.achievedCount === 2,
    twoNights.ledger.sprintHighSpeed);

  // HIS PER-PHASE NUMBERS, read off the contract the app actually builds.
  // HIS PER-PHASE CEILINGS, read off the contract the app actually builds. The
  // TARGET stays 1 — "may mean 3" is a permission, not a thing to aim for.
  const inSeason = contract('in_season_game_week').sprintHighSpeed.exposure;
  ok('9f. [R-079] in season CAPS at three sprint nights, and the target stays one',
    inSeason.permittedMaximum === 3 && inSeason.defaultTarget === 1, inSeason);
  // ⚠ AND IT IS THE FIRST CEILING IN-SEASON HAS EVER HAD — census A6 recorded
  // sprint as uncapped in six phases, which is what `max: null` meant.
  ok('9g. [R-079] the in-season ceiling is a real number, not null',
    typeof inSeason.permittedMaximum === 'number', inSeason.permittedMaximum);
}

// 9h. R-079 FOLLOW-ON: A NO-CLUB WEEK OWES A SPRINT EXPOSURE IT NEVER GETS.
//
// **MEASURED 2026-08-13: the app PRESCRIBES no sprint work at all.** Across
// pre-season and in-season worlds, `workout.speedBlock` is absent, no
// conditioning row carries `category: 'sprint'`, and no row is named for sprint
// work. **Every sprint credit in the ledger comes from a team-training anchor.**
//
// A CLUB athlete therefore meets `sprint.required: 1` from the club alone. This
// cell asks the question that leaves: **what happens to an athlete with NO
// club?** The contract still requires one, and nothing delivers it.
//
// THIS CELL DOES NOT ASSERT A FIX — it PINS the current answer, so that when
// someone builds sprint placement the change is visible rather than silent.
{
  const c = contract('in_season_bye_build', {
    teamTrainingDays: [], teamParticipation: {},
    currentProductionClaimsAnchorCredit: false,
    plannerSelected: { mainStrength: 3, coreConditioning: 3, optionalFlush: 0, sprintHighSpeed: 1, powerPrimers: 0 },
  });
  const noClub = evaluate(c, [
    strength(1, ['squat', 'push']), strength(4, ['hinge', 'pull']), strength(6, ['push', 'pull']),
  ]);
  // NON-VACUITY: the week must genuinely require a sprint, or the cell below is
  // asserting nothing.
  ok('9h. [R-079] a no-club week still REQUIRES a sprint exposure',
    c.sprintHighSpeed.exposure.requiredMinimum >= 1, c.sprintHighSpeed.exposure);
  ok('9i. [R-079] ...and with no club and no speed block, it achieves ZERO',
    noClub.ledger.sprintHighSpeed.achievedCount === 0, noClub.ledger.sprintHighSpeed);
  // THE ANSWER, PINNED. The app DOES report it — the shortfall is not silent.
  const sprintShortfall = noClub.findings.filter((f) =>
    f.domain === 'sprint_high_speed' && f.code === 'required_minimum_shortfall');
  ok('9j. [R-079] and the week is NOT silent about it — a blocking shortfall fires',
    sprintShortfall.length === 1 && sprintShortfall[0].severity === 'blocking',
    noClub.findings.map((f) => `${f.domain}/${f.code}/${f.severity}`));
}

// 10. Flush is incorrectly used while core conditioning is short.
{
  const c = contract('mid_preseason', {
    plannerSelected: { mainStrength: 4, coreConditioning: 3, optionalFlush: 1, sprintHighSpeed: 1, powerPrimers: 0 },
  });
  witnesses.flushAsCore = evaluate(c, [
    conditioning(1, 'core', 'moderate'), conditioning(2, 'core', 'moderate'),
    conditioning(3, 'optional_flush', 'light'),
  ]);
  ok('10a. flush does not enter core count',
    witnesses.flushAsCore.ledger.conditioning.coreCount === 2 &&
    witnesses.flushAsCore.ledger.conditioning.optionalFlushCount === 1);
  ok('10b. flush replacing core is detected', has(witnesses.flushAsCore, 'core_flush_misclassification'));
}

// 11. Four eligible lifts receive four primers against preferred 1-2.
{
  const c = contract('mid_preseason', {
    plannerSelected: { mainStrength: 4, coreConditioning: 4, optionalFlush: 0, sprintHighSpeed: 1, powerPrimers: 4 },
  });
  witnesses.fourPrimers = evaluate(c, [
    strength(1, ['push'], { power: true }), strength(2, ['squat'], { power: true }),
    strength(4, ['pull'], { power: true }), strength(6, ['hinge'], { power: true }),
  ]);
  ok('11. four-primer over-selection is reported', has(witnesses.fourPrimers, 'power_policy_breach'));
}

// 12. Contract v2 owns the preferred/permitted distinction.
{
  const c = contract('mid_preseason', {
    plannerSelected: { mainStrength: 3, coreConditioning: 4, optionalFlush: 0, sprintHighSpeed: 1, powerPrimers: 0 },
  });
  witnesses.fiveHardDays = evaluate(c, [1, 2, 3, 4, 5].map((day) => conditioning(day, 'core', 'hard')));
  const sixHardDays = evaluate(c, [0, 1, 2, 3, 4, 5].map((day) => conditioning(day, 'core', 'hard')));
  ok('12. five hard days are permitted but six breach the mode maximum',
    !has(witnesses.fiveHardDays, 'hard_day_breach') &&
    witnesses.fiveHardDays.advisories.some((finding) => finding.domain === 'hard_days') &&
    has(sixHardDays, 'hard_day_breach'));
  // R-359 (2026-09-03): the sixth hard day is warned, never refused — the breach
  // is a finding the athlete sees, not a blocking violation the gateway throws on.
  ok('12b. the six-hard-day breach is a warning, not a blocking violation (R-359)',
    sixHardDays.findings.some((finding) => finding.code === 'hard_day_breach' && finding.severity === 'advisory') &&
    !sixHardDays.blockingViolations.some((finding) => finding.code === 'hard_day_breach'));
}

console.log('\n-- Section 18 evaluator properties --');
let propertyCount = 0;
function property(name: string, condition: boolean, detail?: unknown): void {
  propertyCount += 1;
  ok(name, condition, detail);
}

property('P1 achieved above a permitted maximum is always detected',
  [1, 2, 3].every((extra) => {
    const c = contract('mid_preseason');
    const workouts = Array.from({ length: 4 + extra }, (_, index) =>
      strength((index + 1) % 7, [['squat', 'hinge', 'push', 'pull'][index % 4] as MainStrengthPattern]));
    return has(evaluate(c, workouts), 'maximum_breach', 'main_strength');
  }));

{
  const c = contract('late_offseason');
  const result = evaluate(c, [
    strength(1, ['squat', 'hinge', 'push', 'pull']),
    strength(3, ['squat', 'hinge', 'push', 'pull']),
    strength(5, ['squat', 'hinge', 'push', 'pull']),
  ]);
  property('P2 selected target above the floor remains independently enforceable',
    has(result, 'planner_selected_target_miss', 'main_strength') &&
    !has(result, 'required_minimum_shortfall', 'main_strength') &&
    result.contract.mainStrength.exposure.unresolvedMinimumShortfall === 0 &&
    result.contract.mainStrength.exposure.unresolvedPlannerSelectedShortfall === 1);
}
{
  const c = contract('late_offseason', {
    plannerSelected: {
      mainStrength: 3, coreConditioning: 4, optionalFlush: 0,
      sprintHighSpeed: 1, powerPrimers: 0,
    },
  });
  const result = evaluate(c, [
    strength(1, ['squat', 'hinge', 'push', 'pull']),
    strength(3, ['squat', 'hinge', 'push', 'pull']),
    strength(5, ['squat', 'hinge', 'push', 'pull']),
  ]);
  property('P3 required, selected and default target outcomes stay distinct',
    result.contract.mainStrength.exposure.requiredMinimum === 3 &&
    result.contract.mainStrength.exposure.plannerSelectedTarget === 3 &&
    result.contract.mainStrength.exposure.defaultTarget === 4 &&
    result.contract.mainStrength.exposure.unresolvedMinimumShortfall === 0 &&
    result.contract.mainStrength.exposure.unresolvedPlannerSelectedShortfall === 0 &&
    has(result, 'default_target_miss', 'main_strength'));
}
property('P4 optional work cannot satisfy a core requirement',
  witnesses.flushAsCore.ledger.conditioning.coreCount === 2 && has(witnesses.flushAsCore, 'optional_work_replacing_required_work'));
property('P5 the rest quota counts days with no REQUIRED work, and only that',
  // The property form of Sam's Rest law. Four recovery days are STILL named as
  // active recovery — the information is not lost, the day simply appears in
  // both lists — and the two strength days are the only ones the quota refuses.
  witnesses.recoveryRest.ledger.restStress.activeRecoveryDays.length === 4 &&
  witnesses.recoveryRest.ledger.restStress.trueFullRestDays.length === 5 &&
  witnesses.recoveryRest.ledger.restStress.trueFullRestDays.every((day) =>
    day !== 1 && day !== 4));
property('P6 prohibited patterns cannot be silently accepted',
  has(witnesses.prohibitedPattern, 'prohibited_pattern_breach'));
property('P7 unknown/modified participation cannot receive sprint credit',
  witnesses.modifiedTt.ledger.sprintHighSpeed.achievedCount === 0);
property('P8 reduced frequency cannot be exceeded silently',
  has(witnesses.reductionAndPower, 'reduction_contradiction'));
{
  const c = contract('mid_offseason');
  const result = evaluate(c, [
    strength(1, ['squat', 'hinge', 'push', 'pull'], { repeated: { push: 4 } }),
    strength(3, ['squat', 'hinge', 'pull']),
  ]);
  property('P9 athlete-visible broad counts do not trigger the retired equality veto',
    result.ledger.strengthPatterns.meaningfulMainLiftCount.push === 4
      && !has(result, 'pattern_imbalance'));
}
{
  const c = contract('in_season_bye_build', {
    teamTrainingDays: [2], teamParticipation: normalParticipation(2), currentProductionClaimsAnchorCredit: true,
  });
  const result = evaluate(c, []);
  property('P10 field anchors never count as formal power primers',
    result.ledger.power.fieldActionPrimerCredit === 0 && result.ledger.power.achievedPrimerCount === 0);
}

console.log('\n-- Section 18 mutation gate --');
type MutatedObservation = Section18EffectiveWeekEvaluation;
function cloneObservation(value: Section18EffectiveWeekEvaluation): MutatedObservation {
  return JSON.parse(JSON.stringify(value)) as MutatedObservation;
}
function killed(name: string, mutantSurvivesInvariant: boolean): void {
  ok(`MUTATION KILLED ${name}`, !mutantSurvivesInvariant);
}

let mutationCount = 0;
{
  mutationCount += 1;
  const mutant = cloneObservation(witnesses.earlyOptionalFive);
  mutant.findings = mutant.findings.filter((finding) => finding.code !== 'maximum_breach');
  killed('remove maximum enforcement', mutant.findings.some((finding) => finding.code === 'maximum_breach'));
}
{
  mutationCount += 1;
  const c = contract('mid_preseason');
  const result = evaluate(c, [conditioning(1, 'core', 'light')]);
  killed('convert optional conditioning into core',
    result.ledger.conditioning.optionalFlushCount === 1 && result.ledger.conditioning.coreCount === 0);
}
{
  mutationCount += 1;
  const c = contract('in_season_bye_build', {
    teamTrainingDays: [2], teamParticipation: normalParticipation(2), currentProductionClaimsAnchorCredit: true,
  });
  const result = evaluate(c, []);
  killed('credit unknown TT as sprint', result.ledger.sprintHighSpeed.achievedCount === 0);
}
{
  mutationCount += 1;
  const mutant = cloneObservation(witnesses.prohibitedPattern);
  mutant.findings = mutant.findings.filter((finding) => finding.code !== 'prohibited_pattern_breach');
  killed('drop prohibited-pattern checks', has(mutant, 'prohibited_pattern_breach'));
}
{
  mutationCount += 1;
  // INVERTED with the ruling. The mutant is now a build that went back to
  // excluding recovery from rest; the invariant it must fail is the Rest law.
  const mutant = cloneObservation(witnesses.recoveryRest);
  mutant.ledger.restStress.trueFullRestDays = mutant.ledger.restStress.trueFullRestDays
    .filter((day) => !mutant.ledger.restStress.activeRecoveryDays.includes(day));
  killed('exclude athlete recovery from rest',
    mutant.ledger.restStress.trueFullRestDays.length === 5);
}
{
  mutationCount += 1;
  const mutant = cloneObservation(witnesses.fourPrimers);
  mutant.findings = mutant.findings.filter((finding) => finding.code !== 'power_policy_breach');
  killed('accept power over-selection', has(mutant, 'power_policy_breach'));
}
{
  mutationCount += 1;
  const mutant = cloneObservation(witnesses.reductionAndPower);
  mutant.findings = mutant.findings.filter((finding) => finding.code !== 'reduction_contradiction');
  killed('accept reduction overshoot', has(mutant, 'reduction_contradiction'));
}
{
  mutationCount += 1;
  const c = contract('late_offseason');
  const mutant = cloneObservation(evaluate(c, [
    strength(1, ['squat', 'hinge', 'push', 'pull']),
    strength(3, ['squat', 'hinge', 'push', 'pull']),
    strength(5, ['squat', 'hinge', 'push', 'pull']),
  ]));
  mutant.findings = mutant.findings.filter((finding) =>
    finding.code !== 'planner_selected_target_miss');
  killed('accept required floor as the planner-selected target',
    has(mutant, 'planner_selected_target_miss'));
}

// ── THE DELOAD LAW (Sam, 2026-07-27) — "Power/speed: KEEP a small sharp dose.
// Power is not removed on a deload; a deload is not a reason to lose sharpness."
//
// §18 removed power on every deload, every low-readiness week and every cooked
// week, through `noPower`, and on the illness week through its own removal
// reason. The deload law shipped in the DOSE layer (`deloadWeekRules`) and never
// reached §18, so the contradiction was live in two representations at once:
// DELOAD_LAW.keepPower === true while §18 set eligible: false.
console.log('\n[deload law] power survives every door that deloads');

ok('a scheduled deload week KEEPS power',
  contract('in_season_game_week', { weekKind: 'deload' }).power.eligible === true,
  contract('in_season_game_week', { weekKind: 'deload' }).power.removalReason);

ok('a low-readiness week KEEPS power',
  contract('in_season_game_week', { capacity: 'low' }).power.eligible === true,
  contract('in_season_game_week', { capacity: 'low' }).power.removalReason);

ok('a cooked-readiness week KEEPS power',
  contract('in_season_game_week', { cookedReadiness: true }).power.eligible === true,
  contract('in_season_game_week', { cookedReadiness: true }).power.removalReason);

ok('an illness_recovery week KEEPS power',
  contract('optional_week').power.eligible === true,
  contract('optional_week').power.removalReason);

// The reason literal must go with the behaviour — a removal reason that no
// longer describes anything is how the old rule grows back.
ok('no contract still cites the retired low_readiness_or_deload removal reason',
  (['in_season_game_week', 'optional_week'] as const).every((mode) =>
    contract(mode, { weekKind: 'deload', capacity: 'low', cookedReadiness: true })
      .power.removalReason !== 'low_readiness_or_deload'));

// A genuine SAFETY prohibition still removes power. The law retires deload as a
// reason to remove it, not injury.
ok('a full pattern restriction still removes power',
  contract('in_season_game_week', {
    prohibitedPatterns: ['squat', 'hinge', 'push', 'pull'],
  }).power.eligible === false);

/* ── Attendance counts; intensity does not ── */

// SAM'S RULING (2026-07-27): "The deload law changes dose and intensity inside
// sessions, never session identity or count ... Counting counts structure;
// intensity and prescribed volume must never feed identity."
//
// The evaluator credited anchor conditioning behind ONE boolean —
// `participation === 'normal_unrestricted'` — which answered four different
// questions at once: is this a conditioning exposure, was it a sprint exposure,
// was it a hard day, and how much stress did it carry. Only the first is
// identity; the other three are intensity.
//
// So a deload that softened the athlete's GAME to `reduced_running` deleted the
// game from the week's conditioning COUNT, and §18 rejected the week for a
// required-minimum shortfall it had itself created. The athlete still played
// the game. Attendance is what makes it an exposure.
//
// Both halves are asserted, because the fix is a SPLIT and a split can fail in
// either direction: a restricted anchor must still COUNT, and must still not
// earn sprint or hard-day credit.
console.log('\n-- Anchor credit: attendance is identity, participation is intensity --');

for (const participation of
  ['modified', 'rehab', 'restricted', 'non_contact', 'reduced_running'] as const) {
  const c = contract('in_season_game_week', {
    teamTrainingDays: [2, 4],
    teamParticipation: normalParticipation(2),
    fixtureDays: [6],
    fixtureParticipation: participation,
  });
  const evaluation = evaluate(c, []);
  const row = evaluation.ledger.anchors.find((entry) => entry.dayOfWeek === 6);

  ok(`a ${participation} anchor still COUNTS as a conditioning exposure`,
    row?.conditioningCredited === true, row);
  ok(`a ${participation} anchor earns NO sprint credit`,
    row?.sprintCredited === false, row);
  ok(`a ${participation} anchor earns NO hard-day credit`,
    row?.hardDayCredited === false, row);
}

// The two states that are NOT attendance keep their existing behaviour. Without
// these the "fix" would be indistinguishable from crediting every anchor.
for (const participation of ['did_not_participate', 'unknown'] as const) {
  const c = contract('in_season_game_week', {
    teamTrainingDays: [2, 4],
    teamParticipation: normalParticipation(2),
    fixtureDays: [6],
    fixtureParticipation: participation,
  });
  const row = evaluate(c, []).ledger.anchors.find((entry) => entry.dayOfWeek === 6);
  ok(`a ${participation} anchor is NOT a conditioning exposure`,
    row?.conditioningCredited === false, row);
}

// ── THE FIXTURE WEEK CARRIES ITS OWN HARD CONDITIONING (Sam, 2026-07-29) ──
//
// "In any fixture week — game or practice match — the game itself carries the
// hard conditioning exposure. The contract never requires a hard app-conditioning
// session in a game-shaped week; app top-up is moderate or easier."
//
// The contract already credits the fixture as ONE conditioning exposure
// (`appCoreConditioning` subtracts 1 for a fixture week). It did not carry that
// credit into the INTENSITY policy, so a game week with exactly one team
// training still demanded a hard app session on top of the game. A pre-season
// week with one team training and a practice match then became `impossible` at
// the §18 gateway — the athlete met "We couldn't safely build your week".
//
// Swept across every mode and every team-training count, so the demand cannot
// come back for one arm of a ternary the way it did here.
for (const mode of ALL_WEEK_MODES) {
  for (const teamTrainingDays of [[], [2], [2, 4], [1, 3, 5]]) {
    const c = contract(mode, { teamTrainingDays });
    const hard = c.conditioning.intensityPolicy.requiredAppHardMinimum;
    if (isFixtureWeekMode(mode)) {
      ok(`${mode} with ${teamTrainingDays.length}TT requires no HARD app conditioning`,
        hard === 0, { mode, teamTrainingDays, hard });
    } else {
      // Not the ruling, but the re-check Sam asked for: any non-fixture mode
      // that grows a hard-app demand should be a deliberate, visible decision.
      ok(`${mode} with ${teamTrainingDays.length}TT declares no unruled hard demand`,
        hard === 0, { mode, teamTrainingDays, hard });
    }
  }
}


// ── A WEEK MAY HOLD MORE THAN ONE FIXTURE (the waist, 2026-08-12) ──
//
// `HOW_TO_BUILD_THIS_APP` §5.4 named `derivedWeekContract:90`'s
// `fixtures[0] ?? null` as THE waist, and this is the contract end of it: the
// input carried ONE `fixtureDay`, so a split round — a midweek game AND the
// usual weekend one — reached the contract as a one-game week. The dropped
// fixture got no anchor, and an anchor is what carries G-1/G-2 protection,
// conditioning credit and the week's identity.
//
// MEASURED BEFORE THE CHANGE: `targetWeekFixtures` for a Wednesday + Saturday
// week returns BOTH, and `fixtures[0]` kept the Wednesday. The list was never
// missing; it was thrown away one line later.
console.log('\n-- A week may hold more than one fixture --');

const splitRound = contract('in_season_game_week', {
  teamTrainingDays: [2],
  fixtureDays: [3, 6],
});
const fixtureAnchors = splitRound.anchors.filter((anchor) =>
  anchor.kind === 'game' || anchor.kind === 'practice_match');

ok('a two-fixture week produces TWO fixture anchors',
  fixtureAnchors.length === 2, splitRound.anchors.map((a) => `${a.kind}:${a.dayOfWeek}`));
ok('both fixture days are anchored, not just the first',
  fixtureAnchors.some((anchor) => anchor.dayOfWeek === 3)
  && fixtureAnchors.some((anchor) => anchor.dayOfWeek === 6),
  fixtureAnchors.map((a) => a.dayOfWeek));
ok('each fixture anchor keeps a distinct id',
  new Set(fixtureAnchors.map((anchor) => anchor.id)).size === 2,
  fixtureAnchors.map((a) => a.id));

// NON-VACUITY, BOTH WAYS. Without these, "two anchors" would also pass against
// a builder that emitted an anchor per DAY OF THE WEEK, and the single-fixture
// case — every other cell in this file — must be untouched.
const singleFixture = contract('in_season_game_week', {
  teamTrainingDays: [2],
  fixtureDays: [6],
});
ok('a one-fixture week still produces exactly ONE fixture anchor',
  singleFixture.anchors.filter((anchor) =>
    anchor.kind === 'game' || anchor.kind === 'practice_match').length === 1,
  singleFixture.anchors.map((a) => `${a.kind}:${a.dayOfWeek}`));

const noFixture = contract('in_season_bye_build', {
  teamTrainingDays: [2],
  fixtureDays: [],
});
ok('a bye week still produces NO fixture anchor',
  noFixture.anchors.every((anchor) =>
    anchor.kind !== 'game' && anchor.kind !== 'practice_match'),
  noFixture.anchors.map((a) => `${a.kind}:${a.dayOfWeek}`));

// A REPEATED DAY IS ONE ANCHOR — `uniqueDays` owns that, exactly as it does for
// team training, so two marks on one date cannot double-count the fixture.
const duplicated = contract('in_season_game_week', {
  teamTrainingDays: [2],
  fixtureDays: [6, 6],
});
ok('a repeated fixture day collapses to one anchor',
  duplicated.anchors.filter((anchor) =>
    anchor.kind === 'game' || anchor.kind === 'practice_match').length === 1,
  duplicated.anchors.map((a) => `${a.kind}:${a.dayOfWeek}`));


// ── THE MODERATE DAY — ADVISORY, NEVER BLOCKING (seat item 4, 2026-08-12) ──
//
// `achievedModerateDayCount` was written on every assessment and read by
// NOTHING, so a week below Sam's "plus one moderate/easy day" passed in
// silence. Measured the same day: 12 of 17 QA scenarios have zero moderate
// days, and every in-season fixture week is among them.
//
// THE CELLS DRIVE THE CONTRACT'S OWN NUMBER, NOT A WORLD. The first version of
// this block asserted "a week with no moderate day" over a hand-built fixture
// that turned out to HAVE two (days 3 and 5) — the fixture was wrong, not the
// rule, and a cell built on it would have been asserting the fixture. Moving
// the contract's minimum either side of the achieved count tests the rule in
// both directions and cannot be fooled by what a fixture happens to classify.
{
  const c = contract('in_season_game_week', {
    teamTrainingDays: [2], fixtureDays: [6],
    plannerSelected: { mainStrength: 3, coreConditioning: 3, optionalFlush: 0, sprintHighSpeed: 1, powerPrimers: 0 },
  });
  const workouts = [strength(1, ['squat']), strength(3, ['push']), strength(5, ['pull'])];
  const achieved = evaluate(c, workouts).ledger.restStress.moderateDays.length;
  ok('the fixture reaches a known moderate-day count for these cells to move around',
    achieved >= 1, achieved);

  const demanding = contract('in_season_game_week', {
    teamTrainingDays: [2], fixtureDays: [6],
    plannerSelected: { mainStrength: 3, coreConditioning: 3, optionalFlush: 0, sprintHighSpeed: 1, powerPrimers: 0 },
  });
  demanding.restStress.preferredModerateDayRange = { min: achieved + 1, max: 7 };
  const below = evaluate(demanding, workouts);
  ok('a week below the preferred moderate minimum raises the advisory',
    has(below, 'moderate_day_missing', 'hard_days'), below.findings.map((f) => f.code));
  ok('the moderate-day finding is ADVISORY and never blocks',
    below.findings.some((f) => f.code === 'moderate_day_missing' && f.severity === 'advisory') &&
    !below.blockingViolations.some((f) => f.code === 'moderate_day_missing'),
    below.blockingViolations.map((f) => f.code));

  const relaxed = contract('in_season_game_week', {
    teamTrainingDays: [2], fixtureDays: [6],
    plannerSelected: { mainStrength: 3, coreConditioning: 3, optionalFlush: 0, sprintHighSpeed: 1, powerPrimers: 0 },
  });
  relaxed.restStress.preferredModerateDayRange = { min: 0, max: 7 };
  ok('the advisory reads the CONTRACT minimum, not a hard-coded 1',
    !has(evaluate(relaxed, workouts), 'moderate_day_missing'));
}

console.log(`\nsection18ContractV2Tests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log(`SECTION18_V2_TOTALS scenarios=12 rules=12 properties=${propertyCount} mutations=${mutationCount}`);
if (fail > 0) process.exit(1);
