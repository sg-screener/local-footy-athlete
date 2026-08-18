import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorageCompat, trackDurableWrite } from './asyncStorageCompat';
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
  WEEKS_PER_BLOCK,
  addDaysISO,
  deriveStoredBlockStateFromProgram,
  resolveBlockGridPosition,
  type BlockGridPosition,
  type StoredProgramBlockState,
} from '../utils/programBlockState';
import type { SessionComponentKind } from '../utils/sessionComponents';

/**
 * ONE RECORD PER ACCEPTED BLOCK — its identity and what it asked of the athlete.
 *
 * Both facts are about the same accepted block and are written in the same breath
 * at acceptance, so they live in one record rather than two maps that could drift
 * or persist down different routes.
 */
export interface AcceptedBlockRecord {
  /** 1-based block number, as the accepted program was authored. */
  blockNumber: number;
  /** Strength sessions that accepted block actually required. */
  requiredStrengthSessions: number;
}
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
  contractOffseasonSubphase,
  migrateLegacyWeeklyExposureContractV2,
  type WeeklyExposureContractV2,
} from '../rules/weeklyExposureContractV2';
import { applyGenerationSafetyToSection18Contract } from '../rules/section18SafetyPolicy';
import { canonicalContextSubphase } from '../utils/workoutCanonicalisation';
import { readStoredWorldOrResetClean } from './unreadableWorldResetDoor';
import type { OffseasonSubphase } from '../rules/offseasonSubphase';
import {
  finaliseSection18SafetyWorkout,
} from '../rules/section18SafetyFinaliser';
import {
  ensureProgramSeasonPhaseClock,
  resolveSeasonPhaseClock,
  type SeasonPhaseClock,
} from '../rules/seasonPhaseClock';
import type { CalendarDayType } from './calendarStore';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { composeAcceptedEffectiveWeekSurfaces } from '../utils/liveEvaluationSurfaces';
import { effectiveFixtureDatesForWeeks } from '../rules/rollingHorizonRepair';
import type { AcceptedEffectiveWeekSurfaces } from '../rules/acceptedEffectiveWeek';
import { applyUserRemovalConstraintsToWeek } from '../rules/userRemovalConstraints';
import {
  athleteActionDiagnosticHash,
  beginAthleteActionTrace,
  currentAthleteActionTrace,
  emitAthleteActionEvent,
  programHydrationTrace,
} from '../utils/athleteActionDiagnostics';
import {
  acceptedProfileForContext,
  createEmptyAcceptedMaterialContext,
  normalizeAcceptedMaterialContext,
  normalizeAcceptedProgramSurfaces,
  type AcceptedMaterialContext,
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
  type ReversibleAdjustmentLedger,
} from '../rules/reversibleAdjustmentLedger';
import {
  PROGRAM_STORE_PERSISTENCE_VERSION,
  type ProgramHydrationIngressClassification,
} from './programHydrationIngress';
import {
  projectHydratedStateDerivedFields,
} from './programHydrationProjection';
import {
  microcycleCoversWeek,
  selectStoredWeekDeclaration,
} from '../rules/storedWeekDeclaration';

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
  // R1.3 (shell rebuild): every serialization of this store — zustand's and
  // the transaction layer's out-of-band protocol alike — converges to the
  // inputs-only shape here. The fat output envelope cannot reach disk.
  return reduceProgramEnvelopeToInputs(
    JSON.stringify({ state, version: PROGRAM_STORE_PERSISTENCE_VERSION }),
  );
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
      // R1.3 (shell rebuild): the NEW shape's material is its INPUTS — the
      // athlete's facts, results and generation anchors. The old shape's
      // material stays a program with microcycles (parked/legacy payloads
      // still pass this boundary).
      if ('inputs' in state) {
        const inputs = (state.inputs ?? {}) as Record<string, unknown>;
        return (inputs.temporarySourceFacts as unknown[] ?? []).length > 0
          || (inputs.injuryEpisodes as unknown[] ?? []).length > 0
          || Object.keys(inputs.sessionFeedback as Record<string, unknown> ?? {}).length > 0
          || Object.keys(inputs.weightOverrides as Record<string, unknown> ?? {}).length > 0
          || inputs.generationAnchorISO != null
          || inputs.seasonPhaseClock != null;
      }
      const program = state.currentProgram as { microcycles?: unknown[] } | null | undefined;
      return !!program && (program.microcycles ?? []).length > 0;
    } catch {
      return false;
    }
  },
});

/**
 * Where a pre-rebuild (old-shape) program envelope is parked, byte-identical,
 * before any new-shape write can destroy it. R2's one-time migration reads
 * THIS copy; it is deleted in the first post-beta release, never in the
 * release that reads it (standing condition 5). Declared here — at the store
 * whose boundary enforces it — and re-exported by quiescentBoot.
 */
export const PRE_REBUILD_ENVELOPE_PARKING_KEY = 'program-store.pre-rebuild-envelope';

