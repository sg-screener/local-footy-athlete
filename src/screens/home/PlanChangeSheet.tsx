import React, { useMemo, useState, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
 * "Something else" folds the chat coach in as an explicit escape hatch
 * (signed-off decision 4): it hands a day-scoped prefill to the Coach tab
 * only after the athlete chooses that fallback.
 */

type StepBackTarget = 'menu' | 'edit_session';

type Step =
  | { kind: 'menu' }
  | { kind: 'edit_session' }
  | { kind: 'pick_add_kind'; returnTo: StepBackTarget }
  | { kind: 'add_blocked_max_sessions'; returnTo: StepBackTarget }
  | {
      kind: 'add_blocked_duplicate';
      duplicate: 'strength' | 'conditioning';
      returnTo: StepBackTarget;
    }
  | { kind: 'pick_category'; mode: 'swap' | 'add'; returnTo: StepBackTarget }
  | { kind: 'pick_conditioning'; mode: 'swap' | 'add'; returnTo: StepBackTarget }
  | { kind: 'pick_strength'; mode: 'swap' | 'add'; returnTo: StepBackTarget }
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
  | { kind: 'confirm_remove'; scope: PlanChangeBinScopeId; label: string }
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
  onAskCoach: (prefill: string) => void;
  /** Open the single week-level readiness owner (the "I'm not 100%" door). The
   *  day-card holds no readiness committer of its own — it hands off here. */
  onOpenReadiness: () => void;
}

function weekdayLabel(dateISO: string): string {
  const day = new Date(`${dateISO}T12:00:00`);
  return day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
}

