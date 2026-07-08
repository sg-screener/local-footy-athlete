/**
 * coachCommandExecutor — turns a `CoachCommand` (from coachCommandRouter)
 * into a verified `ExecutionResult`. The executor is the ONLY place that
 * mounts engines (orchestrateModalitySwap, applyCoachActions). It owns
 * the visible-progress story and the verification-before-reply rule.
 *
 * Hard rules:
 *   1. Reply text is ALWAYS derived from the engine's verified result —
 *      no canned "Done" strings unless the engine confirms the visible
 *      diff.
 *   2. Unsupported operations return mode='not_supported' with an
 *      honest reply. Never silently delegate to the LLM/legacy.
 *   3. clarify commands return verbatim the router's clarifier — the
 *      executor doesn't paraphrase.
 *   4. The executor is pure with respect to onProgress callbacks; all
 *      side effects pass through orchestrator/applyCoachActions.
 */

import type {
  CoachCommand,
  CoachCommandTarget,
  CoachCommandScope,
  CoachMutatePayload,
  CoachMutateOperation,
} from './coachCommandRouter';
import type { CoachReferenceResolution } from './coachReferenceResolver';
import {
  orchestrateModalitySwap,
  type ModalitySwapOutcome,
} from './coachModalitySwapOrchestrator';
import {
  applyAdjustmentEvents,
  applyMoveSession,
  type ApplyEventsResult,
  type ApplyOptions,
  type ApplyMoveSessionInput,
  type ApplyMoveSessionResult,
} from './applyAdjustmentEvents';
import type { AdjustmentEvent } from './programAdjustmentEngine';
import {
  verifyRenderedProgramMutation,
  verifyRenderedExerciseSwap,
  verifyRenderedSessionMove,
  type RenderedMutationVerification,
  type RenderedExerciseSwapVerification,
  type RenderedSessionMoveVerification,
  extractVisibleProgramItemsFromWorkout,
} from './visibleProgramReadModel';
import { EXERCISE_TAGS } from '../data/exerciseTags';
import {
  classifyPoolSlot,
  getSlotSiblings,
  findPoolEntry,
} from '../data/exercisePoolsStrength';
import {
  resolveWeekWithConditioning,
  getMondayForDate,
  type ResolvedDay,
  type ScheduleState,
} from './sessionResolver';
import { buildScheduleStateImperative } from './coachWeekDiff';
import {
  useCoachMutationHistoryStore,
  type MutationHistoryEntry,
  type RevertPlan,
  type DateOverrideSnapshot,
  type ModalityPreferenceSnapshot,
  type MutationKind,
  type MutationTouchedActivity,
} from '../store/coachMutationHistoryStore';
import {
  applyUndoPlan,
  readCurrentDateOverride,
  readCurrentDateOverrideMap,
  readCurrentCalendarMark,
  readCurrentModalityPreference,
  readCurrentModalityPreferenceMap,
  type ApplyUndoPlanResult,
  type ApplyUndoPlanDeps,
} from './coachUndoEngine';
import type { ModalityPreference } from '../store/coachPreferencesStore';
import { useProgramStore } from '../store/programStore';
import { useCalendarStore, type CalendarDayType } from '../store/calendarStore';
import type { Workout, OverrideContext } from '../types/domain';
import { logger } from './logger';
import {
  buildConditioningPrescription,
  chooseBestConditioningAddition,
  type CoachConditioningEditScope,
  type CoachConditioningEditMode,
  type CoachPlanChangeKind,
  type CoachTrainingIntent,
} from './coachPlan';

// ─── Public types ───────────────────────────────────────────────────

export type ExecutionResultKind =
  | 'mutated'
  | 'verified_no_op'              // engine ran but nothing changed (no matching session)
  | 'clarify'                     // router or engine asked for more info
  | 'rejected'                    // operation parsed but not allowed (e.g. past edits)
  | 'rejected_with_alternatives'  // safety violation; reply lists alternatives
  | 'not_supported'               // operation has no engine wired yet
  | 'conversation_delegated'      // router said `conversation` — caller rides legacy WITH packet
  | 'explain_delegated'           // legacy alias retained for back-compat
  | 'inspect_delegated'           // router said `inspect_state` — caller renders state
  | 'error';

export interface ExecutionResult {
  kind: ExecutionResultKind;
  /** Reply text. Always derived from the engine result; never canned. */
  reply: string;
  /** True only when the engine reported applied + verified. */
  applied: boolean;
  /** Categorical route label (matches the orchestrator's `route` for
   *  modality flows; otherwise a router-derived label). */
  route: string;
  /** Visible-progress stages the executor traversed in order. */
  progress: ProgressStage[];
  /** Forwarded engine outcome for the modality flows so the screen's
   *  debug overlay can keep showing the same fields it shows today. */
  modalityOutcome?: ModalitySwapOutcome;
  /** When kind === 'conversation_delegated' / 'explain_delegated', the
   *  caller may use this to tag the legacy text source for analytics. */
  delegationHint?: 'conversation' | 'explain' | 'inspect_state';
  /** For `rejected_with_alternatives`: structured rule violations the
   *  router decided made the action unsafe. */
  safetyConcerns?: string[];
  /** For `rejected_with_alternatives`: concrete next steps the athlete
   *  can pick from. The reply text already names the first alternative;
   *  the screen may render the rest as quick-reply chips. */
  suggestedAlternatives?: string[];
  /** For clarify: option chips, mirrored from the command. */
  options?: string[];
}

export type ProgressStage =
  | 'checking_program'
  | 'applying_change'
  | 'verifying_update'
  | 'composing_reply';

export interface ExecuteCoachCommandInput {
  command: CoachCommand;
  todayISO: string;
  /** Required for modality ops — re-passed through to the orchestrator. */
  referenceResolution: CoachReferenceResolution | null;
  /** The user's original message. Modality orchestrator re-parses for
   *  bike-label / "just this session" etc. */
  userMessage: string;
  /** Visible-progress callback — the screen wires these to UI strings:
   *  "Checking program…" / "Applying change…" / "Verifying update…". */
  onProgress?: (stage: ProgressStage) => void;
  /** Test seam — when present, the conditioning add/remove branch swaps
   *  in stub apply + verify functions instead of the live store path.
   *  Production code leaves this undefined. */
  conditioningDeps?: ConditioningMutationDeps;
  /** Test seam — same idea for the deterministic replace_exercise branch. */
  replaceExerciseDeps?: ReplaceExerciseDeps;
  /** Test seam — same idea for the deterministic move_session branch. */
  moveSessionDeps?: MoveSessionDeps;
  /** Test seam — same idea for adding/copying a session onto a Rest day. */
  addSessionDeps?: AddSessionDeps;
  /** Test seam — same idea for the deterministic remove_session branch. */
  removeSessionDeps?: RemoveSessionDeps;
  /** Test seam — bundled deps for undo recording + execution. Production
   *  leaves undefined; the executor reads/writes the live mutation
   *  history store and runs the live undo engine. */
  undoDeps?: UndoDeps;
}

/**
 * Dependency surface for the add/remove conditioning executor branch.
 * In production all four are undefined and the executor uses the live
 * store wiring (applyAdjustmentEvents → useProgramStore.setManualOverride
 * + verifyRenderedProgramMutation reading the same store).
 *
 * Tests inject stubs here so the branch can be exercised without
 * mounting Zustand stores or React state.
 */
export interface ConditioningMutationDeps {
  /** Replaces the live `applyAdjustmentEvents` call. */
  applyEvents?: (events: AdjustmentEvent[], opts: ApplyOptions) => ApplyEventsResult;
  /** Replaces `verifyRenderedProgramMutation` for the post-apply check. */
  verifyRendered?: (args: {
    requestedDay: string;
    todayISO: string;
    targetDate: string;
    beforeWorkout?: ResolvedDay['workout'] | null;
    expectedActivityTitle?: string | null;
  }) => RenderedMutationVerification;
  /** Snapshots the workout on the target date BEFORE the apply call.
   *  Used to populate `verifyRendered`'s `beforeWorkout` argument so
   *  the verification can compare before/after. Tests can stub. */
  snapshotBefore?: (targetDate: string) => ResolvedDay['workout'] | null;
  /** Optional post-apply snapshot for ProgramEdit invariant verification.
   *  Production leaves this undefined and reads the live visible program. */
  snapshotAfter?: (targetDate: string) => ResolvedDay['workout'] | null;
  /** Optional visible-week snapshot used to choose context-aware
   *  conditioning when the user asks for generic "conditioning". */
  snapshotWeek?: (targetDate: string) => ResolvedDay[];
  /** Replaces the live undo application when a post-apply verifier rejects
   *  the mutation. Production falls back to `applyUndoPlan`. */
  rollback?: (plan: RevertPlan, opts: { todayISO: string }) => ApplyUndoPlanResult;
  /** Optional ID generator for the AdjustmentEvent. Tests pin a value. */
  newEventId?: () => string;
}

/**
 * Dependency surface for the deterministic replace_exercise branch.
 * Mirrors `ConditioningMutationDeps` — production leaves all four
 * undefined and the executor uses the live store wiring; tests inject
 * stubs.
 */
export interface ReplaceExerciseDeps {
  /** Replaces the live `applyAdjustmentEvents` call. */
  applyEvents?: (events: AdjustmentEvent[], opts: ApplyOptions) => ApplyEventsResult;
  /** Replaces `verifyRenderedExerciseSwap` for the post-apply check. */
  verifyRendered?: (args: {
    requestedDay: string;
    todayISO: string;
    targetDate: string;
    fromName: string;
    toName: string;
  }) => RenderedExerciseSwapVerification;
  /** Snapshots the workout on the target date BEFORE the apply call so
   *  the executor can read the exercise list (for clarifier options
   *  + fuzzy source resolution + pronoun handling). */
  snapshotBefore?: (targetDate: string) => ResolvedDay['workout'] | null;
  /** Optional ID generator for the AdjustmentEvent. */
  newEventId?: () => string;
}

/**
 * Dependency surface for the deterministic move_session branch. Production
 * leaves all four undefined and the executor wires the live store path;
 * tests inject stubs to keep the harness pure.
 */
export interface MoveSessionDeps {
  /** Replaces `applyMoveSession` for the cross-date orchestration. */
  applyMove?: (input: ApplyMoveSessionInput, opts: ApplyOptions) => ApplyMoveSessionResult;
  /** Replaces `verifyRenderedSessionMove` for the post-apply check. */
  verifyRendered?: (args: {
    requestedDay: string;
    todayISO: string;
    sourceDate: string;
    destDate: string;
    movedSessionName: string;
  }) => RenderedSessionMoveVerification;
  /** Snapshots the workout on a given date — used to read the source's
   *  workoutType for the (executor-side) safety re-check, and for the
   *  reply-text composition. */
  snapshotBefore?: (date: string) => ResolvedDay['workout'] | null;
  /** Visible-week supplier for the missing-source / missing-dest
   *  clarifier — the executor lists ACTUAL session names by day rather
   *  than asking an open-ended question. */
  visibleWeek?: (mondayISO: string) => ResolvedDay[];
}

export interface RemoveSessionApplyResult {
  applied: boolean;
  reason?: string;
}

export interface RenderedRemoveSessionVerification {
  targetRemoved: boolean;
  otherDaysUnchanged: boolean;
  changedOtherDates: string[];
  beforeWorkoutName: string | null;
  afterWorkoutName: string | null;
}

export interface AddSessionApplyResult {
  applied: boolean;
  reason?: string;
}

export interface RenderedAddSessionVerification {
  targetAdded: boolean;
  otherDaysUnchanged: boolean;
  changedOtherDates: string[];
  beforeWorkoutName: string | null;
  afterWorkoutName: string | null;
}

export interface AddSessionDeps {
  applyAdd?: (
    input: { targetDate: string; sourceWorkout: Workout; reason?: string },
    opts: { todayISO: string },
  ) => AddSessionApplyResult;
  verifyRendered?: (args: {
    requestedDay: string;
    todayISO: string;
    targetDate: string;
    sourceWorkout: Workout;
    beforeWorkout: ResolvedDay['workout'] | null;
    afterWorkout: ResolvedDay['workout'] | null;
    visibleWeekBefore: ResolvedDay[];
    visibleWeekAfter: ResolvedDay[];
  }) => RenderedAddSessionVerification;
  snapshotBefore?: (date: string) => ResolvedDay['workout'] | null;
  snapshotAfter?: (date: string) => ResolvedDay['workout'] | null;
  visibleWeek?: (mondayISO: string) => ResolvedDay[];
  readCalendarMark?: (date: string) => CalendarDayType | null;
  rollback?: (snapshot: RemoveSessionRollbackSnapshot, opts: { todayISO: string }) => void;
}

/**
 * Dependency surface for the deterministic remove_session branch. The live
 * path clears any manual override for the target date, marks it as rest,
 * then verifies the rendered week before replying.
 */
export interface RemoveSessionDeps {
  applyRemove?: (
    input: { targetDate: string; targetSessionId?: string | null; reason?: string },
    opts: { todayISO: string },
  ) => RemoveSessionApplyResult;
  verifyRendered?: (args: {
    requestedDay: string;
    todayISO: string;
    targetDate: string;
    beforeWorkout: ResolvedDay['workout'] | null;
    afterWorkout: ResolvedDay['workout'] | null;
    visibleWeekBefore: ResolvedDay[];
    visibleWeekAfter: ResolvedDay[];
  }) => RenderedRemoveSessionVerification;
  snapshotBefore?: (date: string) => ResolvedDay['workout'] | null;
  snapshotAfter?: (date: string) => ResolvedDay['workout'] | null;
  visibleWeek?: (mondayISO: string) => ResolvedDay[];
  readCalendarMark?: (date: string) => CalendarDayType | null;
  rollback?: (snapshot: RemoveSessionRollbackSnapshot, opts: { todayISO: string }) => void;
}

/**
 * Dependency surface for mutation-history recording AND undo execution.
 * The two paths share a single seam because tests typically want to
 * stub both — record at the end of a mutation, read+revert at undo
 * time. Production leaves every field undefined and the executor uses
 * the live `coachMutationHistoryStore` + `coachUndoEngine`.
 */
export interface UndoDeps {
  /** Records a successful, verified mutation. Returns the entry. */
  recordMutation?: (
    entry: Omit<MutationHistoryEntry, 'id' | 'timestamp' | 'revertedAt'> & {
      id?: string;
      timestamp?: number;
    },
  ) => MutationHistoryEntry;
  /** Most recent non-reverted entry, or null when history is empty. */
  getLastUndoableMutation?: () => MutationHistoryEntry | null;
  /** Marks an entry as reverted. */
  markReverted?: (id: string, revertedAt?: number) => void;
  /** Runs a revert plan. Tests stub this to bypass the live undo engine. */
  applyUndo?: (
    plan: RevertPlan,
    opts: { todayISO: string; deps?: ApplyUndoPlanDeps },
  ) => ApplyUndoPlanResult;
  /** Reads the current dateOverride for a date. Used for snapshots. */
  readDateOverride?: (date: string) => {
    workout: Workout | null;
    context: OverrideContext | null;
  };
  /** Reads the current modality-preference entry for a session. */
  readPreference?: (sessionName: string) => {
    canonicalKey: string;
    entry: ReturnType<typeof readCurrentModalityPreference>['entry'];
  };
  /** Reads the entire current modality-preferences map (used for the
   *  preference-changes diff). */
  readPreferenceMap?: () => Record<
    string,
    NonNullable<ReturnType<typeof readCurrentModalityPreference>['entry']>
  >;
  /** Reads the entire current dateOverride + context map (used for the
   *  modality-orchestrator diff that identifies which dates the
   *  orchestrator's eager rewrite touched). */
  readDateOverrideMap?: () => Map<
    string,
    { workout: Workout | null; context: OverrideContext | null }
  >;
  /** Optional clock seam for deterministic record timestamps. */
  now?: () => number;
}

// ─── Public entry point ─────────────────────────────────────────────

export function executeCoachCommand(
  input: ExecuteCoachCommandInput,
): ExecutionResult {
  const { command } = input;
  const stages: ProgressStage[] = [];
  const tick = (stage: ProgressStage) => {
    stages.push(stage);
    try { input.onProgress?.(stage); } catch { /* swallow */ }
  };

  switch (command.mode) {
    case 'mutate':
      return executeMutate(input, stages, tick);

    case 'clarify':
      tick('composing_reply');
      return {
        kind: 'clarify',
        reply: command.question,
        applied: false,
        route: `clarify:${command.reason}`,
        progress: stages,
        options: command.options,
      };

    case 'reject':
    case 'reject_with_reason':
      tick('composing_reply');
      return {
        kind:
          (command.safetyConcerns && command.safetyConcerns.length > 0) ||
          (command.suggestedAlternatives && command.suggestedAlternatives.length > 0)
            ? 'rejected_with_alternatives'
            : 'rejected',
        reply: command.reply,
        applied: false,
        route: `reject:${command.reason}`,
        progress: stages,
        safetyConcerns: command.safetyConcerns,
        suggestedAlternatives: command.suggestedAlternatives,
      };

    case 'conversation':
    case 'explain':
      // Don't tick progress stages — the conversation path runs its own
      // animation. The caller delegates to /coach-chat WITH the full
      // coachContextPacket so the LLM is grounded in the visible week.
      return {
        kind: command.mode === 'explain' ? 'explain_delegated' : 'conversation_delegated',
        reply: '',
        applied: false,
        route: `conversation:${command.topic}`,
        progress: stages,
        delegationHint: command.mode === 'explain' ? 'explain' : 'conversation',
      };

    case 'inspect_state':
      // Same — caller composes reply from the visible week.
      return {
        kind: 'inspect_delegated',
        reply: '',
        applied: false,
        route: 'inspect_state',
        progress: stages,
        delegationHint: 'inspect_state',
      };
  }
}

// ─── Mutation routing ───────────────────────────────────────────────

function executeMutate(
  input: ExecuteCoachCommandInput,
  stages: ProgressStage[],
  tick: (s: ProgressStage) => void,
): ExecutionResult {
  const { command } = input;
  if (command.mode !== 'mutate') {
    // Unreachable; satisfies type narrowing.
    return {
      kind: 'error',
      reply: 'Internal error: executeMutate called on non-mutate command.',
      applied: false,
      route: 'internal_error',
      progress: stages,
    };
  }

  // Confidence / clarification gate — applies before we touch any engine.
  if (command.needsClarification) {
    tick('composing_reply');
    return {
      kind: 'clarify',
      reply: command.clarificationQuestion ?? 'Could you clarify which session?',
      applied: false,
      route: `clarify_needed:${command.operation}`,
      progress: stages,
      options: command.options,
    };
  }

  switch (command.operation) {
    case 'set_conditioning_modality_preference':
    case 'swap_conditioning_modality_once':
    case 'set_bike_subtype_preference':
      return runModalityOrchestrator(input, stages, tick);

    case 'add_conditioning':
    case 'remove_conditioning':
      return runConditioningMutation(input, stages, tick);

    case 'replace_exercise':
      return runReplaceExercise(input, stages, tick);

    case 'add_session':
      return runAddSession(input, stages, tick);

    case 'remove_session':
      return runRemoveSession(input, stages, tick);

    case 'move_session':
      return runMoveSession(input, stages, tick);

    case 'undo_last_change':
      return runUndoLastChange(input, stages, tick);
  }
}

