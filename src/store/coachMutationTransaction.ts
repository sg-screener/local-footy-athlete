import type { ProgramState } from './programStore';
import {
  beginProgramPersistenceStage,
  endProgramPersistenceStage,
  persistProgramStoreEnvelopeDurably,
  readDurableProgramStoreEnvelope,
  restoreProgramStoreEnvelopeDurably,
  useProgramStore,
  type ProgramPersistenceStageToken,
} from './programStore';
import { useCalendarStore } from './calendarStore';
import { useReadinessStore } from './readinessStore';
import {
  restoreCoachUpdatesCompatibilityMirror,
  useCoachUpdatesStore,
} from './coachUpdatesStore';
import { useCoachMutationHistoryStore } from './coachMutationHistoryStore';
import { useCoachPreferencesStore } from './coachPreferencesStore';
import {
  asyncStorageDurable,
  beginAsyncStorageWriteStage,
  endAsyncStorageWriteStage,
  type AsyncStorageWriteStageToken,
} from './asyncStorageCompat';
import {
  buildSemanticProgramSnapshot,
  diffSemanticPrograms,
  semanticFingerprint,
  snapshotSemanticResolvedDay,
  type SemanticProgramDiff,
  type SemanticProgramSnapshot,
} from '../utils/programSemanticSnapshot';
import {
  buildDayWorkoutProjectedDay,
  buildProgramTabProjectedWeek,
} from '../utils/visibleProgramReadModel';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { logger } from '../utils/logger';
import {
  athleteActionDiagnosticsEnabled,
  beginAthleteActionTrace,
  currentAthleteActionTrace,
  runWithAthleteActionTrace,
  athleteActionTraceCoordinator,
  type AthleteActionTraceContext,
} from '../utils/athleteActionDiagnostics';
import {
  buildAthleteSemanticSnapshotV2,
  capturedTraceField,
  notApplicableTraceField,
  type AthleteSemanticStateV2,
} from '../dev/e2e/AthleteActionTraceCoordinator';
import { semanticFingerprintV2 } from '../utils/semanticFingerprintV2';

type AcceptedProgramStateSnapshot = Pick<
  ProgramState,
  | 'currentProgram'
  | 'currentMicrocycle'
  | 'todayWorkout'
  | 'blockState'
  | 'acceptedMaterialContext'
  | 'dateOverrides'
  | 'overrideContexts'
  | 'weekScopedOverlays'
  | 'userRemovalConstraints'
  | 'reversibleAdjustmentLedger'
  | 'exposureContractsByWeek'
  | 'sessionFeedback'
>;

interface AcceptedMirrorSnapshot {
  markedDays: ReturnType<typeof useCalendarStore.getState>['markedDays'];
  readinessSignalsByDate: ReturnType<typeof useReadinessStore.getState>['signalsByDate'];
  coachUpdatesByWeek: ReturnType<typeof useCoachUpdatesStore.getState>['updatesByWeek'];
  activeConstraints: ReturnType<typeof useCoachUpdatesStore.getState>['activeConstraints'];
  activeInjury: ReturnType<typeof useCoachUpdatesStore.getState>['activeInjury'];
  dismissedCoachNoteIds: ReturnType<typeof useCoachUpdatesStore.getState>['dismissedCoachNoteIds'];
  mutationHistoryEntries: ReturnType<typeof useCoachMutationHistoryStore.getState>['entries'];
  modalityPreferences: ReturnType<typeof useCoachPreferencesStore.getState>['modalityPreferences'];
}

export interface CoachMutationCandidateVerification {
  ok: boolean;
  reason?: string;
  details?: Record<string, unknown>;
}

export type CoachMutationTransactionResult<T> =
  | {
      ok: true;
      value: T;
      diff: SemanticProgramDiff;
      persistedEnvelope: string;
    }
  | {
      ok: false;
      value: T | null;
      route: string;
      reason: string;
      diff: SemanticProgramDiff | null;
      rollbackVerified: boolean;
    };

export class CoachMutationRollbackError extends Error {
  readonly code = 'coach_mutation_rollback_failed';

