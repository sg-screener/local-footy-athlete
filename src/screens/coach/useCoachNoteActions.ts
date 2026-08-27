/**
 * THE COACH-NOTE WRITERS, WITH THEIR SOURCE AS A PARAMETER — one home, two
 * mounts, and no second door.
 *
 * ## Why this file exists (SEAT_INBOX item 8, 2026-08-12)
 *
 * `CoachStatusScreen` — "My Status" — owns the program modifiers now. Seven of
 * its eight controls were inert because their writers lived inside
 * `useHomeScreen`, tangled with the day screen's own state. The merge plan's
 * binding rule forbids the obvious shortcut:
 *
 *   > **"My status" MOUNTS THE EXISTING DOORS. It does not build new ones.**
 *
 * So nothing here is new. `clearCoachNote` and `updateCoachNoteStatus` are
 * `handleClearCoachNote` and `handleUpdateCoachNoteStatus`, moved from
 * `useHomeScreen.ts` and changed in exactly ONE respect.
 *
 * ## THE ONE RESPECT: THE SOURCE IS INJECTED
 *
 * The moved code carried **nine hard-coded `screen: 'program_tab'` sites**.
 * That field is where a decision's authorship is written down, so a lift that
 * kept it would have recorded every My Status tap as a Program-tab tap — and
 * no cell in the repo read it, so nothing would have gone red.
 *
 * `src/__tests__/coachNoteActionSourceTests.ts` is the cell that now does, and
 * its header records the two premises of the order that turned out to be false
 * when measured. The short version, because it decides what a reader should
 * NOT go looking for: **these actions never reach the decision ledger** (only
 * three exercise-level action types do), so the athlete-action TAPE is the
 * whole record, and the durable door had to be taught to carry the screen
 * before this parameter was observable at all.
 *
 * ## WHY A FACTORY UNDER THE HOOK
 *
 * `createCoachNoteActions` is pure of React: it takes its notes, its result
 * handler and its observers as arguments. That is not a testing convenience —
 * it is what makes the provenance claim checkable at all. The defect class here
 * is a wrong ARGUMENT, not a wrong function (`AGENTS.md`: *"a cell that names a
 * function does not cover its arguments"*), and an argument is only assertable
 * where a test can hold the call.
 *
 * ## WHAT DELIBERATELY DID NOT MOVE
 *
 * **The rebuild.** `handleProgramControlResult` reaches `runRebuild`, which
 * regenerates the program — and generation is under another agent's stand-down.
 * It stays with its owner and arrives here as `onResult`, so this hook never
 * needs an opinion about what a rebuild is.
 *
 * **The render witnesses.** `setPendingInjuryObservation` and friends are the
 * day screen watching ITSELF re-render the result. They are that screen's
 * instrument, not this writer's, so they arrive as optional `observers`. The
 * Program tab passes the ones it always had; a surface with no witness renders
 * passes none, and says so rather than pretending to observe.
 */

import { useCallback, useMemo, useState } from 'react';
import { useProgramStore } from '../../store/programStore';
import { todayISOLocal } from '../../utils/appDate';
import { explorerTestId } from '../../utils/stableTestId';
import { registerAthleteActionUIOutcome } from '../../dev/e2e/athleteActionUIObservation';
import { isTemporaryEquipmentFact } from '../../rules/temporarySourceFact';
import { athleteSafeRefusal } from '../../utils/planChangeRefusalCopy';
import { clearReversibleAdjustment } from '../../store/reversibleAdjustmentTransaction';
import {
  executeProgramControlAction,
  executeProgramControlActionDurably,
  type ProgramControlActionResult,
  type ProgramControlStatusUpdate,
} from '../../utils/programControlActions';
import type { ProgramControlScreen } from '../../types/programControlAction';
import { dismissActiveCoachNote } from '../../utils/activeCoachNotes';
import type { ExerciseExclusionScope } from '../../rules/exerciseExclusions';
import { applyExerciseExclusionDecision } from '../../utils/exerciseExclusionOwner';
import {
  buildGuidedInjuryConstraint,
  guidedInjuryResultFromConstraint,
  type GuidedInjuryFlowResult,
} from '../../utils/guidedInjuryControl';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import type { ActiveInjuryConstraint } from '../../store/coachUpdatesStore';
import type {
  ActiveCoachNote,
  ActiveCoachNoteAction,
} from '../../utils/activeCoachNotes';
/**
 * MOVED WITH THE WRITERS, NOT COPIED BESIDE THEM. Both lived as file-local
 * declarations in `useHomeScreen`; `updateCoachNoteStatus` is their only reader,
 * so they travel with it rather than staying behind as an unread pair.
 */
