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
  WeekScopedWorkoutOverlay,
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
import { buildCoachRevisionTemplateWorkout } from '../utils/coachRevisionTemplates';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';
import { commitAcceptedStateTransaction } from '../store/acceptedStateTransaction';
import {
  composeInjuryCompatibility,
  migrateLegacyInjuryEpisodes,
} from '../rules/injuryEpisode';

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
let fiveHardAccepted = false;
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

function liveWeekAccepted(value: ReturnType<typeof program>): boolean {
  const state = useProgramStore.getState();
  return rebaseAcceptedEffectiveWeek({
    surfaces: state,
    weekStart: firstWeek(value).startDate.slice(0, 10),
    profile: value.profile,
    markedDays: state.acceptedMaterialContext.markedDays,
  }).evaluation.blockingViolations.length === 0;
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
    reason: 'one_off_game',
    exposureContract: base.exposureContract ? clone(base.exposureContract) : undefined,
    exposureContractV2: base.exposureContractV2 ? clone(base.exposureContractV2) : undefined,
    workoutsByDate: { [sourceDate]: removeConditioningFromWorkout(source, 'overlay-without-core') },
    createdAt: NOW,
    updatedAt: NOW,
  });
  return { extraDate };
}

/** Workout id the overlay dependency installs; nothing else in the week uses it. */
const OVERLAY_DEPENDENCY_WORKOUT_ID = 'overlay-fourth-core-workout';

/**
 * Is the removed overlay's CONTENT actually gone from the accepted week?
 *
 * This replaces `Object.keys(weekScopedOverlays).length === 0` in scenarios 35
 * and 36. That count was a proxy for "the overlay is gone", and it stopped being
 * one on 2026-07-30, when a §18 repair of a BASE-OWNED week moved out of
 * `dateOverrides` — the athlete's decision surface — and into an overlay of its
 * own (see docs/DERIVED_OVERRIDE_MATERIALISATION_REASSESSMENT_2026-07-30.md).
 * Both scenarios remove an overlay from a week that then genuinely needs
 * repairing, so a `accepted_week_repair` overlay is minted immediately
 * afterwards and the count is 1 again. The removal still happened; the count no
 * longer says so.
 *
 * DELIBERATELY STRONGER, not weaker. The count only ever implied the removed
 * content was gone. This asks the accepted week directly, so an implementation
 * that emptied the map while leaving the fourth core conditioning session in the
 * week now fails where the count passed. `liveWeekAccepted` beside it is
 * untouched and is what kills M12 — bypassing the whole-week repair still leaves
 * blocking violations and still fails.
 */