/**
 * THE GENERATION ANCHOR'S ONE OWNER (Sam's ruling, 2026-08-06).
 *
 * The anchor is a DECISION — the day the athlete's program was actually
 * generated — and it is written in exactly one place: by generation itself,
 * onto the program (`generateProgram.ts`). Every install door stamps the
 * persisted anchor THROUGH HERE, so the value can never be authored by a
 * caller's idea of today.
 *
 * Why this function exists rather than an inline read at each door: the two
 * install doors disagreed. `commitRebuiltProgram` stamped the anchor and
 * `programStore.setCurrentProgram` — the one ONBOARDING uses — did not, so a
 * world built by editing carried its anchor and a world built by onboarding
 * carried null. Boot then guessed today and re-anchored the whole program.
 * Two doors, one input, one of them silent: the ownership defect underneath
 * the symptom.
 */
export function generationAnchorForProgram(
  program: { generationAnchorISO?: string } | null | undefined,
): string | null {
  return program?.generationAnchorISO ?? null;
}

/** An old-shape envelope carries stored outputs; the new shape carries `inputs`. */
export function programEnvelopeIsOldShape(raw: string): boolean {
  try {
    const state = (JSON.parse(raw) as { state?: Record<string, unknown> }).state;
    if (!state || 'inputs' in state) return false;
    return 'currentProgram' in state || 'acceptedMaterialContext' in state;
  } catch {
    return false;
  }
}

/**
 * **THE ONE PROJECTION OF "WHAT THE PROGRAM STORE PERSISTS".**
 *
 * There were THREE copies of this field list and they had already drifted. The
 * two in this file carried `acceptedBlocks`; the third — the dev-E2E harness's
 * convergence check (`src/dev/e2e/devE2EPersistence.ts`), whose own docstring
 * says *"Mirrors `programStore`'s `partialize` field for field. If that list
 * ever grows a key, this one grows with it"* — did not, because it is in
 * another file and nothing made it grow.
 *
 * **MEASURED COST, on glass, 2026-08-18 at `main @ c2aaf313`:** the harness read
 * `acceptedBlocks` on disk and not in memory, refused the world as
 * *"Persisted semantic state did not converge: program-store"*, and **every
 * seeded Maestro flow in the repo — the entire simulator rig — died at the seed
 * step.** The projection is now a function, so a fourth copy cannot be written
 * by adding a key in one place; there is one place.
 *
 * Accepts BOTH shapes on purpose: a live store (fields at the top level) and an
 * already-reduced envelope's `state` (which carries `inputs`). One projection,
 * so the two sides of a convergence check cannot ask different questions.
 */
export function projectProgramPersistedInputs(
  state: Record<string, any>,
): Record<string, unknown> {
  const alreadyReduced = (state.inputs ?? null) as Record<string, unknown> | null;
  if (alreadyReduced) return alreadyReduced;
  const accepted = (state.acceptedMaterialContext ?? {}) as Record<string, unknown>;
  return {
    generationAnchorISO: state.generationAnchorISO ?? null,
    // ⚠ THE HYDRATED CLOCK IS THE THIRD ARM AND IT IS NOT DECORATION. `merge`
    // restores the persisted clock into `hydratedSeasonPhaseClock` while
    // `currentProgram` is still null — boot has not regenerated yet. Without
    // this arm a write in that window persists `null` over a clock that was
    // correctly restored one tick earlier. The storage adapter's copy always
    // had it; `partialize`'s copy did not, which is drift #2 in the same list.
    seasonPhaseClock: state.currentProgram?.seasonPhaseClock
      ?? state.hydratedSeasonPhaseClock ?? null,
    sessionFeedback: state.sessionFeedback ?? {},
    weightOverrides: state.weightOverrides ?? {},
    // A BLOCK'S OWN REQUIREMENT IS AN INPUT AND MUST OUTLIVE THE PROCESS.
    // The program is not persisted — boot REGENERATES — so if this is not
    // here it is gone by the first relaunch, and the boundary silently
    // stops progressing anything.
    acceptedBlocks: state.acceptedBlocks ?? {},
    temporarySourceFacts: accepted.temporarySourceFacts ?? [],
    injuryEpisodes: accepted.injuryEpisodes ?? [],
  };
}

/**
 * R1.3: reduce ANY outgoing program envelope to the inputs shape. Writers
 * that still serialise the fat output envelope (the transaction layer's
 * out-of-band persistence, zustand's post-migration write-back) converge to
 * inputs-only at this one door; writers already sending the new shape pass
 * through untouched.
 */
export function reduceProgramEnvelopeToInputs(value: string): string {
  try {
    const parsed = JSON.parse(value) as { state?: Record<string, any>; version?: unknown };
    const state = parsed.state;
    if (!state || 'inputs' in state) return value;
    return JSON.stringify({
      state: { inputs: projectProgramPersistedInputs(state) },
      version: parsed.version,
    });
  } catch {
    return value;
  }
}