type StatusModifierKind = 'recovery' | 'load_reduction' | 'readiness' | 'unknown';

const targetStatusModifierKind = (
  status: ProgramControlStatusUpdate,
): Exclude<StatusModifierKind, 'unknown'> => {
  if (status === 'still_sick') return 'recovery';
  if (status === 'still_cooked') return 'load_reduction';
  return 'readiness';
};

/**
 * THE DAY SCREEN'S RENDER WITNESSES, PASSED IN RATHER THAN OWNED.
 *
 * Each of these records that a door RETURNED something, so a later render can
 * be checked against it. Nothing here is load-bearing for the athlete: a mount
 * that supplies none still writes the same program state through the same door.
 */
export interface CoachNoteActionObservers {
  readonly onInjuryOutcome?: (observation: {
    traceId: string;
    observationId: string;
    episodeId: string;
    expectedStatus: 'active' | 'resolved';
    controlId: string;
  }) => void;
  readonly onRestorationOutcome?: (observation: {
    traceId: string;
    observationId: string;
    acceptedRevisionAfter: number;
    affectedDates: string[];
    adjustmentId: string;
    controlId: string;
  }) => void;
  readonly onSourceFactOutcome?: (args: {
    result: ProgramControlActionResult;
    domain: 'readiness' | 'equipment';
    expectedStatus: 'active' | 'resolved';
    factId?: string;
    controlId?: string;
  }) => void;
}

/**
 * HOW THIS SURFACE TELLS THE ATHLETE IT COULDN'T.
 *
 * The moved code called `Alert.alert` directly, and that import is what made
 * this module unloadable by the node harness every cell in this repo runs in —
 * so the provenance claim would have had nowhere to be checked. Inverting it is
 * not a testing convenience: **the screen owns how a refusal is shown**, the
 * writer owns only that there WAS one, and the two mounts are free to differ
 * later without this file learning about it.
 *
 * Both mounts pass `Alert.alert` today, so the athlete sees exactly what they
 * saw before the move.
 */
export type CoachNoteRefusalNotice = (title: string, message: string) => void;

export interface CoachNoteActionsInput {
  /**
   * WHERE THE ATHLETE IS ACTUALLY STANDING. `'program_tab'` or `'my_status'`
   * today; the type is the full door vocabulary because narrowing it here would
   * be a second opinion about what a screen is.
   */
  readonly screen: ProgramControlScreen;
  /** The derived modifier list this surface is showing. */
  readonly notes: readonly ActiveCoachNote[];
  /** What this screen does with a door result — rebuild notice, or nothing. */
  readonly onResult: (result: ProgramControlActionResult) => void | Promise<void>;
  /** Defaults to silence, so a mount that forgets it cannot crash a writer. */
  readonly notifyRefusal?: CoachNoteRefusalNotice;
  readonly observers?: CoachNoteActionObservers;
}

export interface CoachNoteActions {
  clearCoachNote: (noteId: string, observeResult?: boolean) => Promise<void>;
  dismissCoachNote: (noteId: string) => void;
  /**
   * THE THIRD WRITER OF THE SAME FAMILY, AND IT HAD TO COME TOO.
   *
   * `update_injury` opens the guided injury flow, and the flow's COMPLETION is
   * this call. Leaving it behind in `useHomeScreen` would have meant My Status
   * opening a sheet it could not commit — or a second copy of the writer on the
   * coach side, which is the one thing the merge plan forbids by name.
   */
  applyGuidedInjury: (
    result: GuidedInjuryFlowResult,
    existingId?: string,
  ) => Promise<void>;
  updateCoachNoteStatus: (
    noteId: string,
    status: ProgramControlStatusUpdate,
  ) => Promise<void>;
}

/**
 * The writers, outside React.
 *
 * Every `screen:` below reads `input.screen`. There is no literal `'program_tab'`
 * left in this file, and that absence is what the provenance cell protects.
 */