export function PlanChangeSheet({
  visible, date, weekDays, onClose, onAskCoach, onOpenReadiness,
}: PlanChangeSheetProps) {
  const [step, setStep] = useState<Step>({ kind: 'menu' });
  const onboardingData = useProfileStore((state) => state.onboardingData);
  const activeConstraints = useCoachUpdatesStore((state) => state.activeConstraints);

  // Fresh menu every time the sheet opens for a (new) day.
  useEffect(() => {
    if (visible) {
      setStep({ kind: 'menu' });
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
  // Wellbeing ("I'm not 100%") is about how the athlete is RIGHT NOW, not the
  // tapped day — so it always applies to today and only appears when today is
  // in the viewed week (guaranteeing today's data is present). This removes
  // the old bug where the sheet showed one date but changed today.
  const todayDay = useMemo(
    () => weekDays.find((day) => day.date === todayISO) ?? null,
    [weekDays, todayISO],
  );
  const todayInView = todayDay !== null;

  if (!date) return null;
  const selectedWorkout = selectedDay?.workout ?? null;
  const selectedWorkoutName = String(selectedWorkout?.name ?? '').toLowerCase();
  const isRestOrRecoveryDay =
    !options?.hasSession ||
    selectedWorkout?.workoutType === 'Recovery' ||
    selectedWorkout?.sessionTier === 'recovery' ||
    selectedWorkoutName === 'rest' ||
    selectedWorkoutName === 'rest day' ||
    selectedWorkoutName === 'recovery';
  const hasEditableSession = !!options?.hasSession && !isRestOrRecoveryDay;

  const commitPlanChange = async (
    change: PlanChange,
    opts?: {
      closeOnSuccess?: boolean;
    },
    trace?: AthleteActionTraceContext,
  ) => {
    const result = change.kind === 'move_session'
      ? await executeProgramControlActionDurably({
          type: 'move_session',
          source: { screen: 'program_tab', surface: 'plan_change_sheet', initiatedBy: 'tap' },
          scope: 'today_only',
          payload: { fromDate: change.fromDate, toDate: change.toDate },
          requiresRebuild: false,
          createsActiveModifier: false,
          oneOffOnly: true,
        }, { visibleWeek: weekDays, todayISO })
      : change.kind === 'remove_session'
        ? await executeProgramControlActionDurably({
            type: 'bin_session',
            source: { screen: 'program_tab', surface: 'plan_change_sheet', initiatedBy: 'tap' },
            scope: 'today_only',
            payload: { date: change.date, scope: change.scope },
            requiresRebuild: false,
            createsActiveModifier: false,
            oneOffOnly: true,
          }, { visibleWeek: weekDays, todayISO })
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
    const backStep = opts?.backStep ?? { kind: 'edit_session' };
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

  const pickerBackStep = (
    mode: 'swap' | 'add',
    returnTo: StepBackTarget,
  ): Step =>
    mode === 'add'
      ? { kind: 'pick_add_kind', returnTo }
      : { kind: 'pick_category', mode, returnTo };

  const categoryBackStep = (
    mode: 'swap' | 'add',
    category: PlanChangeCategoryId,
    returnTo: StepBackTarget,
  ): Step => {
    if (category.startsWith('conditioning_')) {
      return { kind: 'pick_conditioning', mode, returnTo };
    }
    if (category.startsWith('strength_') || category === 'accessories') {
      return { kind: 'pick_strength', mode, returnTo };
    }
    return pickerBackStep(mode, returnTo);
  };

  const applyCategory = (
    mode: 'swap' | 'add',
    category: PlanChangeCategoryId,
    returnTo: StepBackTarget,
  ) =>
    apply(
      mode === 'swap'
        ? { kind: 'swap_category', date, category }
        : { kind: 'add_category', date, category },
      { backStep: categoryBackStep(mode, category, returnTo) },
    );

  const startAdd = (returnTo: StepBackTarget) => {
    if ((options?.visibleSessionCount ?? 0) >= 2) {
      setStep({ kind: 'add_blocked_max_sessions', returnTo });
      return;
    }
    setStep({ kind: 'pick_add_kind', returnTo });
  };

  const chooseAddKind = (kind: 'strength' | 'conditioning', returnTo: StepBackTarget) => {
    const existing = options?.visibleSessionKinds ?? [];
    if (existing.includes(kind)) {
      setStep({ kind: 'add_blocked_duplicate', duplicate: kind, returnTo });
      return;
    }
    setStep({
      kind: kind === 'strength' ? 'pick_strength' : 'pick_conditioning',
      mode: 'add',
      returnTo,
    });
  };

  // Athlete override principle: safe edits commit, risky edits route
  // through the shared pre-commit risk assessor.
  const chooseCategory = (
    mode: 'swap' | 'add',
    category: PlanChangeCategoryId,
    returnTo: StepBackTarget,
  ) => {
    applyCategory(mode, category, returnTo);
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
        backStep: { kind: 'edit_session' },
      });
      return;
    }
    if (move.scopes.length === 1) {
      setStep({ kind: 'pick_destination', scope: move.scopes[0].id });
      return;
    }
    setStep({ kind: 'pick_move_scope' });
  };

  // Bin entry point: multi-session days pick WHICH part first; single-part
  // days go straight to the are-you-sure.
  const startBin = () => {
    const scopes = options?.binScopes ?? [];
    if (scopes.length > 1) {
      setStep({ kind: 'pick_bin_scope' });
      return;
    }
    setStep({ kind: 'confirm_remove', scope: 'whole_day', label: 'this session' });
  };

  const askCoach = () => {
    onClose();
    onAskCoach(`About ${weekdayLabel(date)}: `);
  };

  // The day-card no longer owns readiness/illness/injury reporting — the
  // "I'm not 100%" row hands off to the single week-level owner (onOpenReadiness).
  const openReadiness = () => {
    onClose();
    onOpenReadiness();
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

      {options && options.locked === null && step.kind === 'menu' && (
        <View>
          {hasEditableSession ? (
            <MenuOption
              label="Edit this session"
              sub="Swap, add, move or remove this session"
              testID="plan-change-edit-session"
              onPress={() => setStep({ kind: 'edit_session' })}
            />
          ) : (
            <MenuOption
              label="Add optional session"
              sub="Add extra strength or conditioning work to this day"
              onPress={() => startAdd('menu')}
            />
          )}
          {todayInView && (
            <MenuOption
              label="I'm not 100%"
              sub="Tired, sick or a niggle - tell the coach and the plan adjusts"
              onPress={openReadiness}
            />
          )}
          <MenuOption
            label="Something else - ask the coach"
            sub="Anything the menu doesn't cover"
            onPress={askCoach}
          />
        </View>
      )}

      {options && options.locked === null && step.kind === 'edit_session' && (
        <View>
          <MenuOption
            label="Swap this session"
            sub="Change to strength, conditioning or recovery"
            onPress={() => setStep({ kind: 'pick_category', mode: 'swap', returnTo: 'edit_session' })}
          />
          <MenuOption
            label="Add to this day"
            sub="Add extra strength or conditioning work to this day"
            onPress={() => startAdd('edit_session')}
          />
          <MenuOption
            label="Move this session"
            sub="Move it to another day or trade places"
            testID={selectedWorkout
              ? explorerTestId.sessionMoveIngress(selectedWorkout.id)
              : undefined}
            onPress={() => startMove()}
          />
          <MenuOption
            label="Bin this session"
            sub="Remove it - the day becomes rest"
            testID={selectedWorkout
              ? explorerTestId.sessionDeleteIngress(selectedWorkout.id)
              : undefined}
            danger
            onPress={startBin}
          />
          <BackRow onPress={() => setStep({ kind: 'menu' })} />
        </View>
      )}

      {options && options.locked === null && step.kind === 'pick_add_kind' && (
        <View>
          <Text style={styles.sectionLabel}>ADD:</Text>
          <MenuOption
            label="Strength"
            sub="Upper, lower, full body or accessories"
            onPress={() => chooseAddKind('strength', step.returnTo)}
          />
          <MenuOption
            label="Conditioning"
            sub="Light or hard - bike, row, ski or intervals"
            onPress={() => chooseAddKind('conditioning', step.returnTo)}
          />
          <BackRow onPress={() => setStep({ kind: step.returnTo })} />
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
            onPress={startBin}
          />
          <BackRow onPress={() => setStep({ kind: step.returnTo })} />
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
            onPress={() => setStep({
              kind: 'pick_category',
              mode: 'swap',
              returnTo: 'edit_session',
            })}
          />
          <MenuOption
            label="Remove a session"
            onPress={startBin}
          />
          <BackRow onPress={() => setStep({ kind: 'pick_add_kind', returnTo: step.returnTo })} />
        </View>
      )}

      {/* Russian dolls level 1: what KIND of session. The athlete picks a
          category; the producer deterministically picks the session
          (sheet v2 — Strength and Sprint arrive in later phases).
          Add mode on an OCCUPIED day is restricted to what the producer
          says can stack (conditioning only). */}
      {options && step.kind === 'pick_category' && (() => {
        const stepCategories =
          step.mode === 'add' && options.hasSession
            ? options.addOnTopCategories
            : options.categories;
        return (
        <View>
          <Text style={styles.sectionLabel}>
            {step.mode === 'swap' ? 'Swap to:' : 'Add:'}
          </Text>
          {stepCategories.some((c) => c.id.startsWith('conditioning_')) && (
            <MenuOption
              label="Conditioning"
              sub="Light or hard - bike, row, ski or intervals"
              onPress={() =>
                setStep({ kind: 'pick_conditioning', mode: step.mode, returnTo: step.returnTo })}
            />
          )}
          {stepCategories.some((c) =>
            c.id.startsWith('strength_') || c.id === 'accessories') && (
            <MenuOption
              label="Strength"
              sub="Upper, lower, full body or accessories"
              onPress={() =>
                setStep({ kind: 'pick_strength', mode: step.mode, returnTo: step.returnTo })}
            />
          )}
          {stepCategories.filter((c) => c.id === 'recovery').map((c) => (
            <MenuOption
              key={c.id}
              label={c.label}
              sub={c.sub}
              onPress={() => chooseCategory(step.mode, c.id, step.returnTo)}
            />
          ))}
          <BackRow onPress={() => setStep({ kind: step.returnTo })} />
        </View>
        );
      })()}

      {/* Russian dolls level 2: conditioning intensity. Availability is
          policy — Hard only appears when the producer offered it (bye
          weeks); the producer picks the concrete template. */}
      {options && step.kind === 'pick_conditioning' && (
        <View>
          <Text style={styles.sectionLabel}>Conditioning:</Text>
          {(step.mode === 'add' && options.hasSession
            ? options.addOnTopCategories
            : options.categories)
            .filter((c) => c.id.startsWith('conditioning_'))
            .map((c) => (
              <MenuOption
                key={c.id}
                label={c.label}
                sub={c.sub}
                onPress={() => chooseCategory(step.mode, c.id, step.returnTo)}
              />
            ))}
          <BackRow
            onPress={() => setStep(pickerBackStep(step.mode, step.returnTo))}
          />
        </View>
      )}

      {/* Russian dolls level 2: strength buckets. The athlete picks the
          bucket ("Upper body"); the producer picks push-vs-pull from what
          the week needs and the engine builds the session with the same
          principles as weekly programming. */}
      {options && step.kind === 'pick_strength' && (
        <View>
          <Text style={styles.sectionLabel}>Strength:</Text>
          {(step.mode === 'add' && options.hasSession
            ? options.addOnTopCategories
            : options.categories)
            .filter((c) => c.id.startsWith('strength_') || c.id === 'accessories')
            .map((c) => (
              <MenuOption
                key={c.id}
                label={c.label}
                sub={c.sub}
                onPress={() => chooseCategory(step.mode, c.id, step.returnTo)}
              />
            ))}
          <BackRow
            onPress={() => setStep(pickerBackStep(step.mode, step.returnTo))}
          />
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
          <BackRow onPress={() => setStep({ kind: 'edit_session' })} />
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
              <MenuOption label="OK" onPress={() => setStep({ kind: 'edit_session' })} />
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
                : { kind: 'edit_session' })} />
          </View>
        );
      })()}

      {/* Multi-session days: pick WHICH part to bin before the
          are-you-sure. Options come from the producer (single owner of
          what's individually binnable on this day). */}
      {options && step.kind === 'pick_bin_scope' && (
        <View>
          <Text style={styles.sectionLabel}>Bin what?</Text>
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
                  label: scope.id === 'whole_day'
                    ? 'everything on this day'
                    : scope.label.toLowerCase(),
                })}
            />
          ))}
          <BackRow onPress={() => setStep({ kind: 'edit_session' })} />
        </View>
      )}

      {step.kind === 'confirm_remove' && (
        <View>
          <Text style={styles.confirmText}>
            {step.scope === 'whole_day'
              ? 'Are you sure? This will be removed and the day becomes rest.'
              : `Are you sure? This bins ${step.label} - the rest of the day stays.`}
          </Text>
          <MenuOption
            label="Yes, bin it"
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
            onPress={() => setStep({ kind: 'edit_session' })}
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

function MenuOption({ label, sub, danger, onPress, testID }: {
  label: string;
  sub?: string;
  danger?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={testID ?? label}
      style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.optionLabel, danger && styles.optionDanger]}>{label}</Text>
      {sub ? <Text style={styles.optionSub} numberOfLines={2}>{sub}</Text> : null}
    </Pressable>
  );
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
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  optionDanger: {
    color: '#F44336',
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