async function parkThenReduceProgramEnvelope(name: string, value: string): Promise<string> {
  try {
    const onDisk = await programStorageGetItem(name);
    if (onDisk !== null && programEnvelopeIsOldShape(onDisk)) {
      const parked = await asyncStorageCompat.getItem(PRE_REBUILD_ENVELOPE_PARKING_KEY);
      if (parked === null) {
        await asyncStorageCompat.setItem(PRE_REBUILD_ENVELOPE_PARKING_KEY, onDisk);
      }
    }
  } catch {
    // Parking is insurance for R2; it must never block or fail a live write.
  }
  return reduceProgramEnvelopeToInputs(value);
}

const programStateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const trace = programHydrationTrace();
    try {
      // THE CLEAN-RESET DOOR (Sam, 2026-08-10: "kill it" → a stored world the
      // current code cannot read is RESET CLEAN and the athlete is told).
      //
      // HERE, and not deeper, for the same reason the power migration ran at
      // read ingress: this is the last point before an unreadable payload can
      // reach anything that might write it back half-understood. The difference
      // is the exit — the migration THREW (six sites), taking the app down at
      // boot rather than letting the athlete in. This returns null, so boot
      // proceeds exactly as a first run, and the telling is owed as a fact.
      const value = await readStoredWorldOrResetClean(
        name,
        await programStorageGetItem(name),
        new Date().toISOString(),
      );
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
  // The WHOLE body is tracked from the first tick: zustand voids this call,
  // and `flushPendingStorageWrites` must see the write during the park's
  // async prelude too, or the durability guarantee silently narrows.
  setItem: (name: string, value: string): Promise<void> =>
    trackDurableWrite(programStateStorageSetItemBody(name, value)),
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

async function programStateStorageSetItemBody(name: string, value: string): Promise<void> {
  {
    if (activeProgramPersistenceStage) {
      return;
    }
    // R1.3 (shell rebuild) — TWO LAWS AT THE ONE WRITER BOUNDARY:
    //
    // 1. PARK BEFORE THE FIRST OVERWRITE. zustand persists the migrated
    //    state back after rehydrating an old-version envelope, and the
    //    transaction layer writes envelopes out-of-band — either could be
    //    the write that destroys the only pre-rebuild copy. Whoever gets
    //    here first parks the old envelope byte-identical for R2.
    // 2. PERSISTED STATE IS INPUTS ONLY. Any writer still serialising the
    //    fat output envelope has it reduced to the inputs shape HERE, at
    //    the boundary — one door, every writer converges.
    value = await parkThenReduceProgramEnvelope(name, value);
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
  }
}

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

const LEGACY_DAY_NAMES: DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];


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
    activeConstraints?: readonly import('./coachUpdatesStore').ActiveConstraint[];
    profile?: OnboardingData | null;
    markedDays?: Readonly<Record<string, CalendarDayType>>;
    validateWeekStarts?: readonly string[];
    todayISO?: string;
  },
): Partial<ProgramState> {
  const effectiveTodayISO = options.todayISO ?? todayISOLocal();
  // THE WORLD ARRIVING, composed once for every door in this function. The
  // snapshot under hydration IS the evaluation context here; the live store
  // still holds the world being replaced.
  const hydratingSurfaces: AcceptedEffectiveWeekSurfaces =
    composeAcceptedEffectiveWeekSurfaces({
      currentProgram: persistedState.currentProgram ?? null,
      currentMicrocycle: persistedState.currentMicrocycle ?? null,
      dateOverrides: persistedState.dateOverrides ?? {},
      weekScopedOverlays: persistedState.weekScopedOverlays ?? {},
      // Nothing has consumed the arriving snapshot's removals yet, so the
      // record and the application input are the same list.
      removalDecisions: persistedState.userRemovalConstraints ?? [],
    });
  let currentProgram = persistedState.currentProgram ?? null;
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
  let currentMicrocycle = persistedState.currentMicrocycle;
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
                  ? !exposureContractV2
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
    // THE FLIP, MOVE (ii) — one read door. NOTE the asymmetry, preserved
    // exactly: the overlay is found by the week's MONDAY, the two microcycles
    // by the DATE itself. Collapsing the two onto one coordinate would be a
    // behaviour change wearing a refactor.
    return selectStoredWeekDeclaration({
      overlay: weekScopedOverlays?.[mondayForDate(date)],
      coveringMicrocycle: currentProgram?.microcycles.find((microcycle) =>
        microcycleCoversWeek(microcycle, date)),
      currentMicrocycle: microcycleCoversWeek(currentMicrocycle, date)
        ? currentMicrocycle
        : null,
      weekStart: mondayForDate(date),
      reader: 'programStore.safetyContractForDate',
    }) ?? undefined;
  };
  let dateOverrides = persistedState.dateOverrides
    ? Object.fromEntries(Object.entries(persistedState.dateOverrides).map(([date, workout]) => [
        date,
        {
          ...(!safetyContractForDate(date)
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
    // THE FLIP, MOVE (ii) — one read door. `baseMicrocycle` above already
    // folds the current-microcycle fallback in, so this caller has two.
    const contract = selectStoredWeekDeclaration({
      overlay,
      coveringMicrocycle: baseMicrocycle,
      weekStart,
      reader: 'programStore.validateHydratedWeeks',
    });
    if (!contract) continue;

    const rebased = rebaseAcceptedEffectiveWeek({
      surfaces: composeAcceptedEffectiveWeekSurfaces({
        currentProgram,
        currentMicrocycle,
        dateOverrides: dateOverrides ?? {},
        weekScopedOverlays: weekScopedOverlays ?? {},
        removalDecisions: persistedState.userRemovalConstraints ?? [],
      }),
      weekStart,
      profile: options.profile,
      markedDays: options.markedDays ?? {},
    });
    const effectiveByDate = new Map<string, Workout>(
      rebased.dates.flatMap((entry) => entry.workout ? [[entry.date, entry.workout]] : []),
    );
    /* THE FALLBACK-WEEK BUILDER IS GONE. It existed only to hand §18 a second
     * week to try when it refused the first, and §18 no longer takes one. */
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
        surfaces: hydratingSurfaces,
        resolveVisibleWorkouts: (candidateWorkouts: readonly Workout[]) =>
          require('../rules/section18AcceptedWeekGateway').resolveFinalVisibleSection18Week({
            contract,
            workouts: candidateWorkouts,
            weekStart,
            profile: options.profile,
            scheduleState: { markedDays: { ...(options.markedDays ?? {}) } },
            surfaces: hydratingSurfaces,
          }),
      });
    // R5.3 RESIDUAL PROBE (Sam's ruling, 2026-08-06: the residual is
    // INSTRUMENTED BEFORE FIXING). An INSTRUMENT, not a gate — prints only
    // under R53_PROBE=1 and is inert otherwise. What it answers: when the
    // derived bye week is a core-conditioning session short, does the gateway
    // repair it and the repair fail to reach the read, or does the gateway
    // return the shortfall unrepaired?
    if (process.env.R53_PROBE === '1') {
      const ev = accepted.evaluation as unknown as {
        blockingViolations?: { code: string }[];
        advisoryViolations?: { code: string }[];
      };
      // `process.stdout` deliberately, not `console.log`: the suites that reach
      // this path wrap their doors in `quiet()`, which replaces the console.
      process.stdout.write('[R53_PROBE] gateway ' + JSON.stringify({
        weekStart,
        mode: accepted.contract?.identity?.mode,
        status: accepted.status,
        attempts: accepted.attempts,
        repairs: (accepted.repairs ?? []).map((r: { kind: string }) => r.kind),
        blocking: (ev.blockingViolations ?? []).map((v) => v.code),
        advisory: (ev.advisoryViolations ?? []).map((v) => v.code),
        coreMin: accepted.contract?.conditioning?.core?.requiredMinimum,
        anchors: (accepted.contract?.anchors ?? [])
          .map((a: { kind: string; dayOfWeek: number }) => `${a.kind}@${a.dayOfWeek}`),
        canonicalByDay: accepted.canonicalWorkouts
          .map((w: Workout) => `${w.dayOfWeek}:${w.name}`),
        hadOverlay: !!overlay,
      }) + '\n');
    }
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
      // A RE-DERIVATION CARRIES WHAT POINTED AT IT, OR IT IS A DELETION.
      //
      // This loop overwrites the day with the week the gateway just re-derived,
      // and the re-derivation does not carry `derivedSessionProvenance`. So a
      // dependency the PROPOSAL held — "this Monday exists because of Sunday's
      // game" — was destroyed at commit time, silently, on every path that
      // re-gates a hydrated week.
      //
      // IT WAS INVISIBLE FOR ONE REASON ONLY: `section18CraftTier` fabricated
      // neighbouring fixtures at ±7 days, so the re-derived Monday happened to
      // be a G+1 day and minted its own record. Three attempts to delete that
      // phantom were reverted for "losing the link"; measured in both arms, the
      // link is derived MORE often without it (30 vs 23) and dies here.
      // `docs/FIXTURE_AUTHORITY_CENSUS_2026-08-12.md` §7-§12.
      //
      // CARRIED, NOT RESURRECTED. Only records the CURRENT fixture authority
      // still supports travel: `buildDerivedSessionExpiryCandidates` is the one
      // owner of "is this record still valid", and it is asked here rather than
      // re-answered. A record whose fixture is gone is left to expire exactly as
      // it does today — this restores history that survived, it does not keep
      // stale history alive.
      //
      // SAME CLASS AS `LAW-rename-carries-its-references`, second sighting in
      // one day: there a seed stabiliser renamed rows and orphaned the block
      // that pointed at them; here a canonicaliser rebuilds a week and drops the
      // provenance pointing into it.
      const after = carryProvenanceThroughRegate({
        before,
        after: acceptedByDay.get(dayOfWeek) ?? null,
        contract: accepted.contract,
        weekStart,
        activeFixtureDates,
      });
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
      ? !safetyContractForDate(effectiveTodayISO)
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
/**
 * Carry a day's still-valid provenance through a re-derivation.
 *
 * The gateway rebuilds a week from the contract and hands back canonical
 * workouts with no `derivedSessionProvenance`. Writing those over the proposal
 * deletes the history the proposal was carrying — which is a deletion wearing a
 * rebuild. See the call site for the founding case.
 *
 * WHAT TRAVELS: records the CURRENT fixture authority still supports. Validity
 * is not re-answered here — `buildDerivedSessionExpiryCandidates` already owns
 * that question, so it is asked, and anything it would expire is left behind to
 * expire. A record kept alive past its fixture would be the opposite defect.
 *
 * WHAT DOES NOT TRAVEL: anything, when either side is absent. A day the
 * re-derivation removed stays removed; provenance is not a reason to resurrect a
 * session, and inventing one here would put this function in the business of
 * deciding what the week holds.
 */
export function carryProvenanceThroughRegate(args: {
  before: Workout | null;
  after: Workout | null;
  contract: WeeklyExposureContractV2 | undefined;
  weekStart: string;
  activeFixtureDates?: ReadonlySet<string>;
}): Workout | null {
  const { before, after, contract } = args;
  if (!before || !after || !contract) return after;
  const carried = (before.derivedSessionProvenance ?? []).filter((record) => !!record.dependency);
  if (carried.length === 0) return after;
  if ((after.derivedSessionProvenance ?? []).some((record) => !!record.dependency)) return after;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { buildDerivedSessionExpiryCandidates } = require('../rules/derivedSessionProvenance');
  const probe = { ...after, derivedSessionProvenance: carried };
  const expiries = buildDerivedSessionExpiryCandidates({
    workouts: [probe],
    contract,
    weekStart: args.weekStart,
    activeFixtureDates: args.activeFixtureDates,
  });
  // MATCH THE OWNER'S ANSWER ON ITS OWN FIELDS. A `DerivedSessionExpiry` is
  // `{ planEntryId, workoutId, origin, scope, reason }` — there is no record id
  // on it, and the first version of this filter keyed on one, so NOTHING ever
  // expired and a record whose fixture was gone travelled anyway. The cell that
  // caught it is the "opposite defect" branch in
  // `derivedRepairOwnershipTests`.
  //
  // CONSERVATIVE BY CONSTRUCTION: candidates are ALTERNATIVES for the whole-week
  // owner to choose between, so if ANY of them would expire a record, it is not
  // carried. Choosing among candidates here would be this function re-answering
  // a question that already has an owner.
  const expiring = new Set<string>();
  for (const candidate of expiries) {
    for (const expiry of candidate.expiries ?? []) {
      expiring.add(`${expiry.origin}|${expiry.scope}|${expiry.planEntryId ?? ''}`);
    }
  }
  const surviving = carried.filter((record) =>
    !expiring.has(`${record.origin}|${record.scope}|${record.sourcePlanEntryId ?? ''}`));
  if (surviving.length === 0) return after;
  return { ...after, derivedSessionProvenance: surviving };
}

export function canonicaliseAcceptedStateCandidate(
  candidate: Partial<ProgramState>,
  options: AcceptedStateCandidateCanonicalisationOptions = {},
): Partial<ProgramState> {
  const accepted = canonicaliseAcceptedBoundaryState(candidate, options);
  return projectHydratedStateDerivedFields(accepted as Record<string, unknown>) as
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
  /** Per-item checklist evidence, including mobility/accessory participation. */
  executionItems?: import('../utils/sessionExecutionChecklist').SessionExecutionItemResult[];
  /** Session effort. Omitted for skipped sessions to avoid fake exertion data. */
  feeling?: FeedbackFeeling;
  /** Session effort, 1-10 — one scale for every input since 2026-08-12. */
  difficulty?: number;
  /**
   * HOW LONG A STRENGTH SESSION ACTUALLY TOOK, in minutes. Sam chose option (a)
   * on 2026-08-12: *"i think do a for now and I will think of if thats good
   * enough long term"*.
   *
   * With `difficulty` it makes strength sRPE (`rules/journalLoad.strengthSRPE`),
   * the fourth and last of the four kinds. PLANNED MINUTES ARE NOT ITS FALLBACK
   * — that was option (b) and he did not choose it. A session without this
   * answer is UNMEASURED, and substituting the planned value would make the
   * column look complete when it is not.
   */
  actualMinutes?: number;
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
  /** Measured duration and 1-10 effort for a performed Team Training component. */
  teamTraining?: import('../types/sessionOutcome').TeamTrainingSessionOutcome;
  /**
   * THE POST-GAME BODY-FEEL RATING — 1-10 since 2026-08-12, the design's "linchpin".
   *
   * Rides `SessionFeedback` for the same reason `teamNightSize` does: the app
   * already records a completed session per date through a transaction with a
   * receipt, and "Log Game" already routes into that flow via
   * `startFinished: true`. A second door for a per-session answer arriving at
   * the same moment would be a second representation of "what the athlete said
   * about this session".
   *
   * ONLY EVER SET ON A GAME. The flag that decides whether the question is asked
   * is the flag that decides whether the answer is sent, so the app cannot store
   * an answer to a question it did not put on the screen.
   */
  gameFeel?: import('../types/sessionOutcome').FeedbackGameFeel;
  /** Canonical complete match result for scheduled games and practice matches. */
  game?: import('../types/sessionOutcome').GameSessionOutcome;
  /**
   * "Did it match the prescription?" — the one-tap exception.
   *
   * THIS COMMENT USED TO SAY it was "the ONLY thing that records effort on a
   * strength session (`difficulty` is written from the conditioning RPE input
   * alone)". That stopped being true when the 1-10 scale landed: the panel
   * writes `difficulty` from the SESSION RPE whenever there is an execution
   * summary, which is the strength path. Corrected 2026-08-13 (seat item 18).
   *
   * NOT `feeling`, which answers how HARD it was. A very_hard session can be
   * exactly as expected; one field for both questions is the two-owners defect.
   */
  expectation?: import('../types/sessionOutcome').FeedbackExpectation;
  /**
   * Why it differed. Present only when `expectation` asks why — the three
   * non-`as_expected` answers. Absent is not "no reason": it means the question
   * was never put.
   */
  expectationReason?: import('../types/sessionOutcome').FeedbackExpectationReason;
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
   * R1.3 (shell rebuild) — INPUT-CLASS fields. The generation anchor is the
   * todayISO the program was last generated with (a fact: partial-week
   * boundaries depend on it), stamped by commitRebuiltProgram and persisted
   * in the inputs envelope so the quiescent boot regenerates the SAME
   * program. The hydrated clock is the persisted phase decision, restored by
   * merge for the boot's generation call.
   */
  generationAnchorISO?: string | null;
  hydratedSeasonPhaseClock?: SeasonPhaseClock | null;

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

  /**
   * THE STRENGTH SESSIONS EACH ACCEPTED BLOCK REQUIRED, KEYED BY BLOCK START.
   *
   * **Sam's ruling, 2026-08-17:** the block-boundary completion denominator is
   * *"the required strength sessions in the accepted block the athlete actually
   * received"*, with *"one durable owner at block acceptance"* that *"rollover
   * and restart read the same value"*.
   *
   * ⚠ **THIS IS A RECORDED FACT, NOT DERIVED STATE.** It cannot be re-derived
   * when it is needed, which is the whole reason it is stored: by the time the
   * boundary asks how much block N required, block N is gone. `quiescentBoot`
   * regenerates with `previousProgram: null` and nulls `blockState`, so a
   * read-time count answers 0 on every launch and un-raises every load the
   * boundary raised. Same family as `generationAnchorISO` — a value that rides
   * the program it describes because nothing else can testify to it later.
   *
   * ⚠ **ITS `blockNumber` IS WHY THIS RECORD IS NOT JUST A NUMBER.** Sam ruled,
   * 2026-08-18: *"the identity/number of the currently accepted block must be
   * persisted when that block is accepted and restored before boot regenerates
   * the program … Once Block 2 is accepted, restart must never infer or reset them
   * to Block 1."* Persisting `blockState` itself was tried and MEASURED RACY: it
   * is a derived surface that hydration sweeps, and the queued write that landed
   * last had already captured it as null, so a correct value reached disk and was
   * then overwritten. The identity therefore rides the record that is written ONCE,
   * at acceptance, in the same `setState` as the requirement — one write, one
   * moment, one owner, and it is measurably durable.
   *
   * WRITER: `recordAcceptedBlock`, called by the two acceptance doors
   * (`setCurrentProgram` and `weekRebuild.commitRebuiltProgram`) beside where each
   * already stamps `blockState`.
   * READERS: `weekRebuild` (rollover) and `quiescentBoot` (restart), each stating
   * it into generation's `progressionHistory` — the same map, so the same value.
   * Boot additionally restores WHICH block is current from
   * `currentAcceptedBlock`.
   * TEST: `test:athlete-journey`, `test:block-two-boot-preservation`.
   */
  acceptedBlocks: Record<string, AcceptedBlockRecord>;

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
      acceptedBlocks: {},

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
        // THE SECOND LOCK IS GONE (2026-08-10, Sam: "kill it"). It threw when a
        // program reached this boundary still carrying a legacy `powerBlock`,
        // and it was the write-side half of a migration that no longer exists.
        // There is nothing to be unmigrated with respect to any more: a world
        // the current code cannot read is reset at the read door, so a
        // legacy-shaped program never reaches a writer to be refused.
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
          // Installing a program the athlete just asked to be built.
          operation: 'forward_decision',
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
            // THE ANCHOR RIDES THE PROGRAM IT ANCHORS (Sam, 2026-08-06). This
            // is the door ONBOARDING installs a first program through, and it
            // was the only install door that did not stamp the anchor —
            // `commitRebuiltProgram` did (`weekRebuild.ts`), so a world built
            // by editing carried its anchor and a world built by onboarding
            // did not. One home, one value, read off the program: never a
            // caller's idea of today. `wornWorldBootTests` holds the line.
            generationAnchorISO: generationAnchorForProgram(validatedProgram),
          },
          validateWeekStarts: validatedProgram?.microcycles.map((microcycle) =>
            microcycle.startDate.slice(0, 10)) ?? [],
        });
        // THE BLOCK'S OWN REQUIREMENT, RECORDED WHERE ITS BLOCK STATE IS STAMPED.
        // After the transaction, so it records what was actually accepted rather
        // than what was offered to the transaction and possibly refused.
        recordAcceptedBlock({
          program: useProgramStore.getState().currentProgram,
          blockState: useProgramStore.getState().blockState,
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
          // A SELECTION publishes no new week content: the week it re-gates is
          // the one already accepted, and it reproduces exactly. So a blocker
          // here never means "the stored snapshot is corrupt" — it means the
          // athlete is opening the reduced week they themselves asked for, and
          // under the strict verdict they could not open it at all.
          operation: 'forward_decision',
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
          // Same family as the selection above.
          operation: 'forward_decision',
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
            // The athlete taking their own content off a day is the same
            // decision as putting it there, in the other direction.
            operation: 'forward_decision',
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
            // "A named act, on the tape, writer `reset`" — onboarding
            // completion, program create, profile reset. Every one of them is
            // something the athlete just did.
            operation: 'forward_decision',
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
          // An overlay is DERIVED content (the fixture-identity law, 7d9d3ee7):
          // republishing it replays no athlete decision, so it cannot be judged
          // as a corrupt snapshot.
          operation: 'forward_decision',
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
          // Derived content again — see `setWeekScopedOverlay`.
          operation: 'forward_decision',
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
          // Derived content again — see `setWeekScopedOverlay`.
          operation: 'forward_decision',
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
          acceptedBlocks: {},
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
      // R1.3 (shell rebuild, docs/SHELL_REBUILD_PLAN_2026-08-05.md):
      // PERSISTED STATE IS INPUTS ONLY. The envelope carries the phase clock
      // (an athlete decision), the fact slices (injury episodes + temporary
      // source facts, until R3 gives them their own input stores), and the
      // results (session feedback, weight overrides). Outputs — the program,
      // the accepted context, overlays, overrides — are DERIVED at boot
      // (store/quiescentBoot.ts) and never stored. The hydration-migration
      // category (ingress classification, legacy fact lifts, acceptance
      // transactions, canonical readback) ceased to exist with them; an
      // OLD-shape envelope is parked byte-identical for R2's one-time
      // migration by parkPreRebuildEnvelopeIfPresent, and restores nothing
      // here. quiescentBootTests holds the laws.
      migrate: (persistedState) => persistedState,
      // ⚠ **THE INPUT LIST HAD THREE COPIES AND NOW HAS ONE.** This is the
      // persist middleware's route; the storage adapter above
      // (`programStateStorage`) re-shapes a full state into the SAME envelope on
      // its own path, and the dev-E2E convergence check reads the same list a
      // third time. Adding a field to one and not the others persists it down
      // one route and drops it down another, which reads as "persistence is
      // flaky" — measured twice: the accepted-block requirement reached disk
      // from the adapter and was absent from here (block 1's entry survived a
      // relaunch and block 2's did not), and then reached disk from BOTH and was
      // absent from the harness (every seeded simulator flow refused to start).
      // `projectProgramPersistedInputs` is the one list.
      partialize: (state) => ({
        inputs: projectProgramPersistedInputs(state as unknown as Record<string, any>),
      }) as unknown as ProgramState,
      merge: (persisted, current) => {
        const inputs = (persisted as {
          inputs?: {
            generationAnchorISO?: string | null;
            seasonPhaseClock?: unknown;
            sessionFeedback?: Record<string, unknown>;
            weightOverrides?: Record<string, unknown>;
            acceptedBlocks?: Record<string, AcceptedBlockRecord>;
            temporarySourceFacts?: unknown[];
            injuryEpisodes?: unknown[];
          };
        } | undefined)?.inputs;
        if (!inputs) return { ...current };
        return {
          ...current,
          sessionFeedback: (inputs.sessionFeedback ?? {}) as ProgramState['sessionFeedback'],
          weightOverrides: (inputs.weightOverrides ?? {}) as ProgramState['weightOverrides'],
          acceptedBlocks: inputs.acceptedBlocks ?? {},
          generationAnchorISO: inputs.generationAnchorISO ?? null,
          hydratedSeasonPhaseClock: (inputs.seasonPhaseClock ?? null) as ProgramState['hydratedSeasonPhaseClock'],
          acceptedMaterialContext: normalizeAcceptedMaterialContext({
            ...current.acceptedMaterialContext,
            temporarySourceFacts: (inputs.temporarySourceFacts ?? []) as never,
            injuryEpisodes: (inputs.injuryEpisodes ?? []) as never,
          }),
        } as ProgramState;
      },
    },
  ),
);