export function createCoachNoteActions(input: CoachNoteActionsInput): CoachNoteActions {
  const { screen, notes, onResult, observers, notifyRefusal } = input;

  const noteFor = (noteId: string): ActiveCoachNote | undefined =>
    notes.find((candidate) => candidate.id === noteId);

  const clearCoachNoteAction = (noteId: string) => executeProgramControlAction({
    type: 'clear_active_modifier',
    source: {
      screen,
      surface: 'coach_notes',
      initiatedBy: 'tap',
    },
    scope: 'current_and_future',
    payload: { noteId },
    requiresRebuild: false,
    createsActiveModifier: false,
    oneOffOnly: false,
  });

  const statusModifierKindForNote = (noteId: string): StatusModifierKind => {
    const note = noteFor(noteId);
    const sourceId = note?.constraintId ?? note?.modifierId ?? noteId;
    if (sourceId.includes('tap-recovery-mode')) return 'recovery';
    if (sourceId.includes('tap-load-reduction')) return 'load_reduction';
    if (sourceId.includes('readiness:')) return 'readiness';
    return 'unknown';
  };

  const clearCoachNote = async (
    noteId: string,
    observeResult = true,
  ): Promise<void> => {
    const note = noteFor(noteId);
    /**
     * ── "RESTORE EXERCISE" TAKES THE EXCLUSION OWNER'S DURABLE DOOR ─────────
     *
     * The same shape the injury arm below already has, for the same reason: a
     * clear whose world has to be RE-DERIVED cannot go through the synchronous
     * `clear_active_modifier` route, because that route can only ASK for a
     * rebuild and the rebuild it gets is `useProgramRebuild`'s author-path one.
     *
     * MEASURED 2026-08-20, walking the real control headlessly: the sync route
     * cleared the exclusion, reported `rebuildRequired: true`, and the
     * author-path rebuild then re-decided the emptied slot — the restored lift
     * went from 3 stored rows to **0**, so the athlete tapped Restore and lost
     * the exercise from their whole program. `restoreExcludedExerciseDurably`
     * settles by re-derivation instead, which restores what the block recorded
     * and re-applies the athlete's later swaps and adds on top of it.
     *
     * `excludedExercise` is the note's own field (`utils/activeCoachNotes`), so
     * this reads the note rather than re-deriving which modifier it came from.
     */
    if (note?.excludedExercise) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { restoreExcludedExerciseDurably } = require('../../utils/exerciseExclusionOwner');
      const restored = await restoreExcludedExerciseDurably(note.excludedExercise);
      const result: ProgramControlActionResult = {
        ok: restored.ok === true,
        changedProgram: restored.changedExistingDecision === true,
        // The door already settled. Asking for one more would be the
        // author-path rebuild this route exists to avoid.
        requiresRebuild: false,
        fallbackToCoach: false,
        route: 'guided_tap_flow',
      };
      await onResult(result);
      return;
    }
    if (note?.injuryEpisodeId) {
      const result = await executeProgramControlActionDurably({
        type: 'clear_injury_modifier',
        source: {
          screen,
          surface: 'coach_notes_injury_resolved',
          initiatedBy: 'tap',
        },
        scope: 'current_and_future',
        payload: { noteId, episodeId: note.injuryEpisodeId },
        requiresRebuild: false,
        createsActiveModifier: false,
        oneOffOnly: false,
      }, { todayISO: todayISOLocal() });
      if (result.ok && result.traceId) {
        const controlId = explorerTestId.injuryResolved(note.injuryEpisodeId);
        const observationId = `injury-resolved:${result.traceId}`;
        registerAthleteActionUIOutcome({
          traceId: result.traceId,
          observationId,
          domainReturn: {
            episodeId: note.injuryEpisodeId,
            changedProgram: result.changedProgram,
          },
          controlId,
        });
        observers?.onInjuryOutcome?.({
          traceId: result.traceId,
          observationId,
          episodeId: note.injuryEpisodeId,
          expectedStatus: 'resolved',
          controlId,
        });
      }
      await onResult(result);
      if (!result.ok) {
        notifyRefusal?.('Couldn’t resolve this injury', result.message ??
          'The accepted program could not be safely recomposed.');
      }
      return;
    }
    if (note?.reversibleAdjustmentId) {
      const result = await clearReversibleAdjustment(
        note.reversibleAdjustmentId,
        useProgramStore.getState().acceptedMaterialContext.revision,
      );
      const restored = result.outcome === 'restored' || result.outcome === 'recomposed' ||
        result.outcome === 'already-cleared';
      if (result.traceId && restored) {
        const observationId = `home-restoration-result:${result.traceId}`;
        registerAthleteActionUIOutcome({
          traceId: result.traceId,
          observationId,
          domainReturn: {
            outcome: result.outcome,
            acceptedRevisionAfter: result.acceptedRevisionAfter,
            affectedDates: result.affectedDates,
          },
          controlId: explorerTestId.adjustmentRestored(note.reversibleAdjustmentId),
        });
        observers?.onRestorationOutcome?.({
          traceId: result.traceId,
          observationId,
          acceptedRevisionAfter: result.acceptedRevisionAfter,
          affectedDates: result.affectedDates,
          adjustmentId: note.reversibleAdjustmentId,
          controlId: explorerTestId.adjustmentRestored(note.reversibleAdjustmentId),
        });
      }
      if (result.outcome === 'safely-rejected' || result.outcome === 'conflicted' ||
        result.outcome === 'superseded') {
        // result.reason can be a raw transaction error.message — never show it
        // verbatim (census finding #8 / addendum i). The safety gate collapses an
        // internal reason to plain copy; a curated reason passes through.
        notifyRefusal?.('Couldn’t restore this adjustment', athleteSafeRefusal(result.reason ??
          'Your program has changed since this adjustment was made.'));
      }
      return;
    }
    const acceptedContext = useProgramStore.getState().acceptedMaterialContext;
    const sourceFactId = note?.temporarySourceFactIds?.[0];
    const sourceFactDomain = sourceFactId && acceptedContext.temporarySourceFacts.some((fact) =>
      isTemporaryEquipmentFact(fact) && fact.factId === sourceFactId)
      ? 'equipment' as const
      : 'readiness' as const;
    const result = sourceFactId
      ? await executeProgramControlActionDurably({
          type: 'clear_fatigue_status',
          source: { screen, surface: 'coach_notes_resolved', initiatedBy: 'tap' },
          scope: 'current_and_future',
          payload: { modifierId: sourceFactId, date: todayISOLocal() },
          requiresRebuild: false,
          createsActiveModifier: false,
          oneOffOnly: false,
        }, { todayISO: todayISOLocal() })
      : clearCoachNoteAction(noteId);
    if (sourceFactId && observeResult) {
      observers?.onSourceFactOutcome?.({
        result,
        domain: sourceFactDomain,
        expectedStatus: 'resolved',
        factId: sourceFactId,
      });
    }
    await onResult(result);
  };

  const applyGuidedInjury = async (
    result: GuidedInjuryFlowResult,
    existingId?: string,
  ): Promise<void> => {
    const todayISO = todayISOLocal();
    const constraint = buildGuidedInjuryConstraint(result, { todayISO, existingId });
    const actionResult = await executeProgramControlActionDurably({
      type: 'set_injury_modifier',
      source: {
        screen,
        surface: 'guided_injury_flow',
        initiatedBy: 'tap',
      },
      scope: 'current_and_future',
      payload: { constraint },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    }, { todayISO });
    const episodeId = actionResult.createdModifierIds?.[0];
    if (actionResult.ok && actionResult.traceId && episodeId) {
      const controlId = explorerTestId.injuryActive(episodeId);
      const observationId = `injury-active:${actionResult.traceId}`;
      registerAthleteActionUIOutcome({
        traceId: actionResult.traceId,
        observationId,
        domainReturn: {
          episodeId,
          existingConstraintId: existingId ?? null,
          changedProgram: actionResult.changedProgram,
        },
        controlId,
      });
      observers?.onInjuryOutcome?.({
        traceId: actionResult.traceId,
        observationId,
        episodeId,
        expectedStatus: 'active',
        controlId,
      });
    }
    await onResult(actionResult);
  };

  const updateCoachNoteStatus = async (
    noteId: string,
    status: ProgramControlStatusUpdate,
  ): Promise<void> => {
    if (status === 'good_now') {
      await clearCoachNote(noteId);
      return;
    }
    const todayISO = todayISOLocal();
    const currentStatusKind = statusModifierKindForNote(noteId);
    const nextStatusKind = targetStatusModifierKind(status);
    if (currentStatusKind !== 'unknown' && currentStatusKind !== nextStatusKind) {
      await clearCoachNote(noteId, false);
    }
    const result = status === 'still_sick'
      ? executeProgramControlAction({
          type: 'set_recovery_mode',
          source: {
            screen,
            surface: 'coach_notes_status_update',
            initiatedBy: 'tap',
          },
          scope: 'current_week',
          payload: {
            date: todayISO,
            todayISO,
            recoveryScope: 'week',
          },
          requiresRebuild: false,
          createsActiveModifier: true,
          oneOffOnly: false,
        }, { todayISO })
      : await executeProgramControlActionDurably({
          type: 'set_fatigue_status',
          source: {
            screen,
            surface: 'coach_notes_status_update',
            initiatedBy: 'tap',
          },
          scope: status === 'still_cooked' ? 'current_week' : 'today_only',
          payload: {
            date: todayISO,
            todayISO,
            level: status === 'still_cooked'
              ? 'cooked'
              : status === 'worse'
                ? 'worse'
                : 'not_right',
          },
          requiresRebuild: false,
          createsActiveModifier: true,
          oneOffOnly: false,
        }, { todayISO });
    observers?.onSourceFactOutcome?.({
      result,
      domain: 'readiness',
      expectedStatus: 'active',
    });
    await onResult(result);
  };

  return {
    clearCoachNote,
    applyGuidedInjury,
    // NOT WRAPPED, NOT COPIED. `dismissActiveCoachNote` is a module-level
    // function with no hook dependencies — it is the one strand that was never
    // tangled, only standing behind the tangle. It joins the set so both mounts
    // route all eight kinds through ONE object rather than one object and an
    // exception.
    dismissCoachNote: dismissActiveCoachNote,
    updateCoachNoteStatus,
  };
}