// ─── Undo last change ──────────────────────────────────────────────
//
// Resolves the most recent non-reverted MutationHistoryEntry, runs its
// `RevertPlan` through the undo engine, then verifies the visible Program
// tab + DayWorkout projections returned to the snapshot. Reply text is
// derived ONLY from the verified result — failed undo never reports
// "Done."
//
// History bookkeeping:
//   * On full verification → markReverted(entry.id) so the next undo skips
//     this entry and undoes the one before it.
//   * On verification failure → leave the entry alone; the user can try
//     again or edit the program directly.
//
// The undo path itself is NOT recorded as a new mutation — the
// markReverted bit is the canonical signal that a mutation was reverted.

function runUndoLastChange(
  input: ExecuteCoachCommandInput,
  stages: ProgressStage[],
  tick: (s: ProgressStage) => void,
): ExecutionResult {
  const deps = input.undoDeps ?? {};
  const getLast =
    deps.getLastUndoableMutation ??
    (() => useCoachMutationHistoryStore.getState().getLastUndoableMutation());
  const apply = deps.applyUndo ?? applyUndoPlan;
  const markReverted =
    deps.markReverted ??
    ((id: string, ts?: number) =>
      useCoachMutationHistoryStore.getState().markReverted(id, ts));
  const now = deps.now ?? Date.now;

  tick('checking_program');
  const entry = (() => {
    try {
      return getLast();
    } catch (e) {
      logger.warn('[coach-command-executor] get_last_threw', {
        error: (e as Error)?.message ?? String(e),
      });
      return null;
    }
  })();

  if (!entry) {
    tick('composing_reply');
    return {
      kind: 'verified_no_op',
      reply: "I don't have a recent coach change to undo.",
      applied: false,
      route: 'no_history:undo_last_change',
      progress: stages,
    };
  }

  tick('applying_change');
  let undoResult: ApplyUndoPlanResult;
  try {
    undoResult = apply(entry.revertPlan, { todayISO: input.todayISO });
  } catch (e) {
    logger.warn('[coach-command-executor] apply_undo_threw', {
      entryId: entry.id,
      error: (e as Error)?.message ?? String(e),
    });
    tick('verifying_update');
    tick('composing_reply');
    return {
      kind: 'verified_no_op',
      reply:
        "I tried to undo that, but it didn't land in the visible program. " +
        "I'm not going to pretend it changed.",
      applied: false,
      route: 'undo_threw:undo_last_change',
      progress: stages,
    };
  }

  tick('verifying_update');
  logger.debug('[coach-command-executor] undo_complete', {
    entryId: entry.id,
    operation: entry.operation,
    affectedDates: entry.affectedDates,
    executed: undoResult.executed,
    fullyVerified: undoResult.verification.fullyVerified,
    perDateMatches: undoResult.verification.perDate.map((p) => ({
      date: p.date,
      matches: p.matches,
    })),
    preferenceMatches: undoResult.verification.preferenceMatches,
  });

  tick('composing_reply');
  if (!undoResult.executed || !undoResult.verification.fullyVerified) {
    return {
      kind: 'verified_no_op',
      reply:
        "I tried to undo that, but it didn't land in the visible program. " +
        "I'm not going to pretend it changed.",
      applied: false,
      route: 'verification_failed:undo_last_change',
      progress: stages,
    };
  }

  // Verified — mark the entry reverted so a follow-up "undo" doesn't try
  // to revert it again.
  try {
    markReverted(entry.id, now());
  } catch (e) {
    logger.warn('[coach-command-executor] mark_reverted_threw', {
      entryId: entry.id,
      error: (e as Error)?.message ?? String(e),
    });
  }

  return {
    kind: 'mutated',
    reply: 'Done - I undid the last change.',
    applied: true,
    route: `undo_last_change:applied:${entry.mutationKind}`,
    progress: stages,
  };
}

// ─── Mutation history recording helpers ────────────────────────────
//
// Every successful, verified mutation funnels through `recordVerifiedMutation`
// — the executor records ONLY when result.kind === 'mutated' and applied is
// true. Failed/verified-no-op turns are never persisted; the contract is
// "if it didn't land, it's not history".
//
// Each branch builds its RevertPlan from a small, branch-specific set of
// snapshots taken BEFORE the mutator runs:
//
//   * conditioning add/remove + replace_exercise → one date's
//     dateOverride snapshot.
//   * move_session → two dates (source + dest) — both are restored.
//   * modality orchestrator → diff before/after preferences map AND
//     before/after dateOverrides map; record only the keys that changed.
//
// On the modality path we deliberately read the live store *both* before
// and after the orchestrator runs, then diff. This is the cheapest correct
// way to capture eager-rewrite dates because the orchestrator can rewrite
// an arbitrary subset of the visible week without explicitly returning
// the list.

interface DateBeforeSnapshot {
  workout: Workout | null;
  context: OverrideContext | null;
}

function takeDateOverrideSnapshots(
  input: ExecuteCoachCommandInput,
  dates: string[],
): Map<string, DateBeforeSnapshot> {
  const deps = input.undoDeps ?? {};
  const read = deps.readDateOverride ?? readCurrentDateOverride;
  const m = new Map<string, DateBeforeSnapshot>();
  for (const d of dates) {
    try {
      m.set(d, read(d));
    } catch {
      m.set(d, { workout: null, context: null });
    }
  }
  return m;
}

function takeDateOverrideMapSnapshot(
  input: ExecuteCoachCommandInput,
): Map<string, DateBeforeSnapshot> {
  const deps = input.undoDeps ?? {};
  const read = deps.readDateOverrideMap ?? readCurrentDateOverrideMap;
  try {
    return read();
  } catch {
    return new Map();
  }
}

function takePreferenceMapSnapshot(
  input: ExecuteCoachCommandInput,
): Record<string, ModalityPreference> {
  const deps = input.undoDeps ?? {};
  const read = deps.readPreferenceMap ?? readCurrentModalityPreferenceMap;
  try {
    return read() as Record<string, ModalityPreference>;
  } catch {
    return {};
  }
}

function buildRevertPlanFromDateSnapshots(
  before: Map<string, DateBeforeSnapshot>,
  affectedDates: string[],
): RevertPlan {
  const dateOverrides: DateOverrideSnapshot[] = affectedDates.map((d) => {
    const snap = before.get(d) ?? { workout: null, context: null };
    return { date: d, workout: snap.workout, context: snap.context };
  });
  return { kind: 'restore_snapshot', dateOverrides };
}

function rollbackFailedConditioningMutation(
  input: ExecuteCoachCommandInput,
  beforeOverrideMap: Map<string, DateBeforeSnapshot>,
  affectedDates: string[],
  route: string,
): void {
  const plan = buildRevertPlanFromDateSnapshots(beforeOverrideMap, affectedDates);
  const rollback =
    input.conditioningDeps?.rollback ??
    ((revertPlan: RevertPlan, opts: { todayISO: string }) =>
      applyUndoPlan(revertPlan, opts));
  try {
    const result = rollback(plan, { todayISO: input.todayISO });
    logger.debug('[coach-command-executor] rollback_failed_conditioning_mutation', {
      route,
      affectedDates,
      executed: result.executed,
      fullyVerified: result.verification.fullyVerified,
    });
  } catch (e) {
    logger.warn('[coach-command-executor] rollback_failed_conditioning_mutation_threw', {
      route,
      affectedDates,
      error: (e as Error)?.message ?? String(e),
    });
  }
}

/** Cheap equality check between two ModalityPreference entries. Treats
 *  null and undefined as equal; ignores `createdAt` because timestamps
 *  drift even when intent didn't. */
function modalityPreferenceEqual(
  a: ModalityPreference | null | undefined,
  b: ModalityPreference | null | undefined,
): boolean {
  const aa = a ?? null;
  const bb = b ?? null;
  if (aa === null && bb === null) return true;
  if (aa === null || bb === null) return false;
  return (
    aa.from === bb.from &&
    aa.to === bb.to &&
    (aa.bikeLabel ?? null) === (bb.bikeLabel ?? null)
  );
}

function dateSnapshotsEqual(
  a: DateBeforeSnapshot | undefined,
  b: DateBeforeSnapshot | undefined,
): boolean {
  const aw = a?.workout ?? null;
  const bw = b?.workout ?? null;
  if (aw === null && bw === null) return true;
  if (aw === null || bw === null) return false;
  // Two overrides are "equal" for the purposes of the diff when their
  // names + workoutType match. Deep equality is overkill — the orchestrator
  // never rewrites a date to a workout with the same name + type.
  const an = (aw.name ?? '').trim().toLowerCase();
  const bn = (bw.name ?? '').trim().toLowerCase();
  if (an !== bn) return false;
  return (aw.workoutType ?? null) === (bw.workoutType ?? null);
}

interface ModalityDiff {
  changedDates: string[];
  changedPreferenceKey: string | null;
  beforePreferenceEntry: ModalityPreference | null;
  beforeDateMap: Map<string, DateBeforeSnapshot>;
}

function diffModalityChanges(args: {
  beforeDateMap: Map<string, DateBeforeSnapshot>;
  afterDateMap: Map<string, DateBeforeSnapshot>;
  beforePrefMap: Record<string, ModalityPreference>;
  afterPrefMap: Record<string, ModalityPreference>;
}): ModalityDiff {
  const { beforeDateMap, afterDateMap, beforePrefMap, afterPrefMap } = args;

  // Date diff — union of keys, then keep those whose snapshots differ.
  const dateUnion = new Set<string>([
    ...beforeDateMap.keys(),
    ...afterDateMap.keys(),
  ]);
  const changedDates: string[] = [];
  for (const d of dateUnion) {
    if (!dateSnapshotsEqual(beforeDateMap.get(d), afterDateMap.get(d))) {
      changedDates.push(d);
    }
  }
  changedDates.sort();

  // Preference diff — first key that differs wins. The orchestrator only
  // ever writes ONE preference per turn, so a single changed key covers
  // every supported modality outcome.
  let changedPreferenceKey: string | null = null;
  let beforePreferenceEntry: ModalityPreference | null = null;
  const prefUnion = new Set<string>([
    ...Object.keys(beforePrefMap),
    ...Object.keys(afterPrefMap),
  ]);
  for (const k of prefUnion) {
    if (!modalityPreferenceEqual(beforePrefMap[k], afterPrefMap[k])) {
      changedPreferenceKey = k;
      beforePreferenceEntry = beforePrefMap[k] ?? null;
      break;
    }
  }

  return {
    changedDates,
    changedPreferenceKey,
    beforePreferenceEntry,
    beforeDateMap,
  };
}

function recordVerifiedMutation(args: {
  input: ExecuteCoachCommandInput;
  result: ExecutionResult;
  operation: CoachMutateOperation;
  mutationKind: MutationKind;
  affectedDates: string[];
  touchedActivities?: MutationTouchedActivity[];
  scope: CoachCommandScope;
  revertPlan: RevertPlan;
}): void {
  const { input, result } = args;
  if (result.kind !== 'mutated' || !result.applied) return;
  const deps = input.undoDeps ?? {};
  const recordMutation =
    deps.recordMutation ??
    ((entry) =>
      useCoachMutationHistoryStore.getState().recordMutation(entry));
  const now = deps.now ?? Date.now;
  try {
    recordMutation({
      operation: args.operation,
      mutationKind: args.mutationKind,
      userMessage: input.userMessage,
      appliedReply: result.reply,
      affectedDates: args.affectedDates,
      touchedActivities: args.touchedActivities,
      scope: args.scope,
      revertPlan: args.revertPlan,
      timestamp: now(),
    });
    logger.debug('[coach-command-executor] recorded_mutation', {
      operation: args.operation,
      mutationKind: args.mutationKind,
      affectedDates: args.affectedDates,
      hasPreferenceSnap: !!args.revertPlan.modalityPreference,
    });
  } catch (e) {
    logger.warn('[coach-command-executor] record_mutation_threw', {
      operation: args.operation,
      error: (e as Error)?.message ?? String(e),
    });
  }
}

// ─── Modality orchestrator handoff ──────────────────────────────────

function runModalityOrchestrator(
  input: ExecuteCoachCommandInput,
  stages: ProgressStage[],
  tick: (s: ProgressStage) => void,
): ExecutionResult {
  tick('checking_program');

  // Snapshot BEFORE the orchestrator runs so we can diff afterwards. The
  // orchestrator may write a preference, eagerly rewrite future dates,
  // or both — diffing is the cheapest correct way to cover every shape.
  const beforeDateMap = takeDateOverrideMapSnapshot(input);
  const beforePrefMap = takePreferenceMapSnapshot(input);

  tick('applying_change');

  const outcome = orchestrateModalitySwap({
    userMessage: input.userMessage,
    todayISO: input.todayISO,
    referenceResolution: input.referenceResolution,
    parsedSwap: parsedModalitySwapFromCommand(input.command),
  });

  tick('verifying_update');

  // The orchestrator already returns a verified reply (Done / didn't land /
  // clarifier). The executor keeps that reply verbatim — it IS the
  // engine-derived truth.
  let kind: ExecutionResultKind;
  switch (outcome.kind) {
    case 'applied':
    case 'applied_preference':
      kind = 'mutated';
      break;
    case 'unparseable':
    case 'no_target':
    case 'ambiguous':
      kind = 'clarify';
      break;
    case 'verification_failed':
    case 'engine_rejected':
      kind = 'rejected';
      break;
    case 'no_match':
    default:
      kind = 'verified_no_op';
      break;
  }

  tick('composing_reply');
  logger.debug('[coach-command-executor] modality_outcome', {
    operation: input.command.mode === 'mutate' ? input.command.operation : null,
    outcomeKind: outcome.kind,
    route: outcome.route,
    applied: outcome.applied,
    referenceStatus: outcome.referenceStatus,
  });
  const result: ExecutionResult = {
    kind,
    reply: outcome.reply,
    applied: outcome.applied,
    route: outcome.route,
    progress: stages,
    modalityOutcome: outcome,
  };

  // Recording: diff the live store before/after to capture the
  // (potentially eager) writes the orchestrator made. We only record
  // when the executor's own classification is `mutated` AND the engine
  // reported applied — same gate the screen uses to render success.
  if (
    result.kind === 'mutated' &&
    result.applied &&
    input.command.mode === 'mutate'
  ) {
    const afterDateMap = takeDateOverrideMapSnapshot(input);
    const afterPrefMap = takePreferenceMapSnapshot(input);
    const diff = diffModalityChanges({
      beforeDateMap,
      afterDateMap,
      beforePrefMap,
      afterPrefMap,
    });

    // Build the revert plan from the diff. When neither dates nor prefs
    // changed (paranoid edge case), skip recording — there's nothing to
    // undo.
    if (diff.changedDates.length > 0 || diff.changedPreferenceKey != null) {
      const dateOverrides: DateOverrideSnapshot[] = diff.changedDates.map((d) => {
        const snap = beforeDateMap.get(d) ?? { workout: null, context: null };
        return { date: d, workout: snap.workout, context: snap.context };
      });
      let modalityPreference: ModalityPreferenceSnapshot | undefined;
      if (diff.changedPreferenceKey) {
        modalityPreference = {
          canonicalKey: diff.changedPreferenceKey,
          sessionName: diff.changedPreferenceKey,
          entry: diff.beforePreferenceEntry ?? null,
        };
      }
      const revertPlan: RevertPlan = {
        kind: 'restore_snapshot',
        dateOverrides,
        modalityPreference,
      };
      const op = input.command.operation;
      const mutationKind: MutationKind =
        op === 'set_conditioning_modality_preference'
          ? 'modality_preference'
          : op === 'set_bike_subtype_preference'
            ? 'bike_subtype_preference'
            : 'modality_swap_once';
      const affectedDates =
        diff.changedDates.length > 0
          ? diff.changedDates
          : outcome.targetDate
            ? [outcome.targetDate]
            : [];
      recordVerifiedMutation({
        input,
        result,
        operation: op,
        mutationKind,
        affectedDates,
        scope: input.command.scope,
        revertPlan,
      });
    } else {
      logger.debug('[coach-command-executor] modality_no_diff_skip_record', {
        outcomeKind: outcome.kind,
        targetDate: outcome.targetDate,
      });
    }
  }

  return result;
}

function parsedModalitySwapFromCommand(
  command: CoachCommand,
): Parameters<typeof orchestrateModalitySwap>[0]['parsedSwap'] {
  if (command.mode !== 'mutate') return null;
  if (
    command.operation === 'swap_conditioning_modality_once' &&
    command.payload.operation === 'swap_conditioning_modality_once'
  ) {
    return command.payload.to
      ? {
          from: command.payload.from,
          to: command.payload.to,
          toToken: command.payload.to === 'ski' ? 'ski erg' : command.payload.to,
          fromInferred: command.payload.from == null,
          bikeLabel: command.payload.bikeLabel ?? null,
          targetedSession: true,
        }
      : null;
  }
  if (
    command.operation === 'set_conditioning_modality_preference' &&
    command.payload.operation === 'set_conditioning_modality_preference'
  ) {
    return command.payload.to
      ? {
          from: command.payload.from,
          to: command.payload.to,
          toToken: command.payload.to === 'ski' ? 'ski erg' : command.payload.to,
          fromInferred: command.payload.from == null,
          bikeLabel: command.payload.bikeLabel ?? null,
          targetedSession: true,
        }
      : null;
  }
  if (
    command.operation === 'set_bike_subtype_preference' &&
    command.payload.operation === 'set_bike_subtype_preference'
  ) {
    return {
      from: 'bike' as any,
      to: 'bike' as any,
      toToken: command.payload.bikeLabel === 'assault' ? 'assault bike' : 'bike',
      fromInferred: false,
      bikeLabel: command.payload.bikeLabel,
      targetedSession: true,
    };
  }
  return null;
}

// ─── Add / remove conditioning via applyAdjustmentEvents ────────────
//
// Both ops share the same shape: build a single AdjustmentEvent
// (`add_conditioning_block` or `remove_conditioning_block`) on the
// resolved target date, run the existing applyAdjustmentEvents path,
// then verify with verifyRenderedProgramMutation against BOTH the
// Program-tab projection AND the DayWorkout projection. Reply text is
// derived ONLY from the verified result — nothing canned.
//
// The router is responsible for emitting `needsClarification` when the
// target is unbound; that is gated upstream of this function. We still
// defensively short-circuit if target.kind !== 'date' (e.g. unbound /
// last_change / session_name without a date) so a pathological command
// turns into a clarify, not a fake "Done".