/**
 * RECORD WHAT AN ACCEPTED BLOCK REQUIRED — the one writer, at block acceptance.
 *
 * Called by BOTH acceptance doors, beside where each already stamps `blockState`
 * off the accepted program: `setCurrentProgram` (the door onboarding and the
 * coach install through) and `weekRebuild.commitRebuiltProgram` (the door every
 * rebuild and the block rollover publish through). Two doors, one function, one
 * value — the shape `generationAnchorISO` already uses for the same reason.
 *
 * ⚠ **KEYED BY THE BLOCK'S OWN START, AND EARLIER BLOCKS ARE KEPT.** The
 * boundary asks about the block that just ENDED, so the map must still hold it
 * after the next block is accepted. Overwriting a single "current" number would
 * destroy the only copy of the answer at the exact moment it is needed.
 *
 * Re-accepting the same block start overwrites its entry, which is correct: a
 * rebuild republishes that block, and the republished week is what the athlete
 * actually received.
 */
export function recordAcceptedBlock(args: {
  program: TrainingProgram | null;
  blockState: StoredProgramBlockState | null;
}): void {
  if (!args.program || !args.blockState?.blockStartDate) return;
  const blockStartISO = args.blockState.blockStartDate.slice(0, 10);
  const blockNumber = Math.max(1, Math.floor(args.blockState.blockNumber ?? 1));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { deriveAcceptedBlockStrengthRequirement } = require('../rules/blockBoundaryProgression');
  const requiredStrengthSessions = deriveAcceptedBlockStrengthRequirement({
    program: args.program,
    blockStartISO,
    // The block's own four weeks. The window is compared against microcycle START
    // dates, so the last Monday is what has to fall inside it.
    blockEndISO: addDaysISO(blockStartISO, WEEKS_PER_BLOCK * 7 - 1),
  }) as number;
  if (requiredStrengthSessions <= 0) return;
  const existing = useProgramStore.getState().acceptedBlocks ?? {};
  const previous = existing[blockStartISO];
  if (previous?.blockNumber === blockNumber
    && previous?.requiredStrengthSessions === requiredStrengthSessions) return;
  useProgramStore.setState({
    acceptedBlocks: {
      ...existing,
      [blockStartISO]: { blockNumber, requiredStrengthSessions },
    },
  } as never);
}