/**
 * WHERE ONE MODIFIER ACTION GOES — the whole routing decision, in one pure
 * function, TOTAL over the eight kinds.
 *
 * This was three `if`s inside `HomeScreenV2.handleCoachNoteAction`. It is a
 * function now for one reason: the claim *"My Status offers no dead controls"*
 * is a claim about EVERY kind, and the only honest way to check "every" is to
 * ask the router about each one. A screen-embedded branch can only be read, and
 * a source scan that reads it is satisfied by dead code.
 *
 * `null` means "this kind reaches nothing", which is what
 * `test:my-status-modifiers` exists to forbid. It is not a fallback — there is
 * deliberately no `default` arm returning a sheet, because a router that always
 * answers cannot report a kind it does not know.
 */
export type CoachNoteActionRoute =
  | 'injury_flow'
  | 'dismiss'
  | 'clear_sheet'
  | 'update_sheet'
  | 'exclusion_scope_sheet';

export function coachNoteActionRoute(
  action: ActiveCoachNoteAction,
): CoachNoteActionRoute | null {
  switch (action.kind) {
    case 'update_injury':
      return 'injury_flow';
    case 'dismiss_note':
      return 'dismiss';
    /**
     * ── THE TWO EXCLUSION CONTROLS (Block Two, Sam's approved contract) ─────
     *
     * "Change scope" gets its OWN route because the update sheet it would
     * otherwise share asks *"How are you feeling now?"* with five readiness
     * answers — the wrong question, with none of Sam's three scopes on it.
     *
     * "Restore exercise" IS a clear, and takes the clear route deliberately —
     * the same reasoning `restore_adjustment` already carries a line above.
     * `clearActiveProgramModifier` routes an `athlete_preferences` clear
     * through `restoreExcludedExercise`, the canonical owner, so this control
     * is live rather than merely routed.
     */
    case 'change_exclusion_scope':
      return 'exclusion_scope_sheet';
    case 'restore_exclusion':
    case 'clear_injury':
    case 'clear_status':
    case 'clear_adjustment':
    // RESTORE IS A CLEAR, AND THAT IS THE DAY SCREEN'S OWN ANSWER, NOT A NEW
    // ONE. `HomeScreenV2` read `kind.startsWith('clear') || kind ===
    // 'restore_adjustment'`; putting an adjustment back is undoing it, and the
    // sheet it opens asks "Restore the previous fixture?".
    case 'restore_adjustment':
      return 'clear_sheet';
    case 'update_status':
    case 'update_adjustment':
      return 'update_sheet';
    default:
      return null;
  }
}

