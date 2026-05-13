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
} from '../store/coachMutationHistoryStore';
import {
  applyUndoPlan,
  readCurrentDateOverride,
  readCurrentDateOverrideMap,
  readCurrentModalityPreference,
  readCurrentModalityPreferenceMap,
  type ApplyUndoPlanResult,
  type ApplyUndoPlanDeps,
} from './coachUndoEngine';
import type { ModalityPreference } from '../store/coachPreferencesStore';
import type { Workout, OverrideContext } from '../types/domain';
import { logger } from './logger';

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
  }) => RenderedMutationVerification;
  /** Snapshots the workout on the target date BEFORE the apply call.
   *  Used to populate `verifyRendered`'s `beforeWorkout` argument so
   *  the verification can compare before/after. Tests can stub. */
  snapshotBefore?: (targetDate: string) => ResolvedDay['workout'] | null;
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
    reply: 'Done — I undid the last change.',
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
  const event: AdjustmentEvent =
    command.operation === 'add_conditioning'
      ? buildAddConditioningEvent(targetDate, modality, newEventId())
      : buildRemoveConditioningEvent(targetDate, newEventId());

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
  });

  logger.debug('[coach-command-executor] conditioning_mutation', {
    operation: command.operation,
    targetDate,
    modality,
    appliedCount: applyResult.applied.length,
    rejectedCount: applyResult.rejected.length,
    rejectedKinds: applyResult.rejected.map((r) => r.kind),
    programTabProjectionHasConditioning: verification.programTabProjectionHasConditioning,
    dayWorkoutProjectionHasConditioning: verification.dayWorkoutProjectionHasConditioning,
  });

  const result = composeConditioningResult({
    operation: command.operation,
    targetDate,
    modality,
    applyResult,
    verification,
    stages,
    tick,
  });

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
  applyResult: ApplyEventsResult;
  verification: RenderedMutationVerification;
  stages: ProgressStage[];
  tick: (s: ProgressStage) => void;
}): ExecutionResult {
  const { operation, targetDate, modality, applyResult, verification, stages, tick } = args;
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
  const programVerified =
    verification.programTabProjectionHasConditioning === wantsConditioning;
  const dayWorkoutVerified =
    verification.dayWorkoutProjectionHasConditioning === wantsConditioning;
  const fullyVerified = programVerified && dayWorkoutVerified;

  tick('composing_reply');
  if (!fullyVerified) {
    return {
      kind: 'verified_no_op',
      reply:
        operation === 'add_conditioning'
          ? `I added conditioning on ${niceDate}, but the change didn't show up on either the Program tab or the day view. ` +
            `Try editing that session directly — the apply layer didn't land it visibly.`
          : `I removed the conditioning on ${niceDate}, but the visible program still shows it. ` +
            `Try editing that session directly — the apply layer didn't land it visibly.`,
      applied: false,
      route: `verification_failed:${operation}`,
      progress: stages,
    };
  }

  // 3. Fully verified — derive a concrete reply.
  const reply =
    operation === 'add_conditioning'
      ? `Done. I added a${modality ? ` ${humanModality(modality)}` : ' light aerobic'} ` +
        `conditioning block to ${niceDate} after the strength work.`
      : `Done. I removed the conditioning block from ${niceDate}.`;
  return {
    kind: 'mutated',
    reply,
    applied: true,
    route: `${operation}:applied`,
    progress: stages,
  };
}

function buildAddConditioningEvent(
  date: string,
  modality: string | null,
  id: string,
): AdjustmentEvent {
  const titleByModality: Record<string, string> = {
    bike: 'Bike Intervals',
    row: 'Row Intervals',
    rower: 'Row Intervals',
    run: 'Aerobic Run',
    ski: 'SkiErg Intervals',
    swim: 'Easy Swim',
    cardio: 'Light Aerobic Intervals',
    aerobic: 'Light Aerobic Intervals',
    sprint: 'Sprint Intervals',
    mixed: 'MetCon',
  };
  const title = modality ? titleByModality[modality] ?? 'Light Aerobic Intervals' : 'Light Aerobic Intervals';
  const description =
    modality === 'sprint'
      ? '6 x 30s @ near-max effort, 2 min easy recovery between reps.'
      : '8 x 2 min @ 75-80% max HR, 1 min easy recovery between reps.';
  const coachNote = modality
    ? `Added ${humanModality(modality)} conditioning after strength`
    : 'Added light aerobic intervals after strength';
  return {
    id,
    kind: 'add_conditioning_block',
    date,
    reason: `coach add_conditioning${modality ? ` (${modality})` : ''}`,
    after: {
      title,
      description,
      coachNote,
      sets: 8,
      minutes: 2,
      restSeconds: 60,
    },
  };
}

function buildRemoveConditioningEvent(date: string, id: string): AdjustmentEvent {
  return {
    id,
    kind: 'remove_conditioning_block',
    date,
    reason: 'coach remove_conditioning',
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

function humanModality(modality: string): string {
  switch (modality) {
    case 'rower': return 'row';
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
      return `That session (${niceDate}) is in the past — I can't change it.`;
    case 'no_workout_on_date':
      return `${niceDate} doesn't have a workout to ${operation === 'add_conditioning' ? 'add to' : 'remove from'}.`;
    case 'invalid_target_date':
      return `${niceDate} isn't in the visible program — try a date inside this week.`;
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
        body = `${niceDate} is in the past — I can't change it.`;
        break;
      case 'no_workout_on_date':
        body = `${niceDate} doesn't have a workout to adjust.`;
        break;
      case 'invalid_target_date':
        body = `${niceDate} isn't in the visible program — try a date inside this week.`;
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
        `Try editing that session directly — the apply layer didn't make it visible.`,
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
        `${humanDate(sourceDate)} is a team training day — those are anchored ` +
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
        `${humanDate(sourceDate)} is a game day — game-day sessions can't be moved.`,
      applied: false,
      route: 'cannot_move_game:move_session',
      progress: stages,
    };
  }

  const movedSessionName = sourceWorkout.name?.trim() || 'session';

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
        body = first?.reason ?? `Can't touch a game day — those are anchored.`;
        break;
      case 'past_date_blocked':
        body = `That date is in the past — I can't change it.`;
        break;
      case 'no_workout_on_date':
        body = `${niceSource} doesn't have a workout to move.`;
        break;
      case 'invalid_target_date':
        body =
          `That date isn't in the visible program — try a date inside this week or next.`;
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
        `Try editing those days directly — the apply layer didn't make it visible.`,
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
    reply: `Done. I moved ${quoteSession(movedSessionName)} from ${niceSource} to ${niceDest}.`,
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
      suffix = ' (team training — unavailable)';
    } else if (w.workoutType === 'Game' || w.sessionTier === 'game') {
      suffix = ' (game day — unavailable)';
    }
    const name = (w.name ?? '').trim() || 'Session';
    out.push(`${humanDate(d.date)} — ${name}${suffix}`);
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
    case 'add_conditioning': return 'add a conditioning session';
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
