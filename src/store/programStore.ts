import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorageCompat } from './asyncStorageCompat';
import {
  DayOfWeek,
  TrainingProgram,
  Microcycle,
  OnboardingData,
  Workout,
  WorkoutExercise,
  OverrideContext,
  UserRemovalConstraint,
  WeekScopedWorkoutOverlay,
} from '../types/domain';
import { logger } from '../utils/logger';
import {
  decideQuarantinedWrite,
  quarantineRefusedPayload,
  registerQuarantineBoundary,
  releaseQuarantine,
} from './refusedPayloadQuarantine';
import {
  addDaysISO,
  deriveStoredBlockStateFromProgram,
  resolveBlockGridPosition,
  type BlockGridPosition,
  type StoredProgramBlockState,
} from '../utils/programBlockState';
import type { SessionComponentKind } from '../utils/sessionComponents';
import type {
  FeedbackCompletion,
  FeedbackFeeling,
  FeedbackPartialReason,
  FeedbackSkipReason,
  FeedbackSoreness,
  SessionOutcomeTransactionReceipt,
} from '../types/sessionOutcome';
import { appDateNow, dayOfWeekForISODate, todayISOLocal } from '../utils/appDate';
import type { WeeklyExposureContract } from '../rules/weeklyExposureContract';
import {
  buildSection18WeeklyExposureContractV2,
  contractOffseasonSubphase,
  migrateLegacyWeeklyExposureContractV2,
  resolveSection18PhasePlannerSelection,
  type Section18Subphase,
  type Section18WeekMode,
  type WeeklyExposureContractV2,
} from '../rules/weeklyExposureContractV2';
import { applyGenerationSafetyToSection18Contract } from '../rules/section18SafetyPolicy';
import { canonicalContextSubphase } from '../utils/workoutCanonicalisation';
import {
  migrateStoredPowerBlock,
  migrateStoredPowerBlocks,
} from '../rules/legacyPowerBlockMigration';
import {
  isGeneratorPlacedRecovery,
  liftGeneratorRecoveryToRest,
} from '../rules/generatorRecoveryRestLift';
import type { OffseasonSubphase } from '../rules/offseasonSubphase';
import {
  finaliseSection18SafetyWeek,
  finaliseSection18SafetyWorkout,
} from '../rules/section18SafetyFinaliser';
import {
  ensureProgramSeasonPhaseClock,
  resolveSeasonPhaseClock,
  type SeasonPhaseClock,
} from '../rules/seasonPhaseClock';
import { resolveWeekIntensityMultiplier } from '../rules/deloadWeekRules';
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';
import type { CalendarDayType } from './calendarStore';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { effectiveFixtureDatesForWeeks } from '../rules/rollingHorizonRepair';
import { applyUserRemovalConstraintsToWeek } from '../rules/userRemovalConstraints';
import { acceptedProfileSnapshotMintRefusal } from '../rules/profileMirrorNarrowing';
import {
  athleteActionDiagnosticHash,
  beginAthleteActionTrace,
  clearProgramHydrationTrace,
  currentAthleteActionTrace,
  emitAthleteActionEvent,
  programHydrationTrace,
  runWithAthleteActionTrace,
} from '../utils/athleteActionDiagnostics';
import {
  ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
  ACCEPTED_PROFILE_SNAPSHOT_PROTOCOL_VERSION,
  acceptedProfileForContext,
  createEmptyAcceptedMaterialContext,
  normalizeAcceptedMaterialContext,
  normalizeAcceptedProgramSurfaces,
  type AcceptedMaterialContext,
  type AcceptedProfileSnapshotV1,
} from './acceptedStateColdStart';
import {
  migrateLegacyTemporarySourceFacts,
  normalizeTemporarySourceFacts,
} from '../rules/temporarySourceFact';
import {
  composeAcceptedProfileConstraints,
  isAcceptedProfileConstraint,
} from '../rules/acceptedProfileProjection';
import {
  createEmptyReversibleAdjustmentLedger,
  normalizeReversibleAdjustmentLedger,
  type ReversibleAdjustmentLedger,
} from '../rules/reversibleAdjustmentLedger';
import {
  PROGRAM_STORE_PERSISTENCE_VERSION,
  ProgramHydrationIngressError,
  dropRetiredWeekOverlaysAtHydration,
  requireProgramHydrationIngress,
  type ProgramHydrationIngressClassification,
  type ProgramHydrationIngressKind,
} from './programHydrationIngress';
import {
  projectAcceptedMaterialContextDerivedFields,
  projectHydratedStateDerivedFields,
} from './programHydrationProjection';
import { hasPowerRow } from '../rules/sessionRowCounting';

export type { AcceptedMaterialContext } from './acceptedStateColdStart';

export class ProgramPersistenceError extends Error {
  readonly code = 'program_persistence_failed' as const;
  readonly originalStack: string | null;

  constructor(public readonly operation: 'read' | 'write' | 'remove', cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'ProgramPersistenceError';
    this.originalStack = cause instanceof Error ? cause.stack ?? null : null;
  }
}

function programPersistenceFailure(
  operation: ProgramPersistenceError['operation'],
  cause: unknown,
): ProgramPersistenceError {
  const error = new ProgramPersistenceError(operation, cause);
  logger.error('[ProgramStore][persistence] Persistence failed', {
    stage: 'persistence',
    operation,
    errorName: cause instanceof Error ? cause.name : typeof cause,
    message: error.message,
    stack: error.originalStack,
  });
  return error;
}

export const PROGRAM_STORE_PERSISTENCE_KEY = 'program-store';

export interface ProgramPersistenceStageToken {
  readonly id: number;
}

let nextProgramPersistenceStageId = 1;
let activeProgramPersistenceStage: {
  token: ProgramPersistenceStageToken;
} | null = null;

async function programStorageGetItem(name: string): Promise<string | null> {
  return asyncStorageCompat.getItem(name);
}

async function programStorageSetItem(name: string, value: string): Promise<void> {
  await asyncStorageCompat.setItem(name, value);
}

async function programStorageRemoveItem(name: string): Promise<void> {
  await asyncStorageCompat.removeItem(name);
}

/**
 * Coach mutations temporarily publish candidate state because the legacy
 * deterministic executors are synchronous writers. While a transaction is
 * open, Zustand persistence is suppressed; the transaction explicitly writes
 * and awaits the one accepted envelope (or restores the exact prior one).
 */
export function beginProgramPersistenceStage(): ProgramPersistenceStageToken {
  if (activeProgramPersistenceStage) {
    throw new Error('program_persistence_stage_already_active');
  }
  const token = { id: nextProgramPersistenceStageId++ };
  activeProgramPersistenceStage = { token };
  return token;
}

export function endProgramPersistenceStage(token: ProgramPersistenceStageToken): void {
  assertProgramPersistenceStage(token);
  activeProgramPersistenceStage = null;
}

export function serializeProgramStoreEnvelope(state: ProgramState): string {
  return JSON.stringify({ state, version: PROGRAM_STORE_PERSISTENCE_VERSION });
}

export async function readDurableProgramStoreEnvelope(): Promise<string | null> {
  try {
    return await programStorageGetItem(PROGRAM_STORE_PERSISTENCE_KEY);
  } catch (error) {
    throw programPersistenceFailure('read', error);
  }
}

export async function persistProgramStoreEnvelopeDurably(
  token: ProgramPersistenceStageToken,
  state: ProgramState = useProgramStore.getState(),
): Promise<string> {
  assertProgramPersistenceStage(token);
  const value = serializeProgramStoreEnvelope(state);
  await writeProgramStoreEnvelopeRaw(value);
  return value;
}

export async function restoreProgramStoreEnvelopeDurably(
  token: ProgramPersistenceStageToken,
  value: string | null,
): Promise<void> {
  assertProgramPersistenceStage(token);
  try {
    if (value === null) {
      await programStorageRemoveItem(PROGRAM_STORE_PERSISTENCE_KEY);
    } else {
      await programStorageSetItem(PROGRAM_STORE_PERSISTENCE_KEY, value);
    }
  } catch (error) {
    throw programPersistenceFailure(value === null ? 'remove' : 'write', error);
  }
}

function assertProgramPersistenceStage(token: ProgramPersistenceStageToken): void {
  if (!activeProgramPersistenceStage || activeProgramPersistenceStage.token.id !== token.id) {
    throw new Error('program_persistence_stage_not_active');
  }
}

async function writeProgramStoreEnvelopeRaw(value: string): Promise<void> {
  try {
    await programStorageSetItem(PROGRAM_STORE_PERSISTENCE_KEY, value);
  } catch (error) {
    throw programPersistenceFailure('write', error);
  }
}

async function persistCanonicalHydratedEnvelopeReadback(): Promise<void> {
  if (activeProgramPersistenceStage) return;
  const canonicalEnvelope = serializeProgramStoreEnvelope(useProgramStore.getState());
  const persistedEnvelope = await programStorageGetItem(PROGRAM_STORE_PERSISTENCE_KEY);
  if (persistedEnvelope !== canonicalEnvelope) {
    await writeProgramStoreEnvelopeRaw(canonicalEnvelope);
  }
  const acknowledgedEnvelope = await programStorageGetItem(PROGRAM_STORE_PERSISTENCE_KEY);
  if (acknowledgedEnvelope !== canonicalEnvelope) {
    throw new Error('program_hydration_normalization_readback_mismatch');
  }
}

/**
 * THE PROGRAM STORE'S WRITER BOUNDARY, declared once.
 *
 * `carriesMaterial` is the store's own answer to "does this payload carry the
 * athlete's state?" — a program with at least one microcycle. An unreadable
 * envelope answers no: bytes we cannot parse are not bytes we can prove hold
 * anything.
 */
registerQuarantineBoundary(PROGRAM_STORE_PERSISTENCE_KEY, {
  carriesMaterial: (envelope) => {
    try {
      const state = (JSON.parse(envelope) as { state?: Record<string, unknown> }).state ?? {};
      const program = state.currentProgram as { microcycles?: unknown[] } | null | undefined;
      return !!program && (program.microcycles ?? []).length > 0;
    } catch {
      return false;
    }
  },
});

const programStateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const trace = programHydrationTrace();
    try {
      const value = await programStorageGetItem(name);
      emitAthleteActionEvent(trace, 'persistence_result', {
        persistenceOperation: 'read',
        persistenceStore: name,
        persistenceSucceeded: true,
        persistedPayloadHash: value ? athleteActionDiagnosticHash(value) : null,
      });
      return value;
    } catch (error) {
      emitAthleteActionEvent(trace, 'persistence_result', {
        persistenceOperation: 'read',
        persistenceStore: name,
        persistenceSucceeded: false,
        originalRejectionCode: 'program_persistence_failed',
        rejectingBoundary: 'programStateStorage.getItem',
        failureCategory: 'persistence_failure',
      });
      throw programPersistenceFailure('read', error);
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (activeProgramPersistenceStage) {
      return;
    }
    // A REFUSAL MUST NEVER PERSIST THE STATE IT REFUSED INTO (Sam, 2026-07-30).
    //
    // This is the single writer boundary for this store, which is why the law
    // lives here rather than at any of the callers: the wipe was not caused by a
    // bad caller, it was caused by there being nothing between a bare fallback
    // and the disk. While a refused payload is held, a payload carrying no
    // program does not travel. A payload that DOES carry one is always allowed
    // through and releases the hold — that write is the lift succeeding, and a
    // quarantine that blocked the repair would strand the athlete as surely as
    // the wipe destroyed him.
    const decision = decideQuarantinedWrite(name, value);
    if (!decision.allowed) {
      emitAthleteActionEvent(currentAthleteActionTrace(), 'persistence_result', {
        persistenceOperation: 'write',
        persistenceStore: name,
        persistenceSucceeded: false,
        originalRejectionCode: decision.reason,
        rejectingBoundary: 'programStateStorage.setItem.quarantine',
        failureCategory: 'persistence_failure',
        previousStateRestored: true,
      });
      logger.error(
        '[programStore] refused to persist over a quarantined payload.',
        { store: name, reason: decision.reason },
      );
      return;
    }
    releaseQuarantine(name);
    // Capture the explicit token synchronously at this async boundary. The
    // local variable preserves correlation through the awaited write; FIFO
    // ordering is never used as an authority.
    const trace = currentAthleteActionTrace();
    try {
      await programStorageSetItem(name, value);
      emitAthleteActionEvent(trace, 'persistence_result', {
        persistenceOperation: 'write',
        persistenceStore: name,
        persistenceSucceeded: true,
        persistedPayloadHash: athleteActionDiagnosticHash(value),
      });
    } catch (error) {
      emitAthleteActionEvent(trace, 'persistence_result', {
        persistenceOperation: 'write',
        persistenceStore: name,
        persistenceSucceeded: false,
        originalRejectionCode: 'program_persistence_failed',
        rejectingBoundary: 'programStateStorage.setItem',
        failureCategory: 'persistence_failure',
      });
      throw programPersistenceFailure('write', error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    const trace = currentAthleteActionTrace();
    try {
      await programStorageRemoveItem(name);
      emitAthleteActionEvent(trace, 'persistence_result', {
        persistenceOperation: 'remove',
        persistenceStore: name,
        persistenceSucceeded: true,
      });
    } catch (error) {
      emitAthleteActionEvent(trace, 'persistence_result', {
        persistenceOperation: 'remove',
        persistenceStore: name,
        persistenceSucceeded: false,
        originalRejectionCode: 'program_persistence_failed',
        rejectingBoundary: 'programStateStorage.removeItem',
        failureCategory: 'persistence_failure',
      });
      throw programPersistenceFailure('remove', error);
    }
  },
};

/**
 * ProgramStore is the final persistence boundary for every generated/edit
 * path. Dynamic loading avoids a store-initialisation cycle while ensuring the
 * same validator runs for program, overlay, and manual-override writes.
 */
function postValidateProgram(program: TrainingProgram, todayISO?: string): TrainingProgram {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .validateLiveProgramWrite(program, todayISO);
}

function postValidateMicrocycle(microcycle: Microcycle, todayISO?: string): Microcycle {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .validateLiveMicrocycleWrite(microcycle, todayISO);
}

function postValidateWorkout(
  date: string,
  workout: Workout,
  options: { restoreMissingPlanPatterns?: boolean } = {},
): Workout {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .validateLiveWorkoutWrite(date, workout, options);
}

function postValidateNullableWorkout(date: string, workout: Workout | null): Workout | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .validateLiveNullableWorkoutWrite(date, workout);
}

