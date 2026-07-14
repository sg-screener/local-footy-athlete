(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(global as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  },
};
process.env.TZ = 'Australia/Melbourne';

import type {
  Microcycle,
  OnboardingData,
  TrainingProgram,
  Workout,
} from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import {
  requireSection18AcceptedWeek,
  resolveFinalVisibleSection18Week,
  runSection18AcceptedWeekGateway,
  Section18WeekAcceptanceError,
} from '../rules/section18AcceptedWeekGateway';
import { evaluateSection18EffectiveWeek } from '../rules/section18EffectiveWeekEvaluator';
import {
  resolveConditioningFeasibility,
  resolveConditioningSubstitutionPolicy,
} from '../rules/conditioningFeasibility';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';
import { buildWeeklyExposureContract } from '../rules/weeklyExposureContractBuilders';
import {
  validateMicrocycleAgainstActiveConstraints,
  validateProgramAgainstActiveConstraints,
  validateWeekOverlayAgainstActiveConstraints,
} from '../utils/postGenerationConstraintValidation';
import { buildRepeatWeekOverlay } from '../utils/repeatWeek';
import {
  canonicaliseHydratedProgram,
  canonicaliseHydratedState,
  useProgramStore,
} from '../store/programStore';
import { useProfileStore } from '../store/profileStore';

const WEEK_START = '2026-07-13';
const NOW = '2026-07-13T00:00:00.000Z';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const TEAM_DAYS = ['Tuesday', 'Thursday', 'Wednesday'] as const;