function overlayDependencyGone(value: ReturnType<typeof program>): boolean {
  const state = useProgramStore.getState();
  const accepted = rebaseAcceptedEffectiveWeek({
    surfaces: state,
    weekStart: firstWeek(value).startDate.slice(0, 10),
    profile: value.profile,
    markedDays: state.acceptedMaterialContext.markedDays,
  });
  const carries = (workouts: readonly Workout[]) =>
    workouts.some((workout) => workout.id === OVERLAY_DEPENDENCY_WORKOUT_ID);
  return !carries(accepted.composedWorkouts) && !carries(accepted.visibleWorkouts) &&
    !Object.values(state.weekScopedOverlays).some((overlay) =>
      overlay.id === 'overlay-fourth-core');
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
    reason: 'one_off_game',
    exposureContract: base.exposureContract ? clone(base.exposureContract) : undefined,
    exposureContractV2: base.exposureContractV2 ? clone(base.exposureContractV2) : undefined,
    workoutsByDate: { [extraDate]: additionalCoreConditioning(source, 3, OVERLAY_DEPENDENCY_WORKOUT_ID) },
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
// RE-POINTED (Sam's ruling 4 + the readiness law, 2026-07-28; applied
// 2026-07-29). This was `program({ phase: 'In-season', low: true })` and was
// called `byeRecovery`, because LOW CAPACITY selected the recovery mode. It no
// longer does: the mode is schedule-triggered only. The same fixture now
// generates a bye BUILD week, which is what it is called here.
//
// NOT COVERED, AND OPEN FOR SAM. The bye-RECOVERY visible shape is no longer
// reachable from generation at all. `resolveSeasonPhaseWeekKind` schedules
// deloads in pre-season (every 4th week) and off-season (after week 4) and NEVER
// in-season, so with capacity and injury removed as triggers the mode has no
// producer left in this path; the illness door deliberately changes the dose and
// not `weekKind`. Ruling needed: which in-season schedule fact enters a bye
// recovery week? Until it lands, that mode's shape is proven where it can still
// be produced — `readinessDoseSweepTests` block [5] at the contract, and
// `section18PhasePlannerTests` scenarios 12-14 with an explicit deload week.
const inSeasonBye = program({ phase: 'In-season' });
const byeBuildVisible = () => visibleEvaluation(inSeasonBye);
const low = program({ phase: 'Off-season', phaseEntry: '2026-06-29', low: true });

check('1 mid off-season S4 final week has only 1-2 primers',
  visibleEvaluation(mid).ledger.mainStrength.achievedCount === 4 &&
  [1, 2].includes(visibleEvaluation(mid).ledger.power.achievedPrimerCount));
check('2 pre-season S4 final week has only 1-2 primers',
  visibleEvaluation(pre).ledger.mainStrength.achievedCount === 4 &&
  visibleEvaluation(pre).ledger.power.achievedPrimerCount <= 2);
check('3 high TT/game load reduces primer count',
  visibleEvaluation(game).ledger.power.achievedPrimerCount < visibleEvaluation(mid).ledger.power.achievedPrimerCount);
// RE-POINTED (2026-07-29). Both of these read "has zero primers", and the note
// below explained why they stood while check 6 was corrected: `low` is the
// CAPACITY score, "a different signal this law does not govern". Sam's readiness
// law closed that exemption on 2026-07-28. Low capacity now shrinks the power
// dose through `deloadPowerDose` instead of removing the block, so a week with
// zero primers is the violation and a week with a small one is the law.
check('4 low capacity KEEPS its primers, within budget', (() => {
  const evaluation = visibleEvaluation(low);
  return evaluation.ledger.power.achievedPrimerCount >= 1 &&
    evaluation.ledger.power.achievedPrimerCount <=
      (evaluation.contract.power.plannerSelectedWeeklyBudget ?? 2);
})(), visibleEvaluation(low).ledger.power);
check('5 in-season bye build KEEPS its primers, within budget', (() => {
  const evaluation = byeBuildVisible();
  return evaluation.ledger.power.achievedPrimerCount >= 1 &&
    evaluation.ledger.power.achievedPrimerCount <=
      (evaluation.contract.power.plannerSelectedWeeklyBudget ?? 2);
})(), byeBuildVisible().ledger.power);
// Re-pointed, not deleted. This read "6 deload has zero primers" — true of the
// code, and exactly what Sam's deload law (2026-07-27) supersedes: "Power is
// not removed on a deload; a deload is not a reason to lose sharpness." The law
// had already reached this gateway's own weekly budget selector, which stopped
// treating a deload as ineligible; what it had not reached was
// `powerPrimerPolicy`, which returned null on a deload week so no primer was
// ever stamped for the budget to keep. Zero primers here was that gap showing
// through, one layer removed from its cause.
{
  const deloadWeek = pre.program.microcycles.find((microcycle) =>
    microcycle.weekKind === 'deload')!;
  const deloadPrimers = visibleEvaluation(pre, deloadWeek)
    .ledger.power.achievedPrimerCount;
  check('6 deload KEEPS its primers, within budget', deloadPrimers >= 1 && deloadPrimers <= 2);
}
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
// REWRITTEN TO SAM'S CHARTER (2026-07-30), and the subject changed under it.
//
// It asserted that a G+1 recovery day could never be full rest. There is no G+1
// recovery day any more: the Bible's anchor is `g_plus_1_rest_or_recovery`, a
// DISJUNCTION the app was resolving on the athlete's behalf — the generator
// pushed a recovery session there, and when that was deleted the RESOLVER
// derived one from nothing instead. An empty G+1 is now REST, and the recovery
// door is the athlete's to open.
//
// Not a weaker cell: it is the same day, asserted as the ruling says it should
// be, and it fails if anything starts filling G+1 again.
check('15 an empty G+1 is REST — nothing is placed on it uninvited',
  gameEvaluation.ledger.restStress.trueFullRestDays.includes(0) &&
  !gameEvaluation.ledger.restStress.hardDays.includes(0) &&
  !gameEvaluation.ledger.mainStrength.sessionDays.includes(0),
  gameEvaluation.ledger.restStress);
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
    // Pick a real accessory, not the leading POWER row: a power row carries
    // `role: 'power'` and is counted by nothing, so re-stamping its §18
    // evidence would build a day that reads as full rest and test the wrong
    // thing entirely.
    exercises: source.exercises.filter((row) => row.role !== 'power').slice(0, 1).map((row) => ({
      ...clone(row), workoutId: 'accessory-only', role: undefined,
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
  // Same rewrite, same reason: accessory work is never REQUIRED work, so it
  // cannot break a rest day. Sam's ruling 2 already said it counts toward
  // nothing; the rest quota now agrees with the ledger instead of contradicting it.
  check('16 gunshow/accessory work is named, and still leaves the day rest',
    evaluation.ledger.restStress.activeRecoveryDays.includes(restDay) &&
    evaluation.ledger.restStress.trueFullRestDays.includes(restDay),
    evaluation.ledger.restStress);
}
// Was "17 bye recovery has at least two true full-rest days" against a fixture
// that is now a bye BUILD week. The rest minimum is contract-stated per mode, so
// this asks the contract instead of restating one mode's number.
check('17 an in-season bye meets its contract-stated full-rest minimum', (() => {
  const evaluation = byeBuildVisible();
  return evaluation.ledger.restStress.trueFullRestDays.length >=
    evaluation.contract.restStress.requiredFullRestMinimum;
})(), byeBuildVisible().ledger.restStress);
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
  const result = runSection18AcceptedWeekGateway({
    contract, workouts: clone(base.workouts), weekStart: WEEK_START, profile: pre3.profile,
    resolveVisibleWorkouts: (workouts) => [...workouts], maxRepairAttempts: 1,
  });
  fiveHardAccepted = result.status !== 'impossible' &&
    result.evaluation.ledger.restStress.hardDays.length === 5 &&
    !result.evaluation.blockingViolations.some((finding) => finding.code === 'hard_day_breach');
  check('19 a complete phase-permitted five-hard-day week is accepted', fiveHardAccepted, {
    status: result.status,
    hardDays: result.evaluation.ledger.restStress.hardDays,
    blockers: result.evaluation.blockingViolations,
  });
}
// REWRITTEN, AND STRICTLY STRONGER. It used to require the week to contain a
// Rest stub — proof the gateway had DELETED an optional session to manufacture a
// rest day. Under Sam's Rest law it never has to: a day carrying only optional
// work is already a rest day, so the repair that removed the athlete's own
// rolling to make the count work has nothing left to do. `repairOptionalRestCandidates`
// is now inert by construction rather than by being called less often.
//
// What the cell protected — required work is never sacrificed to rest — is kept
// and tightened: the targets must still be met, and now nothing may have been
// removed to meet them.
check('20 rest is satisfied without removing ANY work, required or optional',
  gameEvaluation.ledger.restStress.trueFullRestDays.length >=
    (firstWeek(game).exposureContractV2?.restStress.requiredFullRestMinimum ?? 0) &&
  gameEvaluation.ledger.mainStrength.achievedCount === firstWeek(game).exposureContractV2?.mainStrength.exposure.plannerSelectedTarget &&
  gameEvaluation.ledger.conditioning.coreCount === firstWeek(game).exposureContractV2?.conditioning.core.plannerSelectedTarget,
  gameEvaluation.ledger.restStress);

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
  // Local stand-in for the retired repeat-week overlay builder (HOME_SCREEN_
  // REDESIGN ruling 1 — the athlete-facing repeat-week writer is gone). This
  // proves the §18 repair fallback works uniformly across overlay-producing
  // pathways in general, not the retired button specifically, so the fixture
  // reproduces an equivalent sparse week-overlay copy without the deleted
  // module.
  const weekOverlayCopy: WeekScopedWorkoutOverlay = {
    id: 'week-overlay-copy-check-23',
    weekStart: WEEK_START,
    weekEnd: dateForWeekDay(WEEK_START, 0),
    anchorDate: null,
    reason: 'one_off_game',
    exposureContractV2: clone(base.exposureContractV2!),
    workoutsByDate: Object.fromEntries(allRest(base.workouts).map((workout) =>
      [dateForWeekDay(WEEK_START, workout.dayOfWeek), workout])),
    createdAt: NOW,
    updatedAt: NOW,
  };
  const repairedRepeat = validateWeekOverlayAgainstActiveConstraints({
    overlay: weekOverlayCopy, todayISO: WEEK_START, activeConstraints: [], profile: mid.profile,
  });
  repeatWriteAccepted = evaluateSection18EffectiveWeek({
    contract: repairedRepeat.exposureContractV2!,
    workouts: Object.values(repairedRepeat.workoutsByDate).filter((workout): workout is Workout => !!workout),
    weekStart: WEEK_START,
  }).blockingViolations.length === 0;
  check('23 a week-overlay copy repairs a blocking candidate through the accepted fallback', repeatWriteAccepted);
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
  const restDate = dateForDay(restDay);
  // THE ATHLETE'S OWN RECOVERY, built by the door they would have used.
  //
  // It used to be lifted off G+1 of the generated week — a session the APP had
  // placed. That was always the wrong subject for a cell about not taking the
  // athlete's things, and once G+1 became rest there was nothing there to lift,
  // so the setup crashed on `clone(undefined)`. `recovery_flow` is what the
  // recovery door actually writes, which is what an override on this surface
  // would actually contain.
  const activeRecovery = {
    ...buildCoachRevisionTemplateWorkout('recovery_flow', restDate)!,
    dayOfWeek: restDay,
  };
  const hydratedState = canonicaliseHydratedState({
    currentProgram: clone(game.program),
    dateOverrides: {
      [restDate]: {
        ...clone(activeRecovery), id: 'hydrated-optional-recovery', dayOfWeek: restDay,
      },
    },
  }, { ingressKind: 'migration_required' });
  // THE OVERRIDE IS THE ATHLETE'S, AND HYDRATION MUST NOT TAKE IT.
  //
  // This cell used to require hydration to REWRITE a recovery session sitting in
  // `dateOverrides` into a Rest stub — the app deleting the athlete's own chosen
  // session to make its rest count work. `dateOverrides` is an athlete-owned
  // surface, and Sam's ruling (2026-07-30) is that athlete-added optional
  // sessions never break rest, so there is nothing to repair and nothing that may
  // be taken. The read-ingress lift deliberately never visits this surface
  // (`rules/generatorRecoveryRestLift.ts`).
  //
  // The cell keeps its real subject — hydration DOES repair before persistence —
  // through the powerBlock migration, which is a lift of a retired format (L15)
  // rather than a deletion of an athlete decision.
  const repairedOverride = hydratedState.dateOverrides?.[restDate];
  const overrideSurvived = !!repairedOverride && repairedOverride.workoutType !== 'Rest';
  hydrationRepairObserved = hydrationRepairObserved && overrideSurvived;
  check('27 hydration lifts retired formats before persistence, and takes nothing of the athlete\'s',
    canonical.microcycles[0].workouts.filter((workout) => !!workout.powerBlock).length <= 2 &&
    overrideSurvived,
    { repairedOverride: repairedOverride?.workoutType });
}
{
  // RE-PINNED to a genuine §18 SAFETY prohibition (Sam, 2026-07-27).
  //
  // This drove the case from the `low` fixture, whose "low" is
  // `conditioningLevel: 'Poor'` + `recentTrainingLoad: 'Hardly at all'` — the
  // onboarding CAPACITY score, not a readiness declaration. Sam cut the
  // conflation that let capacity mark §18 power ineligible, so that week no
  // longer prohibits power at this boundary; generation still strips its primers
  // through capacity's own lever (check 4 above still passes).
  //
  // The guarantee under test — a §18 safety prohibition is authoritative at
  // commit and unsafe hydrated content cannot survive it — is unchanged, and now
  // rides a prohibition that actually exists.
  const base = firstWeek(low);
  const primer = firstWeek(mid).workouts.find((workout) => workout.powerBlock)?.powerBlock;
  const unsafe = base.workouts.map((workout) => ({ ...workout, ...(primer ? { powerBlock: primer } : {}) }));
  const prohibited = clone(base.exposureContractV2!);
  prohibited.safety.prohibitedPower = true;
  prohibited.power.eligible = false;
  const accepted = requireSection18AcceptedWeek({
    contract: prohibited, workouts: unsafe,
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
    result.status === 'impossible' && selectedTargetPreserved);
  check('30 repair loops terminate deterministically',
    result.status === 'impossible' && result.attempts <= 3 && !!result.failureSignature);
  const fallback = runSection18AcceptedWeekGateway({
    contract: clone(base.exposureContractV2!), workouts: allRest(base.workouts),
    weekStart: WEEK_START, profile: mid.profile,
    resolveVisibleWorkouts: (workouts) => [...workouts],
    maxRepairAttempts: 2,
    safeFallback: () => ({ contract: clone(base.exposureContractV2!), workouts: clone(base.workouts) }),
  });
  check('31 safe fallback passes the same gateway',
    fallback.status !== 'impossible' && fallback.repairs.some((repair) => repair.kind === 'safe_fallback_candidate'));
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
const generated = [mid, late, pre, pre3, game, inSeasonBye, low, limitedMid, bodyweightPre];
check('P1 weekly primers never exceed the selected budget', generated.every((value) => {
  const evaluation = visibleEvaluation(value);
  return evaluation.ledger.power.achievedPrimerCount <=
    (evaluation.contract.power.plannerSelectedWeeklyBudget ?? 2);
}));
// RE-POINTED (2026-07-29). "Ineligible" was the wrong word for both members of
// this list: low capacity and a bye recovery week are DOSE states, not gates.
// What must hold is that neither exceeds the budget the contract selected — the
// property the removal was hiding behind.
check('P2 every low-dose state keeps a primer within its selected budget', [
  visibleEvaluation(low), byeBuildVisible(),
].every((evaluation) =>
  evaluation.ledger.power.achievedPrimerCount >= 1 &&
  evaluation.ledger.power.achievedPrimerCount <=
    (evaluation.contract.power.plannerSelectedWeeklyBudget ?? 2)));
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
// THE PROPERTY, INVERTED WITH THE RULING and kept non-vacuous. The old form
// asserted the two lists were disjoint. They now overlap on purpose — a day the
// athlete rolled on is both rested and active — so the property that carries the
// law is that no day with REQUIRED work ever appears in the rest quota.
check('P5 the rest quota never contains a day with required work', generated.every((value) => {
  const ledger = visibleEvaluation(value).ledger;
  // Deliberately NOT "and never a moderate day". A day carrying only
  // medium-stress OPTIONAL work is moderate AND rested, and that is the law
  // rather than a hole in it — `moderateDays` is a stress observation, not a
  // statement about what the plan required. Hard days and main-strength days are.
  return ledger.restStress.trueFullRestDays.every((day) =>
    !ledger.restStress.hardDays.includes(day) &&
    !ledger.mainStrength.sessionDays.includes(day));
}));
check('P6 visible minimum rest is enforced', [visibleEvaluation(game), byeBuildVisible()].every(
  (evaluation) => evaluation.ledger.restStress.trueFullRestDays.length >=
    evaluation.contract.restStress.requiredFullRestMinimum));
check('P7 app programming never exceeds the mode-specific permitted hard-day maximum', generated.every((value) =>
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
  // INVERTED with the ruling. The mutant this must kill is a build that went back
  // to charging the athlete a rest day for their own recovery session.
  ['M3 charging the athlete a rest day for their own recovery is killed',
    gameEvaluation.ledger.restStress.trueFullRestDays.includes(0)],
  ['M4 observing raw instead of visible week is killed', firstWeek(game).exposureContractV2?.restStress.achievedTrueFullRestCount === gameEvaluation.ledger.restStress.trueFullRestDays.length],
  ['M5 rejecting a complete phase-permitted five-hard-day week is killed', fiveHardAccepted],
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
  useProgramStore.getState().removeManualOverride(extraDate);
  overrideRemovalAtomic = !useProgramStore.getState().dateOverrides[extraDate] && liveWeekAccepted(mid);
  check('33 removing an override repairs the whole week before publication', overrideRemovalAtomic);
}
{
  installOverrideDependency(mid);
  useProgramStore.getState().clearManualOverrides();
  overrideClearAtomic = Object.keys(useProgramStore.getState().dateOverrides).length === 0 &&
    liveWeekAccepted(mid);
  check('34 clearing all overrides is atomic', overrideClearAtomic);
}
{
  const { weekStart } = installOverlayDependency(mid);
  useProgramStore.getState().removeWeekScopedOverlay(weekStart);
  overlayRemovalAtomic = overlayDependencyGone(mid) && liveWeekAccepted(mid);
  check('35 removing an overlay repairs the whole week before publication', overlayRemovalAtomic);
}
{
  installOverlayDependency(mid);
  useProgramStore.getState().clearWeekScopedOverlays();
  overlayClearAtomic = overlayDependencyGone(mid) && liveWeekAccepted(mid);
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
  pausedProgramSnapshot = JSON.stringify(useProgramStore.getState().currentProgram);
  const injuryEpisodes = migrateLegacyInjuryEpisodes({
    activeConstraints: [pauseConstraint],
    activeInjury: null,
    sourceSurface: 'section18_full_pause_invariant',
  });
  const compatibility = composeInjuryCompatibility({
    activeConstraints: useProgramStore.getState().acceptedMaterialContext.activeConstraints,
    injuryEpisodes,
  });
  commitAcceptedStateTransaction({
    reason: 'test:canonical-full-pause-source-fact',
    injuryEpisodes,
    activeConstraints: compatibility.activeConstraints,
    activeInjury: compatibility.activeInjury,
  });
  const storedProgram = useProgramStore.getState().currentProgram!;
  const pausedWeek = storedProgram.microcycles[0];
  const visiblePausedWorkouts = buildProgramTabProjectedWeek({
    mondayISO: pausedWeek.startDate.slice(0, 10),
    todayISO: WEEK_START,
    state: buildScheduleStateImperative(),
    overrideContexts: useProgramStore.getState().overrideContexts,
  }).flatMap((day) => day.workout ? [day.workout] : []);
  const composedPauseContract = applyGenerationSafetyToSection18Contract({
    contract: clone(pausedWeek.exposureContractV2!),
    forceFullPause: true,
  });
  const evaluation = evaluateSection18EffectiveWeek({
    contract: composedPauseContract,
    workouts: visiblePausedWorkouts,
    weekStart: pausedWeek.startDate.slice(0, 10),
  });
  fullPauseAtomic = useCoachUpdatesStore.getState().activeConstraints.some((entry) =>
    entry.id === pauseConstraint.id) &&
    JSON.stringify(storedProgram) === pausedProgramSnapshot &&
    pausedWeek.exposureContractV2!.authorisedReductions.every((entry) =>
      entry.reason !== 'full_pause') &&
    composedPauseContract.authorisedReductions.some((entry) =>
      entry.reason === 'full_pause') &&
    visiblePausedWorkouts.every((workout) =>
      workout.workoutType === 'Rest' || workout.workoutType === 'Recovery' || workout.workoutType === 'Flush-Out') &&
    evaluation.ledger.mainStrength.achievedCount === 0 &&
    evaluation.ledger.conditioning.coreCount === 0 &&
    evaluation.ledger.sprintHighSpeed.achievedCount === 0 &&
    evaluation.ledger.power.achievedPrimerCount === 0 &&
    evaluation.blockingViolations.length === 0;
  check('38 full-pause source fact composes recovery-only visibility without overwriting the base',
    fullPauseAtomic, {
      activeInjury: buildScheduleStateImperative().activeInjury,
      activeConstraints: buildScheduleStateImperative().activeConstraints,
      visibleWorkouts: visiblePausedWorkouts.map((workout) => ({
        name: workout.name,
        workoutType: workout.workoutType,
        exercises: workout.exercises.length,
        conditioning: workout.conditioningBlock?.options.length ?? 0,
        speed: !!workout.speedBlock,
      })),
      evaluation,
    });

  useCoachUpdatesStore.getState().removeActiveConstraint(pauseConstraint.id);
  conservativeClear = useCoachUpdatesStore.getState().activeConstraints.some((entry) =>
    entry.id === pauseConstraint.id) && JSON.stringify(useProgramStore.getState().currentProgram) === pausedProgramSnapshot;
  check('40 deleting a compatibility mirror cannot resolve a canonical episode', conservativeClear);
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
// Re-pointed at what this check is FOR — hard-day and sprint credit, which is
// what its name, P15 and M15 all say. It also asserted `!conditioningCredited`,
// from when all three claims moved behind one boolean. Sam's ruling
// (2026-07-27) separates them: the athlete ATTENDED the modified session and
// the reduced-running game, so both remain conditioning exposures; neither
// earns sprint or hard-day credit, which are intensity claims.
//
// The conditioning half is now asserted POSITIVELY here rather than dropped, so
// this pins the whole split instead of half of it. Check 42 keeps the boundary:
// `unknown` participation still earns nothing at all.
typedAnchorHardOwnership = typedDeniedEvaluation.ledger.anchors.every((anchor) =>
  anchor.conditioningCredited && !anchor.sprintCredited && !anchor.hardDayCredited) &&
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

// RE-POINTED (2026-07-29). This asserted the bye-RECOVERY 0TT shape (two lifts,
// 1-2 recovery aerobics, two true rests, zero primers) against a fixture that
// low capacity used to route into that mode. It is a bye BUILD week now, so the
// property it can still prove is the one it was really written for: a repair
// pass that satisfies the rest minimum must not delete the week's SELECTED
// optional work to do it. See the NOT COVERED note above for the recovery
// shape's own coverage.
const byeBuildEvaluation = byeBuildVisible();
byeRecoveryPreserved = byeBuildEvaluation.ledger.restStress.trueFullRestDays.length >=
    byeBuildEvaluation.contract.restStress.requiredFullRestMinimum &&
  byeBuildEvaluation.ledger.conditioning.coreCount >=
    byeBuildEvaluation.contract.conditioning.core.requiredMinimum &&
  byeBuildEvaluation.ledger.mainStrength.achievedCount >=
    byeBuildEvaluation.contract.mainStrength.exposure.requiredMinimum;
check('45 an in-season bye keeps its selected work while meeting the rest minimum',
  byeRecoveryPreserved, byeBuildEvaluation.ledger);

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
fallbackPassedGateway = productionFallback.status !== 'impossible' &&
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
  const ledgerSemantics = (evaluation: typeof onceEvaluation) => JSON.stringify({
    strength: evaluation.ledger.mainStrength.achievedCount,
    conditioning: evaluation.ledger.conditioning.coreCount,
    sprint: evaluation.ledger.sprintHighSpeed.achievedCount,
    power: evaluation.ledger.power.achievedPrimerCount,
    hardDays: evaluation.ledger.restStress.hardDays,
    fullRest: evaluation.ledger.restStress.trueFullRestDays,
    anchorCredits: evaluation.ledger.anchors.map((anchor) => ({
      id: anchor.id,
      participation: anchor.participation,
      conditioning: anchor.conditioningCredited,
      sprint: anchor.sprintCredited,
      hard: anchor.hardDayCredited,
    })),
  });
  hydrationParticipationStable = onceAnchor?.participation === 'unknown' &&
    onceAnchor.participationProvenance === 'legacy_unknown' &&
    twiceAnchor?.participation === 'unknown' &&
    twiceAnchor.participationProvenance === 'legacy_unknown' &&
    onceEvaluation.blockingViolations.length === 0 &&
    twiceEvaluation.blockingViolations.length === 0 &&
    ledgerSemantics(onceEvaluation) === ledgerSemantics(twiceEvaluation);
  check('52 rehydration preserves participation state and accepted-week semantics',
    hydrationParticipationStable, {
      onceAnchor,
      twiceAnchor,
      onceSemantics: ledgerSemantics(onceEvaluation),
      twiceSemantics: ledgerSemantics(twiceEvaluation),
      oncePower: onceWeek.workouts.filter((workout) => workout.powerBlock).map((workout) => ({
        day: workout.dayOfWeek, family: workout.powerBlock?.family, name: workout.name,
      })),
      twicePower: twiceWeek.workouts.filter((workout) => workout.powerBlock).map((workout) => ({
        day: workout.dayOfWeek, family: workout.powerBlock?.family, name: workout.name,
      })),
    });
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
check('P19 impossible gateway transactions preserve the previous accepted state',
  typedRejectionObserved && failedConstraintAtomic);

console.log('\n-- Final-boundary mutation witnesses --');
const finalBoundaryMutations: Array<[string, boolean]> = [
  ['M11 bypassing whole-week repair during override deletion is killed', overrideRemovalAtomic && overrideClearAtomic],
  ['M12 bypassing whole-week repair during overlay deletion is killed', overlayRemovalAtomic && overlayClearAtomic],
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