  constructor(message: string, public readonly cause: unknown) {
    super(message);
    this.name = 'CoachMutationRollbackError';
  }
}

let coachMutationQueue: Promise<void> = Promise.resolve();

const ACCEPTED_MIRROR_STORAGE_KEYS = [
  'calendar-storage',
  'readiness-store',
  'coach-updates',
  'coach-mutation-history-store',
  'coach-preferences-store',
] as const;

type AcceptedMirrorStorageKey = typeof ACCEPTED_MIRROR_STORAGE_KEYS[number];
type AcceptedMirrorEnvelopes = Record<AcceptedMirrorStorageKey, string | null>;

/**
 * Sole Coach acceptance owner. Legacy executors may temporarily publish a
 * candidate, but their automatic persistence is suppressed. Only a candidate
 * with a material semantic diff is durably accepted, projection-verified and
 * then allowed to produce a success response.
 */
export async function runCoachMutationTransaction<T>(args: {
  todayISO: string;
  extraDates?: readonly string[];
  /** Permit a durable accepted-envelope change with no visible program diff. */
  allowAcceptedStateOnlyChange?: boolean;
  /** Permit an identical semantic retry and re-acknowledge the durable envelope. */
  allowIdempotentNoop?: boolean;
  mutate: () => T;
  didApply: (value: T) => boolean;
  verifyCandidate?: (args: {
    value: T;
    before: SemanticProgramSnapshot;
    after: SemanticProgramSnapshot;
    diff: SemanticProgramDiff;
  }) => CoachMutationCandidateVerification;
  verifyAfterPersistence?: (args: {
    value: T;
    before: SemanticProgramSnapshot;
    after: SemanticProgramSnapshot;
    diff: SemanticProgramDiff;
  }) => CoachMutationCandidateVerification | Promise<CoachMutationCandidateVerification>;
}): Promise<CoachMutationTransactionResult<T>> {
  const execute = (): Promise<CoachMutationTransactionResult<T>> => withCoachMutationLock(async () => {
    const trace = currentAthleteActionTrace();
    const preProgram = captureAcceptedProgramState();
    const preMirrors = captureAcceptedMirrors();
    const preDates = collectAcceptedDates(useProgramStore.getState(), args.extraDates ?? [], args.todayISO);
    const beforeProjection = captureSemanticProjection(preDates, args.todayISO);
    const token = beginProgramPersistenceStage();
    let mirrorToken: AsyncStorageWriteStageToken | null = null;
    let preEnvelope: string | null = null;
    let preMirrorEnvelopes: AcceptedMirrorEnvelopes | null = null;
    let durablePreStateRead = false;
    let value: T | null = null;
    let candidatePersisted = false;
    let diff: SemanticProgramDiff | null = null;

    try {
      mirrorToken = beginAsyncStorageWriteStage(ACCEPTED_MIRROR_STORAGE_KEYS);
      preEnvelope = await readDurableProgramStoreEnvelope();
      preMirrorEnvelopes = await readAcceptedMirrorEnvelopesDurably();
      durablePreStateRead = true;
      if (trace && athleteActionDiagnosticsEnabled()) {
        const semantic = captureTraceSemanticSnapshot(preProgram, preMirrors);
        athleteActionTraceCoordinator.recordBefore({
          token: trace,
          semantic,
          visibleCard: beforeProjection.program,
          visibleDetail: beforeProjection.detailDays,
          persistedEnvelope: {
            program: preEnvelope,
            mirrors: preMirrorEnvelopes,
          },
        });
        athleteActionTraceCoordinator.recordPersistence(trace, {
          operation: 'read_before',
          store: 'program-store+accepted-mirrors',
          attempted: true,
          acknowledged: true,
          expectedFingerprint: notApplicableTraceField('pre-command read establishes the expected durable state'),
          actualFingerprint: capturedTraceField(semanticFingerprintV2({
            program: preEnvelope,
            mirrors: preMirrorEnvelopes,
          })),
        });
      }
      // Nothing may replace the visible state captured at command entry while
      // the durable read yields (notably late hydration in cold-start/tests).
      restoreAcceptedInMemory(preProgram, preMirrors);
      value = args.mutate();
      const afterDates = collectAcceptedDates(
        useProgramStore.getState(),
        [...preDates, ...(args.extraDates ?? [])],
        args.todayISO,
      );
      const afterProjection = captureSemanticProjection(afterDates, args.todayISO);
      diff = diffSemanticPrograms(beforeProjection.program, afterProjection.program);

      if (!args.didApply(value)) {
        const changed = completeAcceptedStateFingerprint() !== semanticFingerprint({
          program: preProgram,
          mirrors: preMirrors,
        });
        if (changed) {
          await restoreExactPreState({
            token,
            preProgram,
            preMirrors,
            preEnvelope,
            preMirrorEnvelopes,
            beforeProjection,
          });
        }
        return {
          ok: false,
          value,
          route: changed ? 'coach_mutation_executor_failed_rolled_back' : 'coach_mutation_not_applied',
          reason: changed
            ? 'The candidate changed accepted state before returning a failure.'
            : 'The deterministic executor did not apply a candidate.',
          diff,
          rollbackVerified: true,
        };
      }

      if (!diff.hasProgrammingChange) {
        const acceptedStateChanged = acceptedStateFingerprint() !==
          acceptedStateFingerprint(preProgram);
        const acceptedOnlyChangeAllowed =
          args.allowAcceptedStateOnlyChange && acceptedStateChanged;
        if (!acceptedOnlyChangeAllowed && !args.allowIdempotentNoop) {
          await restoreExactPreState({
            token,
            preProgram,
            preMirrors,
            preEnvelope,
            preMirrorEnvelopes,
            beforeProjection,
          });
          return {
            ok: false,
            value,
            route: 'coach_mutation_no_material_semantic_change',
            reason: 'Only presentation fields changed; no programming field changed.',
            diff,
            rollbackVerified: true,
          };
        }
        // Ledger status transitions (conflicted/superseded bookkeeping) are
        // accepted-state changes even though the visible program is intact.
      }

      const candidateVerification = args.verifyCandidate?.({
        value,
        before: beforeProjection.program,
        after: afterProjection.program,
        diff,
      });
      if (candidateVerification && !candidateVerification.ok) {
        await restoreExactPreState({
          token,
          preProgram,
          preMirrors,
          preEnvelope,
          preMirrorEnvelopes,
          beforeProjection,
        });
        return {
          ok: false,
          value,
          route: 'coach_mutation_semantic_verification_failed',
          reason: candidateVerification.reason ?? 'The semantic candidate did not match the accepted intent.',
          diff,
          rollbackVerified: true,
        };
      }

      const persistedEnvelope = await persistProgramStoreEnvelopeDurably(token);
      candidatePersisted = true;
      if (trace && athleteActionDiagnosticsEnabled()) {
        athleteActionTraceCoordinator.recordPersistence(trace, {
          operation: 'write_attempt',
          store: 'program-store',
          attempted: true,
          acknowledged: false,
          expectedFingerprint: capturedTraceField(semanticFingerprintV2(persistedEnvelope)),
          actualFingerprint: notApplicableTraceField('write acknowledgement requires readback'),
        });
      }
      const acknowledgedEnvelope = await readDurableProgramStoreEnvelope();
      if (acknowledgedEnvelope !== persistedEnvelope) {
        throw new Error('persisted_program_envelope_ack_mismatch');
      }
      if (trace && athleteActionDiagnosticsEnabled()) {
        athleteActionTraceCoordinator.recordPersistence(trace, {
          operation: 'readback',
          store: 'program-store',
          attempted: true,
          acknowledged: true,
          expectedFingerprint: capturedTraceField(semanticFingerprintV2(persistedEnvelope)),
          actualFingerprint: capturedTraceField(semanticFingerprintV2(acknowledgedEnvelope)),
        });
      }
      await persistAcceptedMirrorEnvelopesDurably(captureAcceptedMirrors());
      if (trace && athleteActionDiagnosticsEnabled()) {
        const mirrorEnvelopes = serializeAcceptedMirrorEnvelopes(captureAcceptedMirrors());
        athleteActionTraceCoordinator.recordPersistence(trace, {
          operation: 'mirror_readback',
          store: 'accepted-mirrors',
          attempted: true,
          acknowledged: true,
          expectedFingerprint: capturedTraceField(semanticFingerprintV2(
            serializeAcceptedMirrorEnvelopes(captureAcceptedMirrors()),
          )),
          // persistAcceptedMirrorEnvelopesDurably performs and verifies the
          // acknowledged readback before returning.
          actualFingerprint: capturedTraceField(semanticFingerprintV2(mirrorEnvelopes)),
        });
      }

      const postProjection = captureSemanticProjection(afterDates, args.todayISO);
      assertCardAndDetailProjectionEqual(postProjection);
      if (semanticFingerprint(postProjection.program) !== semanticFingerprint(afterProjection.program)) {
        throw new Error('semantic_projection_changed_after_persistence');
      }
      const postVerification = await args.verifyAfterPersistence?.({
        value,
        before: beforeProjection.program,
        after: postProjection.program,
        diff,
      });
      if (postVerification && !postVerification.ok) {
        throw new Error(postVerification.reason ?? 'post_persistence_verifier_failed');
      }

      if (trace && athleteActionDiagnosticsEnabled()) {
        athleteActionTraceCoordinator.recordAfter({
          token: trace,
          semantic: captureTraceSemanticSnapshot(),
          visibleCard: postProjection.program,
          visibleDetail: postProjection.detailDays,
        });
      }

      return { ok: true, value, diff, persistedEnvelope };
    } catch (error) {
      if (!token) throw error;
      try {
        await restoreExactPreState({
          token,
          preProgram,
          preMirrors,
          preEnvelope,
          preMirrorEnvelopes,
          beforeProjection,
          restoreDurable: durablePreStateRead && (candidatePersisted || isPersistenceFailure(error)),
        });
      } catch (rollbackError) {
        throw new CoachMutationRollbackError(
          `Coach mutation failed and exact rollback could not be verified: ${String((rollbackError as Error)?.message ?? rollbackError)}`,
          { mutationError: error, rollbackError },
        );
      }
      logger.warn('[coach-mutation-transaction] candidate rejected and rolled back', {
        error: error instanceof Error ? error.message : String(error),
        candidatePersisted,
      });
      if (trace && athleteActionDiagnosticsEnabled()) {
        // Diagnostics are fail-isolated: evidence collection can never change
        // the transaction result after the rollback owner has verified it.
        try {
          const restoredProjection = captureSemanticProjection(preDates, args.todayISO);
          const restoredProgramEnvelope = await readDurableProgramStoreEnvelope();
          const restoredMirrorEnvelopes = await readAcceptedMirrorEnvelopesDurably();
          athleteActionTraceCoordinator.recordRollback(trace, {
            memory: {
              expected: semanticFingerprintV2({ program: preProgram, mirrors: preMirrors }),
              actual: semanticFingerprintV2({
                program: captureAcceptedProgramState(),
                mirrors: captureAcceptedMirrors(),
              }),
              verified: completeAcceptedStateFingerprint() === semanticFingerprint({
                program: preProgram,
                mirrors: preMirrors,
              }),
            },
            programEnvelope: {
              expected: semanticFingerprintV2(preEnvelope),
              actual: semanticFingerprintV2(restoredProgramEnvelope),
              verified: restoredProgramEnvelope === preEnvelope,
            },
            mirrorEnvelopes: {
              expected: semanticFingerprintV2(preMirrorEnvelopes),
              actual: semanticFingerprintV2(restoredMirrorEnvelopes),
              verified: semanticFingerprintV2(restoredMirrorEnvelopes) ===
                semanticFingerprintV2(preMirrorEnvelopes),
            },
            visibleProjection: {
              expected: semanticFingerprintV2(beforeProjection),
              actual: semanticFingerprintV2(restoredProjection),
              verified: semanticFingerprint(restoredProjection.program) ===
                semanticFingerprint(beforeProjection.program),
            },
          });
        } catch {
          // The rollback itself has already been verified by restoreExactPreState.
        }
      }
      return {
        ok: false,
        value,
        route: isPersistenceFailure(error)
          ? 'coach_mutation_persistence_failed'
          : 'coach_mutation_post_apply_verification_failed',
        reason: error instanceof Error ? error.message : String(error),
        diff,
        rollbackVerified: true,
      };
    } finally {
      if (mirrorToken) endAsyncStorageWriteStage(mirrorToken);
      endProgramPersistenceStage(token);
    }
  });
  if (!athleteActionDiagnosticsEnabled()) return execute();
  const inherited = currentAthleteActionTrace();
  const trace: AthleteActionTraceContext = beginAthleteActionTrace({
    source: inherited?.source ?? 'system',
    actionType: inherited?.actionType ?? 'program_change',
    route: 'runCoachMutationTransaction',
    currentWeekId: inherited?.currentWeekId,
    sourceDate: inherited?.sourceDate,
    targetDate: inherited?.targetDate,
    sessionDate: inherited?.sessionDate,
    planEntryId: inherited?.planEntryId,
    workoutId: inherited?.workoutId,
    scope: inherited?.scope,
    sessionTier: inherited?.sessionTier,
    workoutType: inherited?.workoutType,
    fixtureId: inherited?.fixtureId,
    practiceMatchId: inherited?.practiceMatchId,
  }, inherited);
  return runWithAthleteActionTrace(trace, execute);
}

