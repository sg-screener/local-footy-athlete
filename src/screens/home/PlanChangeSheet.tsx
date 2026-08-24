import React, { useMemo, useState, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { Button, Sheet, SheetHeader } from '../../components/ui';
import { LfaIcon } from '../../components/icons/LfaIcon';
import { RowIcon } from '../../components/icons/SectionIcon';
import { menuRowFor } from './planChangeTypeMenu';
import { useProgramStore } from '../../store';
import { applyProgramOverrideWrite } from '../../store/programStore';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import { useProfileStore } from '../../store/profileStore';
import { todayISOLocal } from '../../utils/appDate';
import type { ResolvedDay } from '../../utils/sessionResolver';
import {
  applyPlanChange,
  listPlanChangeOptionsForDay,
  previewPlanChangeRisk,
  removeEmptiesTheDay,
  type PlanChange,
  type PlanChangeBinScopeId,
  type PlanChangeCategoryId,
  type PlanChangeDayOptions,
  type PlanChangeMoveScopeId,
  type PlanChangeOutcome,
} from '../../utils/planChangeProducer';
import { isG1RoutedChange, type G1RoutedChange } from '../../utils/planChangeTypes';
import {
  executeProgramControlActionDurably,
  programControlActionForPlanChange,
} from '../../utils/programControlActions';
import { riskReasons } from '../../utils/planChangeRefusalCopy';
import { signedCopy } from '../../rules/signedCopy';
import {
  G1_LANDING_BACK_ROW,
  G1_LANDING_WARNING,
  g1LandingRoutesFor,
  type G1LandingAskContext,
} from '../../rules/g1LandingAsk';
import {
  TEAM_NIGHT_MOVE_ASK,
  TEAM_NIGHT_MOVE_ROUTE_IDS,
  type TeamNightMoveAskContext,
} from '../../rules/teamNightMoveAsk';
import {
  emitAthleteActionEvent,
  type AthleteActionTraceContext,
} from '../../utils/athleteActionDiagnostics';
import {
  mayOverrideBlock,
  BLOCK_OVERRIDE_LABEL,
  BLOCK_KEEP_LABEL,
} from '../../rules/blockOverride';
import {
  observeRenderedAthleteActionOutcome,
  registerAthleteActionUIOutcome,
} from '../../dev/e2e/athleteActionUIObservation';
import { explorerTestId } from '../../utils/stableTestId';
import { ExplorerRenderWitness } from '../../components/ExplorerRenderWitness';
import { getSessionComponents } from '../../utils/sessionComponents';

/**
 * PlanChangeSheet — the tap-first change door (ATHLETE_CHANGE_VOCABULARY.md
 * group 1, Phase 1).
 *
 * The athlete tapped a day, so there is no date ambiguity; they pick an
 * action, so there is no intent ambiguity; and the menu only lists options
 * the shared policy validates (bye gating, edit horizon, rest-day move
 * destinations), so nothing offered can be refused downstream. Changes
 * apply deterministically through the same writer as the chat coach —
 * no LLM in this path.
 *
 * THE SHEET RENDERS CAPABILITY; IT DOES NOT DERIVE IT (Sam's design rulings 7-9,
 * 2026-07-31). Whether a row is live comes from `PlanChangeDayOptions`, which is
 * the ONE projection's answer for this day — `projectVisibleWeek.projectParts`
 * via `listPlanChangeOptionsForDay`. This screen no longer asks "is this a
 * session?" and no longer reads a workout's name or `sessionTier` to decide what
 * an athlete may do with it. Two things went with that:
 *
 *   - THE OLD INTERMEDIATE MENU IS GONE (ruling 7/8). The programmed session
 *     card now enters the canonical Add, Move and Remove action menu through
 *     one compact plan-options doorway. The editable-session branch that chose between
 *     "Edit this session" and "Add optional session" went with it — it was a
 *     capability question answered by comparing a workout's type and tier against
 *     the word recovery and lowercasing its name, which is the second-derivation
 *     shape this unit removes (and the reason the source contract in
 *     `planChangeProducerTests` [9] now asserts those comparisons are ABSENT from
 *     this file, hence the circumlocution here).
 *   - THE READINESS ROW AND THE ASK-THE-COACH ROW ARE GONE (ruling 7). Readiness
 *     lives on the week card, which is the single week-level owner this sheet
 *     already handed off to; the Coach tab covers the escape hatch. A hand-off is
 *     still a door, and a door that exists in two places is two doors — which is
 *     why `readinessSourceFactOwnershipTests` now asserts the wording is ABSENT
 *     from this file (hence the circumlocution here) and PRESENT on the week
 *     card.
 */

type Step =
  | { kind: 'actions' }
  | { kind: 'add_blocked_max_sessions' }
  | { kind: 'add_blocked_duplicate'; duplicate: 'strength' | 'conditioning' }
  /** WHAT KIND OF SESSION — Add's single five-type path. */
  | { kind: 'pick_type' }
  | { kind: 'pick_conditioning' }
  | { kind: 'pick_strength' }
  | {
      kind: 'confirm_warning';
      change: PlanChange;
      title: string;
      reasons: string[];
      closeOnSuccess?: boolean;
      backStep: Step;
      trace: AthleteActionTraceContext;
    }
  | {
      // A6: no `title`. The refusal headline is the domain's own reason; the
      // sheet holds no competing constant. See utils/planChangeRefusalCopy.
      kind: 'block_warning';
      reasons: string[];
      backStep: Step;
      /**
       * THE WAY THROUGH, WHEN THERE IS ONE — Sam, 2026-08-12: *"should give
       * warnings but allow them to do whatever they want"*.
       *
       * Absent means the refusal stands, and it stands for exactly one reason:
       * the action is physically impossible (`canOverride: false`), or the app
       * could not say why it refused. `rules/blockOverride` owns that decision;
       * this screen only renders its answer.
       */
      override?: {
        change: PlanChange;
        closeOnSuccess?: boolean;
        trace?: AthleteActionTraceContext;
      };
    }
  | {
      // Sam's G-1 ask. The athlete has put a session on the day before their
      // game. Warn once, offer the three ruled routes, apply nothing until they
      // answer. All copy comes from rules/g1LandingAsk — the sheet holds none.
      //
      // The change is any door that can land content, not Move alone. A swap
      // onto the same day asks the same question, and while this step was typed
      // to a move it could never be shown for one.
      kind: 'g1_ask';
      change: G1RoutedChange;
      context: G1LandingAskContext;
      backStep: Step;
    }
  | {
      // The second, stronger warning. Route (c) alone, whatever was landed.
      kind: 'g1_deload_confirm';
      change: G1RoutedChange;
      context: G1LandingAskContext;
      backStep: Step;
    }
  | {
      // Sam's team-night ask (signed 2026-08-02): moving a team night asks
      // "just this once, or permanent?" — two routes + back, warning-register
      // chrome, all copy from rules/teamNightMoveAsk. One-off = a dated
      // schedule fact; permanent = the setup owner, confirmed INLINE here.
      kind: 'team_night_ask';
      change: Extract<PlanChange, { kind: 'move_team_night' }>;
      context: TeamNightMoveAskContext;
      backStep: Step;
    }
  | { kind: 'pick_move_scope' }
  | { kind: 'pick_destination'; scope: PlanChangeMoveScopeId }
  | { kind: 'pick_bin_scope' }
  /**
   * `label` NAMES WHAT GOES, or is null when everything on the day goes. Null is
   * not "no label" — it selects the sentence, because "the rest of the day
   * stays" is a claim about state and there is no rest of the day when the one
   * offered scope IS the day.
   */
  | { kind: 'confirm_remove'; scope: PlanChangeBinScopeId; label: string | null }
  | {
      kind: 'result';
      ok: boolean;
      /** Ruling #6: nothing published is its own answer, not a failure. */
      outcome?: PlanChangeOutcome;
      message: string;
      traceId?: string;
      observationId?: string;
      resultTestID?: string;
      canonicalResult?: {
        action: 'move' | 'delete';
        sourceDate: string;
        sourceSessionId: string;
        targetDate?: string;
        scope?: PlanChangeBinScopeId;
      };
    };

interface PlanChangeSheetProps {
  visible: boolean;
  date: string | null;
  weekDays: ResolvedDay[];
  initialAction?: PlanChangeInitialAction;
  /**
   * ⚠ **THE SCOPE THE ATHLETE ALREADY ANSWERED BY WHICH BIN THEY TAPPED —
   * SAM, 2026-08-25 (R-218a).** *"when I hit remove on a double day i get the
   * 'just the gym session' or 'just team training' option still — it should
   * know which one I'm trying to delete because i hit the bin icon on that
   * day."*
   *
   * ⚠ **THIS DOES NOT WEAKEN THE SKIP LAW ABOVE, AND THE DIFFERENCE IS THE
   * WHOLE POINT.** That law refuses to skip the scope step when the APP would
   * be INFERRING which session was meant — Sam's finding 3, where one offered
   * scope on a two-session day silently turned "move the gym session" into
   * "move everything". Here the athlete has already answered, with their
   * thumb, on the box itself. It is R-120b's *"the path is the context"*:
   * asking again would be asking a question they have just answered.
   *
   * **IT IS STILL VALIDATED AGAINST THE PRODUCER'S OFFER** — a scope the
   * producer does not offer for this day falls through to the question rather
   * than being committed. The board proposes; the producer still decides.
   */
  initialBinScope?: PlanChangeBinScopeId;
  /**
   * ⚠ **A COMPLETED MOVE, DRAGGED — R-218b (Sam, 2026-08-25): *"these boxes
   * should be able to be dragged and dropped"*.**
   *
   * A drag answers every question this sheet would otherwise ask in sequence:
   * WHICH session (the box lifted), and WHERE (the box dropped on). So the
   * sheet applies it rather than walking the athlete back through a menu they
   * have already operated with their hand.
   *
   * ⚠ **IT IS APPLIED THROUGH `apply`, THE SAME COMMIT THE DESTINATION LIST
   * USES.** Nothing here bypasses the producer: an illegal move still refuses,
   * and a G-1 landing still raises its ask. **The drag chose the change; it did
   * not decide whether the change is allowed** — and those are the two things
   * `a-legality-probe-is-not-a-change-probe` exists to keep apart.
   *
   * `teamNightRoute: 'this_week_only'` is Sam's answer, given before the plan:
   * dragging the club night moves it for this week and asks nothing. The
   * permanent route is untouched and still reachable from its own flow.
   */
  initialMove?: {
    toDate: string;
    scope: PlanChangeMoveScopeId | 'team';
  };
  fromWeek?: boolean;
  onClose: () => void;
}

export type PlanChangeInitialAction = 'add' | 'move' | 'remove';

function weekdayLabel(dateISO: string): string {
  const day = new Date(`${dateISO}T12:00:00`);
  return day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
}

export function PlanChangeSheet({
  visible, date, weekDays, initialAction, initialBinScope, initialMove,
  fromWeek = false, onClose,
}: PlanChangeSheetProps) {
  const [step, setStep] = useState<Step>({ kind: 'actions' });
  const onboardingData = useProfileStore((state) => state.onboardingData);
  const activeConstraints = useCoachUpdatesStore((state) => state.activeConstraints);

  // Fresh state every time the sheet opens for a (new) day. Week may already
  // have selected Add, Move or Remove; Day intentionally starts on this menu.
  useEffect(() => {
    if (visible) {
      setStep({ kind: 'actions' });
    }
  }, [visible, date]);

  const todayISO = todayISOLocal();
  const options: PlanChangeDayOptions | null = useMemo(() => {
    if (!visible || !date) return null;
    return listPlanChangeOptionsForDay({ visibleWeek: weekDays, date, todayISO });
  }, [visible, date, weekDays, todayISO]);
  useEffect(() => {
    if (step.kind !== 'result' || !step.traceId || !step.observationId ||
      !step.resultTestID || !step.canonicalResult) return;
    const sourceDay = weekDays.find((day) => day.date === step.canonicalResult!.sourceDate);
    const targetDay = step.canonicalResult.targetDate
      ? weekDays.find((day) => day.date === step.canonicalResult!.targetDate)
      : sourceDay;
    const sourceReleased = sourceDay?.workout?.id !== step.canonicalResult.sourceSessionId;
    const targetSessionId = targetDay?.workout?.id ?? null;
    const deletedScopeStillRendered = step.canonicalResult.action === 'delete' &&
      step.canonicalResult.scope && step.canonicalResult.scope !== 'whole_day'
      ? getSessionComponents(targetDay?.workout ?? null).some((component) =>
          component.id === step.canonicalResult!.scope ||
          (step.canonicalResult!.scope === 'team' && component.id === 'team_training'))
      : false;
    const renderedStateMatches = step.canonicalResult.action === 'move'
      ? sourceReleased && !!targetSessionId
      : step.canonicalResult.scope === 'whole_day'
        ? !targetSessionId
        : !deletedScopeStillRendered;
    if (!renderedStateMatches) return;
    observeRenderedAthleteActionOutcome({
      traceId: step.traceId,
      observationId: step.observationId,
      renderedText: {
        message: step.message,
        canonicalResult: step.canonicalResult,
        sourceReleased,
        targetSessionId,
        deletedScopeStillRendered,
      },
      controlId: step.resultTestID,
      accessibilityNode: {
        testID: step.resultTestID,
        role: 'text',
        canonicalIdentity: step.canonicalResult,
      },
    });
  }, [step, weekDays]);
  const selectedDay = useMemo(
    () => (date ? weekDays.find((day) => day.date === date) ?? null : null),
    [date, weekDays],
  );

  // Move entry point. The producer answers with either usable scopes or a
  // typed refusal, and BOTH are rendered — the device dead end was this tap
  // leading to a "Move to:" heading with nothing under it and no explanation.
  // A single scope with one obvious meaning skips straight to the destinations.
  const startMove = () => {
    const move = options?.move;
    if (!move) return;
    if (move.refusal) {
      setStep({
        kind: 'block_warning',
        reasons: [move.refusal.message],
        backStep: { kind: 'actions' },
      });
      return;
    }
    // Skipping the scope step is only safe when there is genuinely nothing to
    // disambiguate — ONE offered scope AND one visible session. Sam's finding
    // 3: on a day the app renders as two sessions the sheet skipped straight
    // to destinations because a single scope came back, so "move the gym
    // session" silently meant "move everything on this day". The producer no
    // longer offers a bare whole_day on a multi-session day; this is the
    // second half of the same law, and it holds even if a future offer
    // narrows to one scope for a reason this screen cannot see.
    if (move.scopes.length === 1 && options!.visibleSessionCount <= 1) {
      setStep({ kind: 'pick_destination', scope: move.scopes[0].id });
      return;
    }
    setStep({ kind: 'pick_move_scope' });
  };

  // Week deep links choose an action and date, then enter the same Add, Move or
  // Remove sequence. Day's plan-options doorway intentionally omits initialAction,
  // so the canonical three-action menu remains visible. There is no dedicated
  // whole-session Swap entry.
  useEffect(() => {
    if (!visible || !options || options.locked !== null || !initialAction) return;
    if (initialAction === 'add') {
      startAdd();
      return;
    }
    if (initialAction === 'move') {
      if (initialMove) {
        /* `closeOnSuccess` — a dragged move needs no result screen. Sam,
         * 2026-08-25, on seeing one: *"you see this pop up which doesn't really
         * make any sense"*. It read "Done. Session moved to 2026-07-15" under
         * the heading "What do you want to do with it?", which is a menu's
         * question answered by a menu the athlete never opened. **The board
         * showing the session in its new box IS the confirmation.** */
        apply(initialMove.scope === 'team'
          ? {
              kind: 'move_team_night',
              fromDate: date!,
              toDate: initialMove.toDate,
              teamNightRoute: 'this_week_only',
            }
          : {
              kind: 'move_session',
              fromDate: date!,
              toDate: initialMove.toDate,
              ...(initialMove.scope === 'whole_day' ? {} : { scope: initialMove.scope }),
            },
          { closeOnSuccess: true });
        return;
      }
      startMove();
      return;
    }
    if (options.canRemove) {
      startBin(initialBinScope);
    } else {
      setStep({
        kind: 'block_warning',
        reasons: ["There's nothing on this day yet."],
        backStep: { kind: 'actions' },
      });
    }
    // `options` deliberately is not a dependency. This is an entry transition,
    // not a watcher: after a successful edit the visible week changes, and
    // re-entering the chosen action then would overwrite its result screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, date, initialAction, initialBinScope, initialMove]);

  if (!date) return null;
  const selectedWorkout = selectedDay?.workout ?? null;

  const commitPlanChange = async (
    change: PlanChange,
    opts?: {
      closeOnSuccess?: boolean;
    },
    trace?: AthleteActionTraceContext,
  ) => {
    // The screen's door is one owner (`programControlActionForPlanChange`), so
    // the harness that has to enter it enters the same one instead of copying
    // this dispatch and drifting from it.
    const screenAction = programControlActionForPlanChange(change);
    const result = screenAction
      ? await executeProgramControlActionDurably(screenAction, { visibleWeek: weekDays, todayISO })
      : applyPlanChange({
          change,
          visibleWeek: weekDays,
          todayISO,
          // The athlete's own tap. LR-11: the screen no longer injects a raw
          // store primitive into the producer — it names itself at the door.
          applyOverride: (overrideDate, workout, context) =>
            void applyProgramOverrideWrite({
              date: overrideDate,
              workout,
              context,
              writer: 'athlete_tap',
            }),
          trace,
        });
    const canonicalResult = selectedWorkout && (
      change.kind === 'move_session' || change.kind === 'remove_session'
    ) ? {
        action: change.kind === 'move_session' ? 'move' as const : 'delete' as const,
        sourceDate: change.kind === 'move_session' ? change.fromDate : change.date,
        sourceSessionId: selectedWorkout.id,
        ...(change.kind === 'move_session' ? { targetDate: change.toDate } : {}),
        ...(change.kind === 'remove_session' ? { scope: change.scope } : {}),
      } : undefined;
    const resultIdentity = canonicalResult
      ? canonicalResult.action === 'move'
        ? `${canonicalResult.sourceSessionId}:${canonicalResult.targetDate}`
        : `${canonicalResult.sourceSessionId}:${canonicalResult.scope ?? 'whole_day'}`
      : undefined;
    const resultTestID = canonicalResult && resultIdentity
      ? explorerTestId.sessionMutationResult(canonicalResult.action, resultIdentity)
      : undefined;
    const observationId = result.traceId
      ? `plan-change-result:${result.traceId}`
      : undefined;
    if (result.ok && result.traceId && observationId && resultTestID && canonicalResult) {
      registerAthleteActionUIOutcome({
        traceId: result.traceId,
        observationId,
        domainReturn: {
          ok: result.ok,
          message: result.message,
          canonicalResult,
        },
        controlId: resultTestID,
      });
    }
    if (result.ok && opts?.closeOnSuccess) {
      // Destructive flows (bin) skip the result screen: the change is
      // already confirmed, so close straight back to the weekly plan.
      // The host's onClose handles any needed navigation (e.g. the
      // session screen goBacks when its workout no longer exists).
      onClose();
      return;
    }
    setStep({
      kind: 'result',
      ok: result.ok,
      outcome: result.outcome,
      message: result.message,
      traceId: result.traceId,
      observationId,
      resultTestID,
      canonicalResult,
    });
  };

  const apply = (
    change: PlanChange,
    opts?: {
      closeOnSuccess?: boolean;
      backStep?: Step;
    },
  ) => {
    const preview = previewPlanChangeRisk({
      change,
      visibleWeek: weekDays,
      todayISO,
      profile: onboardingData,
      activeConstraints,
    });
    if (!preview.ok) {
      setStep({ kind: 'result', ok: false, message: preview.message });
      return;
    }
    const backStep = opts?.backStep ?? { kind: 'actions' };
    // Before any risk framing: the athlete has put a session on the day before
    // their game and has not been asked yet. Nothing has been applied.
    if (preview.g1Ask && isG1RoutedChange(change)) {
      setStep({ kind: 'g1_ask', change, context: preview.g1Ask, backStep });
      return;
    }
    // The team-night ask (Sam, signed 2026-08-02): moving a team night asks
    // "just this once, or permanent?" before anything commits. Same shape as
    // the G-1 ask — an unanswered route is a question, not a refusal.
    if (preview.teamNightAsk && change.kind === 'move_team_night') {
      setStep({ kind: 'team_night_ask', change, context: preview.teamNightAsk, backStep });
      return;
    }
    if (preview.assessment.decision === 'block') {
      setStep({
        kind: 'block_warning',
        reasons: riskReasons(preview.assessment.findings),
        backStep,
        // LAYER 3. `canOverride` has been written in nine places and read in
        // none since it was added; this is its first production reader. When
        // every finding allows it, the athlete gets a way through — the app
        // warns, and then does what it was asked.
        override: mayOverrideBlock(preview.assessment.findings)
          ? { change, closeOnSuccess: opts?.closeOnSuccess, trace: preview.trace }
          : undefined,
      });
      return;
    }
    if (preview.assessment.decision === 'confirm') {
      setStep({
        kind: 'confirm_warning',
        change,
        title: 'Check this first',
        reasons: riskReasons(preview.assessment.findings),
        closeOnSuccess: opts?.closeOnSuccess,
        backStep,
        trace: preview.trace,
      });
      return;
    }
    void commitPlanChange(change, opts, preview.trace);
  };

  const pickerBackStep = (): Step => ({ kind: 'pick_type' });

  const categoryBackStep = (
    category: PlanChangeCategoryId,
  ): Step => {
    if (category.startsWith('conditioning_')) {
      return { kind: 'pick_conditioning' };
    }
    if (category.startsWith('strength_')) {
      return { kind: 'pick_strength' };
    }
    // Gunshow, Mobility and Accessories commit from the type list itself —
    // there is no bucket under them, so the way back is the list.
    return pickerBackStep();
  };

  const applyCategory = (category: PlanChangeCategoryId) =>
    apply(
      { kind: 'add_category', date, category },
      { backStep: categoryBackStep(category) },
    );

  const startAdd = () => {
    if ((options?.visibleSessionCount ?? 0) >= 2) {
      setStep({ kind: 'add_blocked_max_sessions' });
      return;
    }
    setStep({ kind: 'pick_type' });
  };

  /**
   * Adding a TYPE, before the athlete has picked a variant of it.
   *
   * The duplicate check is at the type row rather than at the category, because
   * "this day already has strength work" is true of Upper, Lower, Full, Gunshow
   * and Accessories alike, and finding that out after two more taps is a worse
   * answer than finding it out at the row that caused it. Mobility adds a
   * recovery-kind part, which never duplicates and never blocks (Sam's charter:
   * "you can always add a recovery or mobility flow to any day").
   */
  const chooseType = (
    adds: 'strength' | 'conditioning' | 'recovery',
    go: () => void,
  ) => {
    if ((options?.visibleSessionCount ?? 0) >= 2) {
      setStep({ kind: 'add_blocked_max_sessions' });
      return;
    }
    if (adds !== 'recovery' && (options?.visibleSessionKinds ?? []).includes(adds)) {
      setStep({ kind: 'add_blocked_duplicate', duplicate: adds });
      return;
    }
    go();
  };

  // Athlete override principle: safe edits commit, risky edits route
  // through the shared pre-commit risk assessor.
  const chooseCategory = (category: PlanChangeCategoryId) => {
    applyCategory(category);
  };

  // Remove entry point: multi-part days pick WHICH part first; days offering one
  // scope go straight to the are-you-sure.
  //
  // THE ONE OFFERED SCOPE IS THE SCOPE THAT GETS SENT. It used to hardcode
  // `whole_day` here, which was invisible until this task's capability work
  // ratified the Remove door on a team-only night: the producer offers exactly
  // one scope there — `team`, Sam's "can't make it tonight, this date only" —
  // and the sheet sent `whole_day`, which the writer refuses outright because
  // the day carries an anchor. The row was live, the tap was honest, and the
  // answer was a refusal for an action the athlete never asked for.
  //
  // `label: null` because a day that offers ONE scope has nothing else on it —
  // `binScopesForSnapshot` only lists a single part when that part is the day —
  // so removing it empties the day, and the confirmation must say so.
  //
  // ONE PREDICATE, THREE READERS. `removeEmptiesTheDay` (the producer, which owns
  // `binScopes`) decides whether the scope picker appears here, which sub-line the
  // Remove row carries below, and — through `label: null` — which confirmation
  // sentence follows. Sam's 2026-07-31 ruling gave the row a state-selected
  // sub-line, and a second predicate answering the same question is how the row
  // and the confirmation come to disagree about one day. See that function's
  // header for why the fact lives in the producer.
  const startBin = (preChosenScope?: PlanChangeBinScopeId) => {
    const scopes = options?.binScopes ?? [];
    // R-218a — the bin icon already said WHICH. Honoured only when the producer
    // actually offers that scope on this day; otherwise the question stands.
    const answered = preChosenScope
      && scopes.some((scope) => scope.id === preChosenScope)
      ? scopes.find((scope) => scope.id === preChosenScope)
      : null;
    if (answered) {
      setStep({ kind: 'confirm_remove', scope: answered.id, label: answered.label ?? null });
      return;
    }
    if (options && !removeEmptiesTheDay(options)) {
      setStep({ kind: 'pick_bin_scope' });
      return;
    }
    setStep({ kind: 'confirm_remove', scope: scopes[0]?.id ?? 'whole_day', label: null });
  };

  /**
   * ⚠ **A DRAGGED MOVE RUNS THIS SHEET WITHOUT SHOWING IT — SAM, 2026-08-25
   * (R-218d): *"the old pop up for 'add swap remove' etc pops up for a second,
   * but then disappears"*.**
   *
   * Routing the drag through this component was right — it is the one place
   * that previews risk, raises the G-1 and team-night asks and commits through
   * the durable door, and duplicating any of that would have been a second
   * change path. **Showing its MENU was wrong**: the athlete answered every
   * question that menu asks with their hand, so the sheet flashed a question
   * and an answer nobody needed.
   *
   * So it mounts INVISIBLE for a dragged move and reveals itself only if a step
   * appears that genuinely needs the athlete — a G-1 ask, a team-night ask, a
   * block, a confirm, or a failure. `step.kind === 'actions'` is the untouched
   * initial state, so "still on actions" means "nothing has asked yet".
   *
   * **A silent success closes it before any step is set at all**, through
   * `closeOnSuccess` — the same escape the bin flow already used.
   */
  const runningSilently = !!initialMove && step.kind === 'actions';

  return (
    <Sheet visible={visible && !runningSilently} onClose={onClose} testID="plan-change-sheet">
      <SheetHeader
        title={fromWeek ? weekdayLabel(date) : signedCopy('plan_change.session_options')}
        subtitle={fromWeek ? 'What do you want to do with it?' : weekdayLabel(date)}
      />

      {options?.locked === 'outside_horizon' && (
        <Text style={styles.lockedText}>
          This week is view-only for now — the plan firms up closer to the
          date, just like a real coach programs it.
        </Text>
      )}
      {(options?.locked === 'game_day' || options?.locked === 'not_visible') && (
        <Text style={styles.lockedText}>
          Nothing to change here right now.
        </Text>
      )}

      {/* PLAN OPTIONS' FIRST STEP. Week deep links may still skip it after the
          athlete has already chosen Add / Move / Remove there; nested questions
          return here on Back. The dedicated whole-session Swap action is gone.
          Every row's availability is a capability the
          projection computed for this day (`PlanChangeDayOptions`), rendered
          here; a row the athlete cannot use is shown OFF with the reason under
          it rather than hidden, because a menu that changes shape day to day is
          a menu the athlete has to relearn. */}
      {options && options.locked === null && step.kind === 'actions' && (
        <View>
          <MenuOption
            label={signedCopy('plan_change.add_to_session')}
            // NAMES NO TYPE. It read "Add extra strength or conditioning work to
            // this day", which named two of the five behind it (ruling 9) — and
            // that sub-line has now rotted twice, once when accessories split
            // and once when mobility arrived. The five rows are one tap away and
            // name themselves; see Batch 6a, where the enumerating alternative
            // is written out for Sam.
            sub="Put another session on this day"
            icon={<MaterialCommunityIcons name="plus-circle-outline" size={18} color={options.canAdd ? '#5BD98A' : MUTED} />}
            neutralIconChip
            disabled={!options.canAdd}
            testID="plan-change-add"
            onPress={startAdd}
          />
          <MenuOption
            label="Move this session"
            // The move refusal is the producer's own sentence, and it is the
            // most specific thing anyone can say about this day — so the
            // disabled row says it rather than a generic line.
            sub={options.move.refusal
              ? options.move.refusal.message
              : 'Move it to another day or trade places'}
            icon={<MaterialCommunityIcons name="arrow-right-bold-outline" size={18} color={options.move.refusal ? MUTED : '#67D7FF'} />}
            neutralIconChip
            disabled={!!options.move.refusal}
            testID={selectedWorkout
              ? explorerTestId.sessionMoveIngress(selectedWorkout.id)
              : undefined}
            onPress={() => startMove()}
          />
          {/* THE REMOVE ROW'S THREE SENTENCES.

              `canRemove` is false only when the day holds nothing at all (a
              fixture locks the whole sheet before this renders), so the
              nothing-here sentence cannot be shown over a day that has work on it.

              THE OTHER TWO ARE STATE-SELECTED, by the SAME predicate `startBin`
              uses (Sam, 2026-07-31, closing copy sheet §6-IV-3). Batch 3's
              "anything else on the day stays" was false on a day whose only
              content IS the session being removed — the very next screen says the
              day becomes rest — and batch 3's own principle is that a signed
              sentence must never be able to lie. A typed cause picks it now, the
              pattern this unit used for the Swap row's disabled lines. */}
          <MenuOption
            label={signedCopy('plan_change.remove_session')}
            sub={!options.canRemove
              ? "There's nothing on this day yet."
              : removeEmptiesTheDay(options)
                ? signedCopy('plan_change.remove_to_rest')
                : 'Remove it — anything else on the day stays.'}
            icon={<MaterialCommunityIcons name="delete-outline" size={18} color={options.canRemove ? '#FF7A85' : MUTED} />}
            neutralIconChip
            disabled={!options.canRemove}
            testID={selectedWorkout
              ? explorerTestId.sessionDeleteIngress(selectedWorkout.id)
              : undefined}
            danger
            onPress={startBin}
          />
          <Button
            label="Back"
            variant="ghost"
            size="md"
            glow={false}
            onPress={onClose}
            style={{ marginTop: 8 }}
          />
        </View>
      )}

      {options && options.locked === null && step.kind === 'add_blocked_max_sessions' && (
        <View>
          <Text style={styles.blockingTitle}>Please remove a session first</Text>
          <Text style={styles.confirmText}>
            This day already has 2 sessions. Remove one before adding another.
          </Text>
          <MenuOption
            label="Remove a session"
            icon={removeIcon(DANGER)}
            danger
            onPress={startBin}
          />
          <BackRow onPress={() => setStep({ kind: 'actions' })} />
        </View>
      )}

      {options && options.locked === null && step.kind === 'add_blocked_duplicate' && (
        <View>
          <Text style={styles.blockingTitle}>
            {step.duplicate === 'strength'
              ? 'Already has strength work'
              : 'Already has conditioning work'}
          </Text>
          <Text style={styles.confirmText}>
            {step.duplicate === 'strength'
              ? 'This day already includes a strength session. Remove one before adding another.'
              : 'This day already includes conditioning. Remove one before adding another.'}
          </Text>
          <MenuOption
            label="Remove a session"
            icon={removeIcon(DANGER)}
            danger
            onPress={startBin}
          />
          <BackRow onPress={() => setStep({ kind: 'pick_type' })} />
        </View>
      )}

      {/* WHAT KIND OF SESSION — the five types, Sam's design ruling 9.
          Add shows Strength, Conditioning, Gunshow, Mobility and Accessories.
          Strength and Conditioning open a bucket
          (which variant); the other three are a session on their own and commit
          from here.

          `recovery` is deliberately absent. It is still a
          `PLAN_CHANGE_CATEGORY_ID` — the charter charters the type and the
          resolver still places it — but ruling 9 names five types the athlete
          adds, and recovery is not one of them. `mobility` takes the slot it was
          hiding in: ten authored templates existed for months and this sheet
          never rendered a row for them.

          Every row still asks the producer whether its category is backed by a
          template on this date, so the menu can never offer a door that has
          nothing behind it. */}
      {options && options.locked === null && step.kind === 'pick_type' && (() => {
        const offers = (id: PlanChangeCategoryId) =>
          options.categories.some((category) => category.id === id);
        const copyFor = (id: PlanChangeCategoryId) =>
          options.categories.find((category) => category.id === id);
        // Row visibility comes from the MODEL (planChangeTypeMenu), so the
        // render vocabulary and the findability gate read one list — a
        // producer-offered category no row reaches is a red cell, not a
        // silent gap on a phone (device pass 2026-08-05, finding 3).
        const rowOffered = (rowId: Parameters<typeof menuRowFor>[0]) =>
          menuRowFor(rowId).reaches.some(offers);
        return (
        <View>
          <Text style={styles.sectionLabel}>Add:</Text>
          {rowOffered('strength') && (
            <MenuOption
              label="Strength"
              sub="Upper, lower or full body"
              icon={strengthIcon(ACCENT)}
              testID="plan-change-type-strength"
              onPress={() => chooseType('strength',
                () => setStep({ kind: 'pick_strength' }))}
            />
          )}
          {rowOffered('conditioning') && (
            <MenuOption
              label="Conditioning"
              sub="Light or hard - bike, row, ski or running"
              icon={conditioningIcon(ACCENT)}
              testID="plan-change-type-conditioning"
              onPress={() => chooseType('conditioning',
                () => setStep({ kind: 'pick_conditioning' }))}
            />
          )}
          {rowOffered('gunshow') && (
            <MenuOption
              label={copyFor('gunshow')!.label}
              sub={copyFor('gunshow')!.sub}
              icon={gunshowIcon(ACCENT)}
              testID="plan-change-type-gunshow"
              onPress={() => chooseType('strength',
                () => chooseCategory('gunshow'))}
            />
          )}
          {rowOffered('primer') && (
            <MenuOption
              label={copyFor('primer')!.label}
              sub={copyFor('primer')!.sub}
              icon={primerIcon(ACCENT)}
              testID="plan-change-type-primer"
              onPress={() => chooseType('strength',
                () => chooseCategory('primer'))}
            />
          )}
          {rowOffered('mobility') && (
            <MenuOption
              label={copyFor('mobility')!.label}
              sub={copyFor('mobility')!.sub}
              icon={mobilityIcon(ACCENT)}
              testID="plan-change-type-mobility"
              onPress={() => chooseType('recovery',
                () => chooseCategory('mobility'))}
            />
          )}
          {/* THE RECOVERY CHOICE (Sam, 2026-08-05, docs/DISPLAY_TIMES_RULING
              §1). The 2026-07-31 charter ruling stands — the app never PLACES
              recovery uninvited; an empty G+1 Sunday is REST. This row is the
              athlete's own door to CHOOSE one: the producer had offered the
              chartered category all along, and no row could reach it (device
              pass 2026-08-05, finding 3). Copy renders from CATEGORY_COPY —
              one name for the door. */}
          {rowOffered('recovery') && (
            <MenuOption
              label={copyFor('recovery')!.label}
              sub={copyFor('recovery')!.sub}
              icon={recoveryIcon(ACCENT)}
              testID="plan-change-type-recovery"
              onPress={() => chooseType('recovery',
                () => chooseCategory('recovery'))}
            />
          )}
          {/* RULING 9's "Accessories" ROW IS THE PREHAB DOOR. The charter split
              accessories into Gunshow and Prehab, and ruling 9 lists Gunshow
              separately, so this is the other half. SIGNED (Sam, 2026-07-31,
              closing copy sheet §6-IV-1): the athlete reads **"Accessories"** —
              ruling 9's own word. The word lives in `CATEGORY_COPY` and this row
              renders it, so there is still exactly one name for the door; the
              typed id stays `prehab` because ids are not copy. */}
          {rowOffered('prehab') && (
            <MenuOption
              label={copyFor('prehab')!.label}
              sub={copyFor('prehab')!.sub}
              icon={prehabIcon(ACCENT)}
              testID="plan-change-type-prehab"
              onPress={() => chooseType('strength',
                () => chooseCategory('prehab'))}
            />
          )}
          <BackRow onPress={() => setStep({ kind: 'actions' })} />
        </View>
        );
      })()}

      {/* Conditioning intensity. Availability is policy — Hard only appears
          when the producer offered it (bye weeks); the producer picks the
          concrete template. */}
      {options && step.kind === 'pick_conditioning' && (
        <View>
          <Text style={styles.sectionLabel}>Conditioning:</Text>
          {options.categories
            .filter((c) => c.id.startsWith('conditioning_'))
            .map((c) => (
              <MenuOption
                key={c.id}
                label={c.label}
                sub={c.sub}
                icon={conditioningIcon(ACCENT)}
                onPress={() => chooseCategory(c.id)}
              />
            ))}
          <BackRow onPress={() => setStep(pickerBackStep())} />
        </View>
      )}

      {/* Strength buckets. The athlete picks the bucket ("Upper body"); the
          producer picks push-vs-pull from what the week needs and the engine
          builds the session with the same principles as weekly programming.

          THREE BUCKETS, NOT FIVE. Gunshow and Prehab used to be listed here
          because "Strength" was the only door wide enough to hold them; ruling
          9 gives each its own row on the step above, so this bucket is the
          three strength sessions and nothing else. */}
      {options && step.kind === 'pick_strength' && (
        <View>
          <Text style={styles.sectionLabel}>Strength:</Text>
          {options.categories
            .filter((c) => c.id.startsWith('strength_'))
            .map((c) => (
              <MenuOption
                key={c.id}
                label={c.label}
                sub={c.sub}
                icon={strengthIcon(ACCENT)}
                onPress={() => chooseCategory(c.id)}
              />
            ))}
          <BackRow onPress={() => setStep(pickerBackStep())} />
        </View>
      )}

      {/* Pre-commit risk warning. Confirm-level findings can continue;
          hard stops cannot be overridden from this tap flow. */}
      {step.kind === 'confirm_warning' && (
        <View>
          <Text style={styles.blockingTitle}>{step.title}</Text>
          {step.reasons.map((reason) => (
            <Text key={reason} style={styles.confirmText}>{reason}</Text>
          ))}
          <MenuOption
            label="Continue"
            onPress={() => void commitPlanChange(
              step.change,
              { closeOnSuccess: step.closeOnSuccess },
              step.trace,
            )}
          />
          <MenuOption
            label="Cancel"
            onPress={() => setStep(step.backStep)}
          />
        </View>
      )}

      {step.kind === 'block_warning' && (
        <View>
          {/* A6: the domain's plain-language refusal IS the headline. The lead
              reason carries the prominence the generic "Can't apply this edit"
              used to take; any further reasons follow as supporting detail. The
              generic line survives only when the assessment gave us nothing to
              say, which should not happen for a hard stop. */}
          {step.reasons.length === 0 ? (
            <Text style={styles.blockingTitle}>Can't apply this edit</Text>
          ) : (
            step.reasons.map((reason, index) => (
              <Text
                key={reason}
                style={index === 0 ? styles.blockingReason : styles.confirmText}
              >
                {reason}
              </Text>
            ))
          )}
          {/* TWO CONTROLS WHEN THERE IS A WAY THROUGH, ONE WHEN THERE IS NOT.
              The refusal that stands keeps its single acknowledgement; the one
              the athlete may pass gets their choice, with the app's advice
              listed above it and its own words on the button. */}
          {step.override ? (
            <>
              <MenuOption
                label={BLOCK_KEEP_LABEL}
                onPress={() => setStep(step.backStep)}
              />
              <MenuOption
                label={BLOCK_OVERRIDE_LABEL}
                testID="plan-change-block-override"
                onPress={() => {
                  const { change: overridden, closeOnSuccess, trace } = step.override!;
                  // RECORDED BEFORE IT IS DONE, and on the same trace as the
                  // change. An override the app did not write down is an
                  // override that never happened as far as every later reader
                  // is concerned — which is the state item 9 names.
                  emitAthleteActionEvent(trace, 'athlete_action_override_allowed', {
                    overriddenReasons: step.reasons,
                    overriddenReasonCount: step.reasons.length,
                    changeKind: overridden.kind,
                  });
                  void commitPlanChange(overridden, { closeOnSuccess }, trace);
                }}
              />
            </>
          ) : (
            <MenuOption
              label="OK"
              onPress={() => setStep(step.backStep)}
            />
          )}
        </View>
      )}

      {step.kind === 'g1_ask' && (
        <View>
          <Text style={styles.blockingTitle}>{G1_LANDING_WARNING.ask.headline}</Text>
          <Text style={styles.confirmText}>
            {G1_LANDING_WARNING.ask.body(step.context)}
          </Text>
          {g1LandingRoutesFor(step.context).map((route) => (
            <MenuOption
              key={route.id}
              label={route.label(step.context)}
              sub={route.detail(step.context)}
              testID={`g1-route-${route.id}`}
              onPress={() => {
                // (a) commits nothing. The day keeps what it already holds and
                // any source session stays where it is, so there is no
                // transaction and nothing to undo — the sheet simply closes.
                if (!route.commits) {
                  onClose();
                  return;
                }
                if (route.requiresSecondWarning) {
                  setStep({
                    kind: 'g1_deload_confirm',
                    change: step.change,
                    context: step.context,
                    backStep: step,
                  });
                  return;
                }
                apply(
                  { ...step.change, g1Route: route.id },
                  { backStep: step.backStep, closeOnSuccess: true },
                );
              }}
            />
          ))}
          {/* ⚠ **R-221 / R-223 — THE SAME BACK TREATMENT AS THE OTHER POPUPS.**
            * Sam, 2026-08-25: *"it doesn't match the style of the other pop
            * ups"* and *"the bottom button should just say 'go back'"*.
            *
            * Session Options and the Week Adjust sheet both end in a centred
            * ghost button; this step ended in another list row, so the way OUT
            * looked like a fourth thing to choose. It is the same `Button`
            * those sheets use, not a copy of its look. The rows above already
            * share their padding and hairline divider — what differed was the
            * exit. */}
          <Button
            label={G1_LANDING_BACK_ROW.label()}
            variant="ghost"
            size="md"
            glow={false}
            testID="g1-route-back"
            onPress={() => setStep(step.backStep)}
            style={{ marginTop: 8 }}
          />
        </View>
      )}

      {step.kind === 'g1_deload_confirm' && (
        <View>
          <Text style={styles.blockingTitle}>
            {G1_LANDING_WARNING.deloadConfirm.headline(step.context)}
          </Text>
          <Text style={styles.confirmText}>{G1_LANDING_WARNING.deloadConfirm.body}</Text>
          <MenuOption
            label="Do it anyway"
            testID="g1-route-deloaded-confirm"
            onPress={() => apply(
              { ...step.change, g1Route: 'deloaded' },
              { backStep: step.backStep, closeOnSuccess: true },
            )}
          />
          <MenuOption label="Back" onPress={() => setStep(step.backStep)} />
        </View>
      )}

      {step.kind === 'team_night_ask' && (
        <View>
          <Text style={styles.blockingTitle}>{TEAM_NIGHT_MOVE_ASK.title()}</Text>
          <Text style={styles.confirmText}>{TEAM_NIGHT_MOVE_ASK.body()}</Text>
          {TEAM_NIGHT_MOVE_ROUTE_IDS.map((routeId) => (
            <MenuOption
              key={routeId}
              label={TEAM_NIGHT_MOVE_ASK.routeLabel(routeId, step.context)}
              testID={`team-night-route-${routeId}`}
              onPress={() => apply(
                { ...step.change, teamNightRoute: routeId },
                // Both routes confirm INLINE (Sam's choice 2): the result step
                // renders the signed success sentence in the sheet — never a
                // deep-link to program setup.
                { backStep: step.backStep },
              )}
            />
          ))}
          <MenuOption
            label={TEAM_NIGHT_MOVE_ASK.backLabel()}
            testID="team-night-route-back"
            onPress={() => setStep(step.backStep)}
          />
        </View>
      )}

      {options && !options.move.refusal && step.kind === 'pick_move_scope' && (
        <View>
          <Text style={styles.sectionLabel}>Move what?</Text>
          {options.move.scopes.map((scope) => (
            <MenuOption
              key={scope.id}
              label={scope.label}
              sub={scope.sub}
              icon={moveScopeIcon(scope.id, ACCENT)}
              testID={`plan-change-move-scope-${scope.id}`}
              onPress={() => setStep({ kind: 'pick_destination', scope: scope.id })}
            />
          ))}
          <BackRow onPress={() => setStep({ kind: 'actions' })} />
        </View>
      )}

      {options && !options.move.refusal && step.kind === 'pick_destination' && (() => {
        const scope = options.move.scopes.find((entry) => entry.id === step.scope);
        // Unreachable by construction — the producer never offers a scope with
        // an empty destination list, and startMove only routes here for a scope
        // it just read. Rendered rather than returning null so a future change
        // that breaks that invariant is visible instead of silent.
        if (!scope) {
          return (
            <View>
              <Text style={styles.blockingTitle}>
                {"That move isn't available any more — reopen the day and try again."}
              </Text>
              <MenuOption label="OK" onPress={() => setStep({ kind: 'actions' })} />
            </View>
          );
        }
        return (
          <View>
            <Text style={styles.sectionLabel}>Move to:</Text>
            {scope.destinations.map((destination) => (
              <MenuOption
                key={destination.date}
                label={weekdayLabel(destination.date)}
                sub={destination.placement === 'combine'
                  ? `Joins ${destination.occupiedBy} on this day`
                  : destination.placement === 'swap'
                    ? `Swap with ${destination.occupiedBy}`
                    : 'Currently a rest day'}
                // The producer owns the meaning. A Team Training destination
                // combines and therefore uses Move; only a real trade uses the
                // chasing-arrows mark.
                icon={destination.placement === 'swap'
                  ? swapIcon(ACCENT)
                  : destination.placement === 'combine'
                    ? moveIcon(ACCENT)
                    : dayIcon(ACCENT)}
                testID={explorerTestId.sessionMoveDestination(destination.date)}
                onPress={() => apply(scope.id === 'team'
                  // The anchor's own move: the typed ask decides once-or-
                  // permanent before anything commits (route travels back on
                  // the change; absent route raises the ask).
                  ? { kind: 'move_team_night', fromDate: date, toDate: destination.date }
                  : {
                      kind: 'move_session',
                      fromDate: date,
                      toDate: destination.date,
                      ...(scope.id === 'whole_day' ? {} : { scope: scope.id }),
                    })}
              />
            ))}
            <BackRow onPress={() => setStep(
              options.move.scopes.length > 1
                ? { kind: 'pick_move_scope' }
                : { kind: 'actions' })} />
          </View>
        );
      })()}

      {/* Multi-session days: pick WHICH part to bin before the
          are-you-sure. Options come from the producer (single owner of
          what's individually binnable on this day). */}
      {options && step.kind === 'pick_bin_scope' && (
        <View>
          <Text style={styles.sectionLabel}>Remove what?</Text>
          {options.binScopes.map((scope) => (
            <MenuOption
              key={scope.id}
              label={scope.label}
              sub={scope.sub}
              danger={scope.id === 'whole_day'}
              icon={binScopeIcon(scope.id, scope.id === 'whole_day' ? DANGER : '#FF7A85')}
              testID={selectedWorkout
                ? explorerTestId.sessionDeleteScope(selectedWorkout.id, scope.id)
                : undefined}
              onPress={() =>
                setStep({
                  kind: 'confirm_remove',
                  scope: scope.id,
                  label: scope.id === 'whole_day' ? null : scope.label.toLowerCase(),
                })}
            />
          ))}
          <BackRow onPress={() => setStep({ kind: 'actions' })} />
        </View>
      )}

      {step.kind === 'confirm_remove' && (
        <View>
          <Text style={styles.confirmText}>
            {step.label === null
              ? 'Are you sure? This will be removed and the day becomes rest.'
              : `Are you sure? This removes ${step.label} - the rest of the day stays.`}
          </Text>
          <MenuOption
            label="Yes, remove it"
            testID={selectedWorkout
              ? explorerTestId.sessionDeleteScope(selectedWorkout.id, `confirm-${step.scope}`)
              : undefined}
            danger
            onPress={() =>
              apply(
                { kind: 'remove_session', date, scope: step.scope },
              )}
          />
          <MenuOption
            label="No, keep it"
            onPress={() => setStep({ kind: 'actions' })}
          />
        </View>
      )}

      {step.kind === 'result' && (
        <View>
          {step.resultTestID ? (
            <ExplorerRenderWitness testID={step.resultTestID} />
          ) : null}
          <Text
            style={step.ok
              ? styles.resultOk
              : step.outcome === 'no_change'
                ? styles.resultNeutral
                : styles.resultBad}
            testID="plan-change-result-message"
            accessibilityRole="text"
          >
            {step.message}
          </Text>
          <Button
            label="Done"
            size="lg"
            glow={false}
            onPress={onClose}
            testID="plan-change-done"
          />
        </View>
      )}
    </Sheet>
  );
}

/**
 * One menu row, with an optional icon chip.
 *
 * The icon carrier is `HomeScreenV2`'s `SheetOption` — same fixed-size round
 * chip, same accent/danger tint, same 18px stroked glyph — so the two sheets an
 * athlete moves between look like one app rather than two. Rows without an icon
 * (Continue, Cancel, OK) keep the old plain layout: an empty chip beside a
 * confirmation button would be a shape carrying no meaning.
 *
 * `disabled` renders the row OFF rather than removing it. It is a real disable — no press
 * handler at all, `accessibilityState` set — because a row that looks dead and
 * still fires is worse than either.
 */
function MenuOption({ label, sub, icon, danger, neutralIconChip, disabled, onPress, testID }: {
  label: string;
  sub?: string;
  icon?: React.ReactNode;
  danger?: boolean;
  neutralIconChip?: boolean;
  disabled?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const body = (
    <>
      <Text style={[
        styles.optionLabel,
        danger && styles.optionDanger,
        disabled && styles.optionLabelDisabled,
      ]}>
        {label}
      </Text>
      {sub ? (
        <Text style={styles.optionSub} numberOfLines={2}>{sub}</Text>
      ) : null}
    </>
  );
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      /* R-109 (Sam, 2026-08-20): *"fix the six accessibility labels so athletes hear
         exercise names, not internal IDs."* The row is ONE accessibility leaf
         (`accessibilityRole="button"`), so its label is the whole of what a
         screen-reader user hears — and it was the test id.
         ⚠ **THE IDENTITY IS NOT LOST: `testID` still sets
         `accessibilityIdentifier`, which is what Maestro's `id:` and the
         explorer match on.** Only the SPOKEN name changes. */
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        icon ? styles.optionWithIcon : styles.option,
        pressed && !disabled && { opacity: 0.7 },
      ]}
    >
      {icon ? (
        <>
          <View style={[
            styles.optionIcon,
            danger && !disabled && !neutralIconChip && { backgroundColor: 'rgba(244, 67, 54, 0.12)' },
            !danger && !disabled && !neutralIconChip && { backgroundColor: 'rgba(200, 255, 0, 0.12)' },
          ]}>
            {icon}
          </View>
          <View style={{ flex: 1 }}>{body}</View>
        </>
      ) : body}
    </Pressable>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────
// Inline stroked SVG, the house pattern (`HomeScreenV2`'s `svg` helper). One
// recognisable shape per action and per session type — Sam's design ruling 10
// calls a glyph that does not mean its row a defect, so nothing here is a
// decorative reuse of a neighbour's shape.
const ACCENT = '#C8FF00';
const DANGER = '#F44336';
const MUTED = '#5A5A5A';

const glyph = (color: string, children: React.ReactNode) => (
  <Svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </Svg>
);

/** Swap — two arrows circling: this for that (Sam's pick, 2026-08-03 icon
 *  ruling row 5, replacing the two straight arrows). Same shape the day
 *  screen's per-row swap and the week screen's 'refresh' row kind already
 *  draw — one mark for "trade", wherever a swap door appears. */
const swapIcon = (color: string) => glyph(color, (
  <><Path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" /><Path d="M4 4v4h4" />
    <Path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" /><Path d="M20 20v-4h-4" /></>
));
/** Add — a plus. */
const addIcon = (color: string) => glyph(color, (
  <><Path d="M12 5v14" /><Path d="M5 12h14" /></>
));
/** Move — Sam's audit replaced the calendar combination with one clear arrow. */
const moveIcon = (color: string) => <LfaIcon name="move-right" color={color} />;
/** Remove — a minus in a circle (Sam's pick, 2026-08-03 icon ruling row 8,
 *  replacing the bin: the retired "bin" verb stays retired in imagery too).
 *  Same mark the day screen's per-row remove draws. Danger-tinted at the
 *  call site. */
const removeIcon = (color: string) => glyph(color, (
  <><Circle cx="12" cy="12" r="9" /><Path d="M8 12h8" /></>
));
/** Strength — a barbell. */
const strengthIcon = (color: string) => glyph(color, (
  <><Path d="M4 9v6" /><Path d="M7 7v10" /><Path d="M17 7v10" /><Path d="M20 9v6" />
    <Path d="M7 12h10" /></>
));
/** Conditioning — a heartbeat trace. */
const conditioningIcon = (color: string) => glyph(color, (
  <Path d="M2 12h4l2-6 4 12 2-6h8" />
));
/** Gunshow — a literal flexed bicep. */
const gunshowIcon = (color: string) => <LfaIcon name="flexed-arm" color={color} />;
/**
 * THE BOLT ALREADY EXISTED AND IS NOT REDRAWN HERE.
 *
 * Sam asked for a lightning bolt (R-129) and the app has had one since R-116 —
 * `RowIconKind: 'bolt'`, drawn once in `SectionIcon`. Reusing it means the Add
 * menu, the week row and the session screen cannot draw three different bolts.
 * He was told it is currently the Speed session's glyph and chose it anyway.
 */
const primerIcon = (color: string) => <RowIcon kind="bolt" size={15} color={color} />;
/** Mobility — a person stretching. */
const mobilityIcon = (color: string) => <LfaIcon name="mobility" color={color} />;
/** Accessories / prehab — the shared medical shield. */
const prehabIcon = (color: string) => <LfaIcon name="medical-shield" color={color} />;
/** Recovery — a full battery: restored capacity rather than another action arrow. */
/* Sam, 2026-08-23: *"Is it possible to change the recovery icon to a battery
 * thats like 3/4 full?"*. It was `full-energy` (a FULL battery), which read as
 * "you are charged" rather than "this is what tops you up". Amends the row this
 * sheet took from the 2026-08-11 icon audit; `test:approved-icons` moves with
 * it rather than being loosened. */
const recoveryIcon = (color: string) => (
  <LfaIcon name="three-quarter-energy" color={color} />
);
/** Team — two people: the anchor Bin's "team" scope removes. */
const teamIcon = (color: string) => glyph(color, (
  <><Circle cx="9" cy="8" r="3" /><Path d="M3.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" />
    <Circle cx="17" cy="9" r="2.3" /><Path d="M14.8 13.6c2 .4 3.2 2 3.2 5.4" /></>
));
/** A blank calendar day — an empty rest day to move onto (destinations,
 * carry-forward Task 4). Occupied destinations use `swapIcon` instead: the
 * icon says whether landing there trades with a session or lands on nothing. */
const dayIcon = (color: string) => glyph(color, (
  <><Rect x="3" y="5" width="18" height="16" rx="2" />
    <Path d="M3 10h18" /><Path d="M8 3v4" /><Path d="M16 3v4" /></>
));

/**
 * "Move what?" scope rows (carry-forward from Task 4) — `whole_day` reuses
 * the exact `moveIcon` from the four-action menu ("the move glyph family",
 * Sam's brief: everything on the day moves, same glyph as the row that opens
 * this step); the content scopes reuse the SAME per-type glyphs the
 * "Strength" / "Conditioning" rows already draw one step earlier in this
 * sheet — the scope IS a session type, so its icon says which one moves.
 */
function moveScopeIcon(id: PlanChangeMoveScopeId, color: string): React.ReactNode {
  if (id === 'strength') return strengthIcon(color);
  if (id === 'conditioning') return conditioningIcon(color);
  if (id === 'recovery') return recoveryIcon(color);
  if (id === 'team') return teamIcon(color);
  return moveIcon(color);
}
/**
 * "Remove what?" scope rows (carry-forward from Task 4) — the remove/danger
 * family per Sam's brief. `whole_day` gets the remove mark (a minus in a
 * circle — never a bin, Sam 2026-08-03) in full danger
 * red (everything goes); a partial scope shows what content is going, tinted
 * the same softer coral the row's own danger styling already uses, so the
 * glyph names the casualty instead of repeating the same bin four times.
 */
function binScopeIcon(id: PlanChangeBinScopeId, color: string): React.ReactNode {
  if (id === 'whole_day') return removeIcon(color);
  if (id === 'strength') return strengthIcon(color);
  if (id === 'conditioning') return conditioningIcon(color);
  if (id === 'recovery') return recoveryIcon(color);
  return teamIcon(color);
}

function BackRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}>
      <Text style={styles.backText}>‹ Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  confirmText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
    marginBottom: 8,
  },
  blockingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  // The lead refusal reason. Sized for a sentence rather than a label — it has
  // to carry the whole explanation at full contrast, which is the point of A6.
  blockingReason: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 22,
    marginBottom: 10,
  },
  lockedText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
    marginBottom: 8,
  },
  option: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  optionWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  optionDanger: {
    color: '#F44336',
  },
  /** An action this day does not offer. The reason sits in the sub-line. */
  optionLabelDisabled: {
    color: 'rgba(255,255,255,0.38)',
  },
  optionSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  back: {
    paddingVertical: 14,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#C8FF00',
  },
  secondaryButton: {
    marginTop: 8,
  },
  resultOk: {
    fontSize: 15,
    color: '#C8FF00',
    lineHeight: 21,
    marginBottom: 16,
  },
  resultBad: {
    fontSize: 15,
    color: '#F44336',
    lineHeight: 21,
    marginBottom: 16,
  },
  /** Nothing applied, nothing wrong (ruling #6) — neither the success green
   *  nor the failure red would be honest about that. */
  resultNeutral: {
    fontSize: 15,
    color: '#FFFFFF',
    opacity: 0.85,
    lineHeight: 21,
    marginBottom: 16,
  },
});