function postValidateWeekOverlay(overlay: WeekScopedWorkoutOverlay): WeekScopedWorkoutOverlay {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .validateLiveWeekOverlayWrite(overlay);
}

function resolveDateMutationExposureContract(
  date: string,
  workout: Workout,
): { weekStart: string; contract: WeeklyExposureContract } | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .resolveLiveDateMutationExposureContract(date, workout);
}

function resolveEditedWeekExposureContract(
  weekStart: string,
): { weekStart: string; contract: WeeklyExposureContract } | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../utils/postGenerationConstraintValidation')
    .resolveLiveEditedWeekExposureContract(weekStart);
}

function mondayForDate(date: string): string {
  const value = new Date(`${date.slice(0, 10)}T12:00:00`);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

/**
 * The resolved off-season subphase for a given date, from the live program's
 * persisted phase clock.
 *
 * For athlete-mutation paths (the coach executor, the plan-change producer)
 * that build a canonical context from the profile's season phase alone. The
 * canonical context requires the subphase, and these callers legitimately have
 * the clock — they just were not reading it, which is how an off-season swap or
 * added session could silently lose its power block. Prefer the week's §18
 * contract when one is in hand; this is for the paths where there is not one.
 */
export function liveOffseasonSubphaseForDate(
  dateISO: string,
): OffseasonSubphase | null {
  const clock = useProgramStore.getState().currentProgram?.seasonPhaseClock;
  if (!clock) return null;
  return resolveSeasonPhaseClock({
    selectedPhase: clock.selectedPhase,
    persistedClock: clock,
    targetWeekStartISO: mondayForDate(dateISO),
  }).offseasonSubphase;
}

/**
 * Persistence is a legacy ingress boundary, not a second programming owner.
 * Old store envelopes may pre-date typed strength intent and canonical
 * component sections, so rehydrate them once through the same finaliser used
 * by generation and edits. Existing modern typed intent wins inside that
 * finaliser; display/scalar fields are compatibility inputs only.
 */
function canonicaliseHydratedWorkout(
  workout: Workout,
  phase?: string,
  weekKind?: Microcycle['weekKind'],
  // The resolved off-season position. Required by the canonical context and
  // therefore required here: this helper reaches the canonicaliser through
  // `require()`, so the compiler cannot see the context it builds and would not
  // have caught a missing subphase. Passing it explicitly keeps hydration
  // honest by hand where the type system is blind.
  offseasonSubphase?: OffseasonSubphase | null,
): Workout {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    finaliseWorkoutAfterMutation,
    canonicalContextSubphase,
  } = require('../utils/workoutCanonicalisation');
  const canonicalPhase = /pre/i.test(phase ?? '')
    ? 'Pre-season'
    : /off/i.test(phase ?? '')
      ? 'Off-season'
      : /in/i.test(phase ?? '')
        ? 'In-season'
        : undefined;
  return finaliseWorkoutAfterMutation(workout, {
    phase: canonicalPhase,
    offseasonSubphase: canonicalContextSubphase(canonicalPhase, offseasonSubphase),
    weekKind,
    // Persisted allocation ownership is legitimate ingress. This preserves
    // explicit legacy contribution arrays even before plan-entry IDs existed.
    planIntentValid: true,
    referenceWorkout: workout,
    section18EvidenceMode: 'preserve_legacy_unknown',
  }).workout;
}

function hydratedWorkoutNeedsIngressCanonicalisation(workout: Workout): boolean {
  const hasStrength = !!workout.strengthIntent?.effectivePatterns.length ||
    !!workout.strengthPatternContributions?.length ||
    workout.exercises.some((row) => row.section18Evidence?.role === 'main_strength');
  const conditioningRole = workout.section18Evidence?.conditioningRole;
  const hasConditioning = !!workout.conditioningBlock ||
    (conditioningRole !== undefined && conditioningRole !== 'none' && conditioningRole !== 'legacy_unknown') ||
    workout.hasCombinedConditioning === true;
  return (
    (!!workout.strengthPatternContributions?.length && !workout.strengthIntent) ||
    (hasStrength && hasConditioning && workout.workoutType !== 'Mixed')
  );
}

export class Section18LegacyMigrationError extends Error {
  readonly code = 'section18_legacy_migration_failed';

  constructor(message: string) {
    super(message);
    this.name = 'Section18LegacyMigrationError';
  }
}

function legacyModeFor(args: {
  phase: 'In-season' | 'Off-season' | 'Pre-season';
  subphase: Section18Subphase | null;
  hasFixture: boolean;
}): { mode: Section18WeekMode; anchorState: 'game' | 'bye' | 'practice_match' | 'none'; declaredSubphase: Section18Subphase } {
  if (args.phase === 'In-season') {
    return args.hasFixture
      ? { mode: 'in_season_game_week', anchorState: 'game', declaredSubphase: 'game_week' }
      : { mode: 'in_season_bye_build', anchorState: 'bye', declaredSubphase: 'bye_build' };
  }
  if (args.phase === 'Off-season') {
    if (
      args.subphase !== 'early_offseason' &&
      args.subphase !== 'mid_offseason' &&
      args.subphase !== 'late_offseason'
    ) {
      throw new Section18LegacyMigrationError('Contractless Off-season week has no trustworthy phase-clock subphase.');
    }
    return { mode: args.subphase, anchorState: 'none', declaredSubphase: args.subphase };
  }
  if (args.hasFixture) {
    return {
      mode: 'practice_match_week',
      anchorState: 'practice_match',
      declaredSubphase: 'practice_match_week',
    };
  }
  if (
    args.subphase !== 'early_preseason' &&
    args.subphase !== 'mid_preseason' &&
    args.subphase !== 'late_preseason'
  ) {
    throw new Section18LegacyMigrationError('Contractless Pre-season week has no trustworthy phase-clock subphase.');
  }
  return { mode: args.subphase, anchorState: 'none', declaredSubphase: args.subphase };
}

function deriveContractlessLegacyContract(args: {
  microcycle: Microcycle;
  selectedPhase: 'In-season' | 'Off-season' | 'Pre-season' | null;
  phaseResolution: ReturnType<typeof resolveSeasonPhaseClock> | null;
}): WeeklyExposureContractV2 {
  if (!args.selectedPhase || !args.phaseResolution) {
    throw new Section18LegacyMigrationError('Contractless week has no trustworthy persisted phase clock.');
  }
  const workouts = args.microcycle.workouts ?? [];
  const teamTrainingDays = workouts
    .filter((workout) => classifyVisibleSession(workout).anchors.teamTraining)
    .map((workout) => workout.dayOfWeek);
  const fixture = workouts.find((workout) => classifyVisibleSession(workout).anchors.game);
  const identity = legacyModeFor({
    phase: args.selectedPhase,
    subphase: args.phaseResolution.subphase,
    hasFixture: !!fixture,
  });
  const availableDayCount = new Set(workouts.map((workout) => workout.dayOfWeek)).size;
  const selection = resolveSection18PhasePlannerSelection({
    mode: identity.mode,
    readiness: 'medium',
    availableDayCount,
    teamTrainingCount: new Set(teamTrainingDays).size,
    weekKind: args.phaseResolution.weekKind,
  });
  return buildSection18WeeklyExposureContractV2({
    seasonPhase: args.selectedPhase,
    declaredSubphase: identity.declaredSubphase,
    mode: identity.mode,
    blockNumber: args.microcycle.miniCycleNumber,
    weekInBlock: ((Math.max(1, args.microcycle.weekNumber) - 1) % 4) + 1,
    globalWeek: args.microcycle.weekNumber,
    phaseWeek: args.phaseResolution.phaseWeekNumber,
    phaseEntryWeekStartISO: args.phaseResolution.clock.phaseEntryWeekStartISO,
    phaseClockSelectedPhase: args.phaseResolution.clock.selectedPhase,
    phaseWeekProvenance: 'preserved_persisted_state',
    weekKind: args.phaseResolution.weekKind,
    anchorState: identity.anchorState,
    teamTrainingDays,
    fixtureDay: fixture?.dayOfWeek ?? null,
    participationProvenance: 'legacy_unknown',
    currentProductionClaimsAnchorCredit: false,
    readiness: 'medium',
    plannerSelected: {
      mainStrength: selection.mainStrength,
      optionalMainStrength: selection.optionalMainStrength,
      coreConditioning: selection.coreConditioning,
      optionalFlush: selection.optionalFlush,
      optionalRecoveryAerobic: selection.optionalRecoveryAerobic,
      sprintHighSpeed: selection.sprintHighSpeed,
      powerPrimers: workouts.filter(hasPowerRow).length,
    },
    prohibitedPatternProvenance: 'legacy_missing',
    source: 'legacy_migration',
  });
}

const LEGACY_DAY_NAMES: DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * ProgramStore and ProfileStore hydrate independently. A contractless program
 * therefore cannot assume the profile has already supplied its scheduling
 * geometry when the accepted-week migration runs. The persisted workout days
 * are trustworthy evidence that those days belonged to the old program; they
 * are not anchor-participation evidence and never create reductions or credit.
 */
function legacyMigrationFallbackProfile(args: {
  profile?: OnboardingData | null;
  microcycle: Microcycle;
  contract: WeeklyExposureContractV2;
}): OnboardingData {
  const persistedDays = Array.from(new Set(
    (args.microcycle.workouts ?? [])
      .map((workout) => workout.dayOfWeek)
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  )).sort((left, right) => (left === 0 ? 7 : left) - (right === 0 ? 7 : right));
  const persistedDayNames = persistedDays.map((day) => LEGACY_DAY_NAMES[day]);
  const profileDays = args.profile?.preferredTrainingDays?.filter(Boolean) ?? [];
  const profileFrequency = args.profile?.trainingDaysPerWeek;
  return {
    ...(args.profile ?? {}),
    seasonPhase: args.contract.identity.seasonPhase,
    trainingDaysPerWeek: profileFrequency && profileFrequency > 0
      ? profileFrequency
      : persistedDays.length,
    preferredTrainingDays: profileDays.length > 0
      ? profileDays
      : persistedDayNames,
    // RETIRED (Sam, 2026-07-28). These were `?? 'Pretty consistent'` and
    // `?? 'Good'` — a missing answer scored 2 + 2 = 4, landing the athlete in
    // the medium band. The old comment called them "generation-only defaults
    // ... never written back as athlete answers", and that was true and beside
    // the point: they were never STORED as answers, they were SCORED as them,
    // and the athlete received the resulting progression tier.
    //
    // Bible Section 9: there is no default and no unknown tier. Passing the
    // absent value through lets the rubric refuse, which is the whole ruling.
    recentTrainingLoad: args.profile?.recentTrainingLoad,
    conditioningLevel: args.profile?.conditioningLevel,
    injuries: args.profile?.injuries ?? [],
  };
}