export function captureAcceptedProgramState(): AcceptedProgramStateSnapshot {
  const state = useProgramStore.getState();
  return clone({
    currentProgram: state.currentProgram,
    currentMicrocycle: state.currentMicrocycle,
    todayWorkout: state.todayWorkout,
    blockState: state.blockState,
    acceptedMaterialContext: state.acceptedMaterialContext,
    dateOverrides: state.dateOverrides,
    overrideContexts: state.overrideContexts,
    weekScopedOverlays: state.weekScopedOverlays,
    userRemovalConstraints: state.userRemovalConstraints,
    reversibleAdjustmentLedger: state.reversibleAdjustmentLedger,
    exposureContractsByWeek: state.exposureContractsByWeek,
    sessionFeedback: state.sessionFeedback,
  });
}

export function acceptedStateFingerprint(value = captureAcceptedProgramState()): string {
  return semanticFingerprint(value);
}

export function completeAcceptedStateFingerprint(): string {
  return semanticFingerprint({
    program: captureAcceptedProgramState(),
    mirrors: captureAcceptedMirrors(),
  });
}

async function restoreExactPreState(args: {
  token: ProgramPersistenceStageToken;
  preProgram: AcceptedProgramStateSnapshot;
  preMirrors: AcceptedMirrorSnapshot;
  preEnvelope: string | null;
  preMirrorEnvelopes: AcceptedMirrorEnvelopes | null;
  beforeProjection: SemanticProjectionSnapshot;
  restoreDurable?: boolean;
}): Promise<void> {
  restoreAcceptedInMemory(args.preProgram, args.preMirrors);
  if (args.restoreDurable !== false) {
    if (!args.preMirrorEnvelopes) throw new Error('missing_precommand_mirror_envelopes');
    await restoreProgramStoreEnvelopeDurably(args.token, args.preEnvelope);
    await restoreAcceptedMirrorEnvelopesDurably(args.preMirrorEnvelopes);
    const restoredEnvelope = await readDurableProgramStoreEnvelope();
    if (restoredEnvelope !== args.preEnvelope) throw new Error('durable_rollback_ack_mismatch');
    const restoredMirrors = await readAcceptedMirrorEnvelopesDurably();
    if (semanticFingerprint(restoredMirrors) !== semanticFingerprint(args.preMirrorEnvelopes)) {
      throw new Error('durable_mirror_rollback_ack_mismatch');
    }
  }
  const restoredAccepted = acceptedStateFingerprint();
  const expectedAccepted = acceptedStateFingerprint(args.preProgram);
  if (restoredAccepted !== expectedAccepted) {
    throw new Error(
      `accepted_state_rollback_mismatch:${firstDivergence(expectedAccepted, restoredAccepted)}`,
    );
  }
  const restoredMirrors = semanticFingerprint(captureAcceptedMirrors());
  const expectedMirrors = semanticFingerprint(args.preMirrors);
  if (restoredMirrors !== expectedMirrors) {
    throw new Error(
      `accepted_mirror_rollback_mismatch:${firstDivergence(expectedMirrors, restoredMirrors)}`,
    );
  }
  const restored = captureSemanticProjection(
    args.beforeProjection.dates,
    args.beforeProjection.todayISO,
  );
  const restoredVisible = semanticFingerprint(restored.program);
  const expectedVisible = semanticFingerprint(args.beforeProjection.program);
  if (restoredVisible !== expectedVisible) {
    throw new Error(
      `visible_semantic_rollback_mismatch:${firstDivergence(expectedVisible, restoredVisible)}`,
    );
  }
  assertCardAndDetailProjectionEqual(restored);
  const trace = currentAthleteActionTrace();
  if (trace && athleteActionDiagnosticsEnabled()) {
    athleteActionTraceCoordinator.recordRollback(trace, {
      memory: {
        expected: semanticFingerprintV2({ program: args.preProgram, mirrors: args.preMirrors }),
        actual: semanticFingerprintV2({
          program: captureAcceptedProgramState(),
          mirrors: captureAcceptedMirrors(),
        }),
        verified: true,
      },
      programEnvelope: args.restoreDurable === false
        ? { verified: true, status: 'not_applicable', reason: 'candidate was never durably written' }
        : { expected: semanticFingerprintV2(args.preEnvelope), verified: true },
      mirrorEnvelopes: args.restoreDurable === false
        ? { verified: true, status: 'not_applicable', reason: 'candidate mirrors were never durably written' }
        : { expected: semanticFingerprintV2(args.preMirrorEnvelopes), verified: true },
      visibleProjection: {
        expected: semanticFingerprintV2(args.beforeProjection),
        actual: semanticFingerprintV2(restored),
        verified: true,
      },
    });
  }
}