function runConditioningMutation(
  input: ExecuteCoachCommandInput,
  stages: ProgressStage[],
  tick: (s: ProgressStage) => void,
): ExecutionResult {
  const { command } = input;
  if (command.mode !== 'mutate') {
    return {
      kind: 'error',
      reply: 'Internal error: runConditioningMutation called on non-mutate command.',
      applied: false,
      route: 'internal_error',
      progress: stages,
    };
  }
  if (command.operation !== 'add_conditioning' && command.operation !== 'remove_conditioning') {
    return {
      kind: 'error',
      reply: 'Internal error: runConditioningMutation called on wrong operation.',
      applied: false,
      route: 'internal_error',
      progress: stages,
    };
  }

  const targetDate = targetDateFor(command.target);
  if (!targetDate) {
    tick('composing_reply');
    return {
      kind: 'clarify',
      reply:
        command.operation === 'add_conditioning'
          ? 'Which day do you want me to add conditioning to?'
          : 'Which session should I remove conditioning from?',
      applied: false,
      route: `clarify_no_target:${command.operation}`,
      progress: stages,
    };
  }

  const deps: ConditioningMutationDeps = input.conditioningDeps ?? {};
  const applyEvents = deps.applyEvents ?? applyAdjustmentEvents;
  const verifyRendered = deps.verifyRendered ?? verifyRenderedProgramMutation;
  const snapshotBefore = deps.snapshotBefore ?? defaultSnapshotBefore;
  const snapshotWeek = deps.snapshotWeek ?? defaultSnapshotWeek;
  const newEventId =
    deps.newEventId ?? (() => `coach-cmd-${command.operation}-${targetDate}`);

  // ── Snapshot BEFORE apply so the verifier can detect the diff ───
  tick('checking_program');
  const beforeWorkout = snapshotBefore(targetDate);
  // Mutation-history snapshot — captures the prior dateOverride for the
  // target date so the undo engine can restore it. Independent of
  // beforeWorkout (which is the resolved-week projection used for visible
  // diff verification, not the raw override entry).
  const beforeOverrideMap = takeDateOverrideSnapshots(input, [targetDate]);

  // ── Build the AdjustmentEvent ───────────────────────────────────
  const modality =
    command.payload.operation === 'add_conditioning' ||
    command.payload.operation === 'remove_conditioning'
      ? command.payload.modality ?? null
      : null;
  let addSpec: AddConditioningEventSpec | null =
    command.operation === 'add_conditioning' &&
    command.payload.operation === 'add_conditioning'
	      ? {
	          modality,
	          customActivity: command.payload.customActivity,
	          intensity: command.payload.intensity,
	          durationMinutes: command.payload.durationMinutes,
	          sets: command.payload.sets,
	          repsMin: command.payload.repsMin,
	          repsMax: command.payload.repsMax,
	          restSeconds: command.payload.restSeconds,
	          prescriptionType: command.payload.prescriptionType,
	          bikeLabel: command.payload.bikeLabel,
	          effortKind: command.payload.effortKind,
	          replaceActivity: command.payload.replaceActivity,
	          trainingIntent: command.payload.trainingIntent,
	          changeKind: command.payload.changeKind,
	          editMode: command.payload.editMode,
	          editScope: command.payload.editScope,
	          targetItemId: command.payload.targetItemId,
	          overrideType: command.payload.overrideType,
	          setupChange: command.payload.setupChange,
	        }
      : null;
  const removeSpec: RemoveConditioningEventSpec | null =
    command.operation === 'remove_conditioning' &&
    command.payload.operation === 'remove_conditioning'
      ? {
          modality,
          targetItemId: command.payload.targetItemId,
        }
      : null;

  if (command.operation === 'add_conditioning' && addSpec) {
    if (command.scope === 'recurring' || addSpec.setupChange === true) {
      tick('composing_reply');
      return {
        kind: 'clarify',
        reply:
          'Do you want this as a one-off extra session, or should I update your weekly setup and rebuild the program?',
        applied: false,
        route: 'clarify_recurring_conditioning_add_requires_setup_scope',
        progress: stages,
        options: ['One-off extra session', 'Update weekly setup'],
      };
    }
    if (
      isEmptyTargetForStandaloneConditioningAdd({
        command,
        beforeWorkout,
        targetDate,
        snapshotWeek,
      })
    ) {
      const standaloneCommand: CoachCommand = {
        mode: 'mutate',
        operation: 'add_session',
        target: command.target,
        payload: {
          operation: 'add_session',
          sourceSessionName: addSpec.customActivity,
          targetSessionName: addSpec.customActivity,
          standaloneAddType: 'conditioning',
          overrideType: addSpec.overrideType ?? 'one_off_extra',
          setupChange: false,
          standaloneConditioning: {
            modality: addSpec.modality as any,
            customActivity: addSpec.customActivity,
            intensity: addSpec.intensity as any,
            durationMinutes: addSpec.durationMinutes,
            sets: addSpec.sets,
            repsMin: addSpec.repsMin,
            repsMax: addSpec.repsMax,
            restSeconds: addSpec.restSeconds,
            prescriptionType: addSpec.prescriptionType,
            bikeLabel: addSpec.bikeLabel as any,
            effortKind: addSpec.effortKind,
            trainingIntent: addSpec.trainingIntent,
          },
          reason: 'coach add standalone conditioning',
        },
        scope: command.scope,
        confidence: command.confidence,
        needsClarification: false,
        reason: 'add_conditioning_empty_day_to_standalone_session',
      };
      return runAddSession(
        {
          ...input,
          command: standaloneCommand,
        },
        stages,
        tick,
      );
    }
    if (isUnderspecifiedAddConditioningSpec(addSpec)) {
      const contextual = chooseBestConditioningAddition(targetDate, snapshotWeek(targetDate));
      if (contextual.kind === 'clarify') {
        tick('composing_reply');
        return {
          kind: 'clarify',
          reply: contextual.question,
          applied: false,
          route: `clarify_conditioning_category:${contextual.reason}`,
          progress: stages,
          options: contextual.options,
        };
      }
      addSpec = {
        ...addSpec,
        modality: contextual.modality,
        customActivity: contextual.title,
        intensity: contextual.intensity,
        durationMinutes: contextual.durationMinutes,
        sets: contextual.sets,
        repsMin: contextual.repsMin,
        repsMax: contextual.repsMax,
        restSeconds: contextual.restSeconds,
        prescriptionType: contextual.prescriptionType,
        effortKind: contextual.effortKind,
        trainingIntent: contextual.trainingIntent,
        description: contextual.description,
        notes: contextual.notes,
        conditioningFlavour: contextual.conditioningFlavour,
        conditioningCategory: contextual.category,
      };
    }
    const contract = completeConditioningEditContract({
      addSpec,
      beforeWorkout,
      targetDate,
    });
    if (contract.kind === 'clarify') {
      tick('composing_reply');
      return {
        kind: 'clarify',
        reply: contract.reply,
        applied: false,
        route: 'clarify_conditioning_source',
        progress: stages,
        options: contract.options,
      };
    }
    addSpec = contract.addSpec;
  }

  const event: AdjustmentEvent =
    command.operation === 'add_conditioning'
      ? buildAddConditioningEvent(targetDate, addSpec ?? { modality }, newEventId())
      : buildRemoveConditioningEvent(targetDate, newEventId(), removeSpec ?? { modality });
  const expectedActivityTitle =
    command.operation === 'add_conditioning' &&
    event.after &&
    typeof event.after === 'object'
      ? String((event.after as any).title ?? '').trim() || null
      : null;

  // ── Apply ──────────────────────────────────────────────────────
  tick('applying_change');
  const applyResult = applyEvents([event], {
    todayISO: input.todayISO,
    allowFutureWeeks: true,
    allowPastDates: false,
  });

  // ── Verify against the visible surfaces ────────────────────────
  tick('verifying_update');
  const verification = verifyRendered({
    requestedDay: targetDate,
    todayISO: input.todayISO,
    targetDate,
    beforeWorkout,
    expectedActivityTitle,
  });

  logger.debug('[coach-command-executor] conditioning_mutation', {
    operation: command.operation,
    targetDate,
    modality,
    customActivity: addSpec?.customActivity ?? null,
    intensity: addSpec?.intensity ?? null,
    editScope: addSpec?.editScope ?? null,
    appliedCount: applyResult.applied.length,
    rejectedCount: applyResult.rejected.length,
    rejectedKinds: applyResult.rejected.map((r) => r.kind),
    programTabProjectionHasConditioning: verification.programTabProjectionHasConditioning,
    dayWorkoutProjectionHasConditioning: verification.dayWorkoutProjectionHasConditioning,
    expectedActivityTitle: verification.expectedActivityTitle,
    programTabProjectionHasExpectedActivity: verification.programTabProjectionHasExpectedActivity,
    dayWorkoutProjectionHasExpectedActivity: verification.dayWorkoutProjectionHasExpectedActivity,
  });

  const result = composeConditioningResult({
    operation: command.operation,
    targetDate,
    modality,
    customActivity: addSpec?.customActivity,
    intensity: addSpec?.intensity,
    durationMinutes: addSpec?.durationMinutes,
    sets: addSpec?.sets,
    repsMin: addSpec?.repsMin,
    repsMax: addSpec?.repsMax,
    restSeconds: addSpec?.restSeconds,
    prescriptionType: addSpec?.prescriptionType,
    replaceActivity: addSpec?.replaceActivity,
    trainingIntent: addSpec?.trainingIntent,
    changeKind: addSpec?.changeKind,
    editScope: addSpec?.editScope,
    removeTargetItemId: removeSpec?.targetItemId,
    removeTargetTitle: removeSpec?.targetItemId
      ? visibleConditioningSources(beforeWorkout).find((source) => source.id === removeSpec.targetItemId)?.title
      : undefined,
    targetedRemoveVerification: removeSpec?.targetItemId
      ? verifyTargetedRemoveConditioningMutation({
          beforeWorkout,
          afterWorkout: deps.snapshotAfter
            ? deps.snapshotAfter(targetDate)
            : input.conditioningDeps
            ? null
            : snapshotBefore(targetDate),
          targetItemId: removeSpec.targetItemId,
        })
      : undefined,
    applyResult,
    verification,
    expectedActivityTitle,
    isDurationCorrection: /(?:last_add_duration_correction|last_add_sprint_duration_correction|named_activity_duration_adjustment|pending_duration_answer)/.test(command.reason ?? ''),
    stages,
    tick,
  });

  if (
    result.kind === 'mutated' &&
    result.applied &&
    command.operation === 'add_conditioning' &&
    addSpec?.editScope === 'edit_duration_only'
  ) {
    const afterWorkout = deps.snapshotAfter
      ? deps.snapshotAfter(targetDate)
      : input.conditioningDeps
      ? null
      : snapshotBefore(targetDate);
    const durationVerification = afterWorkout
      ? verifyDurationOnlyConditioningMutation({
          beforeWorkout,
          afterWorkout,
          targetItemId: addSpec.targetItemId,
          durationMinutes: addSpec.durationMinutes,
        })
      : { ok: true, reason: 'no_after_snapshot' };
    if (!durationVerification.ok) {
      rollbackFailedConditioningMutation(
        input,
        beforeOverrideMap,
        [targetDate],
        `duration_only_verification_failed:${durationVerification.reason}`,
      );
      return {
        kind: 'verified_no_op',
        reply: 'I couldn\'t safely update that duration. Which conditioning item should I change?',
        applied: false,
        route: `duration_only_verification_failed:${durationVerification.reason}`,
        progress: Array.from(new Set([...stages, 'verifying_update', 'composing_reply'])),
      };
    }
  }

  if (applyResult.applied.length > 0 && !result.applied) {
    rollbackFailedConditioningMutation(input, beforeOverrideMap, [targetDate], result.route);
  }

  // Record the mutation only if the executor confirmed it landed visibly
  // on both surfaces — failed/verified-no-op turns must NOT enter history.
  if (result.kind === 'mutated' && result.applied) {
    const revertPlan = buildRevertPlanFromDateSnapshots(beforeOverrideMap, [targetDate]);
    recordVerifiedMutation({
      input,
      result,
      operation: command.operation,
      mutationKind:
        command.operation === 'add_conditioning'
          ? 'add_conditioning'
          : 'remove_conditioning',
      affectedDates: [targetDate],
      touchedActivities:
        command.operation === 'add_conditioning'
          ? [
              {
                kind: 'conditioning',
                date: targetDate,
                sessionName:
                  command.target.kind === 'date'
                    ? command.target.sessionName
                    : undefined,
                title: expectedActivityTitle ?? addSpec?.customActivity ?? humanModality(modality ?? 'conditioning'),
                modality,
                intensity: addSpec?.intensity,
                durationMinutes: addSpec?.durationMinutes,
                sets: event.after && typeof event.after === 'object'
                  ? Number((event.after as any).sets ?? 0) || undefined
                  : undefined,
                repsMin: event.after && typeof event.after === 'object'
                  ? Number((event.after as any).repsMin ?? 0) || undefined
                  : undefined,
                repsMax: event.after && typeof event.after === 'object'
                  ? Number((event.after as any).repsMax ?? 0) || undefined
                  : undefined,
                prescriptionType: event.after && typeof event.after === 'object'
                  ? String((event.after as any).prescriptionType ?? '') || undefined
                  : undefined,
                bikeLabel: addSpec?.bikeLabel,
                effortKind: addSpec?.effortKind,
                trainingIntent: addSpec?.trainingIntent ?? (
                  event.after && typeof event.after === 'object'
                    ? String((event.after as any).trainingIntent ?? '') || undefined
                    : undefined
                ),
              },
            ]
          : undefined,
      scope: command.scope,
      revertPlan,
    });
  }

  return result;
}

function composeConditioningResult(args: {
  operation: 'add_conditioning' | 'remove_conditioning';
  targetDate: string;
  modality: string | null;
  customActivity?: string;
  intensity?: string;
  durationMinutes?: number;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  restSeconds?: number;
  prescriptionType?: 'duration' | 'duration_minutes';
  replaceActivity?: string;
  trainingIntent?: CoachTrainingIntent;
  changeKind?: CoachPlanChangeKind;
  editScope?: CoachConditioningEditScope;
  removeTargetItemId?: string;
  removeTargetTitle?: string;
  targetedRemoveVerification?: { ok: boolean; reason: string };
  applyResult: ApplyEventsResult;
  verification: RenderedMutationVerification;
  expectedActivityTitle: string | null;
  isDurationCorrection?: boolean;
  stages: ProgressStage[];
  tick: (s: ProgressStage) => void;
}): ExecutionResult {
  const {
    operation,
    targetDate,
    modality,
    customActivity,
    intensity,
    durationMinutes,
    sets,
    repsMin,
    repsMax,
    restSeconds,
    prescriptionType,
    replaceActivity,
    trainingIntent,
    changeKind,
    editScope,
    removeTargetItemId,
    removeTargetTitle,
    targetedRemoveVerification,
    applyResult,
    verification,
    expectedActivityTitle,
    isDurationCorrection,
    stages,
    tick,
  } = args;
  const niceDate = humanDate(targetDate);

  // 1. Engine rejected the event outright.
  if (applyResult.applied.length === 0) {
    tick('composing_reply');
    const reasonText = honestRejectReason(applyResult, operation, niceDate);
    return {
      kind: 'verified_no_op',
      reply: reasonText,
      applied: false,
      route: `apply_rejected:${operation}`,
      progress: stages,
    };
  }

  // 2. Apply succeeded — verify the visible surface actually moved.
  const wantsConditioning = operation === 'add_conditioning';
  const expectedActivityVerified =
    !!expectedActivityTitle &&
    (verification.programTabProjectionHasExpectedActivity === true ||
      verification.dayWorkoutProjectionHasExpectedActivity === true);
  const visibleConditioningVerified =
    verification.afterHasConditioning === true ||
    verification.programTabProjectionHasConditioning === true ||
    verification.dayWorkoutProjectionHasConditioning === true ||
    expectedActivityVerified;
  const addVerified =
    visibleConditioningVerified;
  const removeVerified = removeTargetItemId
    ? targetedRemoveVerification?.ok === true
    : !visibleConditioningVerified &&
      verification.programTabProjectionHasConditioning === false &&
      verification.dayWorkoutProjectionHasConditioning === false;
  const fullyVerified = wantsConditioning ? addVerified : removeVerified;

  tick('composing_reply');
  if (!fullyVerified) {
    return {
      kind: 'verified_no_op',
      reply:
        operation === 'add_conditioning'
          ? `I tried to add conditioning on ${niceDate}, but I couldn't verify it in the visible program. ` +
            `Try editing that session directly - the apply layer didn't land it visibly.`
          : removeTargetItemId
          ? `I couldn't safely remove that conditioning item on ${niceDate}. Which item should I remove?`
          : `I removed the conditioning on ${niceDate}, but the visible program still shows it. ` +
            `Try editing that session directly - the apply layer didn't land it visibly.`,
      applied: false,
      route: removeTargetItemId
        ? `verification_failed:${operation}:${targetedRemoveVerification?.reason ?? 'targeted_remove'}`
        : `verification_failed:${operation}`,
      progress: stages,
    };
  }

  // 3. Fully verified — derive a concrete reply.
  const reply =
    operation === 'add_conditioning'
      ? buildAddedConditioningReply(niceDate, {
          modality,
          customActivity,
	          intensity,
	          durationMinutes,
      sets,
      repsMin,
      repsMax,
      restSeconds,
      prescriptionType,
      replaceActivity,
	          trainingIntent,
          changeKind,
	          editScope,
	          isDurationCorrection,
	        })
      : `Done. I removed the conditioning block from ${niceDate}.`;
  const removeReply = removeTargetItemId
    ? `Done. I removed ${removeTargetTitle ?? 'that conditioning item'} from ${niceDate}.`
    : `Done. I removed the conditioning block from ${niceDate}.`;
  return {
    kind: 'mutated',
    reply: operation === 'remove_conditioning' ? removeReply : reply,
    applied: true,
    route: `${operation}:applied`,
    progress: stages,
  };
}

interface AddConditioningEventSpec {
  modality: string | null;
  customActivity?: string;
  intensity?: string;
  durationMinutes?: number;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  restSeconds?: number;
  prescriptionType?: 'duration' | 'duration_minutes';
  bikeLabel?: string | null;
  effortKind?: 'sprint' | 'interval';
  replaceActivity?: string;
  trainingIntent?: CoachTrainingIntent;
  changeKind?: CoachPlanChangeKind;
  editMode?: CoachConditioningEditMode;
  editScope?: CoachConditioningEditScope;
  targetItemId?: string;
  description?: string;
  notes?: string;
  conditioningFlavour?: 'aerobic' | 'high-intensity' | 'tempo';
  conditioningCategory?: 'aerobic_base' | 'sprint' | 'vo2' | 'glycolytic' | 'tempo' | 'low_load';
  overrideType?: 'one_off_extra';
  setupChange?: boolean;
}

interface RemoveConditioningEventSpec {
  modality: string | null;
  targetItemId?: string;
}

function isUnderspecifiedAddConditioningSpec(spec: AddConditioningEventSpec): boolean {
  if (spec.editMode && spec.editMode !== 'append') return false;
  if (spec.replaceActivity || spec.targetItemId || spec.changeKind) return false;
  if (spec.trainingIntent || spec.effortKind || spec.intensity) return false;
  if (spec.modality) return false;
  if (spec.durationMinutes || spec.sets || spec.repsMin || spec.repsMax || spec.restSeconds) return false;
  const title = normalisedConditioningTitle(spec.customActivity ?? '');
  return title === '' || title === 'conditioning';
}

function isEmptyTargetForStandaloneConditioningAdd(args: {
  command: Extract<CoachCommand, { mode: 'mutate' }>;
  beforeWorkout: ResolvedDay['workout'] | null;
  targetDate: string;
  snapshotWeek: (targetDate: string) => ResolvedDay[];
}): boolean {
  if (args.beforeWorkout && !isRemovedSessionProjection(args.beforeWorkout)) return false;
  if (args.beforeWorkout && isRemovedSessionProjection(args.beforeWorkout)) return true;
  const targetSessionName =
    args.command.target.kind === 'date'
      ? String(args.command.target.sessionName ?? '')
      : '';
  if (/\b(?:rest|empty|no\s+(?:s&c\s+)?session|no\s+workout)\b/i.test(targetSessionName)) {
    return true;
  }
  if (targetSessionName.trim() && !isGenericDateTargetLabel(targetSessionName)) {
    return false;
  }
  const weekTarget = args.snapshotWeek(args.targetDate).find((day) => day.date === args.targetDate);
  if (weekTarget && !weekTarget.workout) return true;
  if (weekTarget?.workout && isRemovedSessionProjection(weekTarget.workout)) return true;
  return false;
}

function isGenericDateTargetLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return (
    normalized === 'today' ||
    normalized === 'tomorrow' ||
    /^(mon|tue|wed|thu|fri|sat|sun)(day)?$/.test(normalized) ||
    /^[a-z]{3}\s+\d{4}-\d{2}-\d{2}$/.test(normalized)
  );
}

type ConditioningEditContractResult =
  | { kind: 'ok'; addSpec: AddConditioningEventSpec }
  | { kind: 'clarify'; reply: string; options?: string[] };

interface VisibleConditioningSource {
  id: string;
  title: string;
}

function completeConditioningEditContract(args: {
  addSpec: AddConditioningEventSpec;
  beforeWorkout: ResolvedDay['workout'] | null;
  targetDate: string;
}): ConditioningEditContractResult {
  const editMode =
    args.addSpec.editMode ??
    (args.addSpec.replaceActivity ? 'update_existing' : 'append');

  if (editMode !== 'update_existing') {
    return { kind: 'ok', addSpec: args.addSpec };
  }

  if (typeof args.addSpec.replaceActivity === 'string' && args.addSpec.replaceActivity.trim()) {
    if (args.addSpec.targetItemId) {
      const source = visibleConditioningSources(args.beforeWorkout).find((candidate) =>
        candidate.id === args.addSpec.targetItemId,
      );
      if (source) {
        return {
          kind: 'ok',
          addSpec: {
            ...args.addSpec,
            replaceActivity: source.title,
            customActivity:
              titleForImplicitConditioningUpdate(source.title, args.addSpec) ??
              args.addSpec.customActivity ??
              source.title,
          },
        };
      }
      return { kind: 'ok', addSpec: args.addSpec };
    }
    const sourceMatches = visibleConditioningSources(args.beforeWorkout).filter((source) =>
      normalisedConditioningTitle(source.title) ===
        normalisedConditioningTitle(args.addSpec.replaceActivity ?? '') ||
      activityTitleMatchesForExecutor(source.title, args.addSpec.replaceActivity ?? ''),
    );
    if (sourceMatches.length === 1) {
      const source = sourceMatches[0];
      return {
        kind: 'ok',
        addSpec: {
          ...args.addSpec,
          targetItemId: source.id,
          customActivity:
            titleForImplicitConditioningUpdate(source.title, args.addSpec) ??
            args.addSpec.customActivity ??
            source.title,
        },
      };
    }
    if (args.addSpec.editScope === 'edit_duration_only') {
      const niceDate = humanDate(args.targetDate);
      return {
        kind: 'clarify',
        reply: `Which conditioning piece on ${niceDate} should I change?`,
        options: sourceMatches.length > 1
          ? sourceMatches.map((source) => source.title)
          : visibleConditioningSources(args.beforeWorkout).map((source) => source.title),
      };
    }
    return { kind: 'ok', addSpec: args.addSpec };
  }

  const sources = visibleConditioningSources(args.beforeWorkout);
  const niceDate = humanDate(args.targetDate);
  if (sources.length === 1) {
    const source = sources[0];
    return {
      kind: 'ok',
      addSpec: {
        ...args.addSpec,
        targetItemId: source.id,
        replaceActivity: source.title,
        customActivity:
          titleForImplicitConditioningUpdate(source.title, args.addSpec) ??
          args.addSpec.customActivity ??
          source.title,
      },
    };
  }

  if (sources.length > 1) {
    return {
      kind: 'clarify',
      reply: `Which conditioning piece on ${niceDate} should I change?`,
      options: sources.map((source) => source.title),
    };
  }

  return {
    kind: 'clarify',
    reply:
      `I can do that, but I can't see a conditioning item on ${niceDate} to update. ` +
      `Which session or exercise should I change?`,
  };
}

function visibleConditioningSources(
  workout: ResolvedDay['workout'] | null,
): VisibleConditioningSource[] {
  const seen = new Set<string>();
  const out: VisibleConditioningSource[] = [];
  for (const item of extractVisibleProgramItemsFromWorkout(workout)) {
    if (item.domain !== 'conditioning' && item.domain !== 'recovery') continue;
    const title = String(item.title ?? '').trim();
    if (!title) continue;
    const key = title.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: item.id, title });
  }
  return out;
}

function activityTitleMatchesForExecutor(title: unknown, wanted: string): boolean {
  const left = normalisedConditioningTitle(String(title ?? ''));
  const right = normalisedConditioningTitle(String(wanted ?? ''));
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

interface VisibleDurationOnlyConditioningItem {
  id: string;
  title: string;
  modality: string | null;
  durationMinutes: number | null;
}

function verifyDurationOnlyConditioningMutation(args: {
  beforeWorkout: ResolvedDay['workout'] | null;
  afterWorkout: ResolvedDay['workout'] | null;
  targetItemId?: string;
  durationMinutes?: number;
}): { ok: boolean; reason: string } {
  const beforeItems = visibleDurationOnlyConditioningItems(args.beforeWorkout);
  const afterItems = visibleDurationOnlyConditioningItems(args.afterWorkout);
  const targetItemId = String(args.targetItemId ?? '').trim();
  if (!targetItemId) return { ok: false, reason: 'missing_target_item_id' };
  if (afterItems.length !== beforeItems.length) {
    return { ok: false, reason: 'duplicate_conditioning_created' };
  }
  const beforeTarget = beforeItems.find((item) => item.id === targetItemId);
  const afterTarget = afterItems.find((item) => item.id === targetItemId);
  if (!beforeTarget) return { ok: false, reason: 'duration_target_missing_before' };
  if (!afterTarget) return { ok: false, reason: 'duration_target_missing_after' };
  if (beforeTarget.modality !== afterTarget.modality) {
    return { ok: false, reason: 'duration_edit_changed_modality' };
  }
  if (
    normalisedConditioningDurationIdentity(beforeTarget.title) !==
    normalisedConditioningDurationIdentity(afterTarget.title)
  ) {
    return { ok: false, reason: 'duration_edit_changed_identity' };
  }
  if (
    args.durationMinutes != null &&
    afterTarget.durationMinutes !== args.durationMinutes
  ) {
    return { ok: false, reason: 'duration_edit_not_applied' };
  }
  return { ok: true, reason: 'ok' };
}

function verifyTargetedRemoveConditioningMutation(args: {
  beforeWorkout: ResolvedDay['workout'] | null;
  afterWorkout: ResolvedDay['workout'] | null;
  targetItemId?: string;
}): { ok: boolean; reason: string } {
  if (!args.afterWorkout) return { ok: false, reason: 'missing_after_snapshot' };
  const beforeItems = visibleDurationOnlyConditioningItems(args.beforeWorkout);
  const afterItems = visibleDurationOnlyConditioningItems(args.afterWorkout);
  const targetItemId = String(args.targetItemId ?? '').trim();
  if (!targetItemId) return { ok: false, reason: 'missing_target_item_id' };
  if (!beforeItems.some((item) => item.id === targetItemId)) {
    return { ok: false, reason: 'remove_target_missing_before' };
  }
  if (afterItems.some((item) => item.id === targetItemId)) {
    return { ok: false, reason: 'remove_target_still_visible' };
  }
  if (afterItems.length !== beforeItems.length - 1) {
    return { ok: false, reason: 'remove_changed_wrong_item_count' };
  }
  const beforeUntouchedIds = beforeItems
    .filter((item) => item.id !== targetItemId)
    .map((item) => item.id)
    .sort();
  const afterIds = afterItems.map((item) => item.id).sort();
  if (JSON.stringify(beforeUntouchedIds) !== JSON.stringify(afterIds)) {
    return { ok: false, reason: 'remove_changed_unrelated_conditioning' };
  }
  return { ok: true, reason: 'ok' };
}

function visibleDurationOnlyConditioningItems(
  workout: ResolvedDay['workout'] | null,
): VisibleDurationOnlyConditioningItem[] {
  return extractVisibleProgramItemsFromWorkout(workout)
    .filter((item) => item.domain === 'conditioning' || item.domain === 'recovery')
    .map((item) => ({
      id: item.id,
      title: item.title,
      modality: item.modality,
      durationMinutes: item.durationMinutes,
    }));
}

function normalisedConditioningDurationIdentity(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\b\d{1,3}\s*(?:m|min|mins|minute|minutes)\b/g, '{duration}')
    .replace(/\b\d{1,3}\s*(?:[-–]\s*\d{1,3})?\s*(?:s|sec|secs|second|seconds)\b/g, '{duration}')
    .replace(/\(\s*\{duration\}\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleForImplicitConditioningUpdate(
  sourceTitle: string,
  spec: AddConditioningEventSpec,
): string | undefined {
  const explicit = spec.customActivity?.trim();
  const source = sourceTitle.trim();
  if (!source) return explicit;
  if (spec.editScope === 'replace_conditioning_prescription') {
    return explicit ?? replacementConditioningTitle(spec) ?? source;
  }

  let next = source;
  if (spec.durationMinutes) {
    next = replaceDurationInConditioningTitle(next, spec.durationMinutes, spec);
  }
  if (spec.modality) {
    next = replaceModeInConditioningTitle(next, spec);
  }

  const sourceChanged = normalisedConditioningTitle(next) !== normalisedConditioningTitle(source);
  if (!explicit) return sourceChanged ? next : source;

  const explicitIsSourceLike =
    normalisedConditioningTitle(explicit) === normalisedConditioningTitle(source);
  const shouldPreserveSourceShape =
    sourceChanged &&
    sourceHasStructuredConditioningName(source) &&
    isGenericConditioningUpdateTitle(explicit, spec);

  if (explicitIsSourceLike || shouldPreserveSourceShape) return next;
  return explicit;
}

function replacementConditioningTitle(spec: AddConditioningEventSpec): string | undefined {
  const mode = conditioningModeLabelForTitle(spec);
  if (spec.trainingIntent === 'sprint' || spec.effortKind === 'sprint') {
    return mode ? `${mode} Sprints` : 'Sprint Intervals';
  }
  if (spec.trainingIntent === 'hiit') {
    return mode ? `HIIT ${mode} Intervals` : 'HIIT Intervals';
  }
  if (spec.trainingIntent === 'tempo') {
    return mode ? `Tempo ${mode}` : 'Tempo Conditioning';
  }
  if (spec.trainingIntent === 'aerobic') {
    return mode ? `Aerobic ${mode}` : 'Aerobic Conditioning';
  }
  return undefined;
}

function replaceDurationInConditioningTitle(
  sourceTitle: string,
  durationMinutes: number,
  spec: AddConditioningEventSpec,
): string {
  const token = `${durationMinutes}min`;
  if (/\b\d{1,3}\s*(?:m|min|mins|minute|minutes)\b/i.test(sourceTitle)) {
    return sourceTitle.replace(/\b\d{1,3}\s*(?:m|min|mins|minute|minutes)\b/ig, token);
  }
  if (/\bEasy\s+Aerobic\s+Flush\b/i.test(sourceTitle)) {
    const mode = conditioningModeLabelForTitle(spec);
    return mode ? `Easy Aerobic Flush (${token} ${mode})` : sourceTitle;
  }
  return sourceTitle;
}

function replaceModeInConditioningTitle(
  sourceTitle: string,
  spec: AddConditioningEventSpec,
): string {
  const mode = conditioningModeLabelForTitle(spec);
  if (!mode) return sourceTitle;
  if (/\([^)]*\b(?:bike|assault\s+bike|air\s+bike|rower|row|skierg|ski\s*erg|run|swim|walk)\b[^)]*\)/i.test(sourceTitle)) {
    return sourceTitle.replace(
      /\(([^)]*)\)/g,
      (_match, content) => {
        const nextContent = String(content)
          .replace(/\b(?:assault\s+bike|air\s+bike|bike|rower|row|skierg|ski\s*erg|run|swim|walk)\b/i, mode)
          .replace(/\s+/g, ' ')
          .trim();
        return `(${nextContent})`;
      },
    );
  }
  if (/\bEasy\s+Aerobic\s+Flush\b/i.test(sourceTitle) && spec.durationMinutes) {
    return `Easy Aerobic Flush (${spec.durationMinutes}min ${mode})`;
  }
  return sourceTitle;
}

function conditioningModeLabelForTitle(spec: AddConditioningEventSpec): string | null {
  if (spec.modality === 'bike') {
    return spec.bikeLabel === 'assault' ? 'Assault Bike' : 'Bike';
  }
  if (spec.modality === 'ski') return 'SkiErg';
  if (spec.modality === 'row' || spec.modality === 'rower') return 'Rower';
  if (spec.modality === 'run') return 'Run';
  if (spec.modality === 'swim') return 'Swim';
  if (spec.modality === 'walk') return 'Walk';
  return null;
}

function canonicalConditioningDisplayTitle(title: string): string {
  return title
    .replace(/\bski\s*erg\b/ig, 'SkiErg')
    .replace(/\bskierg\b/ig, 'SkiErg')
    .replace(/\bassault\s+bike\b/ig, 'Assault Bike')
    .replace(/\brower\b/ig, 'Rower');
}

function sprintModeTitleLabel(
  modality: string | null,
  bikeLabel?: string | null,
): string {
  if (modality === 'bike') return bikeLabel === 'assault' ? 'Assault Bike' : 'Bike';
  if (modality === 'ski') return 'SkiErg';
  if (modality === 'row' || modality === 'rower') return 'Rower';
  if (modality === 'run') return 'Run';
  if (modality === 'swim') return 'Swim';
  if (modality === 'walk') return 'Walk';
  return 'Sprint';
}

function sprintEffortDisplayLabel(
  modality: string | null,
  bikeLabel: string | null | undefined,
  title: string,
): string {
  const mode = sprintModeTitleLabel(modality, bikeLabel);
  if (mode !== 'Sprint') return `${mode} sprints`;
  if (/\bski\s*erg|skierg\b/i.test(title)) return 'SkiErg sprints';
  if (/\bassault\s+bike|air\s+bike\b/i.test(title)) return 'Assault Bike sprints';
  if (/\bbike\b/i.test(title)) return 'Bike sprints';
  if (/\brow(?:er|ing)?\b/i.test(title)) return 'Rower sprints';
  if (/\brun(?:ning)?\b/i.test(title)) return 'run sprints';
  return 'sprint efforts';
}

