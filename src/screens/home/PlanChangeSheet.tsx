import React, { useMemo, useState, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/common/Text';
import { Button, Sheet } from '../../components/ui';
import { useProgramStore } from '../../store';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import { useProfileStore } from '../../store/profileStore';
import { todayISOLocal } from '../../utils/appDate';
import type { ResolvedDay } from '../../utils/sessionResolver';
import { GuidedInjuryFlowSheet } from './GuidedInjuryFlowSheet';
import {
  buildGuidedInjuryConstraint,
  type GuidedInjuryFlowResult,
} from '../../utils/guidedInjuryControl';
import {
  applyPlanChange,
  listPlanChangeOptionsForDay,
  previewPlanChangeRisk,
  type PlanChange,
  type PlanChangeBinScopeId,
  type PlanChangeCategoryId,
  type PlanChangeDayOptions,
} from '../../utils/planChangeProducer';
import {
  executeProgramControlAction,
  executeProgramControlActionDurably,
} from '../../utils/programControlActions';
import type { TapRecoveryModifierScope } from '../../utils/tapProgramModifiers';
import type { ProgramEditRiskFinding } from '../../utils/programEditRiskAssessment';
import type { AthleteActionTraceContext } from '../../utils/athleteActionDiagnostics';

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
      kind: 'block_warning';
      title: string;
      reasons: string[];
      backStep: Step;
    }
  | { kind: 'pick_destination' }
  | { kind: 'pick_bin_scope' }
  | { kind: 'confirm_remove'; scope: PlanChangeBinScopeId; label: string }
  | { kind: 'pick_wellbeing' }
  | { kind: 'pick_tired' }
  | { kind: 'pick_sleep' }
  | { kind: 'pick_sick' }
  | { kind: 'confirm_shutdown' }
  | { kind: 'result'; ok: boolean; message: string };

interface PlanChangeSheetProps {
  visible: boolean;
  date: string | null;
  weekDays: ResolvedDay[];
  onClose: () => void;
  onAskCoach: (prefill: string) => void;
}

function weekdayLabel(dateISO: string): string {
  const day = new Date(`${dateISO}T12:00:00`);
  return day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
}

function riskReason(finding: ProgramEditRiskFinding): string {
  const observed = typeof finding.data?.observed === 'number' ? finding.data.observed : null;
  switch (finding.ruleId) {
    case 'cap_maxHardDays_over':
      return observed
        ? `This gives you ${observed} hard days this week. That's the upper edge.`
        : 'This pushes your hard days above the clean weekly target.';
    case 'cap_maxMainStrengthSessions_over':
      return observed
        ? `This gives you ${observed} main strength sessions this week. That's more than the normal cap.`
        : 'This pushes main strength above the normal weekly cap.';
    case 'cap_maxRunningExposures_over':
      return 'This adds more running than the weekly cap.';
    case 'cap_sprintCodExposures_over':
      return 'This adds more sprint/COD than the week needs.';
    case 'g1_hard_work':
    case 'g1_not_light':
      return "This puts hard work one day before your game, so it can't be applied. Choose a lighter session or another day.";
    case 'g2_hard_lower':
    case 'g2_hard_conditioning':
    case 'g2_sprint_cod':
      return 'This puts hard work too close to game day.';
    case 'g_plus1_hard_work':
      return 'This adds hard work the day after your game, when recovery should win.';
    case 'game_day_hard_work':
      return "This puts hard training on game day, so it can't be applied. Choose a recovery session or another day.";
    case 'protected_anchor_edit_blocked':
    case 'protected_game_anchor_removed':
    case 'protected_team_training_anchor_removed':
      return "This would remove a protected team/game anchor, so it can't be applied. Use the team/game controls to change that anchor.";
    case 'active_injury_hard_stop':
      return "There's an active medical/injury hard stop, so normal training edits are paused. Choose recovery or clear it once you're ready.";
    default:
      return finding.message;
  }
}

function riskReasons(findings: ProgramEditRiskFinding[]): string[] {
  const reasons = findings.map(riskReason);
  return Array.from(new Set(reasons)).slice(0, 3);
}