function restoreAcceptedInMemory(
  program: AcceptedProgramStateSnapshot,
  mirrors: AcceptedMirrorSnapshot,
): void {
  useCalendarStore.setState({ markedDays: clone(mirrors.markedDays) });
  useReadinessStore.setState({ signalsByDate: clone(mirrors.readinessSignalsByDate) });
  restoreCoachUpdatesCompatibilityMirror({
    updatesByWeek: clone(mirrors.coachUpdatesByWeek),
    activeConstraints: clone(mirrors.activeConstraints),
    activeInjury: clone(mirrors.activeInjury),
    dismissedCoachNoteIds: clone(mirrors.dismissedCoachNoteIds),
  });
  useCoachMutationHistoryStore.setState({ entries: clone(mirrors.mutationHistoryEntries) });
  useCoachPreferencesStore.setState({ modalityPreferences: clone(mirrors.modalityPreferences) });
  // Mirror-store subscriptions may publish a compatibility context revision.
  // Restore the authoritative accepted ProgramStore snapshot last so those
  // callbacks cannot become a second rollback owner.
  useProgramStore.setState(clone(program));
}

interface SemanticProjectionSnapshot {
  todayISO: string;
  dates: string[];
  program: SemanticProgramSnapshot;
  detailDays: ReturnType<typeof snapshotSemanticResolvedDay>[];
}