/**
 * WHICH BLOCK THE ATHLETE IS CURRENTLY IN, from the accepted record alone.
 *
 * The most recently accepted block start — blocks are accepted in order, so the
 * greatest key is the current one. **This reads the athlete's own accepted
 * history and nothing else: it does not consult today's date, does not walk a
 * block grid, and returns null for a genuinely new athlete** (for whom block 1 is
 * the correct answer, arrived at by having no record rather than by a fallback).
 */
export function currentAcceptedBlock(
  accepted: Readonly<Record<string, AcceptedBlockRecord>> | null | undefined,
): StoredProgramBlockState | null {
  const starts = Object.keys(accepted ?? {}).sort();
  const latest = starts[starts.length - 1];
  if (!latest) return null;
  const record = (accepted ?? {})[latest];
  if (!record || typeof record.blockNumber !== 'number') return null;
  return { blockStartDate: latest, blockNumber: record.blockNumber };
}

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
  /**
   * REQUIRED, like the writer id above and for the same reason. Placing
   * content already declared `forward_decision`; REMOVING it and the named
   * erasure said nothing and inherited the strict verdict, so on a week the
   * athlete had made short they could neither undo their own edit nor run the
   * reset. Optional here meant "whichever the transaction happens to default
   * to", which is the one thing a door must never leave to its callee.
   */
  operation: 'forward_decision' | 'restoration';
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
    operation: args.operation,
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
 * ROLLBACK-ONLY: put the pin list back exactly as a snapshot found it.
 *
 * WHY IT LIVES HERE AND NOT AT THE CALLER. The coach executor's `add_session`
 * rollback has to restore three stores, and `userRemovalConstraints` is the
 * third — the pin minted by `commitAthleteSessionAdditionTransaction`. It was
 * restoring that one with a direct `useProgramStore.setState`, which made
 * `coachCommandExecutor` a SECOND LIVE WRITER of a persisted shape and reddened
 * `test:repo-law-guards` ("every persisted store has ONE live writer"). The
 * guard was right: the fix is to write through the store's own module, exactly
 * as `applyProgramOverrideWrite` below already does for overrides — not to
 * raise the debt allowance.
 *
 * DELIBERATELY NOT A GENERAL SETTER. It restores a list the caller captured
 * BEFORE its own failed write, so it cannot be used to author constraints —
 * only to un-author them. `writer` is required so the restore is attributable
 * in the same way every other sanctioned write is.
 */
export function restoreUserRemovalConstraintsWrite(args: {
  constraints: readonly UserRemovalConstraint[];
  writer: ProgramOverrideWriterId;
}): void {
  useProgramStore.setState({
    userRemovalConstraints: [...args.constraints],
  } as Partial<ProgramState> as never);
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
