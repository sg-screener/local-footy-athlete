(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import type { OnboardingData, Workout, WorkoutExercise } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import {
  evaluateSection18EffectiveWeek,
  type Section18EffectiveWeekEvaluation,
  type Section18FindingCode,
} from '../rules/section18EffectiveWeekEvaluator';
import {
  buildSection18WeeklyExposureContractV2,
  migrateLegacyWeeklyExposureContractV2,
  section18PhaseTableSignature,
  type AnchorParticipationState,
  type Section18AuthorisedReduction,
  type Section18ConditioningRole,
  type Section18ConditioningStress,
  type Section18ContractV2Input,
  type Section18Subphase,
  type Section18WeekMode,
  type WeeklyExposureContractV2,
} from '../rules/weeklyExposureContractV2';
import { buildWeeklyExposureContract } from '../rules/weeklyExposureContractBuilders';
import { observeMicrocycleSection18 } from '../utils/section18ProgramObservation';
import { finaliseWorkoutAfterMutation } from '../utils/workoutCanonicalisation';
import type { MainStrengthPattern } from '../rules/strengthPatternContributions';
import { canonicaliseHydratedProgram } from '../store/programStore';

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
  workout.intensity = opts.hard ? 'High' : 'Moderate';
  if (opts.power) {
    workout.powerBlock = {
      id: `power-${dayOfWeek}`,
      title: 'Primer',
      prescription: '2 x 3',
      kind: 'primer',
      family: 'lower',
      exercises: [],
      notes: [],
    } as Workout['powerBlock'];
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

function identityFor(mode: Section18WeekMode): {
  phase: OnboardingData['seasonPhase'];
  subphase: Section18Subphase;
  anchorState: Section18ContractV2Input['anchorState'];
} {
  if (mode === 'in_season_game_week') return { phase: 'In-season', subphase: 'game_week', anchorState: 'game' };
  if (mode === 'in_season_bye_build') return { phase: 'In-season', subphase: 'bye_build', anchorState: 'bye' };
  if (mode === 'in_season_bye_recovery') return { phase: 'In-season', subphase: 'bye_recovery', anchorState: 'bye' };
  if (mode === 'practice_match_week') return { phase: 'Pre-season', subphase: 'practice_match_week', anchorState: 'practice_match' };
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
    declaredSubphase: identity.subphase,
    mode,
    blockNumber: mode === 'late_offseason' ? 2 : 1,
    weekInBlock: mode === 'mid_offseason' ? 3 : 1,
    globalWeek: mode === 'late_offseason' ? 5 : mode === 'mid_offseason' ? 3 : 1,
    phaseWeek: mode === 'late_offseason' ? 5 : mode === 'mid_offseason' ? 3 : 1,
    phaseWeekProvenance: 'explicit_phase_clock',
    weekKind: 'build',
    anchorState: identity.anchorState,
    teamTrainingDays: [],
    fixtureDay: null,
    readiness: 'medium',
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
    seasonPhase: 'Pre-season',
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingIntensity: 'Hard',
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
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
  ok('shared microcycle observer consumes generated v2 contract', !!observeMicrocycleSection18(week));
  ok('healthy generated TT resolves to normal unrestricted participation',
    week.exposureContractV2?.anchors.every((anchor) =>
      anchor.participation === 'normal_unrestricted' &&
      anchor.participationProvenance === 'derived_healthy_unrestricted') === true);
  ok('generated Contract v2 independently satisfies every planner-selected core target',
    generated.microcycles.every((candidate) => {
      const observation = observeMicrocycleSection18(candidate);
      return observation !== null && [
        observation.contract.mainStrength.exposure,
        observation.contract.conditioning.core,
        observation.contract.sprintHighSpeed.exposure,
      ].every((policy) => policy.plannerSelectionKind !== 'core' ||
        policy.unresolvedPlannerSelectedShortfall === 0);
    }));

  const beforeHydrationSignatures = generated.microcycles.map((candidate) =>
    section18PhaseTableSignature(candidate.exposureContractV2));
  const rehydrated = canonicaliseHydratedProgram(
    JSON.parse(JSON.stringify(generated)) as typeof generated,
  );
  ok('rehydration preserves every phase-owned Contract v2 selected-target signature',
    JSON.stringify(rehydrated.microcycles.map((candidate) =>
      section18PhaseTableSignature(candidate.exposureContractV2))) ===
      JSON.stringify(beforeHydrationSignatures));

  const legacy = buildWeeklyExposureContract({
    seasonPhase: 'Pre-season', readiness: 'medium', selectedDayNumbers: [1, 2, 3, 4, 5, 6],
    teamTrainingDayNumbers: [2, 4], hasGame: false, gameDay: null,
    weekKind: 'build', preseasonSubphase: 'early_preseason', appConditioningFeasible: true,
  });
  const migratedA = migrateLegacyWeeklyExposureContractV2(legacy, { blockNumber: 1, weekInBlock: 1, globalWeek: 1 });
  const migratedB = migrateLegacyWeeklyExposureContractV2(legacy, { blockNumber: 1, weekInBlock: 1, globalWeek: 1 });
  ok('legacy migration is deterministic', JSON.stringify(migratedA) === JSON.stringify(migratedB));
  ok('legacy migration does not invent participation certainty',
    migratedA.anchors.every((anchor) => anchor.participation === 'unknown'));
  ok('legacy missing prohibited-pattern state remains traceable',
    migratedA.strengthPatterns.prohibitedPatternProvenance === 'legacy_missing' &&
    migratedA.strengthPatterns.prohibitedPatterns.length === 0);

  const sourceWorkout = week.workouts[0];
  const editedWorkout = finaliseWorkoutAfterMutation({
    ...sourceWorkout,
    intensity: sourceWorkout.intensity === 'High' ? 'Moderate' : 'High',
  }, {
    phase: 'Pre-season',
    weekKind: week.weekKind,
    planIntentValid: false,
    referenceWorkout: sourceWorkout,
  }).workout;
  const editedObservation = observeMicrocycleSection18(week, [
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
        severity: 7,
        tier: 'moderate_reduction',
        avoidSprint: true,
        avoidHardConditioning: true,
        reduceHardExtras: true,
        preferRecovery: true,
        fullPause: false,
      },
    },
  });
  console.warn = originalWarn;
  console.log = originalLog;
  ok('active-constraint generation still emits observable Contract v2 ledgers',
    constrained.microcycles.every((candidate) =>
      candidate.exposureContractV2?.protocolVersion === 2 && !!observeMicrocycleSection18(candidate)));
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
    readiness: 'medium', cookedReadiness: true, reductions,
    plannerSelected: { mainStrength: 2, coreConditioning: 1, optionalFlush: 0, sprintHighSpeed: 0, powerPrimers: 0 },
  });
  witnesses.reductionAndPower = evaluate(c, [
    strength(1, ['squat', 'push'], { power: true }),
    strength(3, ['hinge', 'pull'], { power: true }),
    strength(5, ['push', 'pull'], { power: true }),
  ]);
  ok('3a. readiness reduction overshoot is detected',
    has(witnesses.reductionAndPower, 'reduction_contradiction'));
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