function captureSemanticProjection(
  dates: readonly string[],
  todayISO: string,
): SemanticProjectionSnapshot {
  const state = buildScheduleStateImperative();
  const overrides = useProgramStore.getState().overrideContexts;
  const uniqueDates = Array.from(new Set(dates.map((date) => date.slice(0, 10)))).sort();
  const weeks = Array.from(new Set(uniqueDates.map(mondayFor)));
  const cardDays = weeks.flatMap((mondayISO) => buildProgramTabProjectedWeek({
    mondayISO,
    todayISO,
    state,
    overrideContexts: overrides,
  })).filter((day) => uniqueDates.includes(day.date));
  const detailDays = uniqueDates.map((date) => snapshotSemanticResolvedDay(
    buildDayWorkoutProjectedDay({
      date,
      todayISO,
      state,
      overrideContext: overrides[date],
    }),
  ));
  return {
    todayISO,
    dates: uniqueDates,
    program: buildSemanticProgramSnapshot(cardDays),
    detailDays,
  };
}

function assertCardAndDetailProjectionEqual(snapshot: SemanticProjectionSnapshot): void {
  const cardByDate = new Map(snapshot.program.days.map((day) => [day.date, day]));
  for (const detail of snapshot.detailDays) {
    if (semanticFingerprint(cardByDate.get(detail.date) ?? null) !== semanticFingerprint(detail)) {
      throw new Error(`weekly_card_detail_semantic_mismatch:${detail.date}`);
    }
  }
}