function sourceHasStructuredConditioningName(title: string): boolean {
  return /\bEasy\s+Aerobic\s+Flush\b/i.test(title) || /\(\s*\d{1,3}\s*(?:m|min)/i.test(title);
}

function isGenericConditioningUpdateTitle(
  title: string,
  spec: AddConditioningEventSpec,
): boolean {
  const normalised = normalisedConditioningTitle(title);
  const mode = conditioningModeLabelForTitle(spec);
  const modeNormalised = normalisedConditioningTitle(mode ?? '');
  if (modeNormalised && normalised === modeNormalised) return true;
  if (modeNormalised && normalised === normalisedConditioningTitle(`light ${mode}`)) return true;
  if (modeNormalised && normalised === normalisedConditioningTitle(`easy ${mode}`)) return true;
  return /^(?:light|easy)?(?:bike|row|rower|skierg|ski|run|swim|walk|aerobic|cardio)$/.test(normalised);
}

function normalisedConditioningTitle(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildAddConditioningEvent(
  date: string,
  spec: AddConditioningEventSpec,
  id: string,
): AdjustmentEvent {
  const {
    modality,
    customActivity,
    intensity,
    bikeLabel,
    effortKind,
    replaceActivity,
    trainingIntent,
    editScope,
    targetItemId,
    description: descriptionOverride,
    notes: notesOverride,
    conditioningFlavour: conditioningFlavourOverride,
    conditioningCategory: conditioningCategoryOverride,
  } = spec;
  const titleByModality: Record<string, string> = {
    bike: 'Bike Intervals',
    row: 'Row Intervals',
    rower: 'Row Intervals',
    run: 'Aerobic Run',
    walk: 'Light Walk',
    ski: 'SkiErg Intervals',
    swim: 'Easy Swim',
    cardio: 'Light Aerobic Intervals',
    aerobic: 'Light Aerobic Intervals',
    sprint: 'Sprint Intervals',
    mixed: 'MetCon',
  };
  const isLowLoadCustom = !!customActivity && !/\bsprint|interval|hard\b/i.test(customActivity);
  const hasDuration = spec.durationMinutes != null;
  const isEasy = intensity === 'light' || modality === 'walk' || isLowLoadCustom ||
    (hasDuration && modality !== 'sprint' && intensity !== 'hard');
  const easyTitleByModality: Record<string, string> = {
    bike: 'Light Bike',
    row: 'Light Row',
    rower: 'Light Row',
    run: 'Easy Run',
    ski: 'Light SkiErg',
    swim: 'Easy Swim',
    cardio: 'Light Cardio',
    aerobic: 'Light Aerobic',
  };
  const rawSprintEffort = trainingIntent === 'sprint' || effortKind === 'sprint' || /\bsprints?\b/i.test(customActivity ?? '');
  const rawTitle =
    customActivity ||
    (rawSprintEffort && modality
      ? `${sprintModeTitleLabel(modality, bikeLabel)} Sprints`
      : undefined) ||
    (isEasy && modality ? easyTitleByModality[modality] : undefined) ||
    (modality ? titleByModality[modality] ?? 'Light Aerobic Intervals' : 'Light Aerobic Intervals');
  const title = canonicalConditioningDisplayTitle(rawTitle);
  const isHillPowerRun =
    /\bhill\s+(?:run|runs|running|sprints?)\b/i.test(title) &&
    (intensity === 'hard' || /\b(?:hard|sprints?)\b/i.test(title));
  const isHardRunEffort =
    !isHillPowerRun &&
    !rawSprintEffort &&
    intensity === 'hard' &&
    (modality === 'run' || /\b(?:run|running)\b/i.test(title)) &&
    !hasDuration;
  const isSprintEffort = rawSprintEffort || isHillPowerRun || isHardRunEffort;
  const isHighIntensityInterval =
    !isSprintEffort &&
    (trainingIntent === 'hiit' || effortKind === 'interval' || /\b(?:hiit|high[-\s]*intensity|intervals?)\b/i.test(title)) &&
    (intensity === 'hard' || /\b(?:hiit|hard|high[-\s]*intensity)\b/i.test(title));
  const prescriptionIntent: CoachTrainingIntent | undefined =
    trainingIntent ??
    (isSprintEffort
      ? 'sprint'
      : isHighIntensityInterval
      ? 'hiit'
      : isEasy
      ? 'low_load'
      : undefined);
  const plannedPrescription = buildConditioningPrescription({
    trainingIntent: prescriptionIntent,
    modality: modality as any,
    title,
    intensity,
    durationMinutes: spec.durationMinutes,
    sets: spec.sets,
    repsMin: spec.repsMin,
    repsMax: spec.repsMax,
    restSeconds: spec.restSeconds,
    prescriptionType: spec.prescriptionType,
  });
  const sprintRepsMin = plannedPrescription.repsMin ?? 20;
  const sprintRepsMax = plannedPrescription.repsMax ?? 30;
  const sprintSets = plannedPrescription.sets ?? 6;
  const sprintRange =
    sprintRepsMin === sprintRepsMax
      ? `${sprintRepsMin}s`
      : `${sprintRepsMin}-${sprintRepsMax}s`;
  const intervalRepsMin = plannedPrescription.repsMin ?? 45;
  const intervalRepsMax = plannedPrescription.repsMax ?? 45;
  const intervalSets = plannedPrescription.sets ?? 8;
  const intervalRange =
    intervalRepsMin === intervalRepsMax
      ? `${intervalRepsMin}s`
      : `${intervalRepsMin}-${intervalRepsMax}s`;
  const durationMinutes =
    plannedPrescription.durationMinutes ??
    spec.durationMinutes ??
    (isEasy ? 20 : undefined);
  const lowerTitle = title.toLowerCase();
  const description = descriptionOverride ??
    (isLowLoadCustom && !modality
      ? `${durationMinutes} min ${title}. Keep it controlled and low-load; stop if it adds soreness.`
      : isEasy
      ? `${durationMinutes} min ${lowerTitle} at conversational pace. Keep it light: 3-4/10.`
      : isHillPowerRun
      ? `${sprintSets} x ${sprintRange} hard hill runs, walk-back recovery between reps. Keep mechanics sharp; stop if speed drops.`
      : isHardRunEffort
      ? `${sprintSets} x ${sprintRange} hard run efforts, full easy recovery between reps. Keep mechanics sharp; stop if speed drops.`
      : isSprintEffort
      ? `${sprintSets} x ${sprintRange} ${sprintEffortDisplayLabel(modality, bikeLabel, title)} @ near-max effort, 2 min easy recovery between reps.`
      : isHighIntensityInterval
      ? `${intervalSets} x ${intervalRange} hard ${conditioningModeLabel(modality, title)} intervals, 90s easy recovery between reps.`
      : modality === 'sprint'
      ? '6 x 20-30s @ near-max effort, 2 min easy recovery between reps.'
      : '8 x 2 min @ 75-80% max HR, 1 min easy recovery between reps.');
  const coachNote =
    replaceActivity && customActivity
      ? `Replaced ${replaceActivity} with ${customActivity}`
      : customActivity
      ? `Added ${customActivity}`
      : modality === 'walk'
      ? 'Added Light Walk'
      : modality
      ? `Added ${humanModality(modality)} conditioning after strength`
      : 'Added light aerobic intervals after strength';
  const sets = plannedPrescription.sets ?? (isEasy ? 1 : isSprintEffort ? sprintSets : isHighIntensityInterval ? intervalSets : spec.sets ?? 8);
  const minutes = durationMinutes;
  const restSeconds = plannedPrescription.restSeconds ?? (isEasy ? 0 : isSprintEffort ? 120 : isHighIntensityInterval ? 90 : 60);
  const conditioningFlavour = conditioningFlavourOverride ?? (isSprintEffort || isHighIntensityInterval
    ? 'high-intensity'
    : trainingIntent === 'tempo' || intensity === 'moderate'
    ? 'tempo'
    : 'aerobic');
  const conditioningCategory = conditioningCategoryOverride ?? (isSprintEffort
    ? 'sprint'
    : isHighIntensityInterval
    ? 'vo2'
    : 'aerobic_base');
  const resolvedTrainingIntent: CoachTrainingIntent =
    trainingIntent ??
    (isSprintEffort
      ? 'sprint'
      : isHighIntensityInterval
      ? 'hiit'
      : conditioningFlavour === 'tempo'
      ? 'tempo'
      : isEasy
      ? 'low_load'
      : 'aerobic');
  const notes = notesOverride ??
    (isLowLoadCustom && !modality
      ? `${durationMinutes} min ${title}. Controlled, low-load work only.`
      : isEasy
      ? `${durationMinutes} min ${lowerTitle}. Conversational pace only; stop if it adds soreness.`
      : isHillPowerRun
      ? `${sprintSets} x ${sprintRange} hard hill runs. Walk back and recover fully; stop if mechanics fade.`
      : isHardRunEffort
      ? `${sprintSets} x ${sprintRange} hard run efforts. Full recovery; stop if mechanics fade.`
      : isSprintEffort
      ? `${sprintSets} x ${sprintRange} ${sprintEffortDisplayLabel(modality, bikeLabel, title)}. Full recovery; stop if power drops.`
      : isHighIntensityInterval
      ? `${intervalSets} x ${intervalRange} hard ${conditioningModeLabel(modality, title)} intervals. Keep the recoveries easy and stop if output drops.`
      : undefined);
  return {
    id,
    kind: 'add_conditioning_block',
    date,
    reason: `coach add_conditioning${modality ? ` (${modality})` : ''}`,
    after: {
      title,
      description,
      coachNote,
      sets,
      minutes,
      repsMin: plannedPrescription.repsMin ?? (isSprintEffort ? 20 : isHighIntensityInterval ? 45 : undefined),
	      repsMax: plannedPrescription.repsMax ?? (isSprintEffort ? 30 : isHighIntensityInterval ? 45 : undefined),
	      prescriptionType: plannedPrescription.prescriptionType ?? (isSprintEffort || isHighIntensityInterval ? 'duration' : undefined),
	      restSeconds,
	      notes,
	      exerciseId: exerciseIdForAddedActivity(title, modality),
	      replaceActivity,
	      conditioningFlavour,
	      conditioningCategory,
	      trainingIntent: resolvedTrainingIntent,
	      editScope,
	      targetItemId,
	    },
	  };
	}

function buildRemoveConditioningEvent(
  date: string,
  id: string,
  spec: RemoveConditioningEventSpec,
): AdjustmentEvent {
  return {
    id,
    kind: 'remove_conditioning_block',
    date,
    reason: 'coach remove_conditioning',
    before: {
      targetItemId: spec.targetItemId,
      modality: spec.modality,
    },
  };
}

function defaultSnapshotBefore(targetDate: string): ResolvedDay['workout'] | null {
  try {
    const monday = getMondayForDate(targetDate);
    const state: ScheduleState = buildScheduleStateImperative();
    const week = resolveWeekWithConditioning(monday, state);
    const day = week.find((d) => d.date === targetDate);
    return day?.workout ?? null;
  } catch (e) {
    logger.warn('[coach-command-executor] snapshot_before_failed', {
      targetDate,
      error: (e as Error)?.message ?? String(e),
    });
    return null;
  }
}

function defaultSnapshotWeek(targetDate: string): ResolvedDay[] {
  try {
    const monday = getMondayForDate(targetDate);
    const state: ScheduleState = buildScheduleStateImperative();
    return resolveWeekWithConditioning(monday, state);
  } catch (e) {
    logger.warn('[coach-command-executor] snapshot_week_failed', {
      targetDate,
      error: (e as Error)?.message ?? String(e),
    });
    return [];
  }
}

function targetDateFor(target: CoachCommandTarget): string | null {
  if (target.kind === 'date') return target.date;
  if (target.kind === 'exercise') return target.date;
  return null;
}

function humanDate(iso: string): string {
  // Cheap, dependency-free pretty-print; the visible string is small
  // and parseable so we keep things deterministic for tests.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
    new Date(`${iso}T12:00:00`).getDay()
  ];
  return `${dow} ${iso}`;
}

function weekdayName(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    new Date(`${iso}T12:00:00`).getDay()
  ] ?? iso;
}

function buildAddedConditioningReply(
  niceDate: string,
  spec: Pick<AddConditioningEventSpec, 'modality' | 'customActivity' | 'intensity' | 'durationMinutes' | 'sets' | 'repsMin' | 'repsMax' | 'restSeconds' | 'prescriptionType' | 'replaceActivity' | 'trainingIntent' | 'changeKind' | 'editScope'> & {
    isDurationCorrection?: boolean;
  },
): string {
  const activity = spec.customActivity ||
    (spec.modality === 'walk' ? 'Light Walk' : undefined) ||
    (spec.intensity === 'light' && spec.modality ? easyActivityLabel(spec.modality) : undefined);
  if (activity) {
    if (spec.isDurationCorrection && spec.repsMin && spec.repsMax) {
      const seconds =
        spec.repsMin === spec.repsMax
          ? `${spec.repsMin} sec`
          : `${spec.repsMin}-${spec.repsMax} sec`;
      const sets = spec.sets && spec.sets > 1 ? `${spec.sets} x ` : '';
      return `Done. I set ${formatActivityForReply(activity)} to ${sets}${seconds} on ${niceDate}.`;
    }
    if (spec.isDurationCorrection && spec.durationMinutes) {
      return `Done. I set ${formatActivityForReply(activity)} to ${spec.durationMinutes} min on ${niceDate}.`;
    }
    if (spec.replaceActivity) {
      const plannedReply = plannedConditioningEditReply(niceDate, {
        sourceActivity: spec.replaceActivity,
        finalActivity: activity,
        modality: spec.modality,
        trainingIntent: spec.trainingIntent,
        changeKind: spec.changeKind,
      });
      if (plannedReply) return plannedReply;
      if (spec.editScope === 'replace_conditioning_prescription') {
        return `Done. I replaced ${formatActivityForReply(spec.replaceActivity)} with ${formatActivityForReply(activity)} on ${niceDate}. ${followUpTweakLine(activity)}`;
      }
      return `Yeah, no worries. I swapped ${formatActivityForReply(spec.replaceActivity)} for ${formatActivityForReply(activity)} on ${niceDate}. ${followUpTweakLine(activity)}`;
    }
    if (spec.durationMinutes) {
      return `Yeah, no worries. I added ${formatActivityForReply(activity)} for ${spec.durationMinutes} min to ${niceDate}. ${followUpTweakLine(activity)}`;
    }
    return `Yeah, no worries. I added ${formatActivityForReply(activity)} to ${niceDate}. ${followUpTweakLine(activity)}`;
  }
  return `Yeah, no worries. I added a${spec.modality ? ` ${humanModality(spec.modality)}` : ' light aerobic'} ` +
    `conditioning block to ${niceDate} after the strength work. Let me know if you want to tweak it.`;
}

function easyActivityLabel(modality: string): string | undefined {
  switch (modality) {
    case 'bike': return 'Light Bike';
    case 'row':
    case 'rower': return 'Light Row';
    case 'run': return 'Easy Run';
    case 'ski': return 'Light SkiErg';
    case 'swim': return 'Easy Swim';
    case 'cardio': return 'Light Cardio';
    case 'aerobic': return 'Light Aerobic';
    default: return undefined;
  }
}

function formatActivityForReply(activity: string): string {
  const label = activity.trim();
  if (/^(pilates|yoga|mobility|stretching|foam rolling|prehab|activation|breathing|core)$/i.test(label)) {
    return label;
  }
  const lower = label.toLowerCase();
  const readable = lower
    .replace(/\bhiit\b/g, 'HIIT')
    .replace(/\bmas\b/g, 'MAS')
    .replace(/\bskierg\b/g, 'SkiErg');
  if (/\bsprints$|\bintervals$|\befforts$/i.test(label)) {
    return readable;
  }
  if (/\b(?:running|run|walking|cycling|swimming|rowing)\b$/i.test(label)) {
    return readable;
  }
  const article = /^[aeiou]/i.test(lower) ? 'an' : 'a';
  return `${article} ${readable}`;
}

function followUpTweakLine(activity: string): string {
  return /\b(?:hiit|intervals?|sprints?|efforts?)\b/i.test(activity)
    ? 'Let me know if you want the work/rest changed.'
    : 'Let me know if you want to tweak it.';
}

function plannedConditioningEditReply(
  niceDate: string,
  spec: {
    sourceActivity: string;
    finalActivity: string;
    modality: string | null;
    trainingIntent?: CoachTrainingIntent;
    changeKind?: CoachPlanChangeKind;
  },
): string | null {
  if (!spec.trainingIntent || !spec.changeKind) return null;
  const targetMode = conditioningModeLabel(spec.modality, spec.finalActivity);
  const sourceMode = conditioningModeLabel(null, spec.sourceActivity);
  if (spec.changeKind === 'modality' && spec.trainingIntent === 'hiit') {
    return `Yeah, no worries. I switched the HIIT ${sourceMode} to ${targetMode} on ${niceDate} and kept the same interval intent: hard efforts, easy recoveries. Let me know if you want the work/rest changed.`;
  }
  if (spec.changeKind === 'training_intent' && spec.trainingIntent === 'hiit') {
    return `Yeah, no worries. I made the ${targetMode} work HIIT on ${niceDate}: hard efforts, easy recoveries. Let me know if you want the work/rest changed.`;
  }
  if (spec.changeKind === 'modality_and_training_intent' && spec.trainingIntent === 'hiit') {
    return `Yeah, no worries. I changed it to HIIT ${targetMode} intervals on ${niceDate}: hard efforts, easy recoveries. Let me know if you want the work/rest changed.`;
  }
  if (spec.trainingIntent === 'sprint') {
    return `Done. I replaced ${formatActivityForReply(spec.sourceActivity)} with ${formatActivityForReply(spec.finalActivity)} on ${niceDate}. Let me know if you want the work/rest changed.`;
  }
  return null;
}

function conditioningModeLabel(modality: string | null, title: string): string {
  if (modality === 'row' || modality === 'rower' || /\brow(?:ing|er)?\b/i.test(title)) return 'rower';
  if (modality === 'bike' || /\bbike\b/i.test(title)) return 'bike';
  if (modality === 'ski' || /\bski(?:erg)?\b/i.test(title)) return 'SkiErg';
  if (modality === 'run' || /\brun(?:ning)?\b/i.test(title)) return 'running';
  if (modality === 'swim' || /\bswim(?:ming)?\b/i.test(title)) return 'swim';
  return 'conditioning';
}

function exerciseIdForAddedActivity(title: string, modality: string | null): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  if (slug) return `coach-${slug}`;
  if (modality === 'walk') return 'coach-light-walk';
  return 'coach-light-aerobic-intervals';
}

function humanModality(modality: string): string {
  switch (modality) {
    case 'rower': return 'row';
    case 'walk': return 'light walk';
    case 'aerobic': return 'light aerobic';
    case 'sprint': return 'sprint';
    default: return modality;
  }
}

function honestRejectReason(
  applyResult: ApplyEventsResult,
  operation: 'add_conditioning' | 'remove_conditioning',
  niceDate: string,
): string {
  const first = applyResult.rejected[0];
  if (!first) {
    return operation === 'add_conditioning'
      ? `I tried to add conditioning on ${niceDate}, but no event landed. ` +
        `Try the Program tab to add it manually.`
      : `I tried to remove conditioning on ${niceDate}, but no event landed. ` +
        `Try the Program tab to remove it manually.`;
  }
  switch (first.kind) {
    case 'no_conditioning_to_swap':
      return `There's no conditioning block on ${niceDate} to remove.`;
    case 'past_date_blocked':
      return `That session (${niceDate}) is in the past - I can't change it.`;
    case 'no_workout_on_date':
      return `${niceDate} doesn't have a workout to ${operation === 'add_conditioning' ? 'add to' : 'remove from'}.`;
    case 'invalid_target_date':
      return `${niceDate} isn't in the visible program - try a date inside this week.`;
    default:
      return `I couldn't ${operation === 'add_conditioning' ? 'add' : 'remove'} conditioning on ${niceDate}: ${first.reason}.`;
  }
}

// ─── Replace exercise via applyAdjustmentEvents ─────────────────────
//
// Deterministic strength-pool style swap. Flow:
//   1. Resolve target session (router-bound date OR lastOpened-bound).
//   2. Snapshot the workout BEFORE the apply so we can read its
//      exercise list — needed to (a) fuzzy-match the source name and
//      (b) build option chips when the source is a pronoun or the
//      replacement is missing.
//   3. Resolve source: case-insensitive exact → fuzzy substring →
//      pronoun → "ambiguous" clarifier with the workout's exercises.
//   4. Resolve replacement: case-insensitive exact in EXERCISE_TAGS,
//      fall back to substring match. Missing → reject_with_reason
//      ("I don't recognise X"). NOT specified → suggest siblings via
//      classifyPoolSlot + getSlotSiblings.
//   5. Build a single replace_exercise AdjustmentEvent and apply it.
//   6. Verify dual-surface absence-of-from + presence-of-to via
//      verifyRenderedExerciseSwap. "Done." only when BOTH surfaces
//      verify; anything else reports verified_no_op honestly.

