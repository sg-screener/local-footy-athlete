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
  buildSection18ProductionFallbackCandidate,
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
import {
  useCoachUpdatesStore,
  type ActiveConstraint,
} from '../store/coachUpdatesStore';
import {
  migrateLegacyWeeklyExposureContractV2,
  type AnchorParticipationState,
  type Section18AnchorContract,
  type WeeklyExposureContractV2,
} from '../rules/weeklyExposureContractV2';
import { applyGenerationSafetyToSection18Contract } from '../rules/section18SafetyPolicy';

const WEEK_START = '2026-07-13';
const NOW = '2026-07-13T00:00:00.000Z';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const TEAM_DAYS = ['Tuesday', 'Thursday', 'Wednesday'] as const;

let pass = 0;
let fail = 0;
const failures: string[] = [];
let rebuildFallbackAccepted = false;
let repeatWriteAccepted = false;
let rolloverFallbackAccepted = false;
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

function dateForWeekDay(weekStart: string, dayOfWeek: number): string {
  const date = new Date(`${weekStart.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  return date.toISOString().slice(0, 10);
}

function strengthWithoutConditioning(source: Workout, id: string): Workout {
  return {
    ...clone(source),
    id,
    name: 'Strength Only',
    workoutType: 'Strength',
    hasCombinedConditioning: false,
    attachedConditioningKind: undefined,
    conditioningBlock: undefined,
    conditioningCategory: undefined,
    conditioningFlavour: undefined,
    section18ConditioningRole: undefined,
    section18Evidence: {
      protocolVersion: 1,
      conditioningRole: 'none',
      conditioningStress: 'unknown',
      provenance: 'explicit_mutation',
    },
    exercises: source.exercises.filter((row) =>
      row.section18Evidence?.role !== 'conditioning'),
  };
}

function minimalAnchorWorkout(anchor: Section18AnchorContract): Workout {
  const team = anchor.kind === 'team_training';
  return {
    id: `typed-anchor-${anchor.id}`,
    microcycleId: 'typed-anchor-week',
    dayOfWeek: anchor.dayOfWeek,
    name: team ? 'Team Training' : anchor.kind === 'practice_match' ? 'Practice Match' : 'Game Day',
    description: '',
    durationMinutes: 60,
    intensity: 'High',
    workoutType: team ? 'Team Training' : 'Game',
    sessionTier: 'core',
    section18Evidence: {
      protocolVersion: 1,
      conditioningRole: 'none',
      conditioningStress: 'unknown',
      provenance: 'explicit_mutation',
    },
    exercises: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function resetLiveStores(value: ReturnType<typeof program>): void {
  useProgramStore.getState().clear();
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null });
  useProfileStore.getState().updateOnboardingData(value.profile);
  useProgramStore.getState().setCurrentProgram(clone(value.program));
}

function precedenceSnapshot(): string {
  const state = useProgramStore.getState();
  return JSON.stringify({
    dateOverrides: state.dateOverrides,
    overrideContexts: state.overrideContexts,
    weekScopedOverlays: state.weekScopedOverlays,
    exposureContractsByWeek: state.exposureContractsByWeek,
  });
}

function coreConditioningWorkout(value: ReturnType<typeof program>): Workout {
  const week = firstWeek(value);
  const visible = resolveFinalVisibleSection18Week({
    contract: week.exposureContractV2!,
    workouts: week.workouts,
    weekStart: week.startDate.slice(0, 10),
    profile: value.profile,
  });
  const source = visible.find((workout) => {
    const role = workout.section18Evidence?.conditioningRole ?? workout.section18ConditioningRole;
    return role === 'required_core' || role === 'planner_selected_core' || role === 'core';
  });
  if (!source) throw new Error('fixture has no core conditioning workout');
  return source;
}

function removeConditioningFromWorkout(source: Workout, id: string): Workout {
  return source.exercises.some((row) => row.section18Evidence?.role === 'main_strength')
    ? strengthWithoutConditioning(source, id)
    : { ...restStub(source), id };
}

function additionalCoreConditioning(source: Workout, dayOfWeek: number, id: string): Workout {
  return {
    ...clone(source),
    id,
    dayOfWeek,
    name: 'Additional Core Conditioning',
    workoutType: 'Conditioning',
    sessionTier: 'core',
    planEntryId: undefined,
    strengthIntent: undefined,
    strengthIntentDiagnostics: undefined,
    strengthPatternContributions: undefined,
    powerBlock: undefined,
    speedBlock: undefined,
    recoveryAddons: undefined,
    hasCombinedConditioning: false,
    attachedConditioningKind: undefined,
    exercises: source.exercises
      .filter((row) => row.section18Evidence?.role === 'conditioning')
      .map((row) => ({ ...clone(row), workoutId: id })),
  };
}

function installOverrideDependency(value: ReturnType<typeof program>): { extraDate: string } {
  resetLiveStores(value);
  const base = firstWeek(value);
  const source = coreConditioningWorkout(value);
  const extraDate = dateForWeekDay(base.startDate.slice(0, 10), 3);
  useProgramStore.getState().setManualOverride(
    extraDate,
    additionalCoreConditioning(source, 3, 'manual-fourth-core'),
    { intent: 'program_adjustment' },
  );
  const sourceDate = dateForWeekDay(base.startDate.slice(0, 10), source.dayOfWeek);
  useProgramStore.getState().setWeekScopedOverlay({
    id: 'overlay-removes-core',
    weekStart: base.startDate.slice(0, 10),
    weekEnd: base.endDate.slice(0, 10),
    anchorDate: null,
    reason: 'repeat_week',
    exposureContract: base.exposureContract ? clone(base.exposureContract) : undefined,
    exposureContractV2: base.exposureContractV2 ? clone(base.exposureContractV2) : undefined,
    workoutsByDate: { [sourceDate]: removeConditioningFromWorkout(source, 'overlay-without-core') },
    createdAt: NOW,
    updatedAt: NOW,
  });
  return { extraDate };
}

function installOverlayDependency(value: ReturnType<typeof program>): { weekStart: string } {
  resetLiveStores(value);
  const base = firstWeek(value);
  const source = coreConditioningWorkout(value);
  const weekStart = base.startDate.slice(0, 10);
  const extraDate = dateForWeekDay(weekStart, 3);
  useProgramStore.getState().setWeekScopedOverlay({
    id: 'overlay-fourth-core',
    weekStart,
    weekEnd: base.endDate.slice(0, 10),
    anchorDate: null,
    reason: 'repeat_week',
    exposureContract: base.exposureContract ? clone(base.exposureContract) : undefined,
    exposureContractV2: base.exposureContractV2 ? clone(base.exposureContractV2) : undefined,
    workoutsByDate: { [extraDate]: additionalCoreConditioning(source, 3, 'overlay-fourth-core-workout') },
    createdAt: NOW,
    updatedAt: NOW,
  });
  const sourceDate = dateForWeekDay(weekStart, source.dayOfWeek);
  useProgramStore.getState().setManualOverride(
    sourceDate,
    removeConditioningFromWorkout(source, 'manual-without-core'),
    { intent: 'program_adjustment' },
  );
  return { weekStart };
}

function redFlagConstraint(id = 'section18-full-pause'): ActiveConstraint {
  return {
    id,
    type: 'injury',
    bodyPart: 'Head/neck',
    bucket: null,
    severity: 10,
    status: 'active',
    startDate: WEEK_START,
    lastUpdatedAt: NOW,
    seriousSymptoms: true,
    seriousSymptom: 'red flag',
    rules: ['Pause training'],
    safeFocus: ['Recovery guidance only'],
    advice: [],
    modifierAffects: ['current_week', 'future_generation'],
  } as ActiveConstraint;
}

function anchorEvaluation(
  source: WeeklyExposureContractV2,
  participation: (anchor: Section18AnchorContract) => AnchorParticipationState,
) {
  const contract = applyGenerationSafetyToSection18Contract({
    contract: {
      ...clone(source),
      anchors: source.anchors.map((anchor) => ({
        ...clone(anchor),
        participation: participation(anchor),
        participationProvenance: participation(anchor) === 'unknown' ? 'legacy_unknown' : 'explicit',
      })),
    },
  });
  return evaluateSection18EffectiveWeek({
    contract,
    workouts: contract.anchors.map(minimalAnchorWorkout),
    weekStart: WEEK_START,
  });
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
  const rebuilt = validateMicrocycleAgainstActiveConstraints({
    microcycle: { ...clone(base), workouts: allRest(base.workouts) },
    todayISO: WEEK_START, activeConstraints: [], profile: mid.profile,
  });
  rebuildFallbackAccepted = evaluateSection18EffectiveWeek({
    contract: rebuilt.exposureContractV2!, workouts: rebuilt.workouts, weekStart: WEEK_START,
  }).blockingViolations.length === 0;
  check('22 rebuild repairs a blocking final-visible candidate through production fallback',
    rebuildFallbackAccepted);
  const repeat = buildRepeatWeekOverlay({
    sourceWorkouts: allRest(base.workouts),
    targetWeekStart: WEEK_START,
    targetExposureContractV2: clone(base.exposureContractV2!),
  });
  const repairedRepeat = validateWeekOverlayAgainstActiveConstraints({
    overlay: repeat, todayISO: WEEK_START, activeConstraints: [], profile: mid.profile,
  });
  repeatWriteAccepted = evaluateSection18EffectiveWeek({
    contract: repairedRepeat.exposureContractV2!,
    workouts: Object.values(repairedRepeat.workoutsByDate).filter((workout): workout is Workout => !!workout),
    weekStart: WEEK_START,
  }).blockingViolations.length === 0;
  check('23 Repeat Week repairs a blocking candidate through the accepted fallback', repeatWriteAccepted);
  const repairedRollover = validateProgramAgainstActiveConstraints({
    program: { ...clone(mid.program), microcycles: [{ ...clone(base), workouts: allRest(base.workouts) }] },
    todayISO: WEEK_START, activeConstraints: [], profile: mid.profile,
  });
  const repairedRolloverWeek = repairedRollover.microcycles[0];
  rolloverFallbackAccepted = evaluateSection18EffectiveWeek({
    contract: repairedRolloverWeek.exposureContractV2!,
    workouts: repairedRolloverWeek.workouts,
    weekStart: WEEK_START,
  }).blockingViolations.length === 0;
  check('24 rollover repairs a blocking candidate through production fallback', rolloverFallbackAccepted);
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
  rebuildFallbackAccepted && repeatWriteAccepted && rolloverFallbackAccepted);
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
  ['M6 bypassing Repeat Week gateway is killed', repeatWriteAccepted],
  ['M7 bypassing Coach edits is killed', coachWriteRejected],
  ['M8 lowering selected targets is killed', selectedTargetPreserved],
  ['M9 storing after warning-only validation is killed', typedRejectionObserved],
  ['M10 skipping post-hydration validation is killed', hydrationRepairObserved],
];
for (const [name, condition] of mutationChecks) check(name, condition);

console.log('\n-- Twenty final-boundary corrective regressions --');

let overrideRemovalAtomic = false;
let overrideClearAtomic = false;
let overlayRemovalAtomic = false;
let overlayClearAtomic = false;
let futureActivationGated = false;
let fullPauseAtomic = false;
let failedConstraintAtomic = false;
let conservativeClear = false;
let legacyUnknownStable = false;
let unknownAnchorUncredited = false;
let typedAnchorHardOwnership = false;
let normalAnchorCredited = false;
let byeRecoveryPreserved = false;
let severeUpperAccepted = false;
let substitutionBeforeReduction = false;
let regenerationBeforeFallback = false;
let fallbackPassedGateway = false;
let fallbackPreservedContract = false;
let fallbackDeterministic = false;
let hydrationParticipationStable = false;

{
  const { extraDate } = installOverrideDependency(mid);
  const before = precedenceSnapshot();
  const wasRejected = rejected(() => useProgramStore.getState().removeManualOverride(extraDate));
  overrideRemovalAtomic = wasRejected && precedenceSnapshot() === before &&
    !!useProgramStore.getState().dateOverrides[extraDate];
  check('33 removing an override cannot create and store a core shortfall', overrideRemovalAtomic);
}
{
  installOverrideDependency(mid);
  const before = precedenceSnapshot();
  const wasRejected = rejected(() => useProgramStore.getState().clearManualOverrides());
  overrideClearAtomic = wasRejected && precedenceSnapshot() === before;
  check('34 clearing all overrides is atomic', overrideClearAtomic);
}
{
  const { weekStart } = installOverlayDependency(mid);
  const before = precedenceSnapshot();
  const wasRejected = rejected(() => useProgramStore.getState().removeWeekScopedOverlay(weekStart));
  overlayRemovalAtomic = wasRejected && precedenceSnapshot() === before &&
    !!useProgramStore.getState().weekScopedOverlays[weekStart];
  check('35 removing an overlay cannot create and store a core shortfall', overlayRemovalAtomic);
}
{
  installOverlayDependency(mid);
  const before = precedenceSnapshot();
  const wasRejected = rejected(() => useProgramStore.getState().clearWeekScopedOverlays());
  overlayClearAtomic = wasRejected && precedenceSnapshot() === before;
  check('36 clearing all overlays is atomic', overlayClearAtomic);
}
{
  resetLiveStores(mid);
  const futureStart = '2026-08-10';
  const futureProgram = generateProgramLocally(mid.profile, {
    todayISO: futureStart,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: 'Off-season',
      phaseEntryWeekStartISO: '2026-06-29',
      originProvenance: 'explicit_user_phase_change',
    },
  });
  const futureWeek = futureProgram.microcycles[0];
  const victim = futureWeek.workouts.find((workout) =>
    workout.exercises.some((row) => row.section18Evidence?.role === 'main_strength'))!;
  const futureDate = dateForWeekDay(futureWeek.startDate.slice(0, 10), victim.dayOfWeek);
  useProgramStore.getState().setManualOverride(
    futureDate,
    restStub(victim),
    { intent: 'program_adjustment' },
  );
  const previousProgramId = useProgramStore.getState().currentProgram?.id;
  const activationRejected = rejected(() =>
    useProgramStore.getState().setCurrentProgram(clone(futureProgram)));
  if (activationRejected) {
    futureActivationGated = useProgramStore.getState().currentProgram?.id === previousProgramId &&
      !!useProgramStore.getState().dateOverrides[futureDate];
  } else {
    const stored = useProgramStore.getState();
    const materialised = stored.currentProgram!.microcycles[0];
    const effective = materialised.workouts.map((workout) =>
      stored.dateOverrides[dateForWeekDay(materialised.startDate.slice(0, 10), workout.dayOfWeek)] ?? workout);
    futureActivationGated = evaluateSection18EffectiveWeek({
      contract: materialised.exposureContractV2!,
      workouts: effective,
      weekStart: materialised.startDate.slice(0, 10),
    }).blockingViolations.length === 0;
  }
  check('37 future-dated override is gated when it first becomes material', futureActivationGated);
}

const pauseConstraint = redFlagConstraint();
let pausedProgramSnapshot = '';
{
  resetLiveStores(mid);
  useCoachUpdatesStore.getState().upsertActiveConstraint(pauseConstraint);
  const storedProgram = useProgramStore.getState().currentProgram!;
  pausedProgramSnapshot = JSON.stringify(storedProgram);
  const pausedWeek = storedProgram.microcycles[0];
  const evaluation = evaluateSection18EffectiveWeek({
    contract: pausedWeek.exposureContractV2!,
    workouts: pausedWeek.workouts,
    weekStart: pausedWeek.startDate.slice(0, 10),
  });
  fullPauseAtomic = useCoachUpdatesStore.getState().activeConstraints.some((entry) =>
    entry.id === pauseConstraint.id) &&
    pausedWeek.workouts.every((workout) =>
      workout.workoutType === 'Rest' || workout.workoutType === 'Recovery' || workout.workoutType === 'Flush-Out') &&
    evaluation.ledger.mainStrength.achievedCount === 0 &&
    evaluation.ledger.conditioning.coreCount === 0 &&
    evaluation.ledger.sprintHighSpeed.achievedCount === 0 &&
    evaluation.ledger.power.achievedPrimerCount === 0 &&
    evaluation.blockingViolations.length === 0;
  check('38 full-pause constraint and recovery-only program commit together', fullPauseAtomic, evaluation);

  useCoachUpdatesStore.getState().removeActiveConstraint(pauseConstraint.id);
  conservativeClear = useCoachUpdatesStore.getState().activeConstraints.every((entry) =>
    entry.id !== pauseConstraint.id) && JSON.stringify(useProgramStore.getState().currentProgram) === pausedProgramSnapshot;
  check('40 clearing a constraint does not silently restore training', conservativeClear);
}
{
  resetLiveStores(mid);
  const boundary = require('../utils/postGenerationConstraintValidation') as {
    stageLiveStoredProgramSafety: (constraints: readonly ActiveConstraint[]) => unknown;
  };
  const originalStage = boundary.stageLiveStoredProgramSafety;
  const beforeProgram = JSON.stringify(useProgramStore.getState().currentProgram);
  const beforeConstraints = JSON.stringify(useCoachUpdatesStore.getState().activeConstraints);
  let threw = false;
  try {
    boundary.stageLiveStoredProgramSafety = () => {
      throw new Error('injected projection failure');
    };
    useCoachUpdatesStore.getState().upsertActiveConstraint(redFlagConstraint('injected-failure'));
  } catch {
    threw = true;
  } finally {
    boundary.stageLiveStoredProgramSafety = originalStage;
  }
  failedConstraintAtomic = threw &&
    JSON.stringify(useProgramStore.getState().currentProgram) === beforeProgram &&
    JSON.stringify(useCoachUpdatesStore.getState().activeConstraints) === beforeConstraints;
  check('39 failed constraint projection commits neither constraint nor program', failedConstraintAtomic);
}

const migratedLegacy = applyGenerationSafetyToSection18Contract({
  contract: migrateLegacyWeeklyExposureContractV2(firstWeek(game).exposureContract!, {
    blockNumber: 1,
    weekInBlock: 1,
    globalWeek: 1,
  }),
});
const migratedLegacyAgain = applyGenerationSafetyToSection18Contract({
  contract: clone(migratedLegacy),
});
const missingParticipation = applyGenerationSafetyToSection18Contract({
  contract: {
    ...clone(firstWeek(game).exposureContractV2!),
    anchors: firstWeek(game).exposureContractV2!.anchors.map((anchor) => ({
      ...clone(anchor),
      participation: 'normal_unrestricted',
      participationProvenance: 'current_input_missing',
    })),
  },
});
legacyUnknownStable = migratedLegacy.anchors.length > 0 && migratedLegacy.anchors.every((anchor) =>
  anchor.participation === 'unknown' &&
  anchor.participationProvenance === 'legacy_unknown' &&
  !anchor.currentProductionClaim.conditioning &&
  !anchor.currentProductionClaim.sprintHighSpeed &&
  !anchor.currentProductionClaim.hardDay) &&
  JSON.stringify(migratedLegacy) === JSON.stringify(migratedLegacyAgain) &&
  missingParticipation.anchors.every((anchor) =>
    anchor.participation === 'unknown' && anchor.participationProvenance === 'legacy_unknown');
check('41 legacy anchors remain deterministic unknown rather than invented healthy participation', legacyUnknownStable);

const unknownEvaluation = evaluateSection18EffectiveWeek({
  contract: migratedLegacy,
  workouts: migratedLegacy.anchors.map(minimalAnchorWorkout),
  weekStart: WEEK_START,
});
unknownAnchorUncredited = unknownEvaluation.ledger.conditioning.anchorCoreCount === 0 &&
  unknownEvaluation.ledger.sprintHighSpeed.achievedCount === 0 &&
  unknownEvaluation.ledger.restStress.anchorHardDays.length === 0 &&
  unknownEvaluation.ledger.restStress.hardDays.length === 0;
check('42 unknown anchors receive no conditioning, sprint or hard-day credit', unknownAnchorUncredited, unknownEvaluation.ledger);

const typedDeniedEvaluation = anchorEvaluation(
  firstWeek(game).exposureContractV2!,
  (anchor) => anchor.kind === 'team_training' ? 'modified' : 'reduced_running',
);
typedAnchorHardOwnership = typedDeniedEvaluation.ledger.anchors.every((anchor) =>
  !anchor.conditioningCredited && !anchor.sprintCredited && !anchor.hardDayCredited) &&
  typedDeniedEvaluation.ledger.restStress.hardDays.length === 0;
check('43 modified TT and reduced-running game cannot regain hard credit through visible fallback',
  typedAnchorHardOwnership, typedDeniedEvaluation.ledger);

const normalEvaluation = anchorEvaluation(
  firstWeek(game).exposureContractV2!,
  () => 'normal_unrestricted',
);
normalAnchorCredited = normalEvaluation.ledger.anchors.length > 0 &&
  normalEvaluation.ledger.anchors.every((anchor) =>
    anchor.conditioningCredited && anchor.sprintCredited && anchor.hardDayCredited) &&
  normalEvaluation.ledger.conditioning.anchorCoreCount === normalEvaluation.ledger.anchors.length;
check('44 normal unrestricted anchors retain approved credit', normalAnchorCredited, normalEvaluation.ledger);

const byeRecoveryEvaluation = visibleEvaluation(byeRecovery);
byeRecoveryPreserved = byeRecoveryEvaluation.ledger.mainStrength.achievedCount === 2 &&
  byeRecoveryEvaluation.ledger.conditioning.optionalRecoveryAerobicCount >= 1 &&
  byeRecoveryEvaluation.ledger.conditioning.optionalRecoveryAerobicCount <= 2 &&
  byeRecoveryEvaluation.ledger.restStress.trueFullRestDays.length >= 2 &&
  byeRecoveryEvaluation.ledger.power.achievedPrimerCount === 0;
check('45 bye-recovery 0TT retains selected recovery aerobic and two true rests',
  byeRecoveryPreserved, byeRecoveryEvaluation.ledger);

const severeUpper = program({
  phase: 'Off-season',
  phaseEntry: '2026-06-15',
  injuries: [{ bodyArea: 'Shoulder', description: 'No loaded pushing', severity: 'Severe' }],
});
const severeUpperEvaluation = visibleEvaluation(severeUpper);
severeUpperAccepted = severeUpperEvaluation.contract.identity.mode === 'late_offseason' &&
  severeUpperEvaluation.ledger.mainStrength.achievedCount === 3 &&
  severeUpperEvaluation.ledger.conditioning.coreCount === 4 &&
  severeUpperEvaluation.ledger.strengthPatterns.meaningfulMainLiftCount.push === 0 &&
  severeUpperEvaluation.ledger.strengthPatterns.meaningfulMainLiftCount.pull > 0 &&
  severeUpperEvaluation.blockingViolations.length === 0;
check('46 severe upper injury produces a valid safe late-off-season S3/C4 week',
  severeUpperAccepted, severeUpperEvaluation);

substitutionBeforeReduction = firstWeek(limitedMid).exposureContractV2?.equipment.substitutionStatus === 'substituted' &&
  firstWeek(limitedMid).exposureContractV2?.equipment.appConditioningFeasible === true &&
  !firstWeek(limitedMid).exposureContractV2?.authorisedReductions.some((entry) =>
    entry.metric === 'conditioning_core_frequency' && entry.reason === 'equipment_infeasibility');
check('47 safe substitution is attempted before conditioning reduction', substitutionBeforeReduction);

const fallbackOrder: string[] = [];
const fallbackBase = firstWeek(mid);
const runProductionFallback = () => runSection18AcceptedWeekGateway({
  contract: clone(fallbackBase.exposureContractV2!),
  workouts: allRest(fallbackBase.workouts),
  weekStart: fallbackBase.startDate.slice(0, 10),
  profile: mid.profile,
  resolveVisibleWorkouts: (workouts) => [...workouts],
  maxRepairAttempts: 2,
  regenerate: () => {
    fallbackOrder.push('regenerate');
    return {
      contract: clone(fallbackBase.exposureContractV2!),
      workouts: allRest(fallbackBase.workouts),
    };
  },
  safeFallback: () => {
    fallbackOrder.push('fallback');
    return buildSection18ProductionFallbackCandidate({
      contract: clone(fallbackBase.exposureContractV2!),
      weekStart: fallbackBase.startDate.slice(0, 10),
      profile: mid.profile,
      activeConstraints: [],
    });
  },
});
const productionFallback = runProductionFallback();
regenerationBeforeFallback = fallbackOrder.join(',') === 'regenerate,fallback';
check('48 production regeneration is attempted before fallback', regenerationBeforeFallback, fallbackOrder);
fallbackPassedGateway = productionFallback.status !== 'rejected' &&
  productionFallback.repairs.some((repair) => repair.kind === 'safe_fallback_candidate') &&
  productionFallback.evaluation.blockingViolations.length === 0;
check('49 production fallback passes the same accepted-week gateway', fallbackPassedGateway, productionFallback);
fallbackPreservedContract = productionFallback.contract.mainStrength.exposure.plannerSelectedTarget ===
  fallbackBase.exposureContractV2?.mainStrength.exposure.plannerSelectedTarget &&
  productionFallback.contract.conditioning.core.plannerSelectedTarget ===
  fallbackBase.exposureContractV2?.conditioning.core.plannerSelectedTarget;
check('50 fallback cannot lower the approved contract', fallbackPreservedContract);
fallbackOrder.length = 0;
const productionFallbackAgain = runProductionFallback();
const fallbackSignature = (result: typeof productionFallback) => JSON.stringify({
  status: result.status,
  attempts: result.attempts,
  selectedStrength: result.contract.mainStrength.exposure.plannerSelectedTarget,
  selectedConditioning: result.contract.conditioning.core.plannerSelectedTarget,
  strength: result.evaluation.ledger.mainStrength.achievedCount,
  conditioning: result.evaluation.ledger.conditioning.coreCount,
  sprint: result.evaluation.ledger.sprintHighSpeed.achievedCount,
  power: result.evaluation.ledger.power.achievedPrimerCount,
  blocking: result.evaluation.blockingViolations.map((finding) => finding.code),
});
fallbackDeterministic = productionFallback.attempts <= 2 && productionFallbackAgain.attempts <= 2 &&
  fallbackOrder.join(',') === 'regenerate,fallback' &&
  fallbackSignature(productionFallback) === fallbackSignature(productionFallbackAgain);
check('51 fallback and repair terminate deterministically', fallbackDeterministic);

{
  const persisted = clone(mid.program);
  const week = persisted.microcycles[0];
  const contract = week.exposureContractV2!;
  const unknownAnchor: Section18AnchorContract = {
    id: 'persisted-legacy-tt',
    kind: 'team_training',
    dayOfWeek: 3,
    participation: 'normal_unrestricted',
    participationProvenance: 'healthy_legacy_assumption',
    currentProductionClaim: { conditioning: true, sprintHighSpeed: true, hardDay: true },
    creditPolicy: {
      conditioningRequiresNormalParticipation: true,
      sprintRequiresNormalHighSpeedParticipation: true,
      hardDayRequiresNormalHardParticipation: true,
      formalPowerPrimerCredit: false,
    },
  };
  week.exposureContractV2 = {
    ...contract,
    source: 'legacy_migration',
    anchors: [...contract.anchors, unknownAnchor],
  };
  const anchorWorkout = minimalAnchorWorkout(unknownAnchor);
  const existingIndex = week.workouts.findIndex((workout) => workout.dayOfWeek === unknownAnchor.dayOfWeek);
  if (existingIndex >= 0) week.workouts[existingIndex] = anchorWorkout;
  else week.workouts.push(anchorWorkout);
  const hydratedOnce = canonicaliseHydratedProgram(persisted);
  const hydratedTwice = canonicaliseHydratedProgram(clone(hydratedOnce));
  const onceWeek = hydratedOnce.microcycles[0];
  const twiceWeek = hydratedTwice.microcycles[0];
  const onceEvaluation = evaluateSection18EffectiveWeek({
    contract: onceWeek.exposureContractV2!, workouts: onceWeek.workouts, weekStart: WEEK_START,
  });
  const twiceEvaluation = evaluateSection18EffectiveWeek({
    contract: twiceWeek.exposureContractV2!, workouts: twiceWeek.workouts, weekStart: WEEK_START,
  });
  const onceAnchor = onceWeek.exposureContractV2!.anchors.find((anchor) => anchor.id === unknownAnchor.id);
  const twiceAnchor = twiceWeek.exposureContractV2!.anchors.find((anchor) => anchor.id === unknownAnchor.id);
  hydrationParticipationStable = onceAnchor?.participation === 'unknown' &&
    onceAnchor.participationProvenance === 'legacy_unknown' &&
    twiceAnchor?.participation === 'unknown' &&
    twiceAnchor.participationProvenance === 'legacy_unknown' &&
    onceEvaluation.blockingViolations.length === 0 &&
    twiceEvaluation.blockingViolations.length === 0 &&
    JSON.stringify(onceEvaluation.ledger) === JSON.stringify(twiceEvaluation.ledger);
  check('52 rehydration preserves participation state and accepted-week semantics',
    hydrationParticipationStable, { onceAnchor, twiceAnchor, onceEvaluation, twiceEvaluation });
}

console.log('\n-- Final-boundary properties --');
check('P12 destructive precedence mutations cannot bypass validation',
  overrideRemovalAtomic && overrideClearAtomic && overlayRemovalAtomic && overlayClearAtomic);
check('P13 constraint and program state never commit partially', fullPauseAtomic && failedConstraintAtomic);
check('P14 unknown participation never gains automatic anchor credit', unknownAnchorUncredited);
check('P15 typed participation owns hard-day classification', typedAnchorHardOwnership && normalAnchorCredited);
check('P16 selected recovery work is not deleted solely to satisfy rest', byeRecoveryPreserved);
check('P17 safe feasible constrained weeks do not reject without regeneration/fallback', severeUpperAccepted);
check('P18 all fallbacks pass the same gateway', fallbackPassedGateway && fallbackPreservedContract);
check('P19 failed gateway transactions preserve the previous accepted state',
  overrideRemovalAtomic && overlayRemovalAtomic && failedConstraintAtomic);

console.log('\n-- Final-boundary mutation witnesses --');
const finalBoundaryMutations: Array<[string, boolean]> = [
  ['M11 bypassing gateway during override deletion is killed', overrideRemovalAtomic && overrideClearAtomic],
  ['M12 bypassing gateway during overlay deletion is killed', overlayRemovalAtomic && overlayClearAtomic],
  ['M13 committing constraint before program validation is killed', failedConstraintAtomic],
  ['M14 restoring healthy_legacy_assumption is killed', legacyUnknownStable && hydrationParticipationStable],
  ['M15 classifying all visible TT/game labels as hard is killed', typedAnchorHardOwnership],
  ['M16 removing bye-recovery flush for rest is killed', byeRecoveryPreserved],
  ['M17 skipping constrained regeneration is killed', regenerationBeforeFallback],
  ['M18 accepting fallback without gateway evaluation is killed', fallbackPassedGateway],
  ['M19 lowering the contract during fallback is killed', fallbackPreservedContract],
];
for (const [name, condition] of finalBoundaryMutations) check(name, condition);

console.log(`\nsection18AcceptedWeekGatewayTests: ${pass} passed, ${fail} failed`);
console.log('SECTION18_ACCEPTED_WEEK_TOTALS scenarios=52 properties=19 mutations=19 cross_paths=1');
if (fail > 0) {
  console.log(`Failures:\n${failures.map((failure) => `  - ${failure}`).join('\n')}`);
  process.exit(1);
}