/** What a confirmation sheet is currently asking about, on either screen. */
export interface CoachNoteSheetState {
  readonly mode: 'clear' | 'update' | 'exclusion_scope';
  readonly note: ActiveCoachNote;
}

export interface CoachNoteActionsHook extends CoachNoteActions {
  /**
   * THE CONSTRAINT BEHIND THE NOTE THE INJURY FLOW IS EDITING, AND ITS PREFILL.
   *
   * Derived HERE and not at the mount, because `CoachTabScreen` may not import a
   * store — `coachTabSlice1Tests` asserts that import ban by name, and it is the
   * thing that keeps the coach tab from growing a second reading of the
   * athlete's state. This hook already reads the stores the writers need.
   */
  readonly injuryConstraint: ActiveInjuryConstraint | null;
  readonly injuryInitial: Partial<GuidedInjuryFlowResult> | undefined;
  /** The clear/update confirmation sheet's state, and its two edges. */
  readonly sheet: CoachNoteSheetState | null;
  readonly closeSheet: () => void;
  readonly confirmClear: () => void;
  readonly updateStatus: (status: ProgramControlStatusUpdate) => void;
  /** Sam's scope question, answered from My Status. */
  readonly changeExclusionScope: (scope: ExerciseExclusionScope) => void;
  /** The note whose injury the guided flow is currently editing. */
  readonly injuryNote: ActiveCoachNote | null;
  readonly closeInjuryFlow: () => void;
  /**
   * THE ROUTER. Which of the eight kinds opens which door — one answer, read by
   * both screens, so a kind cannot be live on one surface and dead on the other
   * by accident.
   */
  readonly onAction: (note: ActiveCoachNote, action: ActiveCoachNoteAction) => void;
}