function runReplaceExercise(
  input: ExecuteCoachCommandInput,
  stages: ProgressStage[],
  tick: (s: ProgressStage) => void,
): ExecutionResult {
  const { command } = input;
  if (command.mode !== 'mutate' || command.operation !== 'replace_exercise') {
    return {
      kind: 'error',
      reply: 'Internal error: runReplaceExercise called on wrong command.',
      applied: false,
      route: 'internal_error',
      progress: stages,
    };
  }
  const payload =
    command.payload.operation === 'replace_exercise' ? command.payload : null;
  if (!payload) {
    return {
      kind: 'error',
      reply: 'Internal error: replace_exercise payload mismatch.',
      applied: false,
      route: 'internal_error',
      progress: stages,
    };
  }

  const targetDate = targetDateFor(command.target);
  if (!targetDate) {
    tick('composing_reply');
    return {
      kind: 'clarify',
      reply: 'Which session has the exercise you want to swap?',
      applied: false,
      route: 'clarify_no_target:replace_exercise',
      progress: stages,
    };
  }

  const deps: ReplaceExerciseDeps = input.replaceExerciseDeps ?? {};
  const applyEvents = deps.applyEvents ?? applyAdjustmentEvents;
  const verifyRendered = deps.verifyRendered ?? verifyRenderedExerciseSwap;
  const snapshotBefore = deps.snapshotBefore ?? defaultSnapshotBefore;
  const newEventId =
    deps.newEventId ?? (() => `coach-cmd-replace_exercise-${targetDate}`);

  // ── 1. Snapshot the target workout — exercise list drives every
  //       clarifier the executor produces below. ───────────────────
  tick('checking_program');
  const beforeWorkout = snapshotBefore(targetDate);
  // Mutation-history snapshot for the target date.
  const beforeOverrideMap = takeDateOverrideSnapshots(input, [targetDate]);
  if (!beforeWorkout) {
    tick('composing_reply');
    return {
      kind: 'verified_no_op',
      reply: `${humanDate(targetDate)} doesn't have a workout to swap an exercise on.`,
      applied: false,
      route: 'no_workout:replace_exercise',
      progress: stages,
    };
  }
  const exerciseNames = listExerciseNames(beforeWorkout);
  if (exerciseNames.length === 0) {
    tick('composing_reply');
    return {
      kind: 'verified_no_op',
      reply: `${humanDate(targetDate)} doesn't have any exercises to swap.`,
      applied: false,
      route: 'no_exercises:replace_exercise',
      progress: stages,
    };
  }

  // ── 2. Resolve the source exercise inside the workout. ─────────
  let sourceMatch: string | null = null;
  if (isPronounSource(payload.fromExercise)) {
    // Pronoun source — defer to a clarifier with concrete options.
    tick('composing_reply');
    return {
      kind: 'clarify',
      reply: `Which exercise on ${humanDate(targetDate)} do you want to swap?`,
      applied: false,
      route: 'clarify_pronoun_source:replace_exercise',
      progress: stages,
      options: exerciseNames,
    };
  }
  sourceMatch = resolveExerciseInList(exerciseNames, payload.fromExercise);
  if (!sourceMatch) {
    tick('composing_reply');
    return {
      kind: 'clarify',
      reply:
        `I can't find "${payload.fromExercise}" on ${humanDate(targetDate)}. ` +
        `Which exercise do you want to swap?`,
      applied: false,
      route: 'clarify_unknown_source:replace_exercise',
      progress: stages,
      options: exerciseNames,
    };
  }

  // ── 3. Resolve (or suggest) the replacement. ───────────────────
  if (!payload.toExercise) {
    // Source-only — offer pool siblings as a deterministic option set.
    const siblings = suggestSiblingsFor(sourceMatch);
    tick('composing_reply');
    if (siblings.length === 0) {
      return {
        kind: 'clarify',
        reply: `What would you like to swap "${sourceMatch}" for?`,
        applied: false,
        route: 'clarify_no_siblings:replace_exercise',
        progress: stages,
      };
    }
    return {
      kind: 'clarify',
      reply: `What would you like to swap "${sourceMatch}" for?`,
      applied: false,
      route: 'clarify_replacement_options:replace_exercise',
      progress: stages,
      options: siblings,
    };
  }
  const replacementName = resolveExerciseName(payload.toExercise);
  if (!replacementName) {
    // Replacement isn't in the registry — reject honestly.
    tick('composing_reply');
    const siblings = suggestSiblingsFor(sourceMatch);
    const altSentence =
      siblings.length > 0
        ? ` Try one of: ${siblings.slice(0, 3).join(', ')}.`
        : '';
    return {
      kind: 'rejected',
      reply:
        `I don't recognise "${payload.toExercise}". ` +
        `I can only swap to exercises in the strength registry.${altSentence}`,
      applied: false,
      route: 'unknown_replacement:replace_exercise',
      progress: stages,
    };
  }

  // ── 4. Build and apply the AdjustmentEvent. ────────────────────
  const event: AdjustmentEvent = {
    id: newEventId(),
    kind: 'replace_exercise',
    date: targetDate,
    reason: `coach replace_exercise`,
    before: sourceMatch,
    after: replacementName,
  };
  tick('applying_change');
  const applyResult = applyEvents([event], {
    todayISO: input.todayISO,
    allowFutureWeeks: true,
    allowPastDates: false,
  });

  // ── 5. Verify dual-surface diff. ───────────────────────────────
  tick('verifying_update');
  const verification = verifyRendered({
    requestedDay: targetDate,
    todayISO: input.todayISO,
    targetDate,
    fromName: sourceMatch,
    toName: replacementName,
  });

  logger.debug('[coach-command-executor] replace_exercise', {
    targetDate,
    sourceMatch,
    replacementName,
    appliedCount: applyResult.applied.length,
    rejectedCount: applyResult.rejected.length,
    rejectedKinds: applyResult.rejected.map((r) => r.kind),
    programTabHasFromExercise: verification.programTabHasFromExercise,
    programTabHasToExercise: verification.programTabHasToExercise,
    dayWorkoutHasFromExercise: verification.dayWorkoutHasFromExercise,
    dayWorkoutHasToExercise: verification.dayWorkoutHasToExercise,
  });

  const result = composeReplaceExerciseResult({
    sourceMatch,
    replacementName,
    targetDate,
    applyResult,
    verification,
    stages,
    tick,
  });

  if (result.kind === 'mutated' && result.applied) {
    const revertPlan = buildRevertPlanFromDateSnapshots(beforeOverrideMap, [targetDate]);
    recordVerifiedMutation({
      input,
      result,
      operation: 'replace_exercise',
      mutationKind: 'replace_exercise',
      affectedDates: [targetDate],
      touchedActivities: [
        {
          kind: 'exercise',
          date: targetDate,
          title: replacementName,
          previousTitle: sourceMatch,
        },
      ],
      scope: command.scope,
      revertPlan,
    });
  }

  return result;
}

function composeReplaceExerciseResult(args: {
  sourceMatch: string;
  replacementName: string;
  targetDate: string;
  applyResult: ApplyEventsResult;
  verification: RenderedExerciseSwapVerification;
  stages: ProgressStage[];
  tick: (s: ProgressStage) => void;
}): ExecutionResult {
  const { sourceMatch, replacementName, targetDate, applyResult, verification, stages, tick } = args;
  const niceDate = humanDate(targetDate);

  if (applyResult.applied.length === 0) {
    tick('composing_reply');
    const first = applyResult.rejected[0];
    const rejReason = first?.reason ?? '';
    let body: string;
    switch (first?.kind) {
      case 'exercise_not_present':
        body = `"${sourceMatch}" wasn't on ${niceDate} when I tried to swap it.`;
        break;
      case 'past_date_blocked':
        body = `${niceDate} is in the past - I can't change it.`;
        break;
      case 'no_workout_on_date':
        body = `${niceDate} doesn't have a workout to adjust.`;
        break;
      case 'invalid_target_date':
        body = `${niceDate} isn't in the visible program - try a date inside this week.`;
        break;
      default:
        body =
          `I tried to swap ${sourceMatch} → ${replacementName} on ${niceDate}, ` +
          `but the apply layer rejected it${rejReason ? ` (${rejReason})` : ''}.`;
    }
    return {
      kind: 'verified_no_op',
      reply: body,
      applied: false,
      route: 'apply_rejected:replace_exercise',
      progress: stages,
    };
  }

  const sourceGone = !verification.programTabHasFromExercise && !verification.dayWorkoutHasFromExercise;
  const replacementVisible = verification.programTabHasToExercise && verification.dayWorkoutHasToExercise;
  const fullyVerified = sourceGone && replacementVisible;

  tick('composing_reply');
  if (!fullyVerified) {
    return {
      kind: 'verified_no_op',
      reply:
        `I tried to swap ${sourceMatch} → ${replacementName} on ${niceDate}, ` +
        `but the change didn't fully land on the visible program. ` +
        `Try editing that session directly - the apply layer didn't make it visible.`,
      applied: false,
      route: 'verification_failed:replace_exercise',
      progress: stages,
    };
  }

  return {
    kind: 'mutated',
    reply: `Done. I swapped ${sourceMatch} for ${replacementName} on ${niceDate}.`,
    applied: true,
    route: 'replace_exercise:applied',
    progress: stages,
  };
}

// ─── Helpers for replace_exercise ───────────────────────────────────

function listExerciseNames(workout: ResolvedDay['workout'] | null): string[] {
  if (!workout) return [];
  const out: string[] = [];
  for (const ex of (workout.exercises ?? []) as any[]) {
    const name = ex?.exercise?.name;
    if (typeof name === 'string' && name.trim()) out.push(name);
  }
  return out;
}

function isPronounSource(s: string): boolean {
  if (!s) return true;
  const t = s.trim().toLowerCase();
  return (
    t === '__pronoun__' ||
    t === 'this' ||
    t === 'that' ||
    t === 'this one' ||
    t === 'that one' ||
    t === 'this exercise' ||
    t === 'that exercise' ||
    t === 'it'
  );
}

/**
 * Best-effort match of a user-supplied exercise name against the actual
 * exercises in a workout. Tries (in order):
 *   1. Case-insensitive exact match.
 *   2. Substring containment in either direction.
 *   3. All-tokens-present (multi-word phrases like "back squat" inside
 *      "Back Squat (Heavy)" or vice-versa).
 * Returns the canonical name as it appears in the workout, or null when
 * nothing matches.
 */
function resolveExerciseInList(
  names: string[],
  needle: string,
): string | null {
  if (!needle) return null;
  const target = needle.trim().toLowerCase();
  if (!target) return null;
  // 1. Exact case-insensitive match
  const exact = names.find((n) => n.toLowerCase() === target);
  if (exact) return exact;
  // 2. Substring containment in either direction
  const sub = names.find((n) => {
    const nl = n.toLowerCase();
    return nl.includes(target) || target.includes(nl);
  });
  if (sub) return sub;
  // 3. Token-based all-present match (e.g. "cable row" → "Bent Over Cable Row")
  const tokens = target.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const matched = names.find((n) => {
      const nl = n.toLowerCase();
      return tokens.every((t) => nl.includes(t));
    });
    if (matched) return matched;
  }
  return null;
}

/**
 * Common athlete abbreviations the strength registry doesn't spell out.
 * "dumbbell bench" → "db bench"; "barbell row" → "bb row"; the registry
 * uses the abbreviated form for compactness, athletes type the full
 * word, so we normalize both directions before matching.
 */
const NAME_SYNONYMS: Array<[RegExp, string]> = [
  [/\bdumbbells?\b/g, 'db'],
  [/\bbarbells?\b/g, 'bb'],
  [/\boverhead\s+press\b/g, 'overhead press'],
  [/\bohp\b/g, 'overhead press'],
  [/\bromanian\s+deadlifts?\b/g, 'rdls'],
  [/\bsplit\s+squats?\b/g, 'split squats'],
];

function normaliseExerciseName(s: string): string {
  let out = s.trim().toLowerCase();
  for (const [re, repl] of NAME_SYNONYMS) out = out.replace(re, repl);
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Resolve an athlete-typed replacement name to a canonical entry in
 * EXERCISE_TAGS. Tries exact case-insensitive (with abbreviation
 * normalisation), then substring containment in either direction,
 * then token-based all-present match. Returns null when nothing
 * matches — the caller surfaces an honest "I don't recognise X"
 * rejection.
 */
function resolveExerciseName(needle: string): string | null {
  if (!needle) return null;
  const target = normaliseExerciseName(needle);
  if (!target) return null;
  const tagNames = Object.keys(EXERCISE_TAGS);
  const tagNormalised: Array<{ original: string; normal: string }> =
    tagNames.map((n) => ({ original: n, normal: normaliseExerciseName(n) }));
  // 1. Exact case-insensitive (post-normalisation)
  const exact = tagNormalised.find((n) => n.normal === target);
  if (exact) return exact.original;
  // 2. Substring containment in either direction
  const sub = tagNormalised.find(
    (n) => n.normal.includes(target) || target.includes(n.normal),
  );
  if (sub) return sub.original;
  // 3. Token-based all-present match (e.g. "trap bar deadlift" → "Trap Bar Deadlift")
  const tokens = target.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const matched = tagNormalised.find((n) =>
      tokens.every((t) => n.normal.includes(t)),
    );
    if (matched) return matched.original;
  }
  return null;
}

/**
 * Suggest 2-4 sibling exercises in the same pool slot/role as the given
 * source. Returns at most 4 names, deterministically ordered by the
 * pool's natural order, with the source itself filtered out.
 */
function suggestSiblingsFor(sourceName: string): string[] {
  // Prefer explicit pool membership; fall back to tag-based heuristic.
  const slot = classifyPoolSlot(sourceName) ?? null;
  if (!slot) return [];
  const { slot: slotKey, role } = slot;
  const siblings = getSlotSiblings(slotKey, role);
  const filtered = siblings
    .map((s) => s.name)
    .filter((n) => n.toLowerCase() !== sourceName.toLowerCase());
  return filtered.slice(0, 4);
}

// Placate the unused-import linter: findPoolEntry is reserved for the
// next refinement (cross-role suggestions). Keep the import warm.
void findPoolEntry;

// ─── Remove whole session ─────────────────────────────────────────

interface RemoveSessionRollbackSnapshot {
  date: string;
  overrideWorkout: Workout | null;
  overrideContext: OverrideContext | null;
  calendarMark: CalendarDayType | null;
  visibleWorkout: ResolvedDay['workout'] | null;
}

function runAddSession(
  input: ExecuteCoachCommandInput,
  stages: ProgressStage[],
  tick: (s: ProgressStage) => void,
): ExecutionResult {
  const { command } = input;
  if (command.mode !== 'mutate' || command.operation !== 'add_session') {
    return {
      kind: 'error',
      reply: 'Internal error: runAddSession called on wrong command.',
      applied: false,
      route: 'internal_error',
      progress: stages,
    };
  }
  const payload = command.payload.operation === 'add_session' ? command.payload : null;
  if (!payload) {
    return {
      kind: 'error',
      reply: 'Internal error: add_session payload mismatch.',
      applied: false,
      route: 'internal_error',
      progress: stages,
    };
  }

  const targetDate = targetDateFor(command.target);
  if (!targetDate) {
    tick('composing_reply');
    return {
      kind: 'clarify',
      reply: 'Which day should I add that session to?',
      applied: false,
      route: 'clarify_no_target:add_session',
      progress: stages,
    };
  }

  const deps: AddSessionDeps = input.addSessionDeps ?? {};
  const snapshotBefore = deps.snapshotBefore ?? defaultSnapshotBefore;
  const snapshotAfter = deps.snapshotAfter ?? (input.addSessionDeps ? (() => null) : defaultSnapshotBefore);
  const visibleWeek = deps.visibleWeek ?? defaultVisibleWeek;
  const readCalendarMark = deps.readCalendarMark ?? readCurrentCalendarMark;
  const applyAdd = deps.applyAdd ?? defaultApplyAddSession;
  const verifyRendered = deps.verifyRendered ?? verifyRenderedAddSession;

  tick('checking_program');
  const weekMonday = getMondayForDate(targetDate);
  const visibleWeekBefore = safeVisibleWeekForMonday(visibleWeek, weekMonday);
  const standaloneWorkout =
    payload.standaloneAddType === 'conditioning'
      ? buildStandaloneConditioningSourceWorkout({
          targetDate,
          visibleWeek: visibleWeekBefore,
          payload: payload.standaloneConditioning,
        })
      : null;
  if (standaloneWorkout?.kind === 'clarify') {
    tick('composing_reply');
    return {
      kind: 'clarify',
      reply: standaloneWorkout.reply,
      applied: false,
      route: `clarify_standalone_conditioning:${standaloneWorkout.reason}`,
      progress: stages,
      options: standaloneWorkout.options,
    };
  }
  const sourceWorkout = standaloneWorkout?.workout ?? findSourceSessionWorkout({
    visibleWeek,
    todayISO: input.todayISO,
    targetDate,
    sourceDate: payload.sourceDate,
    sourceSessionName: payload.sourceSessionName ?? payload.targetSessionName,
  });
  if (!sourceWorkout) {
    tick('composing_reply');
    return {
      kind: 'clarify',
      reply: 'Which session should I add?',
      applied: false,
      route: 'clarify_no_source:add_session',
      progress: stages,
      options: buildMoveSessionDayOptions(visibleWeek, input.todayISO, targetDate),
    };
  }

  const beforeWorkout = snapshotBefore(targetDate);
  if (beforeWorkout && !isRemovedSessionProjection(beforeWorkout)) {
    tick('composing_reply');
    return {
      kind: 'verified_no_op',
      reply:
        `${humanDate(targetDate)} already has ${quoteSession(beforeWorkout.name ?? 'a session')}. ` +
        `Do you want me to replace it or move ${quoteSession(sourceWorkout.name ?? 'that session')} somewhere else?`,
      applied: false,
      route: 'target_not_rest:add_session',
      progress: stages,
    };
  }

  const beforeOverride = takeDateOverrideSnapshots(input, [targetDate]).get(targetDate) ?? {
    workout: null,
    context: null,
  };
  const beforeCalendarMark = readCalendarMark(targetDate);
  if (payload.standaloneAddType === 'conditioning' && beforeCalendarMark === 'game') {
    tick('composing_reply');
    return {
      kind: 'rejected',
      reply:
        `${humanDate(targetDate)} is game day, so I won't add extra conditioning without a clearer safety call.`,
      applied: false,
      route: 'game_day_blocked:add_session:standalone_conditioning',
      progress: stages,
    };
  }
  const rollbackSnapshot: RemoveSessionRollbackSnapshot = {
    date: targetDate,
    overrideWorkout: beforeOverride.workout,
    overrideContext: beforeOverride.context,
    calendarMark: beforeCalendarMark,
    visibleWorkout: beforeWorkout,
  };

  tick('applying_change');
  const applyResult = applyAdd(
    {
      targetDate,
      sourceWorkout,
      reason: payload.reason ?? 'coach add_session',
    },
    { todayISO: input.todayISO },
  );

  tick('verifying_update');
  const afterWorkout = snapshotAfter(targetDate);
  const visibleWeekAfter = safeVisibleWeekForMonday(visibleWeek, weekMonday);
  const verification = verifyRendered({
    requestedDay: targetDate,
    todayISO: input.todayISO,
    targetDate,
    sourceWorkout,
    beforeWorkout,
    afterWorkout,
    visibleWeekBefore,
    visibleWeekAfter,
  });

  logger.debug('[coach-command-executor] add_session', {
    targetDate,
    sourceWorkoutName: sourceWorkout.name ?? null,
    beforeWorkoutName: beforeWorkout?.name ?? null,
    afterWorkoutName: afterWorkout?.name ?? null,
    applied: applyResult.applied,
    applyReason: applyResult.reason ?? null,
    targetAdded: verification.targetAdded,
    otherDaysUnchanged: verification.otherDaysUnchanged,
    changedOtherDates: verification.changedOtherDates,
  });

  if (!applyResult.applied) {
    tick('composing_reply');
    return {
      kind: applyResult.reason === 'past_date_blocked' ? 'rejected' : 'verified_no_op',
      reply: addSessionApplyRejectReply(targetDate, applyResult.reason),
      applied: false,
      route: `apply_rejected:add_session${applyResult.reason ? ':' + applyResult.reason : ''}`,
      progress: stages,
    };
  }

  if (!verification.targetAdded || !verification.otherDaysUnchanged) {
    rollbackRemoveSession(input, rollbackSnapshot, 'verification_failed:add_session');
    tick('composing_reply');
    return {
      kind: 'verified_no_op',
      reply:
        `I tried to add ${quoteSession(sourceWorkout.name ?? 'that session')} to ${humanDate(targetDate)}, ` +
        `but the visible program didn't verify cleanly. I haven't claimed the change as done.`,
      applied: false,
      route: verification.targetAdded
        ? `verification_failed:add_session:other_days_changed:${verification.changedOtherDates.join(',')}`
        : 'verification_failed:add_session:target_not_added',
      progress: stages,
    };
  }

  tick('composing_reply');
  const finalName = afterWorkout?.name ?? sourceWorkout.name ?? 'Session';
  const isOneOffExtraConditioning =
    payload.standaloneAddType === 'conditioning' &&
    payload.overrideType === 'one_off_extra' &&
    payload.setupChange !== true;
  const result: ExecutionResult = {
    kind: 'mutated',
    reply: isOneOffExtraConditioning
      ? `Done - I added ${finalName} ${targetDate === input.todayISO ? 'today' : `to ${humanDate(targetDate)}`} as a one-off extra session.`
      : `Done. I added ${quoteSession(finalName)} to ${humanDate(targetDate)}.`,
    applied: true,
    route: 'add_session:applied',
    progress: stages,
  };

  const revertPlan: RevertPlan = {
    kind: 'restore_snapshot',
    dateOverrides: [{
      date: targetDate,
      workout: beforeOverride.workout,
      context: beforeOverride.context,
    }],
    calendarMarks: [{ date: targetDate, mark: beforeCalendarMark }],
  };
  recordVerifiedMutation({
    input,
    result,
    operation: 'add_session',
    mutationKind: 'add_session' as MutationKind,
    affectedDates: [targetDate],
    touchedActivities: [{
      kind: 'session',
      date: targetDate,
      sessionName: finalName,
      title: finalName,
    }],
    scope: command.scope,
    revertPlan,
  });

  return result;
}