function canonicaliseHydratedMicrocycle(
  microcycle: Microcycle,
  phase?: string,
  phaseClock?: SeasonPhaseClock,
  profile?: OnboardingData | null,
): Microcycle {
  const contractWasMissing = !microcycle.exposureContractV2 && !microcycle.exposureContract;
  const selectedPhase = phaseClock?.selectedPhase ?? (
    /pre/i.test(phase ?? '') ? 'Pre-season' :
      /off|base/i.test(phase ?? '') ? 'Off-season' :
        /in/i.test(phase ?? '') ? 'In-season' : null
  );
  const phaseResolution = selectedPhase && phaseClock
    ? resolveSeasonPhaseClock({
        selectedPhase,
        targetWeekStartISO: microcycle.startDate,
        persistedClock: phaseClock,
      })
    : null;
  let exposureContractV2 = microcycle.exposureContractV2 ?? (
    microcycle.exposureContract
      ? migrateLegacyWeeklyExposureContractV2(microcycle.exposureContract, {
          blockNumber: microcycle.miniCycleNumber,
          weekInBlock: ((Math.max(1, microcycle.weekNumber) - 1) % 4) + 1,
          globalWeek: microcycle.weekNumber,
        })
      : undefined
  );
  if (!exposureContractV2) {
    exposureContractV2 = deriveContractlessLegacyContract({
      microcycle,
      selectedPhase,
      phaseResolution,
    });
  }
  if (exposureContractV2 && phaseResolution) {
    const expectedSubphase = exposureContractV2.identity.anchorState === 'practice_match'
      ? 'practice_match_week'
      : phaseResolution.subphase ?? exposureContractV2.identity.expectedSubphase;
    exposureContractV2 = {
      ...exposureContractV2,
      identity: {
        ...exposureContractV2.identity,
        seasonPhase: phaseClock!.selectedPhase,
        expectedSubphase,
        phaseWeek: phaseResolution.phaseWeekNumber,
        phaseEntryWeekStartISO: phaseClock!.phaseEntryWeekStartISO,
        phaseClockSelectedPhase: phaseClock!.selectedPhase,
        phaseWeekProvenance: 'preserved_persisted_state',
        weekKind: phaseResolution.weekKind,
      },
    };
  }
  // Legacy row/contribution ownership must be translated before the weekly
  // evaluator can count it, but this is only ingress normalisation: the
  // complete resulting week still has to pass safety and the accepted-week
  // gateway below before any hydrated state can publish.
  let workouts = (microcycle.workouts ?? []).map((workout) =>
    contractWasMissing || hydratedWorkoutNeedsIngressCanonicalisation(workout)
      ? canonicaliseHydratedWorkout(
          workout,
          selectedPhase ?? phase,
          phaseResolution?.weekKind ?? microcycle.weekKind,
          phaseResolution?.offseasonSubphase ??
            (exposureContractV2 ? contractOffseasonSubphase(exposureContractV2) : null),
        )
      : workout);
  if (exposureContractV2) {
    exposureContractV2 = applyGenerationSafetyToSection18Contract({
      contract: exposureContractV2,
    });
    const safety = finaliseSection18SafetyWeek({
      contract: exposureContractV2,
      workouts,
      weekStart: microcycle.startDate.slice(0, 10),
      canonicalContext: {
        phase: exposureContractV2.identity.seasonPhase,
        offseasonSubphase: canonicalContextSubphase(
          exposureContractV2.identity.seasonPhase,
          phaseResolution?.offseasonSubphase ??
            contractOffseasonSubphase(exposureContractV2),
        ),
        weekKind: phaseResolution?.weekKind ?? microcycle.weekKind,
        section18EvidenceMode: 'preserve_legacy_unknown',
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fallbackProfile = exposureContractV2.source === 'legacy_migration'
      ? legacyMigrationFallbackProfile({
          profile,
          microcycle,
          contract: safety.contract,
        })
      : profile;
    const accepted = require('../rules/section18AcceptedWeekGateway')
      .requireSection18AcceptedWeek({
        contract: safety.contract,
        workouts: safety.workouts,
        weekStart: microcycle.startDate.slice(0, 10),
        profile,
        regenerate: fallbackProfile
          ? () => require('../utils/postGenerationConstraintValidation')
              .buildSection18ProductionFallbackCandidate({
                contract: safety.contract,
                weekStart: microcycle.startDate.slice(0, 10),
                profile: fallbackProfile,
              })
          : undefined,
        safeFallback: fallbackProfile
          ? () => require('../utils/postGenerationConstraintValidation')
              .buildSection18ProductionFallbackCandidate({
                contract: safety.contract,
                weekStart: microcycle.startDate.slice(0, 10),
                profile: fallbackProfile,
              })
          : undefined,
      });
    workouts = accepted.canonicalWorkouts;
    exposureContractV2 = accepted.contract;
  }
  return {
    ...microcycle,
    weekKind: phaseResolution?.weekKind ?? microcycle.weekKind,
    // One intensity owner. This used to be a second table reading
    // `Off-season ? 0.85 : 0.9`. Its in-season branch was DORMANT rather than
    // harmful — `resolveSeasonPhaseWeekKind` never mints a deload week
    // in-season, so nothing reached the 0.9 — but a second table free to
    // drift from the owner is the defect, whether or not it has fired yet.
    intensityMultiplier: phaseResolution
      ? resolveWeekIntensityMultiplier(selectedPhase, phaseResolution.weekKind)
      : microcycle.intensityMultiplier,
    workouts,
    exposureContractV2,
  };
}

export function canonicaliseHydratedProgram(
  program: TrainingProgram,
  profile?: OnboardingData | null,
): TrainingProgram {
  // Defence in depth: this is exported and reachable without going through
  // `canonicaliseHydratedState`. The migration is idempotent, so running it
  // twice is free and missing it once is an athlete's lost power work.
  const clockedProgram = ensureProgramSeasonPhaseClock({
    ...program,
    microcycles: (program.microcycles ?? []).map((microcycle) => ({
      ...microcycle,
      workouts: migrateStoredPowerBlocks(microcycle.workouts ?? []),
    })),
  });
  return {
    ...clockedProgram,
    microcycles: (clockedProgram.microcycles ?? []).map((microcycle) =>
      canonicaliseHydratedMicrocycle(
        microcycle,
        clockedProgram.programPhase,
        clockedProgram.seasonPhaseClock,
        profile,
      )),
  };
}

function canonicaliseHydratedSafetyWorkout(
  workout: Workout,
  contract: WeeklyExposureContractV2 | undefined,
  phase?: string,
  /** Clock-resolved fallback for a contract that does not name one. */
  offseasonSubphase?: OffseasonSubphase | null,
): Workout {
  return contract
    ? finaliseSection18SafetyWorkout({
        contract,
        workout,
        canonicalContext: {
          phase: contract.identity.seasonPhase,
          offseasonSubphase: canonicalContextSubphase(
            contract.identity.seasonPhase,
            contractOffseasonSubphase(contract) ?? offseasonSubphase,
          ),
          section18EvidenceMode: 'preserve_legacy_unknown',
        },
      }).workout
    : canonicaliseHydratedWorkout(workout, phase, undefined, offseasonSubphase);
}

/**
 * Thrown when a program reaches the accept boundary carrying a week the app
 * cannot install: no `exposureContractV2` and no legacy `exposureContract` to
 * migrate from.
 *
 * Every accepted-week read (`rebaseAcceptedEffectiveWeek`) requires a contract
 * and throws without one. Accepting such a program used to succeed here and
 * detonate later at an unrelated call site — `setGameDay` — so the athlete was
 * told a save had failed when the real fault was an uninstallable week accepted
 * several steps earlier (device blocker, 2026-07-25).
 *
 * Sam ruling (2026-07-26), option (b): refuse it HERE, by name. Deliberately not
 * option (a) — minting the contract on this path is not separable from
 * rebuilding the week, because hydration only survives the §18 gateway by
 * handing it a profile-built regenerate/safeFallback candidate. Rebuilding a
 * week as a side effect of accepting a program is exactly the silent
 * reinterpretation this whole unit removed.
 */
export class AcceptedProgramContractMissingError extends Error {
  readonly code = 'accepted_program_contract_missing';
  readonly weekStarts: string[];
  constructor(weekStarts: string[]) {
    super(
      'Accepted program is missing its weekly exposure contract for '
        + `${weekStarts.join(', ')}. A program with no contract (v2 or legacy) `
        + 'cannot be installed: every accepted-week read requires one. Structural '
        + 'migration belongs to the hydration path, which can rebuild the week; '
        + 'the accept path refuses rather than rebuilds.',
    );
    this.name = 'AcceptedProgramContractMissingError';
    this.weekStarts = weekStarts;
  }
}

/**
 * The accept-path invariant: an ACCEPTED program is an INSTALLABLE program.
 * Structural migration (which may rebuild a week) stays with hydration.
 */
export function assertAcceptedProgramInstallable(
  program: TrainingProgram | null | undefined,
): void {
  if (!program) return;
  const missing = (program.microcycles ?? [])
    .filter((microcycle) => !microcycle.exposureContractV2 && !microcycle.exposureContract)
    .map((microcycle) => microcycle.startDate?.slice(0, 10) ?? 'unknown-week');
  if (missing.length > 0) throw new AcceptedProgramContractMissingError(missing);
}

function canonicaliseAcceptedBoundaryState(
  persistedState: Partial<ProgramState>,
  options: {
    structuralMigrationRequired: boolean;
    activeConstraints?: readonly import('./coachUpdatesStore').ActiveConstraint[];
    profile?: OnboardingData | null;
    markedDays?: Readonly<Record<string, CalendarDayType>>;
    validateWeekStarts?: readonly string[];
    todayISO?: string;
  },
): Partial<ProgramState> {
  const effectiveTodayISO = options.todayISO ?? todayISOLocal();
  let currentProgram = persistedState.currentProgram && options.structuralMigrationRequired
    ? canonicaliseHydratedProgram(persistedState.currentProgram, options.profile)
    : persistedState.currentProgram;
  const overlayOwnedWeekStarts = new Set(Object.keys(persistedState.weekScopedOverlays ?? {}));
  if (currentProgram && options.activeConstraints) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const validator = require('../utils/postGenerationConstraintValidation');
    let changed = false;
    const microcycles = currentProgram.microcycles.map((microcycle) => {
      // An explicit accepted overlay owns this effective week. Validating the
      // hidden base independently would reintroduce a second week authority;
      // the precedence-composed gateway below validates the overlay-owned week.
      if (overlayOwnedWeekStarts.has(microcycle.startDate.slice(0, 10))) return microcycle;
      const validated = validator.validateMicrocycleAgainstActiveConstraints({
        microcycle,
        todayISO: effectiveTodayISO,
        activeConstraints: options.activeConstraints!,
        profile: options.profile,
      });
      if (validated !== microcycle) changed = true;
      return validated;
    });
    if (changed) currentProgram = { ...currentProgram, microcycles };
  }
  const phase = currentProgram?.seasonPhaseClock?.selectedPhase ?? currentProgram?.programPhase;
  // Where in the off-season hydrated content sits, resolved from the persisted
  // phase clock — the same owner generation uses. Hydrated workouts that carry
  // no contract of their own would otherwise reach the canonicaliser with the
  // fact missing, and a missing subphase used to mean "early off-season, delete
  // the power". Null when there is no clock, which for a pre-clock program can
  // never canonicalise to Off-season anyway (`programPhase` has no off-season
  // spelling the phase regex matches).
  const hydratedOffseasonSubphase = currentProgram?.seasonPhaseClock
    ? resolveSeasonPhaseClock({
        selectedPhase: currentProgram.seasonPhaseClock.selectedPhase,
        persistedClock: currentProgram.seasonPhaseClock,
        targetWeekStartISO: mondayForDate(effectiveTodayISO),
      }).offseasonSubphase
    : null;
  let currentMicrocycle = persistedState.currentMicrocycle && options.structuralMigrationRequired
    ? canonicaliseHydratedMicrocycle(
        persistedState.currentMicrocycle,
        phase,
        currentProgram?.seasonPhaseClock,
        options.profile,
      )
    : persistedState.currentMicrocycle;
  if (currentMicrocycle && options.activeConstraints &&
    !overlayOwnedWeekStarts.has(currentMicrocycle.startDate.slice(0, 10))) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    currentMicrocycle = require('../utils/postGenerationConstraintValidation')
      .validateMicrocycleAgainstActiveConstraints({
        microcycle: currentMicrocycle,
        todayISO: effectiveTodayISO,
        activeConstraints: options.activeConstraints,
        profile: options.profile,
      });
  }
  let weekScopedOverlays = persistedState.weekScopedOverlays
      ? Object.fromEntries(Object.entries(persistedState.weekScopedOverlays).map(([weekStart, overlay]) => [
        weekStart,
        (() => {
          if (
            !overlay.exposureContractV2 &&
            !overlay.exposureContract &&
            Object.keys(overlay.workoutsByDate ?? {}).length === 0
          ) {
            // Empty future owner placeholders carry no material programming
            // yet. Preserve them byte-for-byte until their target week gains
            // a base contract during rebuild/rollover materialisation.
            return overlay;
          }
          let exposureContractV2 = overlay.exposureContractV2 ?? (
            overlay.exposureContract
              ? migrateLegacyWeeklyExposureContractV2(overlay.exposureContract)
              : undefined
          );
          if (exposureContractV2) {
            const generationConstraints = options.activeConstraints
              ? require('../utils/generationConstraints').buildGenerationConstraintContext({
                  activeConstraints: options.activeConstraints,
                  todayISO: weekStart,
                  periodEndISO: addDaysISO(weekStart, 6),
                })
              : undefined;
            exposureContractV2 = applyGenerationSafetyToSection18Contract({
              contract: exposureContractV2,
              generationConstraints,
              forceFullPause: options.activeConstraints?.some((constraint) =>
                constraint.type === 'injury' && constraint.status !== 'resolved' &&
                constraint.seriousSymptoms === true),
            });
          }
          return {
            ...overlay,
            exposureContractV2,
            workoutsByDate: Object.fromEntries(
              Object.entries(overlay.workoutsByDate).map(([date, workout]) => [
                date,
                  workout
                  ? !options.structuralMigrationRequired && !exposureContractV2
                    ? workout
                    : canonicaliseHydratedSafetyWorkout(
                        workout, exposureContractV2, phase, hydratedOffseasonSubphase)
                  : null,
              ]),
            ),
          };
        })(),
      ]))
    : persistedState.weekScopedOverlays;
  const safetyContractForDate = (date: string): WeeklyExposureContractV2 | undefined => {
    const overlay = weekScopedOverlays?.[mondayForDate(date)];
    if (overlay?.exposureContractV2) return overlay.exposureContractV2;
    const programMicrocycle = currentProgram?.microcycles.find((microcycle) =>
      date >= microcycle.startDate.slice(0, 10) && date <= microcycle.endDate.slice(0, 10));
    if (programMicrocycle?.exposureContractV2) return programMicrocycle.exposureContractV2;
    if (
      currentMicrocycle &&
      date >= currentMicrocycle.startDate.slice(0, 10) &&
      date <= currentMicrocycle.endDate.slice(0, 10)
    ) {
      return currentMicrocycle.exposureContractV2;
    }
    return undefined;
  };
  let dateOverrides = persistedState.dateOverrides
    ? Object.fromEntries(Object.entries(persistedState.dateOverrides).map(([date, workout]) => [
        date,
        {
          ...(!options.structuralMigrationRequired && !safetyContractForDate(date)
            ? workout
            : canonicaliseHydratedSafetyWorkout(
                workout, safetyContractForDate(date), phase, hydratedOffseasonSubphase)),
          // Date-keyed overrides own a concrete calendar day. Older edit
          // writers used the 1..7 coaching convention (Sunday=7), whereas
          // Workout uses JavaScript 0..6. Normalise at ingress so the weekly
          // gateway cannot mistake a valid Sunday override for a missing day.
          dayOfWeek: new Date(`${date.slice(0, 10)}T12:00:00`).getDay(),
        },
      ]))
    : persistedState.dateOverrides;

  // A migrated overlay or date override can make an otherwise-valid base
  // microcycle invalid. Rebuild the actual precedence-ordered week here and
  // pass that effective candidate through the same accepted-week gateway.
  // Any deterministic cross-day repair is persisted back into the surface
  // that owns the changed date, so hydration cannot merely validate the base
  // program while retaining an invalid visible override.
  const hydratedWeekStarts = new Set<string>([
    ...Object.keys(weekScopedOverlays ?? {}),
    ...Object.keys(dateOverrides ?? {}).map(mondayForDate),
    ...(persistedState.userRemovalConstraints ?? [])
      .filter((constraint) => constraint.status === 'active')
      .map((constraint) => mondayForDate(constraint.targetDate)),
    ...(options.validateWeekStarts ?? []).map((weekStart) => weekStart.slice(0, 10)),
    ...(options.activeConstraints
      ? [
          ...(currentProgram?.microcycles ?? []).map((microcycle) =>
            microcycle.startDate.slice(0, 10)),
          ...(currentMicrocycle ? [currentMicrocycle.startDate.slice(0, 10)] : []),
        ]
      : []),
  ]);
  const activeFixtureDates = options.profile
    ? effectiveFixtureDatesForWeeks({
        profile: options.profile,
        markedDays: options.markedDays ?? {},
        weekStarts: Array.from(hydratedWeekStarts),
      })
    : undefined;
  for (const weekStart of hydratedWeekStarts) {
    const overlay = weekScopedOverlays?.[weekStart];
    const baseMicrocycle = currentProgram?.microcycles.find((microcycle) =>
      weekStart >= microcycle.startDate.slice(0, 10) &&
      weekStart <= microcycle.endDate.slice(0, 10)) ?? (
      currentMicrocycle &&
      weekStart >= currentMicrocycle.startDate.slice(0, 10) &&
      weekStart <= currentMicrocycle.endDate.slice(0, 10)
        ? currentMicrocycle
        : undefined
    );
    const contract = overlay?.exposureContractV2 ?? baseMicrocycle?.exposureContractV2;
    if (!contract) continue;

    const rebased = rebaseAcceptedEffectiveWeek({
      surfaces: {
        currentProgram,
        currentMicrocycle,
        dateOverrides: dateOverrides ?? {},
        weekScopedOverlays: weekScopedOverlays ?? {},
        userRemovalConstraints: persistedState.userRemovalConstraints ?? [],
      },
      weekStart,
      profile: options.profile,
      markedDays: options.markedDays ?? {},
    });
    const effectiveByDate = new Map<string, Workout>(
      rebased.dates.flatMap((entry) => entry.workout ? [[entry.date, entry.workout]] : []),
    );
    const fallbackProfile = contract.source === 'legacy_migration' && baseMicrocycle
      ? legacyMigrationFallbackProfile({
          profile: options.profile,
          microcycle: baseMicrocycle,
          contract,
        })
      : options.profile;
    const buildFallback = fallbackProfile
      ? () => require('../utils/postGenerationConstraintValidation')
          .buildSection18ProductionFallbackCandidate({
            contract,
            weekStart,
            profile: fallbackProfile,
            activeConstraints: options.activeConstraints,
          })
      : undefined;
    // THE COLLAPSE, AND ACCEPT-AND-REDUCE (Sam, 2026-07-29, rulings 1 and 2).
    //
    // This was `requireSection18AcceptedWeek`, and its throw escaped the
    // transaction owner to reach the tap door as a dead screen — reachable from
    // a fresh install in three actions (onboard, generate, mark a day as rest).
    // A typed refusal interpreted five ways is the two-representations disease
    // wearing an exception, so the gateway's own typed result flows here and
    // THIS owner decides what a rejected week means.
    //
    // What it means is ruling 2: a rest mark is the athlete stating a fact
    // about their life, and this app does not refuse facts. The gateway's
    // `canonicalWorkouts` on an `impossible` verdict is the best week it could
    // build around the fact — so the mark is KEPT, that week is published, and
    // the shortfall is disclosed in Sam's signed words rather than swallowed.
    // Crashing was the worst answer; refusing was the second worst.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const accepted = require('../rules/section18AcceptedWeekGateway')
      .runSection18AcceptedWeekGateway({
        contract,
        workouts: rebased.composedWorkouts,
        weekStart,
        profile: options.profile,
        activeFixtureDates,
        userRemovalConstraints: persistedState.userRemovalConstraints,
        regenerate: buildFallback,
        safeFallback: buildFallback,
        resolveVisibleWorkouts: (candidateWorkouts: readonly Workout[]) =>
          require('../rules/section18AcceptedWeekGateway').resolveFinalVisibleSection18Week({
            contract,
            workouts: candidateWorkouts,
            weekStart,
            profile: options.profile,
            scheduleState: { markedDays: { ...(options.markedDays ?? {}) } },
            userRemovalConstraints: persistedState.userRemovalConstraints,
          }),
      });
    const acceptedByDay = new Map<number, Workout>(
      accepted.canonicalWorkouts.map((workout: Workout) => [workout.dayOfWeek, workout]),
    );
    // A DERIVED REPAIR NEVER LANDS ON THE ATHLETE'S SURFACE (Sam, 2026-07-30).
    //
    // The gateway's repair used to go into `dateOverrides` whenever the week had
    // no overlay to hold it. `dateOverrides` is the athlete's DECISION surface —
    // `rebaseAcceptedEffectiveWeek` says so in its own comment and treats
    // `date_override` as athlete-owned — so that filed derived content under his
    // signature, and one rest mark materialised five overrides, one of them on
    // the rest day itself.
    //
    // What made it visible is that the two resolvers order the same two inputs
    // oppositely: `_resolveDateRaw` puts a manual override at Priority 1 ABOVE
    // the calendar mark, while `rebaseAcceptedEffectiveWeek` composes the
    // override and applies the marks LAST. So the screen prescribed Lower Squat
    // on the day he had marked as rest while the accepted week correctly held
    // nothing, three actions from a fresh install. It also cost two device
    // findings: the move door's target-identity check compares accepted against
    // visible and was refusing, correctly, about a day that disagreed with
    // itself.
    //
    // The overlay already means "derived content for this week, authored by a
    // fact, not by the athlete", which is exactly what a gateway repair is. So a
    // base-owned week MINTS one rather than borrowing the athlete's. This is a
    // deletion of a second home for one kind of content, not a new branch: after
    // it, a repair has one surface and `dateOverrides` means one thing.
    //
    // The first branch is untouched and is the one case where writing there is
    // right — an override the athlete DID author is his, and the repair updates
    // it in place. A fix that simply deleted the write would pass the ownership
    // assertions and lose every edit in the app; `derivedRepairOwnershipTests`
    // holds that cell open.
    const overlayWorkouts = overlay ? { ...overlay.workoutsByDate } : {};
    let repairedBaseOwnedWeek = false;
    for (let offset = 0; offset < 7; offset++) {
      const date = addDaysISO(weekStart, offset);
      const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
      const before = effectiveByDate.get(date) ?? null;
      const after = acceptedByDay.get(dayOfWeek) ?? null;
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      if (dateOverrides && Object.prototype.hasOwnProperty.call(dateOverrides, date)) {
        // D-2 PROBE (Sam's ruling: measure first, LR-27 method). An INSTRUMENT,
        // not a gate: it prints only under D2_PROBE=1 and is inert otherwise.
        // What it answers is the parked question — does this branch overwrite
        // content the athlete authored, how often, and with what?
        if (process.env.D2_PROBE === '1') {
          const stored = (dateOverrides as Record<string, unknown>)[date] as
            { id?: string; name?: string; exercises?: unknown[] } | null;
          const replacement = after as
            { id?: string; name?: string; exercises?: unknown[] } | null;
          // eslint-disable-next-line no-console
          console.log('[D2_PROBE] in_place_repair', JSON.stringify({
            date,
            action: after ? 'overwrite' : 'delete',
            storedName: stored?.name ?? null,
            storedRows: (stored?.exercises ?? []).length,
            storedBytes: JSON.stringify(stored ?? null).length,
            replacementName: replacement?.name ?? null,
            replacementRows: (replacement?.exercises ?? []).length,
            replacementBytes: JSON.stringify(replacement ?? null).length,
            sameId: !!stored?.id && stored.id === replacement?.id,
          }));
        }
        if (after) dateOverrides[date] = after;
        else delete dateOverrides[date];
      } else {
        overlayWorkouts[date] = after;
        if (!overlay) repairedBaseOwnedWeek = true;
      }
    }
    if (weekScopedOverlays && (overlay || repairedBaseOwnedWeek)) {
      const now = appDateNow().toISOString();
      weekScopedOverlays[weekStart] = {
        ...(overlay ?? {
          id: `accepted-week-repair:${weekStart}`,
          weekStart,
          weekEnd: addDaysISO(weekStart, 6),
          anchorDate: null,
          reason: 'accepted_week_repair' as const,
          createdAt: now,
        }),
        workoutsByDate: overlayWorkouts,
        exposureContractV2: accepted.contract,
        updatedAt: now,
      };
    } else {
      // The accepted contract is the persisted ledger for a base-owned week that
      // needed no repair. Nothing changed, so no overlay is minted, but the
      // achieved/reduction ledger must not remain stranded in the transient
      // gateway result.
      if (currentProgram && baseMicrocycle) {
        currentProgram = {
          ...currentProgram,
          microcycles: currentProgram.microcycles.map((microcycle) =>
            microcycle.id === baseMicrocycle.id
              ? { ...microcycle, exposureContractV2: accepted.contract }
              : microcycle),
        };
      }
      if (currentMicrocycle && currentMicrocycle.id === baseMicrocycle?.id) {
        currentMicrocycle = {
          ...currentMicrocycle,
          exposureContractV2: accepted.contract,
        };
      }
    }
  }
  const hydratedTodayWorkout = persistedState.todayWorkout
    ? applyUserRemovalConstraintsToWeek({
        workouts: [persistedState.todayWorkout],
        weekStart: mondayForDate(effectiveTodayISO),
        constraints: persistedState.userRemovalConstraints,
      }).find((workout) =>
        workout.dayOfWeek === new Date(`${effectiveTodayISO}T12:00:00`).getDay()) ?? null
    : persistedState.todayWorkout;
  return {
    ...persistedState,
    currentProgram,
    currentMicrocycle,
    todayWorkout: hydratedTodayWorkout
      ? !options.structuralMigrationRequired && !safetyContractForDate(effectiveTodayISO)
        ? hydratedTodayWorkout
        : canonicaliseHydratedSafetyWorkout(
            hydratedTodayWorkout,
            safetyContractForDate(effectiveTodayISO),
            phase,
            hydratedOffseasonSubphase,
          )
      : hydratedTodayWorkout,
    dateOverrides,
    weekScopedOverlays,
  };
}

export interface AcceptedStateCandidateCanonicalisationOptions {
  activeConstraints?: readonly import('./coachUpdatesStore').ActiveConstraint[];
  profile?: OnboardingData | null;
  markedDays?: Readonly<Record<string, CalendarDayType>>;
  validateWeekStarts?: readonly string[];
  todayISO?: string;
}

/** Runtime acceptance owns validation, but never legacy hydration migration. */
export function canonicaliseAcceptedStateCandidate(
  candidate: Partial<ProgramState>,
  options: AcceptedStateCandidateCanonicalisationOptions = {},
): Partial<ProgramState> {
  const accepted = canonicaliseAcceptedBoundaryState(candidate, {
    ...options,
    structuralMigrationRequired: false,
  });
  return projectHydratedStateDerivedFields(accepted as Record<string, unknown>) as
    Partial<ProgramState>;
}

export interface HydratedStateCanonicalisationOptions {
  ingressKind: Exclude<ProgramHydrationIngressKind, 'invalid_or_ambiguous'>;
  profile?: OnboardingData | null;
}

/**
 * Hydration dispatch has one owner: the typed ingress classification.
 * Accepted envelopes receive only the safe derived projection; supported
 * legacy envelopes additionally receive the structural migration pipeline.
 */
/**
 * Lift every stored `powerBlock` on every hydration surface into power rows.
 *
 * Runs ABOVE the `ingressKind` branch below, deliberately. An
 * `accepted_canonical` program takes an early return that skips the whole
 * boundary canonicalisation — and accepted-canonical is exactly what a program
 * written by a Stage 2 build IS, so putting the migration inside that
 * canonicalisation would leave the athletes who most need it unmigrated. Sam's
 * requirement is "unconditionally, before any write path can persist"; this is
 * the only point that satisfies both words.
 *
 * Idempotent by construction — `migrateStoredPowerBlock` returns the same object
 * when there is no block — so running it on every read forever costs nothing and
 * cannot drift.
 */
/**
 * Refuse to publish a program that still carries a legacy stored block.
 *
 * Loud on purpose. The alternative — persisting it — loses real prescribed work
 * with no record, which is the one outcome this whole stage exists to prevent.
 */
function assertNoUnmigratedPowerBlock(program: TrainingProgram | null): void {
  if (!program) return;
  const offenders = (program.microcycles ?? []).flatMap((microcycle) =>
    (microcycle.workouts ?? []).filter((workout) => !!workout.powerBlock));
  if (offenders.length === 0) return;
  throw new Error(
    '[programStore] refusing to publish a program carrying a legacy powerBlock; ' +
    'it has not been through the read-path migration and persisting it would ' +
    `drop the athlete's power work (workouts: ${offenders.map((w) => w.id).join(', ')})`,
  );
}

function migrateHydratedStatePowerBlocks(
  state: Partial<ProgramState>,
): Partial<ProgramState> {
  const next: Partial<ProgramState> = { ...state };

  if (next.currentProgram) {
    next.currentProgram = {
      ...next.currentProgram,
      microcycles: (next.currentProgram.microcycles ?? []).map((microcycle) => ({
        ...microcycle,
        // TWO LIFTS, ONE INGRESS. The recovery lift runs on the PLAN only —
        // `dateOverrides` and `weekScopedOverlays` below are athlete-owned
        // surfaces and are deliberately not visited. See
        // `rules/generatorRecoveryRestLift.ts`.
        workouts: liftGeneratorRecoveryToRest(
          migrateStoredPowerBlocks(microcycle.workouts ?? []),
        ),
      })),
    };
  }
  if (next.currentMicrocycle) {
    next.currentMicrocycle = {
      ...next.currentMicrocycle,
      workouts: liftGeneratorRecoveryToRest(
        migrateStoredPowerBlocks(next.currentMicrocycle.workouts ?? []),
      ),
    };
  }
  if (next.todayWorkout) {
    next.todayWorkout = isGeneratorPlacedRecovery(next.todayWorkout)
      ? null
      : migrateStoredPowerBlock(next.todayWorkout);
  }
  if (next.dateOverrides) {
    next.dateOverrides = Object.fromEntries(
      Object.entries(next.dateOverrides).map(([date, workout]) => [
        date,
        workout ? migrateStoredPowerBlock(workout) : workout,
      ]),
    );
  }
  if (next.weekScopedOverlays) {
    next.weekScopedOverlays = Object.fromEntries(
      Object.entries(next.weekScopedOverlays).map(([weekStart, overlay]) => [
        weekStart,
        overlay
          ? {
              ...overlay,
              workoutsByDate: Object.fromEntries(
                Object.entries(overlay.workoutsByDate ?? {}).map(([date, workout]) => [
                  date,
                  workout ? migrateStoredPowerBlock(workout) : workout,
                ]),
              ),
            }
          : overlay,
      ]),
    );
  }
  return next;
}

export function canonicaliseHydratedState(
  rawPersistedState: Partial<ProgramState>,
  options: HydratedStateCanonicalisationOptions,
): Partial<ProgramState> {
  // FIRST, and above every branch below. See `migrateHydratedStatePowerBlocks`.
  const persistedState = migrateHydratedStatePowerBlocks(rawPersistedState);
  // ALSO above every branch below. See `dropRetiredWeekOverlaysAtHydration`
  // (L15, HOME_SCREEN_REDESIGN ruling 1) — runs unconditionally, regardless of
  // ingress classification.
  const liftedState = dropRetiredWeekOverlaysAtHydration(persistedState);
  if (options.ingressKind === 'accepted_canonical') {
    return projectHydratedStateDerivedFields(
      liftedState as Record<string, unknown>,
    ) as Partial<ProgramState>;
  }
  const migrated = canonicaliseAcceptedBoundaryState(liftedState, {
    structuralMigrationRequired: true,
    profile: options.profile,
  });
  return projectHydratedStateDerivedFields(migrated as Record<string, unknown>) as
    Partial<ProgramState>;
}

// ─── Session Feedback ───

export type {
  FeedbackCompletion,
  FeedbackFeeling,
  FeedbackPartialReason,
  FeedbackSkipReason,
  FeedbackSoreness,
} from '../types/sessionOutcome';

export interface SessionFeedbackComponent {
  componentId: string;
  kind: SessionComponentKind;
  label: string;
  completion: FeedbackCompletion;
  partialReason?: FeedbackPartialReason;
  skipReason?: FeedbackSkipReason;
}

export interface SessionFeedback {
  dateStr: string;
  completion: FeedbackCompletion;
  /**
   * Component-level completions for combined sessions. Top-level completion
   * remains as a backward-compatible aggregate only.
   */
  components?: SessionFeedbackComponent[];
  /** Session effort. Omitted for skipped sessions to avoid fake exertion data. */
  feeling?: FeedbackFeeling;
  /** RPE-style difficulty rating (1–10). Optional for backward compat. */
  difficulty?: number;
  /** Post-session soreness level. Optional for backward compat. */
  soreness?: FeedbackSoreness;
  /**
   * "How was training?" — Light / Normal / Hard, asked ONLY on a team-training day.
   *
   * Sam's signed mechanism, 2026-07-30. This is the ANSWER; the team-night size is a
   * rolling read over the last three of them (`rules/teamNightSize.ts`) and is never
   * stored. It rides `SessionFeedback` because the app already records a completed
   * session per date through a transaction with a receipt — which is what made the
   * smallest mechanism small.
   */
  teamNightSize?: import('../rules/teamNightSize').TeamNightSize;
  /** Optional reason when an athlete completed only part of the session. */
  partialReason?: FeedbackPartialReason;
  /** Required reason when an athlete skips the session from the feedback form. */
  skipReason?: FeedbackSkipReason;
  /**
   * Optional performance data for trackable conditioning sessions.
   * Easy/recovery sessions intentionally keep using completion + feeling only.
   */
  conditioning?: import('../utils/conditioningLogging').ConditioningPerformanceLog;
  /** Main-lift snapshot captured on save for future progression/diary use. */
  strength?: import('../utils/strengthLogging').StrengthExercisePerformanceLog[];
  notes?: string;
  /** Canonical durable mutation receipt. Missing on legacy persisted feedback. */
  outcomeReceipt?: SessionOutcomeTransactionReceipt;
}

export interface ProgramState {
  currentProgram: TrainingProgram | null;
  currentMicrocycle: Microcycle | null;
  todayWorkout: Workout | null;
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;
  blockState: StoredProgramBlockState | null;

  /**
   * One accepted material snapshot for all inputs that can change the visible
   * Section 18 week. Calendar/readiness/constraint stores are compatibility
   * mirrors; athlete-visible projection reads this context with the program
   * surfaces published in the same ProgramStore state replacement.
   */
  acceptedMaterialContext: AcceptedMaterialContext;

  /**
   * Manual workout overrides — ONLY for explicit human/coach edits.
   *
   * Automatic adjustments (game proximity: G+1 recovery, G-1 reduction, etc.)
   * are DERIVED at read time by sessionResolver.ts, never stored here.
   *
   * Key: ISO date 'YYYY-MM-DD', Value: manually-authored Workout
   *
   * NOTE: Persisted under the key 'dateOverrides' for backward compatibility
   * with existing AsyncStorage data. The property name is 'dateOverrides' in
   * the store but semantically represents manual overrides only.
   */
  dateOverrides: Record<string, Workout>;

  /**
   * Optional structured context for each manual override.
   * Key: ISO date (same key as dateOverrides). Value: OverrideContext.
   * Used for stale-override detection — tells us WHY the override was created.
   */
  overrideContexts: Record<string, OverrideContext>;

  /**
   * System-authored week overlays.
   *
   * Used for one-off game / practice-match rebuilds: the selected week can
   * use the engine's with-game/no-game candidate without mutating the shared
   * base program template that future weeks resolve from.
   *
   * Key: Monday ISO date for the overlay week.
   */
  weekScopedOverlays: Record<string, WeekScopedWorkoutOverlay>;

  /** Persisted athlete-authored hard constraints for binned sessions/components. */
  userRemovalConstraints: UserRemovalConstraint[];

  /** Accepted reversible fixture/session actions and their exact owned deltas. */
  reversibleAdjustmentLedger: ReversibleAdjustmentLedger;

  /** Target-week contracts reconciled by explicit date-level edits. */
  exposureContractsByWeek: Record<string, WeeklyExposureContract>;

  /**
   * Session feedback — lightweight post-session capture.
   * Key: ISO date 'YYYY-MM-DD'. Value: SessionFeedback.
   * Fed into progression context on subsequent sessions.
   */
  sessionFeedback: Record<string, SessionFeedback>;

  /**
   * Per-session weight overrides — tracks what weight was actually used.
   *
   * Key: ISO date 'YYYY-MM-DD'.
   * Value: Record of exerciseId → performed weight in kg (null = bodyweight).
   *
   * NOT the same as template weights — these are per-session actuals.
   * Used by progression to determine baseline for future sessions:
   *   "Last time you did this exercise you used X kg, so today starts there."
   *
   * Never overwrites template prescriptions. Read-time only.
   */
  weightOverrides: Record<string, Record<string, number | null>>;

  setCurrentProgram: (
    program: TrainingProgram | null,
    options?: { clearOverrideDates?: readonly string[]; todayISO?: string },
  ) => void;
  setBlockState: (blockState: StoredProgramBlockState | null) => void;
  ensureBlockState: (dateISO?: string) => StoredProgramBlockState;
  setCurrentMicrocycle: (microcycle: Microcycle | null, todayISO?: string) => void;
  setTodayWorkout: (workout: Workout | null, todayISO?: string) => void;
  setGenerating: (generating: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addExerciseToWorkout: (workoutId: string, exercise: WorkoutExercise) => void;

  /**
   * Replace an exercise in the microcycle template by dayOfWeek + name match.
   * This is a TEMPLATE edit — it changes the program itself, not a date override.
   * Used by the AI coach for single-exercise substitutions.
   */
  replaceExerciseInWorkout: (
    dayOfWeek: number,
    oldExerciseName: string,
    newExercise: WorkoutExercise,
  ) => boolean;

  // SETTING an override is NOT a store action (LR-1, 2026-08-03). The raw
  // `setManualOverride` primitive is retired: a single-date write goes through
  // `applyProgramOverrideWrite`, which requires the writer to name itself.
  /** Remove a manual override for a specific date */
  removeManualOverride: (date: string) => void;
  /** Clear all manual overrides (called on full program regeneration) */
  clearManualOverrides: (todayISO?: string) => void;
  /** Dismiss a stale-override warning (user chose "keep") */
  dismissStaleWarning: (date: string) => void;

  /** Set/replace a system-authored week overlay */
  setWeekScopedOverlay: (overlay: WeekScopedWorkoutOverlay) => void;
  /** Remove a system-authored week overlay by Monday ISO key */
  removeWeekScopedOverlay: (weekStart: string) => void;
  /** Clear all system-authored week overlays */
  clearWeekScopedOverlays: () => void;

  /** Remove feedback for a date */
  removeSessionFeedback: (date: string) => void;

  /** Set the performed weight for an exercise on a specific date */
  setWeightOverride: (date: string, exerciseId: string, weightKg: number | null) => void;
  /** Remove a weight override for an exercise on a date */
  removeWeightOverride: (date: string, exerciseId: string) => void;

  clear: () => void;
}

let programHydrationAcceptancePromise: Promise<void> = Promise.resolve();
let programHydrationAccepted = false;
let programHydrationIngressForAcceptance: ProgramHydrationIngressClassification | null = null;

export const useProgramStore = create<ProgramState>()(
  persist(
    (set) => ({
      currentProgram: null,
      currentMicrocycle: null,
      todayWorkout: null,
      isGenerating: false,
      isLoading: false,
      error: null,
      blockState: null,
      acceptedMaterialContext: createEmptyAcceptedMaterialContext(),
      dateOverrides: {},
      overrideContexts: {},
      weekScopedOverlays: {},
      userRemovalConstraints: [],
      reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
      exposureContractsByWeek: {},
      sessionFeedback: {},
      weightOverrides: {},

      // Override lifecycle is NOT owned by this setter (2026-07-08).
      // It used to silently wipe dateOverrides/overrideContexts ("new
      // block = fresh slate") — which meant EVERY rebuild destroyed
      // away-day clears, injury swaps and the athlete's manual edits no
      // matter what the rebuild logic decided (the root cause of the
      // "removed Monday resurrects after adding a game" class of bug).
      // Clearing decisions now belong to the canonical sweep
      // (utils/weekRebuild.decideOverrideSweep) or an EXPLICIT
      // clearManualOverrides() where a true fresh slate is intended
      // (onboarding completion, program create, profile reset).
      setCurrentProgram: (program, options) => {
        // THE SECOND LOCK. Nothing writes `powerBlock` any more, so a program
        // reaching this boundary still carrying one has not been through the
        // read-path migration — and persisting it would drop the athlete's
        // power on the next round trip. That is precisely the silent loss Sam
        // ruled out, so the path is made impossible rather than unlikely.
        // Ingress migrates unconditionally; this refuses the case where it
        // somehow did not.
        assertNoUnmigratedPowerBlock(program);
        const effectiveTodayISO = options?.todayISO ?? todayISOLocal();
        const candidateProgram = program
          ? postValidateProgram(ensureProgramSeasonPhaseClock(program), effectiveTodayISO)
          : null;
        const priorState = normalizeAcceptedProgramSurfaces(useProgramStore.getState());
        const clearedDates = new Set(options?.clearOverrideDates ?? []);
        const candidateOverrides = clearedDates.size > 0
          ? Object.fromEntries(Object.entries(priorState.dateOverrides).filter(([date]) =>
              !clearedDates.has(date)))
          : priorState.dateOverrides;
        const candidateOverrideContexts = clearedDates.size > 0
          ? Object.fromEntries(Object.entries(priorState.overrideContexts).filter(([date]) =>
              !clearedDates.has(date)))
          : priorState.overrideContexts;
        const acceptedSurfaces = candidateProgram
          ? canonicaliseAcceptedStateCandidate({
              currentProgram: candidateProgram,
              dateOverrides: candidateOverrides,
              overrideContexts: candidateOverrideContexts,
              userRemovalConstraints: priorState.userRemovalConstraints,
            }, {
              profile: acceptedProfileForContext(
                useProgramStore.getState().acceptedMaterialContext,
                require('./profileStore').useProfileStore.getState().onboardingData,
              ),
              todayISO: effectiveTodayISO,
            })
          : null;
        const validatedProgram = acceptedSurfaces?.currentProgram ?? candidateProgram;
        const validatedOverrides = acceptedSurfaces?.dateOverrides ?? candidateOverrides;
        const validatedOverrideContexts = acceptedSurfaces?.overrideContexts ?? candidateOverrideContexts;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitAcceptedStateTransaction({
          reason: 'program:replace',
          todayISO: effectiveTodayISO,
          program: {
            currentProgram: validatedProgram,
            currentMicrocycle: null,
            todayWorkout: null,
            dateOverrides: validatedOverrides,
            overrideContexts: validatedOverrideContexts,
            weekScopedOverlays: {},
            exposureContractsByWeek: {},
            blockState: validatedProgram
              ? deriveStoredBlockStateFromProgram(validatedProgram, effectiveTodayISO)
              : null,
          },
          validateWeekStarts: validatedProgram?.microcycles.map((microcycle) =>
            microcycle.startDate.slice(0, 10)) ?? [],
        });
      },

      setBlockState: (blockState) => set({ blockState }),

      ensureBlockState: (dateISO) => {
        const state = normalizeAcceptedProgramSurfaces(useProgramStore.getState());
        if (state.blockState) return state.blockState;
        const derived = deriveStoredBlockStateFromProgram(state.currentProgram, dateISO);
        useProgramStore.setState({ blockState: derived });
        return derived;
      },

      setCurrentMicrocycle: (microcycle, todayISO) => {
        const effectiveTodayISO = todayISO ?? todayISOLocal();
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitAcceptedStateTransaction({
          reason: 'program:select_microcycle',
          todayISO: effectiveTodayISO,
          program: {
            currentMicrocycle: microcycle
              ? postValidateMicrocycle(microcycle, effectiveTodayISO)
              : null,
          },
          validateWeekStarts: microcycle ? [microcycle.startDate.slice(0, 10)] : [],
        });
      },

      setTodayWorkout: (workout, todayISO) => {
        const effectiveTodayISO = todayISO ?? todayISOLocal();
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitAcceptedStateTransaction({
          reason: 'program:set_today_workout',
          todayISO: effectiveTodayISO,
          program: {
            todayWorkout: workout
              ? postValidateNullableWorkout(effectiveTodayISO, workout)
              : null,
          },
        });
      },

      setGenerating: (generating) => set({ isGenerating: generating }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      // REMOVING THE LAST OVERRIDE IS THE ATHLETE'S CHANGE, NOT THE WIPE
      // (recipe lesson 11). A removal whose result happens to be the empty
      // default is an attributed erasure, so it declares itself with a named
      // act and LANDS — refusing it would strand the athlete with an edit they
      // could not take back. The refusal stays aimed at UNATTRIBUTED defaults.
      removeManualOverride: (date) => {
        const state = normalizeAcceptedProgramSurfaces(useProgramStore.getState());
        if (!Object.prototype.hasOwnProperty.call(state.dateOverrides, date)) return;
        const weekStart = mondayForDate(date);
        const updatedOverrides = { ...state.dateOverrides };
        delete updatedOverrides[date];
        const updatedContexts = { ...state.overrideContexts };
        delete updatedContexts[date];
        const exposureContractsByWeek = { ...state.exposureContractsByWeek };
        if (!Object.keys(updatedOverrides).some((candidate) =>
          mondayForDate(candidate) === weekStart)) delete exposureContractsByWeek[weekStart];
        const emptiesTheSlice = Object.keys(updatedOverrides).length === 0;
        const resetActionId = emptiesTheSlice
          ? beginProgramOverrideResetAction(`override_remove:${date}`)
          : undefined;
        try {
          applyProgramOverrideSliceWrite({
            writer: 'store_action',
            reason: `override:remove:${date}`,
            next: {
              dateOverrides: updatedOverrides,
              overrideContexts: updatedContexts,
              exposureContractsByWeek,
            },
            validateWeekStarts: [weekStart],
            ...(resetActionId ? { resetActionId } : {}),
          });
        } finally {
          if (resetActionId) endProgramOverrideResetAction(resetActionId);
        }
      },

      // The EXPLICIT fresh slate (onboarding completion, program create,
      // profile reset). Erasure is the one write that may empty the slice, and
      // it says so: a named act, on the tape, writer `reset`.
      clearManualOverrides: (todayISO) => {
        const effectiveTodayISO = todayISO ?? todayISOLocal();
        const state = normalizeAcceptedProgramSurfaces(useProgramStore.getState());
        const affectedWeeks = Array.from(new Set(Object.keys(state.dateOverrides).map(mondayForDate)));
        const resetActionId = beginProgramOverrideResetAction('override_clear_all');
        try {
          applyProgramOverrideSliceWrite({
            writer: 'reset',
            reason: 'override:clear_all',
            todayISO: effectiveTodayISO,
            next: {
              dateOverrides: {},
              overrideContexts: {},
              exposureContractsByWeek: {},
            },
            validateWeekStarts: affectedWeeks,
            resetActionId,
          });
        } finally {
          endProgramOverrideResetAction(resetActionId);
        }
      },

      removeSessionFeedback: (date) =>
        set((state) => {
          const updated = { ...state.sessionFeedback };
          delete updated[date];
          return { sessionFeedback: updated };
        }),

      setWeightOverride: (date, exerciseId, weightKg) =>
        set((state) => ({
          weightOverrides: {
            ...state.weightOverrides,
            [date]: {
              ...(state.weightOverrides[date] || {}),
              [exerciseId]: weightKg,
            },
          },
        })),

      removeWeightOverride: (date, exerciseId) =>
        set((state) => {
          const dateOverrides = { ...(state.weightOverrides[date] || {}) };
          delete dateOverrides[exerciseId];
          const allOverrides = { ...state.weightOverrides };
          if (Object.keys(dateOverrides).length === 0) {
            delete allOverrides[date];
          } else {
            allOverrides[date] = dateOverrides;
          }
          return { weightOverrides: allOverrides };
        }),

      dismissStaleWarning: (date) =>
        set((state) => ({
          // Write a 'dismissed' context so neither structured nor heuristic
          // detection will flag this override again. The override itself is untouched.
          overrideContexts: {
            ...state.overrideContexts,
            [date]: { intent: 'dismissed' },
          },
        })),

      setWeekScopedOverlay: (overlay) => {
        const validatedOverlay = postValidateWeekOverlay(overlay);
        const state = normalizeAcceptedProgramSurfaces(useProgramStore.getState());
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitAcceptedStateTransaction({
          reason: `overlay:set:${validatedOverlay.weekStart}`,
          program: {
            weekScopedOverlays: {
              ...state.weekScopedOverlays,
              [validatedOverlay.weekStart]: validatedOverlay,
            },
          },
          validateWeekStarts: [validatedOverlay.weekStart],
        });
      },

      removeWeekScopedOverlay: (weekStart) => {
        const state = normalizeAcceptedProgramSurfaces(useProgramStore.getState());
        if (!Object.prototype.hasOwnProperty.call(state.weekScopedOverlays, weekStart)) return;
        const updated = { ...state.weekScopedOverlays };
        delete updated[weekStart];
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitAcceptedStateTransaction({
          reason: `overlay:remove:${weekStart}`,
          program: { weekScopedOverlays: updated },
          validateWeekStarts: [weekStart],
        });
      },

      clearWeekScopedOverlays: () => {
        const state = normalizeAcceptedProgramSurfaces(useProgramStore.getState());
        const affectedWeeks = Object.keys(state.weekScopedOverlays);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./acceptedStateTransaction').commitAcceptedStateTransaction({
          reason: 'overlay:clear_all',
          program: { weekScopedOverlays: {} },
          validateWeekStarts: affectedWeeks,
        });
      },

      addExerciseToWorkout: (workoutId, exercise) =>
        set((state) => {
          if (!state.currentMicrocycle) return state;

          const updatedWorkouts = state.currentMicrocycle.workouts.map((w) => {
            if (w.id !== workoutId) return w;
            return {
              ...w,
              exercises: [...w.exercises, exercise],
            };
          });

          const updatedMicrocycle = postValidateMicrocycle({
            ...state.currentMicrocycle,
            workouts: updatedWorkouts,
          });

          // Also update todayWorkout if it's the same workout
          const updatedToday =
            state.todayWorkout?.id === workoutId
              ? postValidateNullableWorkout(
                  todayISOLocal(),
                  { ...state.todayWorkout, exercises: [...state.todayWorkout.exercises, exercise] },
                )
              : state.todayWorkout;

          return {
            currentMicrocycle: updatedMicrocycle,
            todayWorkout: updatedToday,
          };
        }),

      replaceExerciseInWorkout: (dayOfWeek, oldExerciseName, newExercise) => {
        const state = useProgramStore.getState();
        if (!state.currentMicrocycle) {
          logger.warn('[programStore] replaceExerciseInWorkout: no currentMicrocycle');
          return false;
        }

        const oldNameLower = oldExerciseName.toLowerCase();
        let swapped = false;

        const updatedWorkouts = state.currentMicrocycle.workouts.map((w) => {
          if (w.dayOfWeek !== dayOfWeek) return w;

          const updatedExercises = w.exercises.map((ex) => {
            const exName = (ex.exercise?.name || ex.exerciseId || '').toLowerCase();
            if (exName.includes(oldNameLower) || oldNameLower.includes(exName)) {
              swapped = true;
              logger.debug(`[programStore] Swapped "${ex.exercise?.name}" → "${newExercise.exercise?.name}" on day ${dayOfWeek}`);
              return {
                ...newExercise,
                id: ex.id, // preserve slot ID
                workoutId: ex.workoutId,
                exerciseOrder: ex.exerciseOrder,
              };
            }
            return ex;
          });

          return { ...w, exercises: updatedExercises, updatedAt: new Date().toISOString() };
        });

        if (!swapped) {
          logger.warn(`[programStore] replaceExerciseInWorkout: "${oldExerciseName}" not found on day ${dayOfWeek}`);
          return false;
        }

        const updatedMicrocycle = postValidateMicrocycle({
          ...state.currentMicrocycle,
          workouts: updatedWorkouts,
          updatedAt: new Date().toISOString(),
        });

        // Also update todayWorkout if it falls on the same dayOfWeek
        const todayDay = dayOfWeekForISODate(todayISOLocal());
        const updatedToday = todayDay === dayOfWeek
          ? postValidateNullableWorkout(
              todayISOLocal(),
              updatedMicrocycle.workouts.find((w) => w.dayOfWeek === dayOfWeek) || state.todayWorkout,
            )
          : state.todayWorkout;

        useProgramStore.setState({
          currentMicrocycle: updatedMicrocycle,
          todayWorkout: updatedToday,
        });

        return true;
      },

      // THE TOTAL ERASURE. This is the one write that may empty the store, and
      // it says so: a named act is opened around it and the erasure lands on
      // the tape as `writer: 'reset'`. It is the ONLY raw slice write left in
      // this file — the whole-state reset cannot route through the accepted-
      // state transaction, because the transaction validates against a program
      // this very call is removing. Declared, pinned by
      // `programOverrideOwnershipTests` cell 3, never silent.
      clear: () => {
        const before = overrideMaterialCounts(useProgramStore.getState());
        const resetActionId = beginProgramOverrideResetAction('program_store_clear');
        try {
          set({
          currentProgram: null,
          currentMicrocycle: null,
          todayWorkout: null,
          isGenerating: false,
          isLoading: false,
          error: null,
          blockState: null,
          acceptedMaterialContext: createEmptyAcceptedMaterialContext(),
          dateOverrides: {},
          overrideContexts: {},
          weekScopedOverlays: {},
          userRemovalConstraints: [],
          reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
          exposureContractsByWeek: {},
          sessionFeedback: {},
          weightOverrides: {},
          });
          recordProgramOverrideWrite({
            writer: 'reset',
            outcome: 'applied',
            before,
            resetActionId,
          });
        } finally {
          endProgramOverrideResetAction(resetActionId);
        }
      },
    }),
    {
      name: PROGRAM_STORE_PERSISTENCE_KEY,
      storage: createJSONStorage(() => programStateStorage),
      version: PROGRAM_STORE_PERSISTENCE_VERSION,
      migrate: (persistedState, persistedVersion) => {
        const ingress = requireProgramHydrationIngress(persistedState, persistedVersion);
        return {
          ...(persistedState as Record<string, unknown>),
          __programHydrationIngress: ingress,
        };
      },
      merge: (persisted, current) => {
        const candidate = (persisted as (Partial<ProgramState> & {
          __programHydrationIngress?: ProgramHydrationIngressClassification;
        }) | undefined) ?? {};
        const embeddedIngress = candidate.__programHydrationIngress;
        const { __programHydrationIngress: _ignoredIngress, ...incomingWithoutIngress } = candidate;
        const incomingRaw = incomingWithoutIngress as Partial<ProgramState>;
        const ingress = embeddedIngress ?? requireProgramHydrationIngress(
          incomingRaw,
          PROGRAM_STORE_PERSISTENCE_VERSION,
        );
        programHydrationIngressForAcceptance = ingress;
        const acceptedCanonical = ingress.kind === 'accepted_canonical';
        const rawAcceptedContext = (incomingRaw.acceptedMaterialContext ?? {}) as
          Partial<AcceptedMaterialContext>;
        let acceptedContext = acceptedCanonical
          ? projectAcceptedMaterialContextDerivedFields(incomingRaw.acceptedMaterialContext)
          : normalizeAcceptedMaterialContext(incomingRaw.acceptedMaterialContext);
        const normalizedSurfaces = normalizeAcceptedProgramSurfaces(incomingRaw);
        if (acceptedCanonical && incomingRaw.reversibleAdjustmentLedger) {
          normalizedSurfaces.reversibleAdjustmentLedger = incomingRaw.reversibleAdjustmentLedger;
        }
        let incoming = {
          ...incomingRaw,
          ...normalizedSurfaces,
          acceptedMaterialContext: acceptedContext,
        };
        if (!acceptedCanonical) {
          const rawLegacyConstraints = Array.isArray(rawAcceptedContext.activeConstraints)
            ? rawAcceptedContext.activeConstraints.filter((constraint) =>
                (constraint.type === 'injury' && !constraint.injuryEpisodeId) ||
                ((constraint.type === 'fatigue' || constraint.type === 'soreness' ||
                  constraint.type === 'equipment' || constraint.type === 'schedule') &&
                  (constraint.temporarySourceFactIds?.length ?? 0) === 0))
            : [];
          const legacyFacts = migrateLegacyTemporarySourceFacts({
            activeConstraints: rawLegacyConstraints,
            activeInjury: acceptedContext.temporarySourceFacts.some((fact) => 'episodeId' in fact)
              ? null
              : rawAcceptedContext.activeInjury ?? acceptedContext.activeInjury,
            readinessSignalsByDate: rawAcceptedContext.readinessSignalsByDate ?? {},
            availabilityConstraints: acceptedProfileForContext(
              acceptedContext,
              {},
            ).availabilityConstraints,
            sourceSurface: 'program_store_hydration',
          });
          const migratedFacts = normalizeTemporarySourceFacts({
            value: [...legacyFacts, ...acceptedContext.temporarySourceFacts],
          });
          if (migratedFacts.length > 0) {
            const capturedAt = migratedFacts
              .map((fact) => fact.createdAt)
              .sort()[0] ?? new Date(0).toISOString();
            acceptedContext = normalizeAcceptedMaterialContext({
              ...acceptedContext,
              temporarySourceFacts: migratedFacts,
              acceptedCompositionBase: acceptedContext.acceptedCompositionBase ?? {
                protocolVersion: ACCEPTED_COMPOSITION_BASE_PROTOCOL_VERSION,
                capturedAt,
                updatedAt: capturedAt,
                sourceRevision: acceptedContext.revision,
                provenance: 'legacy_after_state_only',
                // A legacy envelope has no provable displaced before-state. Its
                // current accepted after-state is the only safe rebase source.
                surfaces: normalizeAcceptedProgramSurfaces(incoming),
              },
            });
            incoming = { ...incoming, acceptedMaterialContext: acceptedContext };
          }
          const migrationContractsByWeek: Record<string, WeeklyExposureContractV2> = {};
          for (const microcycle of incoming.currentProgram?.microcycles ?? []) {
            if (microcycle.exposureContractV2) {
              migrationContractsByWeek[microcycle.startDate.slice(0, 10)] =
                microcycle.exposureContractV2;
            }
          }
          if (incoming.currentMicrocycle?.exposureContractV2) {
            migrationContractsByWeek[incoming.currentMicrocycle.startDate.slice(0, 10)] =
              incoming.currentMicrocycle.exposureContractV2;
          }
          for (const [weekStart, overlay] of Object.entries(incoming.weekScopedOverlays)) {
            if (overlay.exposureContractV2) {
              migrationContractsByWeek[weekStart] = overlay.exposureContractV2;
            }
          }
          incoming.reversibleAdjustmentLedger = normalizeReversibleAdjustmentLedger({
            value: incomingRaw.reversibleAdjustmentLedger,
            userRemovalConstraints: incoming.userRemovalConstraints,
            acceptedRevision: acceptedContext.revision,
            exposureContractsByWeek: migrationContractsByWeek,
          });
          if (acceptedContext.acceptedCompositionBase) {
            acceptedContext = normalizeAcceptedMaterialContext({
              ...acceptedContext,
              acceptedCompositionBase: {
                ...acceptedContext.acceptedCompositionBase,
                surfaces: {
                  ...acceptedContext.acceptedCompositionBase.surfaces,
                  reversibleAdjustmentLedger: incoming.reversibleAdjustmentLedger,
                },
              },
            });
            incoming = {
              ...incoming,
              ...acceptedContext.acceptedCompositionBase.surfaces,
              acceptedMaterialContext: acceptedContext,
            };
          }
        }
        const persistedState = canonicaliseHydratedState(
          incoming,
          {
            ingressKind: ingress.kind,
            profile: acceptedProfileForContext(
              acceptedContext,
              {},
            ),
          },
        );
        const merged = { ...current, ...persistedState } as ProgramState;
        if (!merged.blockState) {
          merged.blockState = deriveStoredBlockStateFromProgram(merged.currentProgram);
        }
        const trace = programHydrationTrace();
        emitAthleteActionEvent(trace, 'hydrated_state_checked', {
          hydrationSucceeded: true,
          acceptedStateVersion: merged.acceptedMaterialContext.revision,
          hydratedStateHash: athleteActionDiagnosticHash({
            program: normalizeAcceptedProgramSurfaces(merged),
            context: merged.acceptedMaterialContext,
          }),
          visibleWeekCount: Object.keys(merged.weekScopedOverlays).length,
          activeRemovalConstraintCount: merged.userRemovalConstraints.length,
        });
        return merged;
      },
      onRehydrateStorage: () => {
        programHydrationIngressForAcceptance = null;
        return (_state, error) => {
        programHydrationAccepted = false;
        programHydrationAcceptancePromise = (async () => {
          if (error) {
            const trace = programHydrationTrace();
            const hydrationReason = error instanceof ProgramHydrationIngressError
              ? error.reason
              : 'program_hydration_failed';
            // The diagnostic events below are DEV-ONLY —
            // `athleteActionDiagnosticsEnabled()` is false in a production
            // build, so on a real device every emit here is a no-op and the
            // thrown message was invisible. A hydration failure then looked
            // like "the athlete's program is empty" with nothing to read.
            //
            // `logger.error` emits at every level in every build, so the
            // message survives. This matters most for the invariant throws that
            // reach here by design — a canonical context asserting a phase and
            // subphase that contradict each other, for example: loud is the
            // whole point of throwing, and it was being swallowed one layer up.
            //
            // Zustand catches this inside `persist`'s hydrate chain and routes
            // it here once. There is no retry, so a throw degrades to in-memory
            // defaults with a readable reason rather than a crash loop.
            logger.error(
              '[programStore] hydration failed; falling back to in-memory defaults.',
              { reason: hydrationReason, message: error instanceof Error ? error.message : String(error) },
            );
            emitAthleteActionEvent(trace, 'hydrated_state_checked', {
              hydrationSucceeded: false,
              originalRejectionCode: hydrationReason,
              rejectingBoundary: 'programStore.onRehydrateStorage',
              failureCategory: 'persistence_failure',
            });
            emitAthleteActionEvent(trace, 'athlete_action_failed', {
              outcome: 'failed',
              internalResultCode: 'program_hydration_failed',
              originalRejectionCode: hydrationReason,
              rejectionCodes: [hydrationReason],
              firstFailingBoundary: 'programStore.onRehydrateStorage',
            });
            clearProgramHydrationTrace();
            return;
          }
          const hydrated = useProgramStore.getState();
          // Publish the complete hydrated/migrated program and material context
          // through the same coordinator used at runtime. Compatibility-store
          // hydration may happen in any order; those stores never publish
          // upstream and are replaced from this accepted context.
          const trace = programHydrationTrace();
          try {
            const acceptedBefore = normalizeAcceptedMaterialContext(
              useProgramStore.getState().acceptedMaterialContext,
            );

            // Nothing has ever been accepted on this device and there is no
            // program to accept — a fresh install, mid-onboarding.
            //
            // This path used to commit an accepted-state transaction anyway,
            // taking the store to revision 1 with an `acceptedProfileSnapshot`
            // of the (empty) profile. That is an acceptance record no athlete
            // ever made, and it is what armed `profileStore`'s mirror against
            // onboarding, reverting every answer in memory.
            //
            // There is nothing to accept, migrate, or project here: no program,
            // no facts, no prior revision. Recording an acceptance is a lie.
            //
            // Reassessment: docs/PROFILE_MIRROR_OWNERSHIP_REASSESSMENT_2026-07-24.md
            // Proof: onboardingReliabilityTests case 0b.
            if (!hydrated.currentProgram && acceptedBefore.revision === 0) {
              emitAthleteActionEvent(trace, 'athlete_action_completed', {
                outcome: 'accepted',
                internalResultCode: 'hydration_no_accepted_state_to_project',
              });
              return;
            }

            if (programHydrationIngressForAcceptance?.kind === 'accepted_canonical') {
              await runWithAthleteActionTrace(trace, async () => {
                if (acceptedBefore.temporarySourceFacts.length > 0) {
                  require('./coachUpdatesStore').publishAcceptedCoachUpdatesCompatibilityMirror({
                    activeConstraints: acceptedBefore.activeConstraints,
                    activeInjury: acceptedBefore.activeInjury,
                  });
                }
                if (acceptedBefore.acceptedProfileSnapshot) {
                  require('./profileStore').publishAcceptedProfileCompatibilityMirror(
                    acceptedBefore.acceptedProfileSnapshot.onboardingData,
                  );
                }
                await persistCanonicalHydratedEnvelopeReadback();
                emitAthleteActionEvent(trace, 'athlete_action_completed', {
                  outcome: 'accepted',
                  internalResultCode: 'hydration_accepted_canonical_projection',
                });
              });
              return;
            }
            const persistedState = async (key: string): Promise<Record<string, any>> => {
              try {
                const raw = await asyncStorageCompat.getItem(key);
                if (!raw) return {};
                const parsed = JSON.parse(raw) as { state?: Record<string, any> } | Record<string, any>;
                return parsed && typeof parsed === 'object' && 'state' in parsed
                  ? parsed.state ?? {}
                  : parsed as Record<string, any>;
              } catch {
                return {};
              }
            };
            const persistedProfile = await persistedState('profile-store');
            let profileForAcceptance = acceptedProfileForContext(
              acceptedBefore,
              (persistedProfile.onboardingData && typeof persistedProfile.onboardingData === 'object'
                ? persistedProfile.onboardingData
                : require('./profileStore').useProfileStore.getState().onboardingData),
            );
            const profileSnapshotTime =
              acceptedBefore.acceptedProfileSnapshot?.updatedAt ??
              acceptedBefore.acceptedCompositionBase?.updatedAt ??
              acceptedBefore.acceptedCompositionBase?.capturedAt ??
              new Date(0).toISOString();
            // NEVER MINT AN ACCEPTANCE NOBODY MADE (Sam, export 4, 2026-07-29).
            //
            // This is where his device's `sourceRevision: 1` snapshot came
            // from: hydration ran mid-onboarding, minted an accepted profile
            // from the store's 2-key DEFAULT, and every later hydration
            // republished it over whatever he had answered since. Three
            // onboardings.
            //
            // The guard above it — no program AND revision 0 — did not fire,
            // because generation had already built him a program from those
            // two answers. Program presence was never the question:
            // `isOnboardingComplete` is, because that is the athlete's own act
            // of acceptance. See rules/profileMirrorNarrowing.
            const mintRefusal = acceptedProfileSnapshotMintRefusal({
              isOnboardingComplete: !!(persistedProfile.isOnboardingComplete ??
                require('./profileStore').useProfileStore.getState().isOnboardingComplete),
              onboardingData: profileForAcceptance,
            });
            if (mintRefusal && !acceptedBefore.acceptedProfileSnapshot) {
              emitAthleteActionEvent(trace, 'athlete_action_completed', {
                outcome: 'accepted',
                internalResultCode: 'hydration_snapshot_mint_refused',
                mintRefusalReason: mintRefusal.reason,
              });
              return;
            }
            let acceptedProfileSnapshot: AcceptedProfileSnapshotV1 =
              acceptedBefore.acceptedProfileSnapshot ?? {
                protocolVersion: ACCEPTED_PROFILE_SNAPSHOT_PROTOCOL_VERSION,
                capturedAt: profileSnapshotTime,
                updatedAt: profileSnapshotTime,
                sourceRevision: acceptedBefore.revision + 1,
                onboardingData: profileForAcceptance,
              };
            let legacyHydrationFacts = acceptedBefore.temporarySourceFacts;
            if (legacyHydrationFacts.length === 0) {
              const [coachMirror, readinessMirror] = await Promise.all([
                persistedState('coach-updates'),
                persistedState('readiness-store'),
              ]);
              legacyHydrationFacts = migrateLegacyTemporarySourceFacts({
                activeConstraints: [
                  ...acceptedBefore.activeConstraints,
                  ...(Array.isArray(coachMirror.activeConstraints) ? coachMirror.activeConstraints : []),
                ],
                activeInjury: acceptedBefore.activeInjury ?? coachMirror.activeInjury ?? null,
                readinessSignalsByDate: {
                  ...(readinessMirror.signalsByDate && typeof readinessMirror.signalsByDate === 'object'
                    ? readinessMirror.signalsByDate
                    : {}),
                  ...acceptedBefore.readinessSignalsByDate,
                },
                availabilityConstraints: profileForAcceptance.availabilityConstraints,
                sourceSurface: 'program_store_hydration',
              });
            }
            if ((profileForAcceptance.availabilityConstraints ?? [])
              .some((constraint) => constraint.scope === 'temporary')) {
              profileForAcceptance = {
                ...profileForAcceptance,
                availabilityConstraints: (profileForAcceptance.availabilityConstraints ?? [])
                  .filter((constraint) => constraint.scope !== 'temporary'),
              };
              acceptedProfileSnapshot = {
                ...acceptedProfileSnapshot,
                onboardingData: profileForAcceptance,
                updatedAt: profileSnapshotTime,
              };
            }
            await runWithAthleteActionTrace(trace, async () => {
              require('./acceptedStateTransaction').commitAcceptedStateTransaction({
                reason: 'program:hydration_acceptance',
                // HYDRATION WEARS ONE DECLARED MODE (Sam, 2026-07-30).
                //
                // This field was absent, so the mode arrived by DEFAULT —
                // `proposal.operation ?? 'restoration'` — and the type's own
                // comment warns that is how a call site inherits a mode by
                // accident. It is stated here because hydration is a
                // restoration by nature: it replays state that was accepted
                // once, so a week it cannot reproduce means the stored snapshot
                // needs LIFTING, not reducing. Publishing a reduced version of
                // a snapshot we do not understand would merge a defect into
                // accepted state, which is the wipe's shape wearing a success.
                //
                // NOT YET WHOLE: the staging path below still runs the §18
                // gateway's accept-and-reduce unconditionally, so one
                // transaction can still reduce a week and then refuse the
                // reduction. Declaring the mode removes the accident; making
                // the two halves agree needs the read-ingress lift, which is
                // its own unit. See
                // docs/HYDRATION_WIPE_DIAGNOSIS_2026-07-30.md.
                operation: 'restoration',
                trace,
                profile: profileForAcceptance,
                acceptedProfileSnapshot,
                activeConstraints: [
                  ...acceptedBefore.activeConstraints.filter((constraint) =>
                    !isAcceptedProfileConstraint(constraint)),
                  ...composeAcceptedProfileConstraints(
                    profileForAcceptance,
                    profileSnapshotTime,
                  ),
                ],
                validateWeekStarts: [
                  ...(hydrated.currentProgram?.microcycles ?? []).map((microcycle) =>
                    microcycle.startDate.slice(0, 10)),
                  ...(hydrated.currentMicrocycle
                    ? [hydrated.currentMicrocycle.startDate.slice(0, 10)]
                    : []),
                  ...Object.keys(hydrated.weekScopedOverlays ?? {}),
                ],
                skipConstraintProjection: true,
              });
              if (legacyHydrationFacts.length > 0) {
                const currentAccepted = normalizeAcceptedMaterialContext(
                  useProgramStore.getState().acceptedMaterialContext,
                );
                if (currentAccepted.temporarySourceFacts.length === 0) {
                  await require('./temporarySourceFactTransaction').commitTemporarySourceFactSet({
                    nextFacts: legacyHydrationFacts,
                    targetFactId: 'episodeId' in legacyHydrationFacts[0]
                      ? legacyHydrationFacts[0].episodeId
                      : legacyHydrationFacts[0].factId,
                    todayISO: todayISOLocal(),
                    reason: 'temporary_source_fact:hydrate_legacy_compatibility',
                  });
                } else {
                  await require('./temporarySourceFactTransaction')
                    .hydrateTemporarySourceFacts(todayISOLocal());
                }
              }
              const accepted = normalizeAcceptedMaterialContext(
                useProgramStore.getState().acceptedMaterialContext,
              );
              if (accepted.temporarySourceFacts.length > 0) {
                require('./coachUpdatesStore').publishAcceptedCoachUpdatesCompatibilityMirror({
                  activeConstraints: accepted.activeConstraints,
                  activeInjury: accepted.activeInjury,
                });
              }
              if (accepted.acceptedProfileSnapshot) {
                require('./profileStore').publishAcceptedProfileCompatibilityMirror(
                  accepted.acceptedProfileSnapshot.onboardingData,
                );
              }
              await persistCanonicalHydratedEnvelopeReadback();
              emitAthleteActionEvent(trace, 'athlete_action_completed', {
                outcome: 'accepted',
                internalResultCode: 'hydration_accepted',
              });
            });
          } catch (hydrationError) {
            const rejectionCode = hydrationError instanceof Error
              ? hydrationError.name
              : 'program_hydration_acceptance_failed';
            // HOLD WHAT WAS REFUSED, before anything else can reach the disk.
            //
            // The rollback above restores memory correctly and always did; the
            // 2026-07-29 wipe happened fourteen seconds LATER, when the boot
            // gate timed out, the athlete tapped Try Again, and a second cycle
            // published an empty baseline over the only copy of his program.
            // What is quarantined is therefore the DISK copy, read here rather
            // than serialised from memory: the disk copy is the one a later
            // writer can destroy, and it is the one he actually still has.
            //
            // Best-effort by design. If the read fails we are already in a
            // storage failure and there is nothing to protect; swallowing that
            // must not replace the real rejection the athlete is owed.
            try {
              quarantineRefusedPayload(
                PROGRAM_STORE_PERSISTENCE_KEY,
                await readDurableProgramStoreEnvelope(),
              );
            } catch {
              // fall through to the rejection below
            }
            emitAthleteActionEvent(trace, 'athlete_action_failed', {
              outcome: 'failed',
              internalResultCode: 'program_hydration_acceptance_failed',
              originalRejectionCode: rejectionCode,
              rejectionCodes: [rejectionCode],
              firstFailingBoundary: 'programStore.onRehydrateStorage.acceptance',
              failureCategory: 'persistence_failure',
              previousStateRestored: true,
            });
            throw hydrationError;
          } finally {
            clearProgramHydrationTrace();
          }
        })().then(() => {
          if (!error) programHydrationAccepted = true;
        });
        };
      },
    },
  ),
);

const rawProgramStoreRehydrate = useProgramStore.persist.rehydrate;
const rawProgramStoreHasHydrated = useProgramStore.persist.hasHydrated;
const initialProgramHydrationCompletion = rawProgramStoreHasHydrated()
  ? programHydrationAcceptancePromise
  : new Promise<void>((resolve, reject) => {
      const unsubscribe = useProgramStore.persist.onFinishHydration(() => {
        unsubscribe();
        programHydrationAcceptancePromise.then(resolve, reject);
      });
    });
let programHydrationQueue = initialProgramHydrationCompletion.catch(() => undefined);

useProgramStore.persist.rehydrate = () => {
  const run = programHydrationQueue.then(async () => {
    programHydrationAccepted = false;
    programHydrationAcceptancePromise = Promise.resolve();
    await rawProgramStoreRehydrate();
    await programHydrationAcceptancePromise;
  });
  programHydrationQueue = run.catch(() => undefined);
  return run;
};

useProgramStore.persist.hasHydrated = () =>
  rawProgramStoreHasHydrated() && programHydrationAccepted;

/* ────────────────────────────────────────────────────────────────────────────
 * THE OVERRIDE DOOR — LR-1
 *
 * `setManualOverride` used to describe itself as a "raw storage primitive" and
 * twenty-seven references across thirteen files reached it. That is the profile
 * store's shape on 2026-07-28 — the day before the wipe fix — with thirteen
 * writers instead of two. This is the counter-shape, by the store-armour recipe
 * (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md`), applied to the last store:
 *
 *   1. ONE DOOR. Every write of the override slice goes through
 *      `applyProgramOverrideSliceWrite`. The single-date write every caller
 *      actually wants is `applyProgramOverrideWrite`, a thin builder over it.
 *   2. EVERY WRITER IS NAMED. `ProgramOverrideWriterId` is a closed union, so
 *      an unnamed writer is a COMPILE error rather than an anonymous write.
 *   3. THE DEFAULT IS NOT A VALUE. Emptying an override map that holds the
 *      athlete's decisions is refused unless the write carries a reset action
 *      that is IN FLIGHT. A reduction is not the wipe (recipe lesson 3), and
 *      an attributed erasure is the athlete's own change (lesson 11) — both
 *      land; only the UNATTRIBUTED bare default is refused.
 *   4. AN IN-FLIGHT RESET, NOT A RESET THAT HAPPENED. A stale id is refused.
 *   5. EVERYTHING IS ON THE TAPE. Applied or refused, every write names its
 *      writer and the material COUNTS either side. Counts and labels only —
 *      dates, exercise names and workout content are answers and stay off it.
 *
 * The physical write still belongs to `commitAcceptedStateTransaction`: the
 * door decides and records, the transaction validates and publishes. That is
 * one owner for the DECISION above one owner for the PUBLICATION, not two
 * owners of the same thing.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Every writer of the program store's override slice, named.
 *
 * `harness` is the one id no product file may use: test suites seed override
 * state through it, and `programOverrideOwnershipTests` cell 5 sweeps `src/`
 * outside `__tests__` for it. A seeded fixture is declared debt under the
 * fixture law, not a hidden writer.
 */
export type ProgramOverrideWriterId =
  | 'athlete_tap'
  | 'plan_change_producer'
  | 'program_control'
  | 'adjustment_events'
  // RETIRED 2026-08-04 (Option C item 4): `'lighter_day'`. The readiness trim
  // is a derived effect of a recorded fact, so it authors a sparse
  // `readiness_reduction` week overlay instead of the athlete's decision
  // surface. A future lighter-day override write is now a COMPILE ERROR.
  | 'coach_action'
  | 'coach_executor'
  | 'coach_program_edit'
  | 'coach_turn_controller'
  | 'coach_undo'
  | 'coach_revision_writer'
  | 'coach_modality_swap'
  | 'store_action'
  | 'reset'
  | 'dev_seed'
  | 'harness';

export type ProgramOverrideRefusalReason =
  | 'default_over_answered_overrides'
  | 'reset_action_not_in_flight';

export interface ProgramOverrideWriteOutcome {
  ok: boolean;
  reason?: ProgramOverrideRefusalReason;
}

/** The material slice this door owns — the athlete's decision surface. */
export interface ProgramOverrideSlice {
  dateOverrides: Record<string, Workout>;
  overrideContexts: Record<string, OverrideContext>;
  exposureContractsByWeek?: Record<string, WeeklyExposureContract>;
  userRemovalConstraints?: UserRemovalConstraint[];
}

const overrideResetActionsInFlight = new Set<string>();
let nextOverrideResetActionId = 1;

/**
 * Open an erasure. The id is only good while the erasure is running, which is
 * what makes a deferred write belonging to a FINISHED reset refusable — the
 * shape the profile loss is still best explained by.
 */
export function beginProgramOverrideResetAction(source: string): string {
  const id = `program-override-reset:${source}:${nextOverrideResetActionId++}`;
  overrideResetActionsInFlight.add(id);
  return id;
}

export function endProgramOverrideResetAction(id: string): void {
  overrideResetActionsInFlight.delete(id);
}

/** Test-visible only so a cell can prove the set empties; never a product read. */
export function activeProgramOverrideResetActionCount(): number {
  return overrideResetActionsInFlight.size;
}

function overrideMaterialCounts(state: ProgramState): {
  overrides: number; contexts: number; constraints: number;
} {
  return {
    overrides: Object.keys(state.dateOverrides ?? {}).length,
    contexts: Object.keys(state.overrideContexts ?? {}).length,
    constraints: (state.userRemovalConstraints ?? []).length,
  };
}

/**
 * The DISK copy, not the in-memory one — memory survives a refusal by
 * construction; the envelope on disk is what a later writer can destroy.
 * Best-effort and async: a quarantine that crashed the refusal it protects
 * would be worse than no quarantine.
 */
function quarantineProgramDiskCopyBestEffort(): void {
  void readDurableProgramStoreEnvelope()
    .then((value) => quarantineRefusedPayload(PROGRAM_STORE_PERSISTENCE_KEY, value))
    .catch(() => {});
}

/**
 * ONE RECORDER for the whole slice. The door and the store's total erasure
 * (`clear()`) both report through here, so a write that is decided in two
 * places is still described in one — counts and labels only, never an answer.
 */
function recordProgramOverrideWrite(args: {
  writer: ProgramOverrideWriterId;
  outcome: 'applied' | 'refused';
  before: { overrides: number; contexts: number; constraints: number };
  reason?: ProgramOverrideRefusalReason;
  resetActionId?: string;
}): void {
  const after = overrideMaterialCounts(useProgramStore.getState());
  emitAthleteActionEvent(beginAthleteActionTrace({
    source: args.writer === 'athlete_tap' ? 'tap' : 'system',
    actionType: 'program_change',
    route: 'applyProgramOverrideSliceWrite',
  }, undefined, { forceRoot: true }), 'program_override_write', {
    writer: args.writer,
    outcome: args.outcome,
    overrideCountBefore: args.before.overrides,
    overrideCountAfter: after.overrides,
    overrideContextCountBefore: args.before.contexts,
    overrideContextCountAfter: after.contexts,
    removalConstraintCountBefore: args.before.constraints,
    removalConstraintCountAfter: after.constraints,
    ...(args.reason ? { internalResultCode: args.reason } : {}),
    // `erasureActId`, not `resetActionId`: the diagnostics forbidden-key
    // filter drops any key containing "set" (recipe lesson 12).
    ...(args.resetActionId ? { erasureActId: args.resetActionId } : {}),
  });
}

/**
 * THE DOOR. Every write of the override slice — set, remove, clear, erase —
 * arrives here, names itself, and is recorded whether it lands or not.
 */
export function applyProgramOverrideSliceWrite(args: {
  next: ProgramOverrideSlice;
  writer: ProgramOverrideWriterId;
  /** Passed through to the accepted-state transaction as its reason. */
  reason: string;
  validateWeekStarts: string[];
  markedDays?: Record<string, CalendarDayType>;
  operation?: 'forward_decision';
  todayISO?: string;
  resetActionId?: string;
}): ProgramOverrideWriteOutcome {
  const before = overrideMaterialCounts(useProgramStore.getState());
  const record = (
    outcome: 'applied' | 'refused',
    reason?: ProgramOverrideRefusalReason,
  ): void => recordProgramOverrideWrite({
    writer: args.writer,
    outcome,
    before,
    ...(reason ? { reason } : {}),
    ...(args.resetActionId ? { resetActionId: args.resetActionId } : {}),
  });

  // THE DEFAULT IS NOT A VALUE. An empty override map written over one that
  // holds decisions is the wipe shape; a map with FEWER entries is the athlete
  // editing (lesson 3) and is never refused.
  const nextIsBareDefault = Object.keys(args.next.dateOverrides).length === 0;
  if (nextIsBareDefault && before.overrides > 0) {
    if (!args.resetActionId) {
      quarantineProgramDiskCopyBestEffort();
      record('refused', 'default_over_answered_overrides');
      return { ok: false, reason: 'default_over_answered_overrides' };
    }
    if (!overrideResetActionsInFlight.has(args.resetActionId)) {
      quarantineProgramDiskCopyBestEffort();
      record('refused', 'reset_action_not_in_flight');
      return { ok: false, reason: 'reset_action_not_in_flight' };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./acceptedStateTransaction').commitAcceptedStateTransaction({
    ...(args.operation ? { operation: args.operation } : {}),
    reason: args.reason,
    ...(args.todayISO ? { todayISO: args.todayISO } : {}),
    program: {
      dateOverrides: args.next.dateOverrides,
      overrideContexts: args.next.overrideContexts,
      ...(args.next.exposureContractsByWeek
        ? { exposureContractsByWeek: args.next.exposureContractsByWeek }
        : {}),
      ...(args.next.userRemovalConstraints
        ? { userRemovalConstraints: args.next.userRemovalConstraints }
        : {}),
    },
    ...(args.markedDays ? { markedDays: args.markedDays } : {}),
    validateWeekStarts: args.validateWeekStarts,
  });
  record('applied');
  return { ok: true };
}

/**
 * The single-date write — what every caller of the retired raw primitive
 * wants, with the writer named. The body is the primitive's own, unchanged:
 * the final active-constraint validation still runs here so no producer can
 * reintroduce unsafe work after its own checks.
 */
export function applyProgramOverrideWrite(args: {
  date: string;
  workout: Workout;
  context?: OverrideContext;
  writer: ProgramOverrideWriterId;
}): ProgramOverrideWriteOutcome {
  const { date, workout, context } = args;
  const validatedWorkout = {
    ...postValidateWorkout(date, workout, {
      // A manual override is the explicit edited result. Preserve planned
      // intent for diagnostics, but never resurrect content the edit
      // deliberately removed.
      restoreMissingPlanPatterns: false,
    }),
    dayOfWeek: new Date(`${date.slice(0, 10)}T12:00:00`).getDay(),
  };
  const exposureResolution = resolveDateMutationExposureContract(date, validatedWorkout);
  const state = normalizeAcceptedProgramSurfaces(useProgramStore.getState());
  const activeRemovals = state.userRemovalConstraints.filter((constraint) =>
    constraint.status === 'active' && constraint.targetDate === date);
  const restoredAt = new Date().toISOString();
  const userRemovalConstraints = state.userRemovalConstraints.map((constraint) =>
    constraint.status === 'active' && constraint.targetDate === date
      ? {
          ...constraint,
          status: 'restored' as const,
          restoredAt,
          restorationReason: 'explicit_re_add' as const,
        }
      : constraint);
  const acceptedContext = normalizeAcceptedMaterialContext(
    useProgramStore.getState().acceptedMaterialContext,
  );
  const markedDays = { ...acceptedContext.markedDays };
  if (activeRemovals.some((constraint) => constraint.wholeDayRestOwned) &&
    markedDays[date] === 'rest') {
    delete markedDays[date];
  }
  return applyProgramOverrideSliceWrite({
    writer: args.writer,
    // An athlete placing content on a day is a decision they stated.
    operation: 'forward_decision',
    reason: `override:set:${date}`,
    next: {
      dateOverrides: { ...state.dateOverrides, [date]: validatedWorkout },
      overrideContexts: context
        ? { ...state.overrideContexts, [date]: context }
        : state.overrideContexts,
      exposureContractsByWeek: exposureResolution
        ? {
            ...state.exposureContractsByWeek,
            [exposureResolution.weekStart]: exposureResolution.contract,
          }
        : state.exposureContractsByWeek,
      userRemovalConstraints,
    },
    markedDays,
    validateWeekStarts: [mondayForDate(date)],
  });
}

/**
 * The block position generation must be told, read from the one owner.
 *
 * §18 ownership reassessment (2026-08-05, D1). Callers used to hand generation
 * the block NUMBER from this anchor and leave it to re-derive the block START
 * from the date — two owners of one grid, which disagree for every date that is
 * not itself a block start. There is now one read and it returns the position
 * whole; `getCurrentBlockNumberForGeneration` is that same value projected, so
 * the two readers cannot drift.
 */
export function getBlockPositionForGeneration(dateISO?: string): BlockGridPosition {
  const state = useProgramStore.getState();
  const blockState = state.blockState ?? state.ensureBlockState(dateISO);
  return resolveBlockGridPosition(blockState, dateISO ?? todayISOLocal());
}

export function getCurrentBlockNumberForGeneration(dateISO?: string): number {
  return getBlockPositionForGeneration(dateISO).blockNumber;
}

/**
 * Get the most recent performed weight for an exercise (across all dates).
 * Returns undefined if the exercise has never been weight-overridden.
 *
 * Standalone function (not a store method) to avoid circular type references.
 * Used by progression to determine baseline weight for future sessions.
 */
export function getLastPerformedWeight(exerciseId: string): number | null | undefined {
  const state = useProgramStore.getState();
  const dates = Object.keys(state.weightOverrides).sort().reverse();
  for (const d of dates) {
    const exerciseWeights = state.weightOverrides[d];
    if (exerciseWeights && exerciseId in exerciseWeights) {
      return exerciseWeights[exerciseId];
    }
  }
  return undefined;
}