export function PlanChangeSheet({
  visible, date, weekDays, onClose, onAskCoach,
}: PlanChangeSheetProps) {
  const [step, setStep] = useState<Step>({ kind: 'menu' });
  const [injuryFlowVisible, setInjuryFlowVisible] = useState(false);
  const onboardingData = useProfileStore((state) => state.onboardingData);
  const activeConstraints = useCoachUpdatesStore((state) => state.activeConstraints);

  // Fresh menu every time the sheet opens for a (new) day.
  useEffect(() => {
    if (visible) {
      setStep({ kind: 'menu' });
      setInjuryFlowVisible(false);
    }
  }, [visible, date]);

  const todayISO = todayISOLocal();
  const options: PlanChangeDayOptions | null = useMemo(() => {
    if (!visible || !date) return null;
    return listPlanChangeOptionsForDay({ visibleWeek: weekDays, date, todayISO });
  }, [visible, date, weekDays, todayISO]);
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
  const WELLBEING_STEP_KINDS: Step['kind'][] = [
    'pick_wellbeing',
    'pick_tired',
    'pick_sleep',
    'pick_sick',
    'confirm_shutdown',
  ];
  const isWellbeingStep = WELLBEING_STEP_KINDS.includes(step.kind);

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
    if (result.ok && opts?.closeOnSuccess) {
      // Destructive flows (bin) skip the result screen: the change is
      // already confirmed, so close straight back to the weekly plan.
      // The host's onClose handles any needed navigation (e.g. the
      // session screen goBacks when its workout no longer exists).
      onClose();
      return;
    }
    setStep({ kind: 'result', ok: result.ok, message: result.message });
  };

  const apply = (
    change: PlanChange,
    opts?: {
      closeOnSuccess?: boolean;
      recoveryModifierScope?: TapRecoveryModifierScope;
      backStep?: Step;
    },
  ) => {
    if (opts?.recoveryModifierScope && 'date' in change) {
      const result = executeProgramControlAction({
        type: 'set_recovery_mode',
        source: { screen: 'program_tab', surface: 'plan_change_sheet', initiatedBy: 'tap' },
        scope: opts.recoveryModifierScope === 'week' ? 'current_week' : 'today_only',
        payload: {
          date: change.date,
          todayISO,
          recoveryScope: opts.recoveryModifierScope,
          planChange: change,
        },
        requiresRebuild: false,
        createsActiveModifier: true,
        oneOffOnly: false,
      }, { visibleWeek: weekDays, todayISO });
      if (result.ok && opts.closeOnSuccess) {
        onClose();
        return;
      }
      setStep({
        kind: 'result',
        ok: result.ok,
        message: result.message ?? (
          result.ok
            ? 'Done. Recovery mode is active.'
            : "I couldn't safely update recovery mode here."
        ),
      });
      return;
    }

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
    if (preview.assessment.decision === 'block') {
      setStep({
        kind: 'block_warning',
        title: "Can't apply this edit",
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

  const applyTired = (severity: 'spark' | 'cooked') => {
    const result = executeProgramControlAction({
      type: 'set_fatigue_status',
      source: { screen: 'program_tab', surface: 'plan_change_sheet', initiatedBy: 'tap' },
      scope: severity === 'cooked' ? 'current_week' : 'today_only',
      payload: {
        date: todayISO,
        todayISO,
        level: severity === 'cooked' ? 'cooked' : 'low_energy',
      },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    }, { todayISO });
    setStep({
      kind: 'result',
      ok: result.ok,
      message:
        severity === 'cooked'
          ? "Heard. This week eases right off - recovery-level only. Clear the note when you're breathing fire again."
          : "Noted. Today backs off the hard stuff where it can. Shout if it gets worse.",
    });
  };

  const applySore = () => {
    const result = executeProgramControlAction({
      type: 'set_fatigue_status',
      source: { screen: 'program_tab', surface: 'plan_change_sheet', initiatedBy: 'tap' },
      scope: 'today_only',
      payload: { date: todayISO, todayISO, level: 'sore' },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    }, { todayISO });
    setStep({
      kind: 'result',
      ok: result.ok,
      message: "Noted. Today adjusts around how you're feeling.",
    });
  };

  const applyPoorSleep = (pattern: 'single_night' | 'repeated') => {
    const result = executeProgramControlAction({
      type: 'set_poor_sleep_status',
      source: { screen: 'program_tab', surface: 'plan_change_sheet', initiatedBy: 'tap' },
      scope: pattern === 'repeated' ? 'current_week' : 'today_only',
      payload: { date: todayISO, todayISO, pattern },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    }, { todayISO });
    setStep({
      kind: 'result',
      ok: result.ok,
      message: pattern === 'repeated'
        ? 'Noted. Hard work is reduced this week while useful safe training stays in.'
        : 'Noted. Today trims hard extras first and keeps the useful work where safe.',
    });
  };

  const applyRoughSick = () => {
    const result = executeProgramControlAction({
      type: 'set_recovery_mode',
      source: { screen: 'program_tab', surface: 'plan_change_sheet', initiatedBy: 'tap' },
      scope: 'current_week',
      payload: {
        date: todayISO,
        todayISO,
        recoveryScope: 'week',
      },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    }, { todayISO });
    setStep({
      kind: 'result',
      ok: result.ok,
      message: "Recovery mode is active for this week. Clear the note when you're good again.",
    });
  };

  const applySniffle = () => {
    // Light sniffle: TODAY's session softens to the recovery flow (not the
    // tapped day). On a rest day there's nothing to soften.
    const todayHasSession =
      !!todayDay?.workout && todayDay.workout.workoutType !== 'Game';
    if (!todayHasSession) {
      setStep({
        kind: 'result',
        ok: true,
        message: "Today's already an easy day - perfect. Fluids, food, sleep.",
      });
      return;
    }
    apply(
      { kind: 'swap_category', date: todayISO, category: 'recovery' },
      { recoveryModifierScope: 'day' },
    );
  };

  const applyGuidedInjury = (result: GuidedInjuryFlowResult) => {
    const constraint = buildGuidedInjuryConstraint(result, { todayISO });
    const trainingPaused = constraint.adjustmentLevel === 'training_paused';
    const actionResult = executeProgramControlAction({
      type: 'set_injury_modifier',
      source: { screen: 'program_tab', surface: 'plan_change_injury_flow', initiatedBy: 'tap' },
      scope: 'current_and_future',
      payload: { constraint },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    }, { todayISO });
    setInjuryFlowVisible(false);
    setStep({
      kind: 'result',
      ok: actionResult.ok,
      message: trainingPaused
        ? 'Affected training is paused until you get medical or physio advice.'
        : 'Injury adjustment is active. Coach Notes will show it until you clear it.',
    });
  };

  return (
    <>
    <Sheet visible={visible && !injuryFlowVisible} onClose={onClose} testID="plan-change-sheet">
      <Text style={styles.title}>
        {isWellbeingStep ? 'How are you today?' : weekdayLabel(date)}
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
              sub="Tired, sick or injured today - the plan adjusts"
              onPress={() => setStep({ kind: 'pick_wellbeing' })}
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
            testID="plan-change-move-session"
            onPress={() => setStep({ kind: 'pick_destination' })}
          />
          <MenuOption
            label="Bin this session"
            sub="Remove it - the day becomes rest"
            testID="plan-change-delete-session"
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

      {/* "I'm not 100%" level 1: what's going on. */}
      {step.kind === 'pick_wellbeing' && (
        <View>
          <Text style={styles.sectionLabel}>What's going on?</Text>
          <MenuOption
            label="I'm tired"
            sub="Flat, heavy legs, low battery"
            onPress={() => setStep({ kind: 'pick_tired' })}
          />
          <MenuOption
            label="I slept poorly"
            sub="One bad night or a repeated pattern"
            onPress={() => setStep({ kind: 'pick_sleep' })}
          />
          <MenuOption
            label="I'm sick"
            sub="From light sniffle to bed-ridden"
            onPress={() => setStep({ kind: 'pick_sick' })}
          />
          <MenuOption
            label="I'm sore"
            sub="General soreness - today adjusts"
            onPress={applySore}
          />
          <MenuOption
            label="I'm injured"
            sub="Area, severity and triggers"
            onPress={() => setInjuryFlowVisible(true)}
          />
          <BackRow onPress={() => setStep({ kind: 'menu' })} />
        </View>
      )}

      {/* Tired severity: clear ends are deterministic (readiness signal). */}
      {step.kind === 'pick_tired' && (
        <View>
          <Text style={styles.sectionLabel}>How tired?</Text>
          <MenuOption
            label="Lacking a bit of spark"
            sub="Today backs off the hard stuff where it can"
            onPress={() => applyTired('spark')}
          />
          <MenuOption
            label="Absolutely cooked"
            sub="Today drops to recovery level"
            onPress={() => applyTired('cooked')}
          />
          <BackRow onPress={() => setStep({ kind: 'pick_wellbeing' })} />
        </View>
      )}

      {step.kind === 'pick_sleep' && (
        <View>
          <Text style={styles.sectionLabel}>How long has sleep been poor?</Text>
          <MenuOption
            label="Just last night"
            sub="A small adjustment for today"
            onPress={() => applyPoorSleep('single_night')}
          />
          <MenuOption
            label="A few nights in a row"
            sub="Reduce hard load for this week"
            onPress={() => applyPoorSleep('repeated')}
          />
          <BackRow onPress={() => setStep({ kind: 'pick_wellbeing' })} />
        </View>
      )}

      {/* Sick severity: sniffle softens today, bed-ridden clears the week,
          the middle talks to the coach with context pre-loaded. */}
      {step.kind === 'pick_sick' && (
        <View>
          <Text style={styles.sectionLabel}>How sick?</Text>
          <MenuOption
            label="Light sniffle"
            sub="Today softens to a recovery flow"
            onPress={applySniffle}
          />
          <MenuOption
            label="Pretty rough"
            sub="Recovery mode for this week"
            onPress={applyRoughSick}
          />
          <MenuOption
            label="Bed-ridden"
            sub="Clears the rest of this week"
            danger
            onPress={() => setStep({ kind: 'confirm_shutdown' })}
          />
          <BackRow onPress={() => setStep({ kind: 'pick_wellbeing' })} />
        </View>
      )}

      {step.kind === 'confirm_shutdown' && (
        <View>
          <Text style={styles.confirmText}>
            Are you sure? Every remaining session this week becomes rest
            (game day is left alone). You can add sessions back the moment
            you're better.
          </Text>
          <MenuOption
            label="Yes - clear my week"
            danger
            onPress={() =>
              apply(
                // Bed-ridden clears THIS week from today onward, regardless
                // of which day's sheet opened it.
                { kind: 'shutdown_week', date: todayISO },
                { recoveryModifierScope: 'week' },
              )}
          />
          <MenuOption
            label="No, keep the plan"
            onPress={() => setStep({ kind: 'pick_sick' })}
          />
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
          <Text style={styles.blockingTitle}>{step.title}</Text>
          {step.reasons.map((reason) => (
            <Text key={reason} style={styles.confirmText}>{reason}</Text>
          ))}
          <MenuOption
            label="OK"
            onPress={() => setStep(step.backStep)}
          />
        </View>
      )}

      {options && step.kind === 'pick_destination' && (
        <View>
          <Text style={styles.sectionLabel}>Move to:</Text>
          {options.moveDestinations.map((destination) => (
            <MenuOption
              key={destination.date}
              label={weekdayLabel(destination.date)}
              sub={destination.occupiedBy
                ? `Swap with ${destination.occupiedBy}`
                : 'Currently a rest day'}
              onPress={() =>
                apply({ kind: 'move_session', fromDate: date, toDate: destination.date })}
            />
          ))}
          <BackRow onPress={() => setStep({ kind: 'edit_session' })} />
        </View>
      )}

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
            testID="plan-change-delete-confirm"
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
          <Text style={step.ok ? styles.resultOk : styles.resultBad}>
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
    <GuidedInjuryFlowSheet
      visible={visible && injuryFlowVisible}
      onClose={() => setInjuryFlowVisible(false)}
      onComplete={applyGuidedInjury}
      titlePrefix={date ? weekdayLabel(date) : undefined}
    />
    </>
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
});