function runRemoveSession(
  input: ExecuteCoachCommandInput,
  stages: ProgressStage[],
  tick: (s: ProgressStage) => void,
): ExecutionResult {
  const { command } = input;
  if (command.mode !== 'mutate' || command.operation !== 'remove_session') {
    return {
      kind: 'error',
      reply: 'Internal error: runRemoveSession called on wrong command.',
      applied: false,
      route: 'internal_error',
      progress: stages,
    };
  }
  const payload = command.payload.operation === 'remove_session' ? command.payload : null;
  if (!payload) {
    return {
      kind: 'error',
      reply: 'Internal error: remove_session payload mismatch.',
      applied: false,
      route: 'internal_error',
      progress: stages,
    };
  }

  const targetDate = targetDateFor(command.target);
  if (!targetDate) {
    tick('composing_reply');
    return {
      kind: 'clarify',
      reply: 'Which session should I remove?',
      applied: false,
      route: 'clarify_no_target:remove_session',
      progress: stages,
      options: buildMoveSessionDayOptions(
        input.removeSessionDeps?.visibleWeek ?? defaultVisibleWeek,
        input.todayISO,
        null,
      ),
    };
  }

  const deps: RemoveSessionDeps = input.removeSessionDeps ?? {};
  const snapshotBefore = deps.snapshotBefore ?? defaultSnapshotBefore;
  const snapshotAfter = deps.snapshotAfter ?? (input.removeSessionDeps ? (() => null) : defaultSnapshotBefore);
  const visibleWeek = deps.visibleWeek ?? defaultVisibleWeek;
  const readCalendarMark = deps.readCalendarMark ?? readCurrentCalendarMark;
  const applyRemove = deps.applyRemove ?? defaultApplyRemoveSession;
  const verifyRendered = deps.verifyRendered ?? verifyRenderedRemoveSession;

  tick('checking_program');
  const beforeWorkout = snapshotBefore(targetDate);
  if (!beforeWorkout) {
    tick('composing_reply');
    return {
      kind: 'verified_no_op',
      reply: `${humanDate(targetDate)} doesn't have a workout to remove.`,
      applied: false,
      route: 'no_workout:remove_session',
      progress: stages,
    };
  }

  const beforeAny: any = beforeWorkout;
  if (beforeAny.isTeamDay === true || beforeAny.workoutType === 'Team Training') {
    tick('composing_reply');
    return {
      kind: 'rejected',
      reply:
        `${humanDate(targetDate)} is a team training day - those are anchored ` +
        `to the calendar and can't be removed by coach chat.`,
      applied: false,
      route: 'cannot_remove_team_training:remove_session',
      progress: stages,
    };
  }
  if (beforeAny.workoutType === 'Game' || beforeAny.sessionTier === 'game') {
    tick('composing_reply');
    return {
      kind: 'rejected',
      reply: `${humanDate(targetDate)} is a game day - game-day sessions can't be removed by coach chat.`,
      applied: false,
      route: 'cannot_remove_game:remove_session',
      progress: stages,
    };
  }

  const weekMonday = getMondayForDate(targetDate);
  const visibleWeekBefore = safeVisibleWeekForMonday(visibleWeek, weekMonday);
  const beforeOverride = takeDateOverrideSnapshots(input, [targetDate]).get(targetDate) ?? {
    workout: null,
    context: null,
  };
  const beforeCalendarMark = readCalendarMark(targetDate);
  const rollbackSnapshot: RemoveSessionRollbackSnapshot = {
    date: targetDate,
    overrideWorkout: beforeOverride.workout,
    overrideContext: beforeOverride.context,
    calendarMark: beforeCalendarMark,
    visibleWorkout: beforeWorkout,
  };

  tick('applying_change');
  const applyResult = applyRemove(
    {
      targetDate,
      targetSessionId: payload.targetSessionId ?? beforeAny.id ?? null,
      reason: payload.reason,
    },
    { todayISO: input.todayISO },
  );

  tick('verifying_update');
  const afterWorkout = snapshotAfter(targetDate);
  const visibleWeekAfter = safeVisibleWeekForMonday(visibleWeek, weekMonday);
  const verification = verifyRendered({
    requestedDay: targetDate,
    todayISO: input.todayISO,
    targetDate,
    beforeWorkout,
    afterWorkout,
    visibleWeekBefore,
    visibleWeekAfter,
  });

  logger.debug('[coach-command-executor] remove_session', {
    targetDate,
    beforeWorkoutName: beforeWorkout.name ?? null,
    afterWorkoutName: afterWorkout?.name ?? null,
    applied: applyResult.applied,
    applyReason: applyResult.reason ?? null,
    targetRemoved: verification.targetRemoved,
    otherDaysUnchanged: verification.otherDaysUnchanged,
    changedOtherDates: verification.changedOtherDates,
  });

  if (!applyResult.applied) {
    tick('composing_reply');
    return {
      kind: applyResult.reason === 'past_date_blocked' ? 'rejected' : 'verified_no_op',
      reply: removeSessionApplyRejectReply(targetDate, applyResult.reason),
      applied: false,
      route: `apply_rejected:remove_session${applyResult.reason ? ':' + applyResult.reason : ''}`,
      progress: stages,
    };
  }

  if (!verification.targetRemoved || !verification.otherDaysUnchanged) {
    rollbackRemoveSession(input, rollbackSnapshot, 'verification_failed:remove_session');
    tick('composing_reply');
    return {
      kind: 'verified_no_op',
      reply:
        `I tried to remove ${quoteSession(beforeWorkout.name ?? 'session')} from ${humanDate(targetDate)}, ` +
        `but the visible program didn't verify cleanly. I haven't claimed the change as done.`,
      applied: false,
      route: verification.targetRemoved
        ? `verification_failed:remove_session:other_days_changed:${verification.changedOtherDates.join(',')}`
        : 'verification_failed:remove_session:target_still_visible',
      progress: stages,
    };
  }

  tick('composing_reply');
  const result: ExecutionResult = {
    kind: 'mutated',
    reply: `Done. I removed ${quoteSession(beforeWorkout.name ?? 'session')} from ${humanDate(targetDate)}.`,
    applied: true,
    route: 'remove_session:applied',
    progress: stages,
  };

  const revertPlan: RevertPlan = {
    kind: 'restore_snapshot',
    dateOverrides: [{
      date: targetDate,
      workout: beforeOverride.workout ?? beforeWorkout,
      context:
        beforeOverride.context ??
        { intent: 'program_adjustment', label: 'coach undo remove_session' } as OverrideContext,
    }],
    calendarMarks: [{ date: targetDate, mark: beforeCalendarMark }],
  };
  recordVerifiedMutation({
    input,
    result,
    operation: 'remove_session',
    mutationKind: 'remove_session',
    affectedDates: [targetDate],
    touchedActivities: [{
      kind: 'session',
      date: targetDate,
      sessionName: beforeWorkout.name ?? undefined,
      title: beforeWorkout.name ?? 'Session',
    }],
    scope: command.scope,
    revertPlan,
  });

  return result;
}

function defaultApplyRemoveSession(
  input: { targetDate: string },
  opts: { todayISO: string },
): RemoveSessionApplyResult {
  if (input.targetDate < opts.todayISO) {
    return { applied: false, reason: 'past_date_blocked' };
  }
  try {
    useProgramStore.getState().removeManualOverride(input.targetDate);
    useCalendarStore.getState().setRestDay(input.targetDate);
    return { applied: true };
  } catch (e) {
    return {
      applied: false,
      reason: (e as Error)?.message ?? String(e),
    };
  }
}

function defaultApplyAddSession(
  input: { targetDate: string; sourceWorkout: Workout; reason?: string },
  opts: { todayISO: string },
): AddSessionApplyResult {
  if (input.targetDate < opts.todayISO) {
    return { applied: false, reason: 'past_date_blocked' };
  }
  try {
    const workout = buildAddedSessionWorkout(input.sourceWorkout, input.targetDate, input.reason);
    useProgramStore.getState().setManualOverride(
      input.targetDate,
      workout,
      { intent: 'program_adjustment', label: input.reason ?? 'coach add_session' } as OverrideContext,
    );
    useCalendarStore.getState().removeRestDay(input.targetDate);
    return { applied: true };
  } catch (e) {
    return {
      applied: false,
      reason: (e as Error)?.message ?? String(e),
    };
  }
}

type StandaloneConditioningSourceResult =
  | { kind: 'ok'; workout: Workout }
  | { kind: 'clarify'; reply: string; options?: string[]; reason: string };

function buildStandaloneConditioningSourceWorkout(args: {
  targetDate: string;
  visibleWeek: ResolvedDay[];
  payload?: Extract<CoachMutatePayload, { operation: 'add_session' }>['standaloneConditioning'];
}): StandaloneConditioningSourceResult {
  const payload = args.payload ?? {};
  let spec: AddConditioningEventSpec = {
    modality: payload.modality ?? null,
    customActivity: payload.customActivity,
    intensity: payload.intensity,
    durationMinutes: payload.durationMinutes,
    sets: payload.sets,
    repsMin: payload.repsMin,
    repsMax: payload.repsMax,
    restSeconds: payload.restSeconds,
    prescriptionType: payload.prescriptionType,
    bikeLabel: payload.bikeLabel,
    effortKind: payload.effortKind,
    trainingIntent: payload.trainingIntent,
  };

  if (isUnderspecifiedAddConditioningSpec(spec)) {
    const contextual = chooseBestConditioningAddition(args.targetDate, args.visibleWeek);
    if (contextual.kind === 'clarify') {
      return {
        kind: 'clarify',
        reply: contextual.question,
        options: contextual.options,
        reason: contextual.reason,
      };
    }
    spec = {
      ...spec,
      modality: contextual.modality,
      customActivity: contextual.title,
      intensity: contextual.intensity,
      durationMinutes: contextual.durationMinutes,
      sets: contextual.sets,
      repsMin: contextual.repsMin,
      repsMax: contextual.repsMax,
      restSeconds: contextual.restSeconds,
      prescriptionType: contextual.prescriptionType,
      effortKind: contextual.effortKind,
      trainingIntent: contextual.trainingIntent,
      description: contextual.description,
      notes: contextual.notes,
      conditioningFlavour: contextual.conditioningFlavour,
      conditioningCategory: contextual.category,
    };
  }

  const event = buildAddConditioningEvent(
    args.targetDate,
    spec,
    `coach-standalone-conditioning-${args.targetDate}`,
  );
  const after = event.after && typeof event.after === 'object'
    ? event.after as any
    : {};
  return {
    kind: 'ok',
    workout: workoutFromStandaloneConditioningAfter(args.targetDate, after),
  };
}

function workoutFromStandaloneConditioningAfter(
  targetDate: string,
  after: Record<string, any>,
): Workout {
  const now = new Date().toISOString();
  const title = String(after.title ?? 'Easy Aerobic Flush').trim() || 'Easy Aerobic Flush';
  const description = String(after.description ?? after.notes ?? title);
  const exerciseId = String(after.exerciseId ?? `coach-${normalisedConditioningTitle(title) || 'conditioning'}`);
  const minutes = Number(after.minutes ?? after.durationMinutes ?? 25) || 25;
  const conditioningFlavour =
    after.conditioningFlavour === 'high-intensity' || after.conditioningFlavour === 'tempo'
      ? after.conditioningFlavour
      : 'aerobic';
  const conditioningCategory =
    after.conditioningCategory === 'sprint' ||
    after.conditioningCategory === 'vo2' ||
    after.conditioningCategory === 'glycolytic'
      ? after.conditioningCategory
      : 'aerobic_base';
  const intensity =
    conditioningFlavour === 'high-intensity'
      ? 'High'
      : conditioningFlavour === 'tempo'
      ? 'Moderate'
      : 'Light';
  return {
    id: `coach-standalone-conditioning-${targetDate}`,
    microcycleId: 'coach-standalone',
    dayOfWeek: new Date(`${targetDate}T12:00:00`).getDay(),
    name: title,
    description,
    durationMinutes: minutes,
    intensity: intensity as any,
    workoutType: 'Conditioning',
    sessionTier: 'optional',
    hasCombinedConditioning: true,
    conditioningFlavour,
    conditioningCategory,
    conditioningBlock: {
      intent: conditioningFlavour,
      options: [{ title, description, exerciseIds: [exerciseId] }],
    },
    coachAddedConditioningLabel: title,
    coachNotes: ['Added standalone conditioning via coach'],
    exercises: [{
      id: exerciseId,
      exerciseId,
      exerciseOrder: 0,
      prescribedSets: Number(after.sets ?? 1) || 1,
      prescribedRepsMin: Number(after.repsMin ?? minutes) || minutes,
      prescribedRepsMax: Number(after.repsMax ?? after.repsMin ?? minutes) || minutes,
      prescriptionType: after.prescriptionType ?? 'duration_minutes',
      prescribedWeightKg: 0,
      restSeconds: Number(after.restSeconds ?? 0) || 0,
      notes: String(after.notes ?? description),
      exercise: {
        id: exerciseId,
        name: title,
        description,
        exerciseType: 'Cardio',
        muscleGroups: [],
        equipmentRequired: [],
        difficultyLevel: 'Intermediate',
        createdAt: now,
        updatedAt: now,
      } as any,
      createdAt: now,
      updatedAt: now,
    } as any],
    createdAt: now,
    updatedAt: now,
  } as Workout;
}

function findSourceSessionWorkout(args: {
  visibleWeek: (mondayISO: string) => ResolvedDay[];
  todayISO: string;
  targetDate: string;
  sourceDate?: string;
  sourceSessionName?: string;
}): Workout | null {
  const mondayCandidates = new Set<string>();
  mondayCandidates.add(getMondayForDate(args.todayISO));
  mondayCandidates.add(getMondayForDate(args.targetDate));
  if (args.sourceDate) mondayCandidates.add(getMondayForDate(args.sourceDate));

  const days = [...mondayCandidates].flatMap((monday) =>
    safeVisibleWeekForMonday(args.visibleWeek, monday),
  );
  if (args.sourceDate) {
    const sourceDay = days.find((day) => day.date === args.sourceDate);
    if (sourceDay?.workout && !isRemovedSessionProjection(sourceDay.workout)) {
      return sourceDay.workout as Workout;
    }
  }

  const wanted = normaliseSessionLookup(args.sourceSessionName ?? '');
  if (!wanted) return null;
  const wantedCompact = wanted.replace(/\s+/g, '');
  for (const day of days) {
    const workout = day.workout;
    if (!workout || isRemovedSessionProjection(workout)) continue;
    const candidate = normaliseSessionLookup(workout.name ?? '');
    const candidateCompact = candidate.replace(/\s+/g, '');
    if (
      candidate === wanted ||
      candidate.includes(wanted) ||
      wanted.includes(candidate) ||
      (candidateCompact.length >= 5 && wantedCompact.includes(candidateCompact)) ||
      (wantedCompact.length >= 5 && candidateCompact.includes(wantedCompact))
    ) {
      return workout as Workout;
    }
  }
  return null;
}