function collectAcceptedDates(
  state: ProgramState,
  extras: readonly string[],
  todayISO: string,
): string[] {
  const weekStarts = new Set<string>();
  for (const microcycle of state.currentProgram?.microcycles ?? []) {
    weekStarts.add(microcycle.startDate.slice(0, 10));
  }
  if (state.currentMicrocycle) weekStarts.add(state.currentMicrocycle.startDate.slice(0, 10));
  for (const weekStart of Object.keys(state.weekScopedOverlays ?? {})) weekStarts.add(weekStart);
  for (const date of [
    ...Object.keys(state.dateOverrides ?? {}),
    ...extras,
    todayISO,
  ]) weekStarts.add(mondayFor(date));
  return Array.from(weekStarts).sort().flatMap((weekStart) =>
    Array.from({ length: 7 }, (_, offset) => addDays(weekStart, offset)));
}

function captureAcceptedMirrors(): AcceptedMirrorSnapshot {
  return clone({
    markedDays: useCalendarStore.getState().markedDays,
    readinessSignalsByDate: useReadinessStore.getState().signalsByDate,
    coachUpdatesByWeek: useCoachUpdatesStore.getState().updatesByWeek,
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    activeInjury: useCoachUpdatesStore.getState().activeInjury,
    dismissedCoachNoteIds: useCoachUpdatesStore.getState().dismissedCoachNoteIds,
    mutationHistoryEntries: useCoachMutationHistoryStore.getState().entries,
    modalityPreferences: useCoachPreferencesStore.getState().modalityPreferences,
  });
}