export function useCoachNoteActions(input: CoachNoteActionsInput): CoachNoteActionsHook {
  const { screen, notes, onResult, observers, notifyRefusal } = input;
  const [sheet, setSheet] = useState<CoachNoteSheetState | null>(null);
  const [injuryNote, setInjuryNote] = useState<ActiveCoachNote | null>(null);

  const actions = useMemo(
    () => createCoachNoteActions({ screen, notes, onResult, observers, notifyRefusal }),
    [screen, notes, onResult, observers, notifyRefusal],
  );

  const activeConstraints = useCoachUpdatesStore((s) => s.activeConstraints);
  const injuryConstraint = useMemo(() => (injuryNote
    ? activeConstraints.find((constraint): constraint is ActiveInjuryConstraint =>
        constraint.type === 'injury' && constraint.id === injuryNote.constraintId) ?? null
    : null), [activeConstraints, injuryNote]);
  const injuryInitial = useMemo(
    () => guidedInjuryResultFromConstraint(injuryConstraint),
    [injuryConstraint],
  );

  const onAction = useCallback((
    note: ActiveCoachNote,
    action: ActiveCoachNoteAction,
  ) => {
    switch (coachNoteActionRoute(action)) {
      case 'injury_flow': return setInjuryNote(note);
      case 'dismiss': return actions.dismissCoachNote(note.id);
      case 'clear_sheet': return setSheet({ mode: 'clear', note });
      case 'update_sheet': return setSheet({ mode: 'update', note });
      case 'exclusion_scope_sheet': return setSheet({ mode: 'exclusion_scope', note });
      // A kind with no route does NOTHING here, visibly and on purpose. The
      // alternative — a fallback sheet — would open a confirmation for an action
      // this screen cannot perform, and the athlete would tap yes on it.
      default: return undefined;
    }
  }, [actions]);

  const confirmClear = useCallback(() => {
    if (!sheet) return;
    void actions.clearCoachNote(sheet.note.id);
    setSheet(null);
  }, [actions, sheet]);

  const updateStatus = useCallback((status: ProgramControlStatusUpdate) => {
    if (!sheet) return;
    void actions.updateCoachNoteStatus(sheet.note.id, status);
    setSheet(null);
  }, [actions, sheet]);

  /**
   * "CHANGE SCOPE", THROUGH THE ONE CANONICAL TRANSACTION OWNER.
   *
   * The exercise comes off the ROW rather than out of a second lookup: the
   * modifier's payload carries the canonical identity its builder stamped, and
   * a re-derivation here would be a second answer to "which exercise is this
   * row about".
   */
  const changeExclusionScope = useCallback((scope: ExerciseExclusionScope) => {
    const exercise = sheet?.note.excludedExercise;
    setSheet(null);
    if (typeof exercise !== 'string' || !exercise) return;
    applyExerciseExclusionDecision({ exercise, scope });
  }, [sheet]);

  return {
    ...actions,
    injuryConstraint,
    injuryInitial,
    sheet,
    closeSheet: useCallback(() => setSheet(null), []),
    confirmClear,
    updateStatus,
    changeExclusionScope,
    injuryNote,
    closeInjuryFlow: useCallback(() => setInjuryNote(null), []),
    onAction,
  };
}