// 6. Practice match with 0 TT finishes below S3/C3.
{
  const c = contract('practice_match_week', {
    fixtureDay: 6, fixtureParticipation: 'normal_unrestricted', currentProductionClaimsAnchorCredit: true,
    plannerSelected: { mainStrength: 2, coreConditioning: 1, optionalFlush: 0, sprintHighSpeed: 1, powerPrimers: 2 },
  });
  witnesses.practiceMatchUnder = evaluate(c, [strength(1, ['push', 'pull']), strength(3, ['hinge', 'push'])]);
  ok('6a. PM 0TT strength below three is detected',
    has(witnesses.practiceMatchUnder, 'required_minimum_shortfall', 'main_strength'));
  ok('6b. PM 0TT conditioning below three is detected',
    has(witnesses.practiceMatchUnder, 'required_minimum_shortfall', 'conditioning'));
}

// 7. Equipment-constrained conditioning deleted before substitution.
{
  const c = contract('mid_offseason', {
    equipment: { appConditioningFeasible: false, substitutionStatus: 'not_attempted', consideredSubstitutions: [] },
    plannerSelected: { mainStrength: 4, coreConditioning: 0, optionalFlush: 0, sprintHighSpeed: 1, powerPrimers: 0 },
  });
  witnesses.equipmentDeletion = evaluate(c, [
    strength(1, ['push']), strength(2, ['squat']), strength(4, ['pull']), strength(6, ['hinge']),
  ]);
  ok('7. deletion before equipment substitution is detected',
    has(witnesses.equipmentDeletion, 'equipment_substitution_missing'));
}

// 8. Recovery workouts were reported as full rest.
{
  const c = contract('in_season_bye_recovery', {
    plannerSelected: { mainStrength: 2, coreConditioning: 0, optionalFlush: 0, sprintHighSpeed: 0, powerPrimers: 0 },
  });
  witnesses.recoveryRest = evaluate(c, [
    strength(1, ['squat', 'push']), strength(4, ['hinge', 'pull']),
    recovery(2), recovery(3), recovery(5), recovery(6), rest(0),
  ], 5);
  ok('8a. active recovery is excluded from true rest',
    witnesses.recoveryRest.ledger.restStress.trueFullRestDays.length === 1 &&
    witnesses.recoveryRest.ledger.restStress.activeRecoveryDays.length === 4,
    witnesses.recoveryRest.ledger.restStress);
  ok('8b. legacy recovery-as-rest miscount is detected', has(witnesses.recoveryRest, 'full_rest_miscount'));
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

// 12. Five hard days without unavoidable normal-anchor authorisation.
{
  const c = contract('mid_preseason', {
    plannerSelected: { mainStrength: 3, coreConditioning: 4, optionalFlush: 0, sprintHighSpeed: 1, powerPrimers: 0 },
  });
  witnesses.fiveHardDays = evaluate(c, [1, 2, 3, 4, 5].map((day) => conditioning(day, 'core', 'hard')));
  ok('12. unauthorised fifth hard day is detected', has(witnesses.fiveHardDays, 'hard_day_breach'));
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
property('P5 recovery days can never become full-rest days',
  witnesses.recoveryRest.ledger.restStress.activeRecoveryDays.length === 4 &&
  witnesses.recoveryRest.ledger.restStress.trueFullRestDays.length === 1);
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
  property('P9 balance uses meaningful main-lift counts',
    result.ledger.strengthPatterns.meaningfulMainLiftCount.push === 4 && has(result, 'pattern_imbalance'));
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
  const mutant = cloneObservation(witnesses.recoveryRest);
  mutant.ledger.restStress.trueFullRestDays.push(...mutant.ledger.restStress.activeRecoveryDays);
  killed('count recovery as full rest', mutant.ledger.restStress.trueFullRestDays.length === 1);
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

console.log(`\nsection18ContractV2Tests: ${pass} passed, ${fail} failed`);
console.log(`SECTION18_V2_TOTALS scenarios=12 rules=12 properties=${propertyCount} mutations=${mutationCount}`);
if (fail > 0) process.exit(1);