function serializeAcceptedMirrorEnvelopes(
  mirrors: AcceptedMirrorSnapshot,
): Record<AcceptedMirrorStorageKey, string> {
  return {
    'calendar-storage': JSON.stringify({
      state: { markedDays: mirrors.markedDays },
      version: 0,
    }),
    'readiness-store': JSON.stringify({
      state: { signalsByDate: mirrors.readinessSignalsByDate },
      version: 0,
    }),
    'coach-updates': JSON.stringify({
      state: {
        updatesByWeek: mirrors.coachUpdatesByWeek,
        activeConstraints: mirrors.activeConstraints,
        activeInjury: mirrors.activeInjury,
        dismissedCoachNoteIds: mirrors.dismissedCoachNoteIds,
      },
      version: 0,
    }),
    'coach-mutation-history-store': JSON.stringify({
      state: { entries: mirrors.mutationHistoryEntries },
      version: 0,
    }),
    'coach-preferences-store': JSON.stringify({
      state: { modalityPreferences: mirrors.modalityPreferences },
      version: 0,
    }),
  };
}

async function readAcceptedMirrorEnvelopesDurably(): Promise<AcceptedMirrorEnvelopes> {
  const entries = await Promise.all(ACCEPTED_MIRROR_STORAGE_KEYS.map(async (key) =>
    [key, await asyncStorageDurable.getItem(key)] as const));
  return Object.fromEntries(entries) as AcceptedMirrorEnvelopes;
}

async function persistAcceptedMirrorEnvelopesDurably(
  mirrors: AcceptedMirrorSnapshot,
): Promise<void> {
  const envelopes = serializeAcceptedMirrorEnvelopes(mirrors);
  try {
    for (const key of ACCEPTED_MIRROR_STORAGE_KEYS) {
      await asyncStorageDurable.setItem(key, envelopes[key]);
    }
    const acknowledged = await readAcceptedMirrorEnvelopesDurably();
    if (semanticFingerprint(acknowledged) !== semanticFingerprint(envelopes)) {
      throw new Error('accepted_mirror_persistence_ack_mismatch');
    }
  } catch (error) {
    throw new Error(
      `accepted_mirror_persistence_failed:${String((error as Error)?.message ?? error)}`,
    );
  }
}

