import React, { useMemo, useState, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { Button, Sheet } from '../../components/ui';
import { useProgramStore } from '../../store';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import { useProfileStore } from '../../store/profileStore';
import { todayISOLocal } from '../../utils/appDate';
import type { ResolvedDay } from '../../utils/sessionResolver';
import {
  applyPlanChange,
  listPlanChangeOptionsForDay,
  previewPlanChangeRisk,
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
import {
  G1_LANDING_BACK_ROW,
  G1_LANDING_WARNING,
  g1LandingRoutesFor,
  type G1LandingAskContext,
} from '../../rules/g1LandingAsk';
import type { AthleteActionTraceContext } from '../../utils/athleteActionDiagnostics';
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
 *   - THE INTERMEDIATE MENU IS GONE (ruling 7/8). "Want to change something?"
 *     used to open a menu whose only job was to open another menu; now it opens
 *     the four actions themselves. The editable-session branch that chose between
 *     "Edit this session" and "Add optional session" went with it — it was a
 *     capability question answered by comparing a workout's type and tier against
 *     the word recovery and lowercasing its name, which is the second-derivation
 *     shape this unit removes (and the reason the source contract in
 *     `planChangeProducerTests` [9] now asserts those comparisons are ABSENT from
 *     this file, hence the circumlocution here). An empty day now shows the same
 *     four rows with three of them off.
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
  /**
   * WHAT KIND OF SESSION — the five types of Sam's ruling 9, one step, two
   * modes. Add and Swap offer the SAME five rows, so they are one step with a
   * `mode` rather than two lists that can drift apart (`pick_add_kind` used to
   * offer two of the five and `pick_category` a different three).
   */
  | { kind: 'pick_type'; mode: 'swap' | 'add' }
  | { kind: 'pick_conditioning'; mode: 'swap' | 'add' }
  | { kind: 'pick_strength'; mode: 'swap' | 'add' }
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
  onClose: () => void;
}

function weekdayLabel(dateISO: string): string {
  const day = new Date(`${dateISO}T12:00:00`);
  return day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
}

export function PlanChangeSheet({
  visible, date, weekDays, onClose,
}: PlanChangeSheetProps) {
  const [step, setStep] = useState<Step>({ kind: 'actions' });
  const onboardingData = useProfileStore((state) => state.onboardingData);
  const activeConstraints = useCoachUpdatesStore((state) => state.activeConstraints);

  // Fresh menu every time the sheet opens for a (new) day. The four actions ARE
  // the first step — there is no menu in front of the menu (ruling 8).
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
          setManualOverride: (overrideDate, workout, context) =>
            useProgramStore.getState().setManualOverride(overrideDate, workout, context),
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
    if (preview.assessment.decision === 'block') {
      setStep({
        kind: 'block_warning',
        reasons: riskReasons(preview.assessment.findings),
        backStep,
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

  const pickerBackStep = (mode: 'swap' | 'add'): Step => ({ kind: 'pick_type', mode });

  const categoryBackStep = (
    mode: 'swap' | 'add',
    category: PlanChangeCategoryId,
  ): Step => {
    if (category.startsWith('conditioning_')) {
      return { kind: 'pick_conditioning', mode };
    }
    if (category.startsWith('strength_')) {
      return { kind: 'pick_strength', mode };
    }
    // Gunshow, Mobility and Accessories commit from the type list itself —
    // there is no bucket under them, so the way back is the list.
    return pickerBackStep(mode);
  };

  const applyCategory = (
    mode: 'swap' | 'add',
    category: PlanChangeCategoryId,
  ) =>
    apply(
      mode === 'swap'
        ? { kind: 'swap_category', date, category }
        : { kind: 'add_category', date, category },
      { backStep: categoryBackStep(mode, category) },
    );

  const startAdd = () => {
    if ((options?.visibleSessionCount ?? 0) >= 2) {
      setStep({ kind: 'add_blocked_max_sessions' });
      return;
    }
    setStep({ kind: 'pick_type', mode: 'add' });
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
    mode: 'swap' | 'add',
    adds: 'strength' | 'conditioning' | 'recovery',
    go: () => void,
  ) => {
    if (mode === 'swap') { go(); return; }
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
  const chooseCategory = (
    mode: 'swap' | 'add',
    category: PlanChangeCategoryId,
  ) => {
    applyCategory(mode, category);
  };

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
  const startBin = () => {
    const scopes = options?.binScopes ?? [];
    if (scopes.length > 1) {
      setStep({ kind: 'pick_bin_scope' });
      return;
    }
    setStep({ kind: 'confirm_remove', scope: scopes[0]?.id ?? 'whole_day', label: null });
  };

  return (
    <Sheet visible={visible} onClose={onClose} testID="plan-change-sheet">
      <Text style={styles.title}>
        {weekdayLabel(date)}
      </Text>

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

      {/* THE FOUR ACTIONS — Sam's design rulings 7-9, 2026-07-31.
          This IS the first step. Every row's availability is a capability the
          projection computed for this day (`PlanChangeDayOptions`), rendered
          here; a row the athlete cannot use is shown OFF with the reason under
          it rather than hidden, because a menu that changes shape day to day is
          a menu the athlete has to relearn. */}
      {options && options.locked === null && step.kind === 'actions' && (
        <View>
          <MenuOption
            label="Swap this session"
            // WHY IT IS OFF, NOT A GENERIC LINE — and selected by a typed fact
            // the projection owns, never by guessing. `canSwap` is false for two
            // different days: one with nothing on it, and one whose whole
            // content is a fixed appointment. "There's nothing here to swap"
            // was true of the first and false of the second (a team night HAS
            // something; it just is not the athlete's to trade), and a signed
            // sentence must never be able to lie (batch 3).
            sub={options.canSwap
              ? 'Change it for another type of session'
              : options.hasSession
                ? 'Nothing on this day can be swapped.'
                : "There's nothing on this day yet."}
            icon={swapIcon(options.canSwap ? ACCENT : MUTED)}
            disabled={!options.canSwap}
            testID="plan-change-swap"
            onPress={() => setStep({ kind: 'pick_type', mode: 'swap' })}
          />
          <MenuOption
            label="Add to this day"
            // NAMES NO TYPE. It read "Add extra strength or conditioning work to
            // this day", which named two of the five behind it (ruling 9) — and
            // that sub-line has now rotted twice, once when accessories split
            // and once when mobility arrived. The five rows are one tap away and
            // name themselves; see Batch 6a, where the enumerating alternative
            // is written out for Sam.
            sub="Put another session on this day"
            icon={addIcon(options.canAdd ? ACCENT : MUTED)}
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
            icon={moveIcon(options.move.refusal ? MUTED : ACCENT)}
            disabled={!!options.move.refusal}
            testID={selectedWorkout
              ? explorerTestId.sessionMoveIngress(selectedWorkout.id)
              : undefined}
            onPress={() => startMove()}
          />
          <MenuOption
            label="Remove this session"
            // `canRemove` is false only when the day holds nothing at all (a
            // fixture locks the whole sheet before this renders), so this
            // sentence cannot be shown over a day that has work on it.
            sub={options.canRemove
              ? 'Remove it — anything else on the day stays.'
              : "There's nothing on this day yet."}
            icon={removeIcon(options.canRemove ? DANGER : MUTED)}
            disabled={!options.canRemove}
            testID={selectedWorkout
              ? explorerTestId.sessionDeleteIngress(selectedWorkout.id)
              : undefined}
            danger
            onPress={startBin}
          />
          <BackRow onPress={onClose} />
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
              ? 'This day already includes a strength session. Swap the current session or remove one before adding another.'
              : 'This day already includes conditioning. Swap the current session or remove one before adding another.'}
          </Text>
          <MenuOption
            label="Swap this session"
            icon={swapIcon(ACCENT)}
            onPress={() => setStep({ kind: 'pick_type', mode: 'swap' })}
          />
          <MenuOption
            label="Remove a session"
            icon={removeIcon(DANGER)}
            danger
            onPress={startBin}
          />
          <BackRow onPress={() => setStep({ kind: 'pick_type', mode: 'add' })} />
        </View>
      )}

      {/* WHAT KIND OF SESSION — the five types, Sam's design ruling 9.
          Add and Swap show the SAME five rows: Strength, Conditioning, Gunshow,
          Mobility and Accessories. Strength and Conditioning open a bucket
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
        const mode = step.mode;
        return (
        <View>
          <Text style={styles.sectionLabel}>{mode === 'swap' ? 'Swap to:' : 'Add:'}</Text>
          {(offers('strength_upper') || offers('strength_lower') || offers('strength_full')) && (
            <MenuOption
              label="Strength"
              sub="Upper, lower or full body"
              icon={strengthIcon(ACCENT)}
              testID="plan-change-type-strength"
              onPress={() => chooseType(mode, 'strength',
                () => setStep({ kind: 'pick_strength', mode }))}
            />
          )}
          {(offers('conditioning_light') || offers('conditioning_hard')) && (
            <MenuOption
              label="Conditioning"
              sub="Light or hard - bike, row, ski or intervals"
              icon={conditioningIcon(ACCENT)}
              testID="plan-change-type-conditioning"
              onPress={() => chooseType(mode, 'conditioning',
                () => setStep({ kind: 'pick_conditioning', mode }))}
            />
          )}
          {offers('gunshow') && (
            <MenuOption
              label={copyFor('gunshow')!.label}
              sub={copyFor('gunshow')!.sub}
              icon={gunshowIcon(ACCENT)}
              testID="plan-change-type-gunshow"
              onPress={() => chooseType(mode, 'strength',
                () => chooseCategory(mode, 'gunshow'))}
            />
          )}
          {offers('mobility') && (
            <MenuOption
              label={copyFor('mobility')!.label}
              sub={copyFor('mobility')!.sub}
              icon={mobilityIcon(ACCENT)}
              testID="plan-change-type-mobility"
              onPress={() => chooseType(mode, 'recovery',
                () => chooseCategory(mode, 'mobility'))}
            />
          )}
          {/* RULING 9's "Accessories" ROW IS THE PREHAB DOOR. The charter split
              accessories into Gunshow and Prehab, and ruling 9 lists Gunshow
              separately, so this is the other half. Which WORD the athlete
              reads — "Accessories" or "Prehab" — is a Batch 6 question for Sam;
              until he signs one, the row renders the label the producer already
              proposed rather than inventing a second name for one door. */}
          {offers('prehab') && (
            <MenuOption
              label={copyFor('prehab')!.label}
              sub={copyFor('prehab')!.sub}
              icon={prehabIcon(ACCENT)}
              testID="plan-change-type-prehab"
              onPress={() => chooseType(mode, 'strength',
                () => chooseCategory(mode, 'prehab'))}
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
                onPress={() => chooseCategory(step.mode, c.id)}
              />
            ))}
          <BackRow onPress={() => setStep(pickerBackStep(step.mode))} />
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
                onPress={() => chooseCategory(step.mode, c.id)}
              />
            ))}
          <BackRow onPress={() => setStep(pickerBackStep(step.mode))} />
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
          <MenuOption
            label="OK"
            onPress={() => setStep(step.backStep)}
          />
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
          {/* Sam signed this label (2026-07-30): the back row says what it
              DOES. "Back" on a warning reads as "cancel", and what it actually
              does is leave the day the way the day was built. */}
          <MenuOption
            label={G1_LANDING_BACK_ROW.label(step.context)}
            testID="g1-route-back"
            onPress={() => setStep(step.backStep)}
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

      {options && !options.move.refusal && step.kind === 'pick_move_scope' && (
        <View>
          <Text style={styles.sectionLabel}>Move what?</Text>
          {options.move.scopes.map((scope) => (
            <MenuOption
              key={scope.id}
              label={scope.label}
              sub={scope.sub}
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
                sub={destination.occupiedBy
                  ? `Swap with ${destination.occupiedBy}`
                  : 'Currently a rest day'}
                testID={explorerTestId.sessionMoveDestination(destination.date)}
                onPress={() => apply({
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
 * `disabled` renders the row OFF rather than removing it (Sam's design ruling 8:
 * the four actions are always the four actions). It is a real disable — no press
 * handler at all, `accessibilityState` set — because a row that looks dead and
 * still fires is worse than either.
 */
function MenuOption({ label, sub, icon, danger, disabled, onPress, testID }: {
  label: string;
  sub?: string;
  icon?: React.ReactNode;
  danger?: boolean;
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
      accessibilityLabel={testID ?? label}
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
            danger && !disabled && { backgroundColor: 'rgba(244, 67, 54, 0.12)' },
            !danger && !disabled && { backgroundColor: 'rgba(200, 255, 0, 0.12)' },
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

/** Swap — two arrows going opposite ways: this for that. */
const swapIcon = (color: string) => glyph(color, (
  <><Path d="M4 8h13l-3-3" /><Path d="M20 16H7l3 3" /></>
));
/** Add — a plus. */
const addIcon = (color: string) => glyph(color, (
  <><Path d="M12 5v14" /><Path d="M5 12h14" /></>
));
/** Move — a calendar with an arrow leaving it: same session, another day. */
const moveIcon = (color: string) => glyph(color, (
  <><Path d="M11 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h9" /><Path d="M8 2v4" />
    <Path d="M15 12h7" /><Path d="M19 9l3 3-3 3" /></>
));
/** Remove — a bin. Danger-tinted at the call site. */
const removeIcon = (color: string) => glyph(color, (
  <><Path d="M4 7h16" /><Path d="M10 11v6" /><Path d="M14 11v6" />
    <Path d="M6 7l1 13h10l1-13" /><Path d="M9 7V4h6v3" /></>
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
/** Gunshow — a flexed arm. */
const gunshowIcon = (color: string) => glyph(color, (
  <><Path d="M4 18v-4a5 5 0 0 1 5-5h3" /><Path d="M12 9a4 4 0 0 1 4 4v5" />
    <Circle cx="19" cy="7" r="2" /></>
));
/** Mobility — a figure reaching through a range. */
const mobilityIcon = (color: string) => glyph(color, (
  <><Circle cx="12" cy="4" r="2" /><Path d="M12 6v6" /><Path d="M7 8l5 2 5-4" />
    <Path d="M12 12l-3 8" /><Path d="M12 12l3 8" /></>
));
/** Prehab / Accessories — a shield: the armour work. */
const prehabIcon = (color: string) => glyph(color, (
  <Path d="M12 3l8 3v6c0 4-3.5 7.5-8 9-4.5-1.5-8-5-8-9V6z" />
));

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