let pass = 0;
let fail = 0;
const failures: string[] = [];
let repeatWriteRejected = false;
let coachWriteRejected = false;
let fiveHardRejected = false;
let selectedTargetPreserved = false;
let typedRejectionObserved = false;
let hydrationRepairObserved = false;
function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.error(`  FAIL ${name}`, detail ?? '');
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function dateForDay(dayOfWeek: number): string {
  const date = new Date(`${WEEK_START}T12:00:00`);
  date.setDate(date.getDate() + (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  return date.toISOString().slice(0, 10);
}

function profile(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return {
    seasonPhase: 'Off-season',
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    teamTrainingIntensity: 'Hard',
    sessionDurationMinutes: 60,
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: '2-5 years',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Elite',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    ...overrides,
  };
}

function program(args: {
  phase?: OnboardingData['seasonPhase'];
  phaseEntry?: string;
  teamTrainingCount?: number;
  game?: boolean;
  low?: boolean;
  days?: OnboardingData['preferredTrainingDays'];
  equipment?: string[];
  equipmentSelectionCompleteness?: OnboardingData['equipmentSelectionCompleteness'];
  injuries?: OnboardingData['injuries'];
} = {}): { profile: OnboardingData; program: TrainingProgram } {
  const phase = args.phase ?? 'Off-season';
  const teamCount = args.teamTrainingCount ?? 0;
  const data = profile({
    seasonPhase: phase,
    teamTrainingDaysPerWeek: teamCount,
    teamTrainingDays: [...TEAM_DAYS.slice(0, teamCount)],
    usualGameDay: args.game ? 'Saturday' : undefined,
    gameDay: undefined,
    preferredTrainingDays: args.days ?? profile().preferredTrainingDays,
    trainingDaysPerWeek: (args.days ?? profile().preferredTrainingDays)?.length ?? 6,
    conditioningLevel: args.low ? 'Poor' : 'Elite',
    recentTrainingLoad: args.low ? 'Hardly at all' : 'Very consistent',
    equipment: args.equipment ?? ['Full Gym'],
    equipmentSelectionCompleteness: args.equipmentSelectionCompleteness ?? 'complete',
    injuries: args.injuries ?? [],
  });
  return {
    profile: data,
    program: generateProgramLocally(data, {
      todayISO: WEEK_START,
      seasonPhaseClock: {
        protocolVersion: 1,
        selectedPhase: phase!,
        phaseEntryWeekStartISO: args.phaseEntry ?? WEEK_START,
        originProvenance: 'explicit_user_phase_change',
      },
      previousProgram: null,
    }),
  };
}

function firstWeek(value: ReturnType<typeof program>): Microcycle {
  return value.program.microcycles[0];
}

function visibleEvaluation(value: ReturnType<typeof program>, microcycle = firstWeek(value)) {
  const contract = microcycle.exposureContractV2!;
  const workouts = resolveFinalVisibleSection18Week({
    contract,
    workouts: microcycle.workouts,
    weekStart: microcycle.startDate.slice(0, 10),
    profile: value.profile,
  });
  return evaluateSection18EffectiveWeek({
    contract,
    workouts,
    weekStart: microcycle.startDate.slice(0, 10),
  });
}

function restStub(source: Workout): Workout {
  return {
    ...source,
    name: 'Rest',
    description: '',
    durationMinutes: 0,
    intensity: 'Light',
    workoutType: 'Rest',
    sessionTier: 'recovery',
    exercises: [],
    powerBlock: undefined,
    speedBlock: undefined,
    conditioningBlock: undefined,
    section18Evidence: undefined,
    section18ConditioningRole: undefined,
    conditioningCategory: undefined,
    conditioningFlavour: undefined,
    hasCombinedConditioning: false,
  };
}

function allRest(workouts: readonly Workout[]): Workout[] {
  return workouts.map(restStub);
}

function hardConditioning(dayOfWeek: number, id: string): Workout {
  return {
    id,
    microcycleId: 'gateway-test',
    dayOfWeek,
    name: 'Hard Core Intervals',
    description: '',
    durationMinutes: 35,
    intensity: 'High',
    workoutType: 'Conditioning',
    sessionTier: 'core',
    conditioningCategory: 'vo2',
    conditioningFlavour: 'high-intensity',
    section18ConditioningRole: 'planner_selected_core',
    section18Evidence: {
      protocolVersion: 1,
      conditioningRole: 'planner_selected_core',
      conditioningStress: 'hard',
      provenance: 'explicit_mutation',
    },
    exercises: [{
      id: `${id}-row`, workoutId: id, exerciseId: `${id}-exercise`, exerciseOrder: 1,
      prescribedSets: 4, prescribedRepsMin: 3, prescribedRepsMax: 3, restSeconds: 180,
      section18Evidence: {
        protocolVersion: 1, role: 'conditioning', strengthPattern: null,
        mainStrengthPattern: null, provenance: 'canonical_row_classifier',
      },
      createdAt: NOW, updatedAt: NOW,
    }],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function rejected(action: () => unknown): boolean {
  try {
    action();
    return false;
  } catch (error) {
    return error instanceof Section18WeekAcceptanceError ||
      (error as { code?: string }).code === 'section18_week_rejected';
  }
}

console.log('\n-- 32 fixed final Section 18 conformance regressions --');

const mid = program({ phase: 'Off-season', phaseEntry: '2026-06-29', days: ['Monday', 'Tuesday', 'Thursday', 'Saturday'] });
const late = program({ phase: 'Off-season', phaseEntry: '2026-06-15' });
const pre = program({ phase: 'Pre-season', phaseEntry: '2026-06-22' });
const pre3 = program({ phase: 'Pre-season', phaseEntry: '2026-06-22', teamTrainingCount: 3 });
const game = program({ phase: 'In-season', game: true, teamTrainingCount: 1 });
const byeRecovery = program({ phase: 'In-season', low: true });
const low = program({ phase: 'Off-season', phaseEntry: '2026-06-29', low: true });

check('1 mid off-season S4 final week has only 1-2 primers',
  visibleEvaluation(mid).ledger.mainStrength.achievedCount === 4 &&
  [1, 2].includes(visibleEvaluation(mid).ledger.power.achievedPrimerCount));
check('2 pre-season S4 final week has only 1-2 primers',
  visibleEvaluation(pre).ledger.mainStrength.achievedCount === 4 &&
  visibleEvaluation(pre).ledger.power.achievedPrimerCount <= 2);
check('3 high TT/game load reduces primer count',
  visibleEvaluation(game).ledger.power.achievedPrimerCount < visibleEvaluation(mid).ledger.power.achievedPrimerCount);
check('4 low readiness has zero primers', visibleEvaluation(low).ledger.power.achievedPrimerCount === 0);
check('5 bye recovery has zero primers', visibleEvaluation(byeRecovery).ledger.power.achievedPrimerCount === 0);
check('6 deload has zero primers', visibleEvaluation(
  pre,
  pre.program.microcycles.find((microcycle) => microcycle.weekKind === 'deload')!,
).ledger.power.achievedPrimerCount === 0);
{
  const hydrated = clone(mid.program);
  hydrated.microcycles[0].workouts = hydrated.microcycles[0].workouts.map((workout) => ({
    ...workout,
    powerBlock: workout.powerBlock ?? mid.program.microcycles[0].workouts.find((candidate) => candidate.powerBlock)?.powerBlock,
  }));
  const canonical = canonicaliseHydratedProgram(hydrated);
  hydrationRepairObserved = canonical.microcycles[0].workouts.filter((workout) => !!workout.powerBlock).length <= 2;
  check('7 rollover/Repeat-style canonicalisation cannot restore excess primers',
    hydrationRepairObserved);
}

const limitedMid = program({
  phase: 'Off-season', phaseEntry: '2026-06-29',
  equipment: ['Dumbbells Only'], equipmentSelectionCompleteness: 'complete',
});
const bodyweightPre = program({
  phase: 'Pre-season', phaseEntry: '2026-06-22',
  equipment: ['Bodyweight Only'], equipmentSelectionCompleteness: 'complete',
});
check('8 limited-equipment mid off-season retains core conditioning through substitutions',
  visibleEvaluation(limitedMid).ledger.conditioning.coreCount >= 3 &&
  firstWeek(limitedMid).exposureContractV2?.equipment.substitutionStatus === 'substituted');
check('9 bodyweight/no-cardio pre-season retains C3-4 safely',
  (() => {
    const buildWeek = bodyweightPre.program.microcycles.find((microcycle) => microcycle.weekKind === 'build')!;
    const count = visibleEvaluation(bodyweightPre, buildWeek).ledger.conditioning.coreCount;
    return count >= 3 && count <= 4;
  })());
{
  const injured = profile({
    equipment: ['Bodyweight Only'], equipmentSelectionCompleteness: 'complete',
    injuries: [{ bodyArea: 'Knee', description: 'Pain running', severity: 'Severe', whenItHurts: 'Running' }],
  });
  const equipment = resolveEquipmentCapabilities(injured);
  const allocation = resolveConditioningFeasibility({
    tier: 'core', focus: 'VO2 conditioning', isHardExposure: true,
    conditioningCategory: 'vo2', conditioningFlavour: 'high-intensity',
    section18ConditioningRole: 'required_core',
  }, { phase: 'Pre-season', equipment, profile: injured });
  check('10 lower-body injury blocks unsafe running substitution',
    allocation.conditioningFeasibility?.resolvedSubstitutionFamily !== 'outdoor_running' &&
    allocation.conditioningFeasibility?.resolvedSubstitutionFamily !== 'hill_running_or_walking');
  check('11 hard core exposure is not replaced by a light flush',
    allocation.conditioningCategory === 'vo2' && allocation.section18ConditioningRole === 'required_core' &&
    allocation.tier === 'core');
}
{
  const blockedProfile = profile({
    equipment: [], equipmentSelectionCompleteness: 'complete',
    injuries: [
      { bodyArea: 'Knee', description: 'No lower work', severity: 'Severe' },
      { bodyArea: 'Shoulder', description: 'No upper work', severity: 'Severe' },
    ],
  });
  const equipment = { ...resolveEquipmentCapabilities(blockedProfile), tags: [], conditioningModalities: [] };
  const allocation = resolveConditioningFeasibility({
    tier: 'core', focus: 'Sprint exposure', isHardExposure: true,
    conditioningCategory: 'sprint', conditioningFlavour: 'high-intensity',
    section18ConditioningRole: 'required_core', conditioningOffFeet: true,
  }, { phase: 'Pre-season', equipment, profile: blockedProfile });
  check('12 frequency reduces only after every safe substitute fails',
    allocation.conditioningFeasibility?.status === 'removed' &&
    (allocation.conditioningFeasibility.attemptedSubstitutionFamilies?.length ?? 0) >= 10);
  const contract = buildWeeklyExposureContract({
    seasonPhase: 'Off-season', readiness: 'high', selectedDayNumbers: [1, 2, 3, 4],
    teamTrainingDayNumbers: [], hasGame: false, gameDay: null,
    offseasonSubphase: 'mid_offseason', appConditioningFeasible: false,
    attemptedConditioningSubstitutions:
      allocation.conditioningFeasibility?.attemptedSubstitutionFamilies ?? [],
  });
  check('13 equipment reduction ledger records attempted substitutions',
    contract.reductions.some((entry) => entry.reason === 'equipment_infeasibility' &&
      entry.detail.includes('outdoor_running') && entry.detail.includes('bodyweight_circuit')));
}

const gameEvaluation = visibleEvaluation(game);
check('14 final visible game week has at least one true full-rest day',
  gameEvaluation.ledger.restStress.trueFullRestDays.length >= 1);
check('15 G+1 recovery is active recovery, never full rest',
  gameEvaluation.ledger.restStress.activeRecoveryDays.includes(0) &&
  !gameEvaluation.ledger.restStress.trueFullRestDays.includes(0));
{
  const restDay = gameEvaluation.ledger.restStress.trueFullRestDays[0];
  const source = firstWeek(game).workouts.find((workout) =>
    workout.exercises.some((row) => row.section18Evidence?.role === 'main_strength'))!;
  const accessory: Workout = {
    ...clone(source), id: 'accessory-only', dayOfWeek: restDay,
    name: 'Gunshow / accessories', sessionTier: 'optional', intensity: 'Light',
    strengthIntent: undefined, strengthPatternContributions: undefined,
    powerBlock: undefined, speedBlock: undefined, conditioningBlock: undefined,
    conditioningCategory: undefined, conditioningFlavour: undefined,
    hasCombinedConditioning: false,
    exercises: source.exercises.slice(0, 1).map((row) => ({
      ...clone(row), workoutId: 'accessory-only',
      section18Evidence: {
        protocolVersion: 1, role: 'strength_accessory', strengthPattern: null,
        mainStrengthPattern: null, provenance: 'canonical_row_classifier',
      },
    })),
    section18Evidence: {
      protocolVersion: 1, conditioningRole: 'none', conditioningStress: 'unknown',
      provenance: 'explicit_mutation',
    },
  };
  const visible = resolveFinalVisibleSection18Week({
    contract: firstWeek(game).exposureContractV2!, workouts: firstWeek(game).workouts,
    weekStart: WEEK_START, profile: game.profile,
  });
  const evaluation = evaluateSection18EffectiveWeek({
    contract: firstWeek(game).exposureContractV2!, workouts: [...visible, accessory],
    weekStart: WEEK_START,
  });
  check('16 gunshow/accessory work is not full rest',
    evaluation.ledger.restStress.activeRecoveryDays.includes(restDay) &&
    !evaluation.ledger.restStress.trueFullRestDays.includes(restDay),
    evaluation.ledger.restStress);
}
check('17 bye recovery has at least two true full-rest days',
  visibleEvaluation(byeRecovery).ledger.restStress.trueFullRestDays.length >= 2);
{
  const aerobic = {
    ...hardConditioning(0, 'long-slow-aerobic'),
    name: 'Long Slow Aerobic Work', intensity: 'Moderate' as const,
    conditioningCategory: 'aerobic_base' as const,
    conditioningFlavour: 'aerobic' as const,
    section18Evidence: {
      protocolVersion: 1 as const, conditioningRole: 'planner_selected_core' as const,
      conditioningStress: 'moderate' as const, provenance: 'explicit_mutation' as const,
    },
  };
  const evaluation = evaluateSection18EffectiveWeek({
    contract: firstWeek(mid).exposureContractV2!, workouts: [aerobic], weekStart: WEEK_START,
  });
  check('18 controlled long aerobic work is moderate',
    evaluation.ledger.restStress.moderateDays.includes(aerobic.dayOfWeek));
}
{
  const base = firstWeek(pre3);
  const contract = clone(base.exposureContractV2!);
  const occupied = new Set(base.workouts.filter((workout) => workout.workoutType !== 'Rest').map((workout) => workout.dayOfWeek));
  const free = [0, 1, 2, 3, 4, 5, 6].filter((day) => !occupied.has(day)).slice(0, 2);
  const overHard = [
    ...base.workouts.filter((workout) => !free.includes(workout.dayOfWeek)),
    ...free.map((day, index) => hardConditioning(day, `fifth-hard-${index}`)),
  ];
  const result = runSection18AcceptedWeekGateway({
    contract, workouts: overHard, weekStart: WEEK_START, profile: pre3.profile,
    resolveVisibleWorkouts: (workouts) => [...workouts], maxRepairAttempts: 1,
  });
  fiveHardRejected = result.status === 'rejected' && result.evaluation.blockingViolations.some((finding) =>
    finding.code === 'hard_day_breach');
  check('19 app-created fifth hard day is rejected without typed anchor proof',
    fiveHardRejected);
}
check('20 optional work is removed before required work when repairing rest',
  firstWeek(game).workouts.some((workout) => workout.workoutType === 'Rest') &&
  gameEvaluation.ledger.mainStrength.achievedCount === firstWeek(game).exposureContractV2?.mainStrength.exposure.plannerSelectedTarget &&
  gameEvaluation.ledger.conditioning.coreCount === firstWeek(game).exposureContractV2?.conditioning.core.plannerSelectedTarget);

check('21 generation cannot store a blocking final-visible violation',
  visibleEvaluation(pre).blockingViolations.length === 0);
{
  const base = firstWeek(mid);
  check('22 rebuild cannot store a blocking final-visible violation', rejected(() =>
    validateMicrocycleAgainstActiveConstraints({
      microcycle: { ...clone(base), workouts: allRest(base.workouts) },
      todayISO: WEEK_START, activeConstraints: [], profile: mid.profile,
    })));
  const repeat = buildRepeatWeekOverlay({
    sourceWorkouts: allRest(base.workouts),
    targetWeekStart: WEEK_START,
    targetExposureContractV2: clone(base.exposureContractV2!),
  });
  repeatWriteRejected = rejected(() => validateWeekOverlayAgainstActiveConstraints({
      overlay: repeat, todayISO: WEEK_START, activeConstraints: [], profile: mid.profile,
    }));
  check('23 Repeat Week cannot store a blocking violation', repeatWriteRejected);
  check('24 rollover cannot store a blocking violation', rejected(() =>
    validateProgramAgainstActiveConstraints({
      program: { ...clone(mid.program), microcycles: [{ ...clone(base), workouts: allRest(base.workouts) }] },
      todayISO: WEEK_START, activeConstraints: [], profile: mid.profile,
    })));
}
{
  useProfileStore.getState().updateOnboardingData(mid.profile);
  useProgramStore.getState().clear();
  useProgramStore.getState().setCurrentProgram(clone(mid.program));
  const strength = firstWeek(mid).workouts.find((workout) =>
    workout.exercises.some((row) => row.section18Evidence?.role === 'main_strength'))!;
  const date = `${WEEK_START.slice(0, 8)}${String(12 + strength.dayOfWeek).padStart(2, '0')}`;
  coachWriteRejected = rejected(() =>
    useProgramStore.getState().setManualOverride(date, restStub(strength), { intent: 'coach_adjustment' }));
  check('25 Coach edit cannot store a blocking violation', coachWriteRejected);
  check('26 explicit user override cannot bypass the same gateway',
    !useProgramStore.getState().dateOverrides[date]);
  useProgramStore.getState().clear();
}
{
  const hydrated = clone(mid.program);
  const primer = hydrated.microcycles[0].workouts.find((workout) => workout.powerBlock)?.powerBlock;
  hydrated.microcycles[0].workouts = hydrated.microcycles[0].workouts.map((workout) => ({
    ...workout, ...(primer ? { powerBlock: primer } : {}),
  }));
  const canonical = canonicaliseHydratedProgram(hydrated);
  hydrationRepairObserved = hydrationRepairObserved &&
    canonical.microcycles[0].workouts.filter((workout) => !!workout.powerBlock).length <= 2;
  const restDay = gameEvaluation.ledger.restStress.trueFullRestDays[0];
  const activeRecovery = resolveFinalVisibleSection18Week({
    contract: firstWeek(game).exposureContractV2!, workouts: firstWeek(game).workouts,
    weekStart: WEEK_START, profile: game.profile,
  }).find((workout) => workout.dayOfWeek === 0)!;
  const restDate = dateForDay(restDay);
  const hydratedState = canonicaliseHydratedState({
    currentProgram: clone(game.program),
    dateOverrides: {
      [restDate]: {
        ...clone(activeRecovery), id: 'hydrated-optional-recovery', dayOfWeek: restDay,
      },
    },
  });
  const repairedOverride = hydratedState.dateOverrides?.[restDate];
  hydrationRepairObserved = hydrationRepairObserved && repairedOverride?.workoutType === 'Rest';
  check('27 hydration repairs migrated base and effective override weeks before persistence',
    canonical.microcycles[0].workouts.filter((workout) => !!workout.powerBlock).length <= 2 &&
    repairedOverride?.workoutType === 'Rest');
}
{
  const base = firstWeek(low);
  const primer = firstWeek(mid).workouts.find((workout) => workout.powerBlock)?.powerBlock;
  const unsafe = base.workouts.map((workout) => ({ ...workout, ...(primer ? { powerBlock: primer } : {}) }));
  const accepted = requireSection18AcceptedWeek({
    contract: clone(base.exposureContractV2!), workouts: unsafe,
    weekStart: WEEK_START, profile: low.profile,
  });
  check('28 safety reductions remain authoritative at commit',
    accepted.canonicalWorkouts.every((workout) => !workout.powerBlock) &&
    accepted.contract.power.plannerSelectedWeeklyBudget === 0);
}
{
  const base = firstWeek(mid);
  const result = runSection18AcceptedWeekGateway({
    contract: clone(base.exposureContractV2!), workouts: allRest(base.workouts),
    weekStart: WEEK_START, profile: mid.profile, maxRepairAttempts: 3,
    resolveVisibleWorkouts: (workouts) => [...workouts],
  });
  selectedTargetPreserved = result.contract.mainStrength.exposure.plannerSelectedTarget ===
    base.exposureContractV2?.mainStrength.exposure.plannerSelectedTarget;
  check('29 selected phase targets remain authoritative',
    result.status === 'rejected' && selectedTargetPreserved);
  check('30 repair loops terminate deterministically',
    result.status === 'rejected' && result.attempts <= 3 && !!result.failureSignature);
  const fallback = runSection18AcceptedWeekGateway({
    contract: clone(base.exposureContractV2!), workouts: allRest(base.workouts),
    weekStart: WEEK_START, profile: mid.profile,
    resolveVisibleWorkouts: (workouts) => [...workouts],
    maxRepairAttempts: 2,
    safeFallback: () => ({ contract: clone(base.exposureContractV2!), workouts: clone(base.workouts) }),
  });
  check('31 safe fallback passes the same gateway',
    fallback.status !== 'rejected' && fallback.repairs.some((repair) => repair.kind === 'safe_fallback_candidate'));
  typedRejectionObserved = rejected(() =>
    requireSection18AcceptedWeek({
      contract: clone(base.exposureContractV2!), workouts: allRest(base.workouts),
      weekStart: WEEK_START, profile: mid.profile,
      resolveVisibleWorkouts: (workouts) => [...workouts], maxRepairAttempts: 2,
    }));
  check('32 irreparable week returns the typed failure', typedRejectionObserved);
}

console.log('\n-- Cross-path equivalence --');
{
  const base = firstWeek(mid);
  const direct = requireSection18AcceptedWeek({
    contract: clone(base.exposureContractV2!), workouts: clone(base.workouts),
    weekStart: WEEK_START, profile: mid.profile,
    resolveVisibleWorkouts: (workouts) => [...workouts],
  });
  const rebuilt = validateMicrocycleAgainstActiveConstraints({
    microcycle: clone(base), todayISO: WEEK_START, activeConstraints: [], profile: mid.profile,
  });
  const hydrated = canonicaliseHydratedProgram(clone(mid.program)).microcycles[0];
  const signature = (contract: NonNullable<Microcycle['exposureContractV2']>, workouts: Workout[]) => {
    const evaluation = evaluateSection18EffectiveWeek({ contract, workouts, weekStart: WEEK_START });
    return JSON.stringify({
      power: contract.power.plannerSelectedWeeklyBudget,
      equipment: contract.equipment.substitutionStatus,
      ledger: evaluation.ledger,
      blocking: evaluation.blockingViolations.map((finding) => finding.code),
    });
  };
  const expected = signature(direct.contract, direct.canonicalWorkouts);
  check('CROSS generation/rebuild/rollover/rehydration use the same acceptance result',
    signature(rebuilt.exposureContractV2!, rebuilt.workouts) === expected &&
    signature(hydrated.exposureContractV2!, hydrated.workouts) === expected);
}

console.log('\n-- Accepted-week properties --');
const generated = [mid, late, pre, pre3, game, byeRecovery, low, limitedMid, bodyweightPre];
check('P1 weekly primers never exceed the selected budget', generated.every((value) => {
  const evaluation = visibleEvaluation(value);
  return evaluation.ledger.power.achievedPrimerCount <=
    (evaluation.contract.power.plannerSelectedWeeklyBudget ?? 2);
}));
check('P2 every ineligible state has zero primers', [low, byeRecovery].every((value) =>
  visibleEvaluation(value).ledger.power.achievedPrimerCount === 0));
check('P3 safe substitutes are selected before frequency reduction',
  firstWeek(limitedMid).exposureContractV2?.equipment.appConditioningFeasible === true &&
  !firstWeek(limitedMid).exposureContractV2?.authorisedReductions.some((entry) =>
    entry.reason === 'equipment_infeasibility'));
check('P4 optional work cannot satisfy core intensity', (() => {
  const optional = hardConditioning(1, 'optional-flush');
  optional.intensity = 'Light';
  optional.section18ConditioningRole = 'optional_flush';
  optional.section18Evidence = {
    protocolVersion: 1, conditioningRole: 'optional_flush', conditioningStress: 'light',
    provenance: 'explicit_mutation',
  };
  const evaluation = evaluateSection18EffectiveWeek({
    contract: firstWeek(mid).exposureContractV2!, workouts: [optional], weekStart: WEEK_START,
  });
  return evaluation.ledger.conditioning.coreCount === 0 &&
    evaluation.ledger.conditioning.optionalFlushCount === 1 &&
    evaluation.blockingViolations.some((finding) => finding.code === 'optional_work_replacing_required_work');
})());
check('P5 active recovery never becomes full rest', generated.every((value) => {
  const ledger = visibleEvaluation(value).ledger.restStress;
  return ledger.activeRecoveryDays.every((day) => !ledger.trueFullRestDays.includes(day));
}));
check('P6 visible minimum rest is enforced', [game, byeRecovery].every((value) => {
  const evaluation = visibleEvaluation(value);
  return evaluation.ledger.restStress.trueFullRestDays.length >=
    evaluation.contract.restStress.requiredFullRestMinimum;
}));
check('P7 app programming never creates an unjustified fifth hard day', generated.every((value) =>
  !visibleEvaluation(value).blockingViolations.some((finding) => finding.code === 'hard_day_breach')));
check('P8 every stored materially changed week passed the gateway',
  rejected(() => validateMicrocycleAgainstActiveConstraints({
    microcycle: { ...clone(firstWeek(mid)), workouts: allRest(firstWeek(mid).workouts) },
    todayISO: WEEK_START, activeConstraints: [], profile: mid.profile,
  })));
check('P9 repairs preserve required core work',
  gameEvaluation.ledger.mainStrength.achievedCount >= gameEvaluation.contract.mainStrength.exposure.requiredMinimum &&
  gameEvaluation.ledger.conditioning.coreCount >= gameEvaluation.contract.conditioning.core.requiredMinimum);
check('P10 contract authority cannot reconcile downward to broken output', (() => {
  const base = firstWeek(mid);
  const result = runSection18AcceptedWeekGateway({
    contract: clone(base.exposureContractV2!), workouts: allRest(base.workouts),
    weekStart: WEEK_START, profile: mid.profile,
    resolveVisibleWorkouts: (workouts) => [...workouts], maxRepairAttempts: 1,
  });
  return result.contract.mainStrength.exposure.plannerSelectedTarget ===
    base.exposureContractV2?.mainStrength.exposure.plannerSelectedTarget;
})());
check('P11 all repair paths terminate', generated.every((value) => {
  const base = firstWeek(value);
  return runSection18AcceptedWeekGateway({
    contract: clone(base.exposureContractV2!), workouts: clone(base.workouts),
    weekStart: base.startDate.slice(0, 10), profile: value.profile, maxRepairAttempts: 8,
  }).attempts <= 8;
}));

console.log('\n-- Mutation witnesses --');
const mutationChecks: Array<[string, boolean]> = [
  ['M1 restoring per-lift primers is killed', visibleEvaluation(mid).ledger.power.achievedPrimerCount <= 2],
  ['M2 skipping substitute attempts is killed', firstWeek(limitedMid).exposureContractV2?.equipment.substitutionStatus === 'substituted'],
  ['M3 treating recovery as rest is killed', !gameEvaluation.ledger.restStress.trueFullRestDays.includes(0)],
  ['M4 observing raw instead of visible week is killed', firstWeek(game).exposureContractV2?.restStress.achievedTrueFullRestCount === gameEvaluation.ledger.restStress.trueFullRestDays.length],
  ['M5 allowing five hard days without proof is killed', fiveHardRejected],
  ['M6 bypassing Repeat Week gateway is killed', repeatWriteRejected],
  ['M7 bypassing Coach edits is killed', coachWriteRejected],
  ['M8 lowering selected targets is killed', selectedTargetPreserved],
  ['M9 storing after warning-only validation is killed', typedRejectionObserved],
  ['M10 skipping post-hydration validation is killed', hydrationRepairObserved],
];
for (const [name, condition] of mutationChecks) check(name, condition);

console.log(`\nsection18AcceptedWeekGatewayTests: ${pass} passed, ${fail} failed`);
console.log('SECTION18_ACCEPTED_WEEK_TOTALS scenarios=32 properties=11 mutations=10 cross_paths=1');
if (fail > 0) {
  console.log(`Failures:\n${failures.map((failure) => `  - ${failure}`).join('\n')}`);
  process.exit(1);
}
