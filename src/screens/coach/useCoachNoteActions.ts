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
    const constraint = note
      ? acceptedContext.activeConstraints
          .find((candidate) => candidate.id === note.constraintId)
      : null;
    const sourceFactId = note?.temporarySourceFactIds?.[0];
    const sourceFactDomain = sourceFactId && acceptedContext.temporarySourceFacts.some((fact) =>
      isTemporaryEquipmentFact(fact) && fact.factId === sourceFactId)
      ? 'equipment' as const
      : 'readiness' as const;
    const result = (constraint?.temporarySourceFactIds?.length ?? 0) > 0
      ? await executeProgramControlActionDurably({
          type: 'clear_fatigue_status',
          source: { screen, surface: 'coach_notes_resolved', initiatedBy: 'tap' },
          scope: 'current_and_future',
          payload: { noteId, modifierId: note?.modifierId, date: todayISOLocal() },
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
    // NOT WRAPPED, NOT COPIED. `dismissActiveCoachNote` is a module-level
    // function with no hook dependencies — it is the one strand that was never
    // tangled, only standing behind the tangle. It joins the set so both mounts
    // route all eight kinds through ONE object rather than one object and an
    // exception.
    dismissCoachNote: dismissActiveCoachNote,
    updateCoachNoteStatus,
  };
}

/** What a confirmation sheet is currently asking about, on either screen. */
export interface CoachNoteSheetState {
  readonly mode: 'clear' | 'update';
  readonly note: ActiveCoachNote;
}

export interface CoachNoteActionsHook extends CoachNoteActions {
  /** The clear/update confirmation sheet's state, and its two edges. */
  readonly sheet: CoachNoteSheetState | null;
  readonly closeSheet: () => void;
  readonly confirmClear: () => void;
  readonly updateStatus: (status: ProgramControlStatusUpdate) => void;
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

  const onAction = useCallback((
    note: ActiveCoachNote,
    action: ActiveCoachNoteAction,
  ) => {
    if (action.kind === 'update_injury') {
      setInjuryNote(note);
      return;
    }
    if (action.kind === 'dismiss_note') {
      actions.dismissCoachNote(note.id);
      return;
    }
    setSheet({
      mode: action.kind.startsWith('clear') || action.kind === 'restore_adjustment'
        ? 'clear'
        : 'update',
      note,
    });
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

  return {
    ...actions,
    sheet,
    closeSheet: useCallback(() => setSheet(null), []),
    confirmClear,
    updateStatus,
    injuryNote,
    closeInjuryFlow: useCallback(() => setInjuryNote(null), []),
    onAction,
  };
}