async function restoreAcceptedMirrorEnvelopesDurably(
  envelopes: AcceptedMirrorEnvelopes,
): Promise<void> {
  for (const key of ACCEPTED_MIRROR_STORAGE_KEYS) {
    if (envelopes[key] === null) await asyncStorageDurable.removeItem(key);
    else await asyncStorageDurable.setItem(key, envelopes[key]!);
  }
}

function isPersistenceFailure(error: unknown): boolean {
  return (error as { code?: string })?.code === 'program_persistence_failed' ||
    /persist|storage|envelope/i.test(String((error as Error)?.message ?? error));
}

async function withCoachMutationLock<T>(task: () => Promise<T>): Promise<T> {
  const previous = coachMutationQueue;
  let release!: () => void;
  coachMutationQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    return await task();
  } finally {
    release();
  }
}

function clone<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function mondayFor(date: string): string {
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  parsed.setDate(parsed.getDate() - ((parsed.getDay() + 6) % 7));
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function addDays(date: string, offset: number): string {
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  parsed.setDate(parsed.getDate() + offset);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function firstDivergence(expected: string, actual: string): string {
  let index = 0;
  while (index < expected.length && index < actual.length && expected[index] === actual[index]) index++;
  return `${index}:expected=${expected.slice(Math.max(0, index - 40), index + 100)}:actual=${actual.slice(Math.max(0, index - 40), index + 100)}`;
}

function captureTraceSemanticSnapshot(
  program = captureAcceptedProgramState(),
  mirrors = captureAcceptedMirrors(),
) {
  const context = program.acceptedMaterialContext;
  const contracts = program.exposureContractsByWeek ?? {};
  const semanticState: AthleteSemanticStateV2 = {
    reversibleAdjustmentLedger: program.reversibleAdjustmentLedger,
    userRemovalConstraints: program.userRemovalConstraints,
    injuryEpisodes: context.injuryEpisodes,
    temporarySourceFacts: {
      injuryEpisodeIds: context.injuryEpisodes.map((episode) => ({
        id: episode.episodeId,
        status: episode.status,
      })),
      constraintFacts: context.activeConstraints.map((constraint) => ({
        id: constraint.id,
        type: constraint.type,
        status: constraint.status,
      })),
    },
    activeConstraints: context.activeConstraints,
    readiness: {
      accepted: context.readinessSignalsByDate,
      mirror: mirrors.readinessSignalsByDate,
    },
    sessionFeedback: program.sessionFeedback,
    coachNoteOwnership: {
      activeConstraintIds: context.activeConstraints.map((constraint) => constraint.id).sort(),
      injuryEpisodeIds: context.injuryEpisodes.map((episode) => episode.episodeId).sort(),
      dismissedCardIds: mirrors.dismissedCoachNoteIds,
    },
    overlays: program.weekScopedOverlays,
    overrides: {
      dateOverrides: program.dateOverrides,
      overrideContexts: program.overrideContexts,
    },
    contracts,
    provenance: collectSemanticMembers({
      currentProgram: program.currentProgram,
      currentMicrocycle: program.currentMicrocycle,
      overlays: program.weekScopedOverlays,
    }, /provenance/i),
    typedReductions: Object.entries(contracts).flatMap(([weekStart, contract]) =>
      ((contract as { authorisedReductions?: unknown[] }).authorisedReductions ?? [])
        .map((reduction) => ({ weekStart, reduction }))),
  };
  return buildAthleteSemanticSnapshotV2(semanticState, context.revision);
}

function collectSemanticMembers(value: unknown, keyPattern: RegExp): unknown[] {
  const collected: unknown[] = [];
  const visit = (current: unknown): void => {
    if (!current || typeof current !== 'object') return;
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      if (keyPattern.test(key)) collected.push({ key, value: child });
      else visit(child);
    }
  };
  visit(value);
  return collected;
}