function normaliseSessionLookup(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:session|workout|the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildAddedSessionWorkout(
  sourceWorkout: Workout,
  targetDate: string,
  reason?: string,
): Workout {
  const clone: any = JSON.parse(JSON.stringify(sourceWorkout));
  const sourceId = String((sourceWorkout as any).id ?? 'session');
  clone.id = `${sourceId}-coach-add-${targetDate}`;
  clone.dayOfWeek = new Date(`${targetDate}T12:00:00`).getDay();
  clone.coachNotes = appendSessionCoachNote(sourceWorkout, reason ?? `Added to ${targetDate}: coach add_session`);
  clone.updatedAt = new Date().toISOString();
  return clone as Workout;
}

function appendSessionCoachNote(workout: Workout, note: string): string[] {
  const notes = Array.isArray((workout as any).coachNotes)
    ? [...((workout as any).coachNotes as string[])]
    : [];
  notes.push(note);
  return notes;
}

function verifyRenderedAddSession(args: {
  targetDate: string;
  sourceWorkout: Workout;
  beforeWorkout: ResolvedDay['workout'] | null;
  afterWorkout: ResolvedDay['workout'] | null;
  visibleWeekBefore: ResolvedDay[];
  visibleWeekAfter: ResolvedDay[];
}): RenderedAddSessionVerification {
  const targetAdded =
    (!args.beforeWorkout || isRemovedSessionProjection(args.beforeWorkout)) &&
    !!args.afterWorkout &&
    !isRemovedSessionProjection(args.afterWorkout) &&
    sessionNamesMatch(args.afterWorkout.name ?? '', args.sourceWorkout.name ?? '');
  const changedOtherDates = changedVisibleWeekDates(
    args.visibleWeekBefore,
    args.visibleWeekAfter,
  ).filter((date) => date !== args.targetDate);
  const comparableWeeks = args.visibleWeekBefore.length > 0 && args.visibleWeekAfter.length > 0;
  return {
    targetAdded,
    otherDaysUnchanged: !comparableWeeks || changedOtherDates.length === 0,
    changedOtherDates,
    beforeWorkoutName: args.beforeWorkout?.name ?? null,
    afterWorkoutName: args.afterWorkout?.name ?? null,
  };
}

function sessionNamesMatch(a: string, b: string): boolean {
  const left = normaliseSessionLookup(a);
  const right = normaliseSessionLookup(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function addSessionApplyRejectReply(targetDate: string, reason?: string): string {
  if (reason === 'past_date_blocked') {
    return `${humanDate(targetDate)} is in the past - I can't change it.`;
  }
  return reason
    ? `I couldn't add a session to ${humanDate(targetDate)}: ${reason}.`
    : `I couldn't add a session to ${humanDate(targetDate)}.`;
}

function verifyRenderedRemoveSession(args: {
  targetDate: string;
  beforeWorkout: ResolvedDay['workout'] | null;
  afterWorkout: ResolvedDay['workout'] | null;
  visibleWeekBefore: ResolvedDay[];
  visibleWeekAfter: ResolvedDay[];
}): RenderedRemoveSessionVerification {
  const targetRemoved =
    !!args.beforeWorkout &&
    (!args.afterWorkout || isRemovedSessionProjection(args.afterWorkout));
  const changedOtherDates = changedVisibleWeekDates(
    args.visibleWeekBefore,
    args.visibleWeekAfter,
  ).filter((date) => date !== args.targetDate);
  const comparableWeeks = args.visibleWeekBefore.length > 0 && args.visibleWeekAfter.length > 0;
  return {
    targetRemoved,
    otherDaysUnchanged: !comparableWeeks || changedOtherDates.length === 0,
    changedOtherDates,
    beforeWorkoutName: args.beforeWorkout?.name ?? null,
    afterWorkoutName: args.afterWorkout?.name ?? null,
  };
}

function isRemovedSessionProjection(workout: ResolvedDay['workout'] | null): boolean {
  if (!workout) return true;
  const anyWorkout: any = workout;
  return (
    anyWorkout.removed === true ||
    anyWorkout.isRemoved === true ||
    anyWorkout.sessionTier === 'removed' ||
    anyWorkout.workoutType === 'Removed' ||
    anyWorkout.workoutType === 'Rest'
  );
}

function changedVisibleWeekDates(before: ResolvedDay[], after: ResolvedDay[]): string[] {
  const beforeByDate = new Map(before.map((day) => [day.date, day]));
  const afterByDate = new Map(after.map((day) => [day.date, day]));
  const dates = new Set<string>([
    ...beforeByDate.keys(),
    ...afterByDate.keys(),
  ]);
  const changed: string[] = [];
  for (const date of dates) {
    const beforeDay = beforeByDate.get(date) ?? null;
    const afterDay = afterByDate.get(date) ?? null;
    if (removeSessionDayFingerprint(beforeDay) !== removeSessionDayFingerprint(afterDay)) {
      changed.push(date);
    }
  }
  changed.sort();
  return changed;
}

function removeSessionDayFingerprint(day: ResolvedDay | null): string {
  const workout = day?.workout ?? null;
  if (!workout) return JSON.stringify({ source: day?.source ?? null, workoutName: null, exercises: [] });
  const exercises = (workout.exercises ?? []).map((exercise: any) => ({
    id: String(exercise.id ?? exercise.exerciseId ?? ''),
    name: String(exercise.exercise?.name ?? exercise.exerciseId ?? ''),
    sets: exercise.prescribedSets ?? null,
    repsMin: exercise.prescribedRepsMin ?? null,
    repsMax: exercise.prescribedRepsMax ?? null,
    prescriptionType: exercise.prescriptionType ?? null,
  }));
  return JSON.stringify({
    source: day?.source ?? null,
    workoutName: workout.name ?? null,
    workoutType: (workout as any).workoutType ?? null,
    sessionTier: (workout as any).sessionTier ?? null,
    exercises,
  });
}

function safeVisibleWeekForMonday(
  visibleWeek: (mondayISO: string) => ResolvedDay[],
  mondayISO: string,
): ResolvedDay[] {
  try {
    return visibleWeek(mondayISO) ?? [];
  } catch (e) {
    logger.warn('[coach-command-executor] remove_session_visible_week_failed', {
      mondayISO,
      error: (e as Error)?.message ?? String(e),
    });
    return [];
  }
}

function rollbackRemoveSession(
  input: ExecuteCoachCommandInput,
  snapshot: RemoveSessionRollbackSnapshot,
  route: string,
): void {
  const rollback = input.removeSessionDeps?.rollback;
  try {
    if (rollback) {
      rollback(snapshot, { todayISO: input.todayISO });
    } else {
      restoreRemoveSessionStores(snapshot);
    }
    logger.debug('[coach-command-executor] rollback_failed_remove_session', {
      route,
      targetDate: snapshot.date,
    });
  } catch (e) {
    logger.warn('[coach-command-executor] rollback_failed_remove_session_threw', {
      route,
      targetDate: snapshot.date,
      error: (e as Error)?.message ?? String(e),
    });
  }
}

function restoreRemoveSessionStores(snapshot: RemoveSessionRollbackSnapshot): void {
  restoreCalendarMark(snapshot.date, snapshot.calendarMark);
  const store = useProgramStore.getState();
  if (snapshot.overrideWorkout) {
    store.setManualOverride(
      snapshot.date,
      snapshot.overrideWorkout,
      snapshot.overrideContext ?? undefined,
    );
    return;
  }
  store.removeManualOverride(snapshot.date);
}

function restoreCalendarMark(date: string, mark: CalendarDayType | null): void {
  const calendar = useCalendarStore.getState();
  calendar.removeRestDay(date);
  calendar.removeGameDay(date);
  calendar.removeNoGame(date);
  if (mark === 'rest') calendar.setRestDay(date);
  if (mark === 'game') calendar.setGameDay(date);
  if (mark === 'noGame') calendar.setNoGame(date);
}

function removeSessionApplyRejectReply(targetDate: string, reason?: string): string {
  if (reason === 'past_date_blocked') {
    return `${humanDate(targetDate)} is in the past - I can't change it.`;
  }
  return `I tried to remove the session on ${humanDate(targetDate)}, but the apply layer rejected it${reason ? ` (${reason})` : ''}.`;
}

// ─── Move session via applyMoveSession (Phase C) ────────────────────
//
// A session move is fundamentally cross-date, so it bypasses the
// per-event single-date applier (`applyAdjustmentEvents`) and goes
// through `applyMoveSession`, which writes BOTH source and dest in one
// orchestrated step. The flow mirrors `runReplaceExercise`:
//
//   1. Resolve source date from `command.target`. When target.kind ===
//      'unbound', emit an option-bearing clarifier listing the visible
//      week's actual sessions — never an open prompt.
//   2. Snapshot the source workout. Use it for (a) the "no workout to
//      move" reply, (b) the executor-side anchor refusal (team training
//      / game), and (c) deriving `movedSessionName` for verification +
//      reply text.
//   3. Resolve destination from `payload.toDate`. When missing, emit a
//      clarifier listing the visible week's days (with team-training /
//      game tags so the athlete sees which slots are off-limits).
//   4. Same-date guard — turn "move Wed to Wed" into a clarifier with
//      OTHER days as options.
//   5. Run `applyMove` (DI seam). Returns ApplyMoveSessionResult shaped
//      like ApplyEventsResult so the rejection-translation pattern in
//      composeMoveSessionResult can mirror the conditioning + replace
//      branches above.
//   6. Run `verifyRendered` (DI seam) — must observe BOTH render
//      surfaces flipping (source no longer shows the moved name; dest
//      does). "Done." only when fully verified.
//
// Anchor refusal (team training / game days) is enforced at THREE
// layers — router safety pre-pass (when the dow is decidable), this
// executor (when the source workout is loaded), and applyMoveSession
// (final write-time guard). Defence in depth: if any one of those
// layers misses the violation, the next catches it.

function runMoveSession(
  input: ExecuteCoachCommandInput,
  stages: ProgressStage[],
  tick: (s: ProgressStage) => void,
): ExecutionResult {
  const { command } = input;
  if (command.mode !== 'mutate' || command.operation !== 'move_session') {
    return {
      kind: 'error',
      reply: 'Internal error: runMoveSession called on wrong command.',
      applied: false,
      route: 'internal_error',
      progress: stages,
    };
  }
  const payload =
    command.payload.operation === 'move_session' ? command.payload : null;
  if (!payload) {
    return {
      kind: 'error',
      reply: 'Internal error: move_session payload mismatch.',
      applied: false,
      route: 'internal_error',
      progress: stages,
    };
  }

  const deps: MoveSessionDeps = input.moveSessionDeps ?? {};
  const applyMove = deps.applyMove ?? applyMoveSession;
  const verifyRendered = deps.verifyRendered ?? verifyRenderedSessionMove;
  const snapshotBefore = deps.snapshotBefore ?? defaultSnapshotBefore;
  const visibleWeek = deps.visibleWeek ?? defaultVisibleWeek;

  // ── 1. Resolve source. No progress ticks yet — keeps the existing
  //       contract that "missing target → clarify with one tick". ──
  const sourceDate = targetDateFor(command.target);
  if (!sourceDate) {
    const options = buildMoveSessionDayOptions(visibleWeek, input.todayISO, null);
    tick('composing_reply');
    return {
      kind: 'clarify',
      reply: 'Which session do you want to move?',
      applied: false,
      route: 'clarify_no_source:move_session',
      progress: stages,
      options,
    };
  }

  // ── 2. Snapshot source — needed for "no workout" + anchor checks. ──
  tick('checking_program');
  const sourceWorkout = snapshotBefore(sourceDate);
  if (!sourceWorkout) {
    tick('composing_reply');
    return {
      kind: 'verified_no_op',
      reply: `${humanDate(sourceDate)} doesn't have a workout to move.`,
      applied: false,
      route: 'no_workout:move_session',
      progress: stages,
    };
  }

  // Anchor refusal at the executor layer — defence in depth alongside
  // the router pre-pass and applyMoveSession's final guard.
  const sourceAny: any = sourceWorkout;
  if (sourceAny.isTeamDay === true || sourceAny.workoutType === 'Team Training') {
    tick('composing_reply');
    return {
      kind: 'rejected',
      reply:
        `${humanDate(sourceDate)} is a team training day - those are anchored ` +
        `to the calendar and can't be moved.`,
      applied: false,
      route: 'cannot_move_team_training:move_session',
      progress: stages,
    };
  }
  if (sourceAny.workoutType === 'Game' || sourceAny.sessionTier === 'game') {
    tick('composing_reply');
    return {
      kind: 'rejected',
      reply:
        `${humanDate(sourceDate)} is a game day - game-day sessions can't be moved.`,
      applied: false,
      route: 'cannot_move_game:move_session',
      progress: stages,
    };
  }

  const movedSessionName = moveSessionSummary(sourceWorkout);

  // ── 3. Resolve destination ─────────────────────────────────────
  const destDate = payload.toDate ?? null;
  if (!destDate) {
    const options = buildMoveSessionDayOptions(
      visibleWeek,
      input.todayISO,
      sourceDate,
    );
    tick('composing_reply');
    return {
      kind: 'clarify',
      reply: `Which day do you want me to move ${quoteSession(movedSessionName)} to?`,
      applied: false,
      route: 'clarify_no_dest:move_session',
      progress: stages,
      options,
    };
  }

  // ── 4. Same-date guard — convert into a clarifier with OTHER days. ──
  if (sourceDate === destDate) {
    const options = buildMoveSessionDayOptions(
      visibleWeek,
      input.todayISO,
      sourceDate,
    );
    tick('composing_reply');
    return {
      kind: 'clarify',
      reply:
        `Where do you want me to move ${quoteSession(movedSessionName)} to ` +
        `instead of ${humanDate(sourceDate)}?`,
      applied: false,
      route: 'clarify_same_date:move_session',
      progress: stages,
      options,
    };
  }

  // Mutation-history snapshot — capture BOTH affected dates' dateOverride
  // entries before the move runs. Restoring both is what undoes the swap
  // (or restores the source's workout while removing the dest write).
  const beforeOverrideMap = takeDateOverrideSnapshots(input, [sourceDate, destDate]);

  // ── 5. Apply the move. ─────────────────────────────────────────
  tick('applying_change');
  const applyResult = applyMove(
    {
      sourceDate,
      destDate,
      reason: payload.swap === true ? 'coach swap_session' : 'coach move_session',
      swap: payload.swap === true,
    },
    {
      todayISO: input.todayISO,
      allowFutureWeeks: true,
      allowPastDates: false,
    },
  );

  // ── 6. Verify dual-surface diff. ───────────────────────────────
  tick('verifying_update');
  const verification = verifyRendered({
    requestedDay: destDate,
    todayISO: input.todayISO,
    sourceDate,
    destDate,
    movedSessionName,
  });

  logger.debug('[coach-command-executor] move_session', {
    sourceDate,
    destDate,
    movedSessionName,
    swap: payload.swap === true,
    appliedCount: applyResult.applied.length,
    rejectedCount: applyResult.rejected.length,
    rejectedKinds: applyResult.rejected.map((r) => r.kind),
    programTabSourceHasMoved: verification.programTabSourceHasMoved,
    programTabDestHasMoved: verification.programTabDestHasMoved,
    dayWorkoutSourceHasMoved: verification.dayWorkoutSourceHasMoved,
    dayWorkoutDestHasMoved: verification.dayWorkoutDestHasMoved,
  });

  const result = composeMoveSessionResult({
    sourceDate,
    destDate,
    movedSessionName,
    swap: payload.swap === true,
    applyResult,
    verification,
    stages,
    tick,
  });

  if (result.kind === 'mutated' && result.applied) {
    const revertPlan = buildRevertPlanFromDateSnapshots(
      beforeOverrideMap,
      [sourceDate, destDate],
    );
    recordVerifiedMutation({
      input,
      result,
      operation: 'move_session',
      mutationKind: 'move_session',
      affectedDates: [sourceDate, destDate],
      scope: command.scope,
      revertPlan,
    });
  }

  return result;
}

function moveSessionSummary(workout: ResolvedDay['workout']): string {
  const base = workout?.name?.trim() || 'session';
  const items = extractVisibleProgramItemsFromWorkout(workout);
  const conditioning = items.find((item) => item.domain === 'conditioning');
  if (!conditioning?.title) return base;
  const conditioningTitle = conditioning.title.trim();
  if (!conditioningTitle || conditioningTitle.toLowerCase() === base.toLowerCase()) {
    return base;
  }
  return `${base} + ${conditioningTitle} session`;
}

function composeMoveSessionResult(args: {
  sourceDate: string;
  destDate: string;
  movedSessionName: string;
  swap: boolean;
  applyResult: ApplyMoveSessionResult;
  verification: RenderedSessionMoveVerification;
  stages: ProgressStage[];
  tick: (s: ProgressStage) => void;
}): ExecutionResult {
  const { sourceDate, destDate, movedSessionName, swap, applyResult, verification, stages, tick } = args;
  const niceSource = humanDate(sourceDate);
  const niceDest = humanDate(destDate);

  // Apply layer rejected the whole move — translate kinds into honest text.
  if (applyResult.applied.length === 0) {
    tick('composing_reply');
    const first = applyResult.rejected[0];
    let kind: ExecutionResultKind = 'verified_no_op';
    let body: string;
    switch (first?.kind) {
      case 'cannot_move_team_training':
        kind = 'rejected';
        body =
          first?.reason ??
          `That move would land on a team training day, which is anchored to the calendar.`;
        break;
      case 'cannot_move_game':
        kind = 'rejected';
        body = first?.reason ?? `Can't touch a game day - those are anchored.`;
        break;
      case 'past_date_blocked':
        body = `That date is in the past - I can't change it.`;
        break;
      case 'no_workout_on_date':
        body = `${niceSource} doesn't have a workout to move.`;
        break;
      case 'invalid_target_date':
        body =
          `That date isn't in the visible program - try a date inside this week or next.`;
        break;
      case 'invalid_event':
        body = first?.reason ?? `That move isn't valid.`;
        break;
      default:
        body =
          `I tried to move ${quoteSession(movedSessionName)} from ${niceSource} ` +
          `to ${niceDest}, but the apply layer rejected it` +
          `${first?.reason ? ` (${first.reason})` : ''}.`;
    }
    return {
      kind,
      reply: body,
      applied: false,
      route: `apply_rejected:move_session${first?.kind ? ':' + first.kind : ''}`,
      progress: stages,
    };
  }

  // Verification: source must NO LONGER show the moved name; dest must
  // show it. Both rules hold for one-way moves AND swaps — when swapping,
  // source receives the OTHER day's workout (so the moved name is gone),
  // and dest receives the source's workout (so the moved name lands).
  const sourceCleared =
    !verification.programTabSourceHasMoved && !verification.dayWorkoutSourceHasMoved;
  const destLanded =
    verification.programTabDestHasMoved && verification.dayWorkoutDestHasMoved;
  const fullyVerified = sourceCleared && destLanded;

  tick('composing_reply');
  if (!fullyVerified) {
    return {
      kind: 'verified_no_op',
      reply:
        `I tried to move ${quoteSession(movedSessionName)} from ${niceSource} ` +
        `to ${niceDest}, but the change didn't fully land on the visible program. ` +
        `Try editing those days directly - the apply layer didn't make it visible.`,
      applied: false,
      route: 'verification_failed:move_session',
      progress: stages,
    };
  }

  if (swap) {
    return {
      kind: 'mutated',
      reply: `Done. I swapped ${niceSource} and ${niceDest}.`,
      applied: true,
      route: 'move_session:applied',
      progress: stages,
    };
  }

  return {
    kind: 'mutated',
    reply: `Done - I moved ${weekdayName(sourceDate)}'s session to ${weekdayName(destDate)}.`,
    applied: true,
    route: 'move_session:applied',
    progress: stages,
  };
}

/**
 * Build the option chip list for a missing-source / missing-dest /
 * same-date clarifier. Lists each day's date + workout name and tags
 * anchor sessions (team training, game) as unavailable so the athlete
 * sees which slots they can't pick. When `excludeDate` is provided that
 * day is filtered out (used for the missing-dest clarifier — no point
 * offering "move to the same day").
 */
function buildMoveSessionDayOptions(
  visibleWeek: (mondayISO: string) => ResolvedDay[],
  todayISO: string,
  excludeDate: string | null,
): string[] {
  const week = safeVisibleWeek(visibleWeek, todayISO);
  const out: string[] = [];
  for (const d of week) {
    if (excludeDate && d.date === excludeDate) continue;
    const w: any = d.workout ?? null;
    if (!w) continue;
    let suffix = '';
    if (w.isTeamDay === true || w.workoutType === 'Team Training') {
      suffix = ' (team training - unavailable)';
    } else if (w.workoutType === 'Game' || w.sessionTier === 'game') {
      suffix = ' (game day - unavailable)';
    }
    const name = (w.name ?? '').trim() || 'Session';
    out.push(`${humanDate(d.date)} - ${name}${suffix}`);
  }
  return out;
}

/**
 * Best-effort visible-week supplier. Wraps the live store path in a
 * try/catch so the executor still produces a clarifier when running
 * inside test harnesses that don't have a Zustand store mounted.
 */
function defaultVisibleWeek(mondayISO: string): ResolvedDay[] {
  try {
    const state: ScheduleState = buildScheduleStateImperative();
    return resolveWeekWithConditioning(mondayISO, state);
  } catch (e) {
    logger.warn('[coach-command-executor] visible_week_failed', {
      mondayISO,
      error: (e as Error)?.message ?? String(e),
    });
    return [];
  }
}

function safeVisibleWeek(
  visibleWeek: (mondayISO: string) => ResolvedDay[],
  todayISO: string,
): ResolvedDay[] {
  try {
    const monday = getMondayForDate(todayISO);
    return visibleWeek(monday) ?? [];
  } catch (e) {
    logger.warn('[coach-command-executor] safe_visible_week_failed', {
      todayISO,
      error: (e as Error)?.message ?? String(e),
    });
    return [];
  }
}

/**
 * Wrap a session name in double quotes for the reply text — but only
 * when it's a real proper noun. The fallback "session" string from
 * runMoveSession (when no workout name was loaded) shouldn't be quoted.
 */
function quoteSession(name: string): string {
  if (!name || name === 'session') return 'that session';
  return `"${name}"`;
}

// ─── Honest "not supported" reply ───────────────────────────────────

function notSupported(
  operation: string,
  stages: ProgressStage[],
): ExecutionResult {
  // Per the contract: never lie. Tell the user the operation is
  // recognised but the engine path isn't wired yet, so they can rephrase
  // or route via the program tab.
  const human = humaniseOperation(operation);
  return {
    kind: 'not_supported',
    reply:
      `I understand you want to ${human}, ` +
      `but I can't apply that automatically yet. ` +
      `Try editing the session directly in the Program tab, or rephrase as a modality swap.`,
    applied: false,
    route: `not_supported:${operation}`,
    progress: stages,
  };
}

function humaniseOperation(op: string): string {
  switch (op) {
    case 'add_session': return 'add a session';
    case 'add_conditioning': return 'add a conditioning session';
    case 'remove_session': return 'remove a whole session';
    case 'remove_conditioning': return 'remove a conditioning session';
    case 'replace_exercise': return 'swap one strength exercise for another';
    case 'move_session': return 'move a session to a different day';
    case 'undo_last_change': return 'undo the most recent change';
    default: return op.replace(/_/g, ' ');
  }
}

// ─── Convenience accessors for the screen ───────────────────────────

export function describeStage(stage: ProgressStage): string {
  switch (stage) {
    case 'checking_program': return 'Checking program…';
    case 'applying_change': return 'Applying change…';
    case 'verifying_update': return 'Verifying update…';
    case 'composing_reply': return 'Writing reply…';
  }
}

export function isExecutionMutated(r: ExecutionResult): boolean {
  return r.kind === 'mutated';
}

export function targetSummary(t: CoachCommandTarget): string {
  switch (t.kind) {
    case 'date': return `${t.date}${t.sessionName ? ' / ' + t.sessionName : ''}`;
    case 'session_name': return t.sessionName;
    case 'exercise': return `${t.date} / ${t.exerciseName}`;
    case 'last_change': return 'last change';
    case 'unbound': return 'unbound';
  }
}
