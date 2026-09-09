/**
 * useSchedule — Shared hooks for all screens.
 *
 * Thin wrappers: read stores → call pure resolvers → return results.
 * No resolution logic lives here. All scheduling rules live in sessionResolver.ts.
 *
 * REACTIVITY RULES:
 *   - Individual Zustand selectors always (never full-store destructuring)
 *   - useIsFocused() on navigable tabs to force re-render after tab freeze
 *   - No useMemo for schedule data (derive on every render — trivial cost)
 */

import { useState, useCallback } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useProgramStore } from '../store/programStore';
import { useCalendarStore } from '../store/calendarStore';
import { useProfileStore } from '../store/profileStore';
import { useReadinessStore } from '../store/readinessStore';
import {
  resolveDate,
  resolveWeekWithConditioning,
  resolveDateWithConditioning,
  resolveMonthIndicatorsWithConditioning,
  getBlockBounds,
  getMondayStr,
  getMondayStrForDate,
  formatWeekLabel,
  clampProgramWeekOffset,
  programWeekOffsetBounds,
} from '../utils/sessionResolver';
import { logger } from '../utils/logger';
import type { ScheduleState, ResolvedDay } from '../utils/sessionResolver';
import {
  DEFAULT_ATHLETE_CONTEXT,
  type AthleteContext,
} from '../utils/sessionBuilder';
import { resolveEquipmentAvailability } from '../utils/equipmentAvailability';
import {
  buildProgramTabProjectedWeek,
  getResolvedVisibleProgramForDate,
} from '../utils/visibleProgramReadModel';
import { todayISOLocal } from '../utils/appDate';
import { assembleScheduleState } from '../utils/deriveVisibleWeek';
import { useDecisionLedgerStore } from '../store/decisionLedgerStore';
import { project } from '../rules/projectVisibleWeek';
import type { VisibleDay, VisibleWeek } from '../rules/visibleProjection';

// ─── Internal: Read raw state from both stores ───

/**
 * Build AthleteContext from profile store data.
 * Falls back to defaults if no onboarding data is available.
 */
/**
 * Exported so the session screen's mobility flow filters through the SAME
 * equipment/injury context the resolver builds sessions with. A second answer to
 * "can this athlete do this movement" would first get the equipment gate on
 * `dead-hang` and `db-pullovers` wrong.
 */
export function useAthleteContext(): AthleteContext {
  const onboardingData = useProfileStore((s) => s.onboardingData);
  const acceptedContext = useProgramStore((s) => s.acceptedMaterialContext);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useCoachUpdatesStore } = require('../store/coachUpdatesStore');
  const mirroredConstraints = useCoachUpdatesStore((s: any) => s.activeConstraints) ?? [];
  const activeConstraints = acceptedContext.revision > 0
    ? acceptedContext.activeConstraints
    : mirroredConstraints;
  const todayISO = todayISOLocal();

  if (!onboardingData) return DEFAULT_ATHLETE_CONTEXT;

  const trainingLocation = onboardingData.trainingLocation || 'Commercial gym';

  return {
    activeConstraints,
    injuries: onboardingData.injuries || [],
    equipmentTags: resolveEquipmentAvailability(onboardingData, activeConstraints, todayISO),
    onboardingData,
  };
}

/**
 * Assembles ScheduleState from individual Zustand selectors.
 * Uses individual selectors (not full-store destructuring) for proper Zustand reactivity.
 *
 * The store property is named `dateOverrides` for AsyncStorage backward compatibility,
 * but semantically represents manual overrides only. The resolver field is `manualOverrides`.
 */
/** Reactive input collection only; the shared assembler owns precedence. */
function useScheduleState(): ScheduleState & { activeConstraints: any[]; modalityPreferences: Record<string, any> } {
  const currentProgram = useProgramStore((s) => s.currentProgram);
  const currentMicrocycle = useProgramStore((s) => s.currentMicrocycle);
  const dateOverrides = useProgramStore((s) => s.dateOverrides);
  const overrideContexts = useProgramStore((s) => s.overrideContexts);
  const weekScopedOverlays = useProgramStore((s) => s.weekScopedOverlays);
  const userRemovalConstraints = useProgramStore((s) => s.userRemovalConstraints);
  const blockState = useProgramStore((s) => s.blockState);
  const sessionFeedback = useProgramStore((s) => s.sessionFeedback);
  const weightOverrides = useProgramStore((s) => s.weightOverrides);
  const acceptedMaterialContext = useProgramStore((s) => s.acceptedMaterialContext);
  const markedDays = useCalendarStore((s) => s.markedDays);
  const onboardingData = useProfileStore((s) => s.onboardingData);
  const readinessSignalsByDate = useReadinessStore((s) => s.signalsByDate);
  const decisions = useDecisionLedgerStore((s) => s.entries);
  const { useAthletePreferencesStore } = require('../store/athletePreferencesStore');
  const athleteExclusions = useAthletePreferencesStore((s: { prefs?: { exclusions?: unknown[] } }) => s.prefs?.exclusions) ?? [];
  const { useCoachPreferencesStore } = require('../store/coachPreferencesStore');
  const modalityPreferences = useCoachPreferencesStore((s: { modalityPreferences: Record<string, any> }) => s.modalityPreferences);
  const { useCoachUpdatesStore } = require('../store/coachUpdatesStore');
  const coachActiveConstraints = useCoachUpdatesStore((s: { activeConstraints: unknown[] }) => s.activeConstraints) ?? [];
  const assembled = assembleScheduleState({
    todayISO: todayISOLocal(), onboardingData, markedDays, readinessSignalsByDate,
    coachActiveConstraints, decisions, currentProgram, currentMicrocycle, dateOverrides,
    overrideContexts, weekScopedOverlays, userRemovalConstraints, blockState,
    acceptedMaterialContext, sessionFeedback, weightOverrides, athleteExclusions, modalityPreferences,
  });
  return { ...assembled, modalityPreferences: assembled.modalityPreferences ?? {} };
}

// ─── Exported Hooks ───

/**
 * Single date resolution with conditioning awareness.
 * Used by DayWorkoutScreen.
 *
 * Resolves the full week containing this date so conditioning
 * rules have proper context (weekly caps, stacking guard, etc.),
 * then returns just the target day.
 *
 * Returns null if no date provided.
 */
export function useResolvedDay(date: string | undefined): ResolvedDay | null {
  const state = useScheduleState();
  if (!date) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useProgramStore } = require('../store/programStore');
  const overrideContext =
    useProgramStore.getState().overrideContexts?.[date];
  const todayISO = todayISOLocal();
  return getResolvedVisibleProgramForDate({
    date,
    state,
    overrideContext,
    todayISO,
    modalityPreferences: (state as any).modalityPreferences,
  }).day;
}

/**
 * Resolved projected week containing an arbitrary date.
 *
 * Systemic owner for any surface that hosts the plan-change door
 * (PlanChangeSheet) away from the Program tab — the producer needs the
 * FULL visible week for policy context (move destinations, bye gating,
 * edit horizon), not just the single day. DayWorkoutScreen is the first
 * consumer; any future surface (calendar drilldown, coach cards) should
 * use this hook rather than re-deriving the week locally.
 *
 * Same projection pipeline as useResolvedWeek, so what the sheet offers
 * here is bit-identical to what it offers on the Program tab.
 */
export function useResolvedWeekForDate(date: string | undefined): ResolvedDay[] {
  const state = useScheduleState();
  if (!date) return [];
  const overrideContexts =
    useProgramStore.getState().overrideContexts ?? {};
  const todayISO = todayISOLocal();
  return buildProgramTabProjectedWeek({
    mondayISO: getMondayStrForDate(date),
    todayISO,
    state,
    overrideContexts,
    modalityPreferences: (state as any).modalityPreferences,
  });
}

/**
 * ONE PROJECTION COMPUTATION FOR THE WHOLE SCREEN FAMILY.
 *
 * The card path (`useResolvedWeek`) and the day-detail path (`useVisibleDay`)
 * call THIS, not `project()` — because two call sites is two chances to pass
 * different arguments, and "the card and the detail disagree" is the defect the
 * projection exists to make unwritable. Same week builder, same weekStart, same
 * `project()`.
 *
 * No try/catch, deliberately: a week whose words are not signed is a real gap
 * (`UnsignedCopyError`) and must surface loudly rather than be swallowed into
 * free text (L14).
 */
function projectWeekFor(
  mondayISO: string,
  state: ReturnType<typeof useScheduleState>,
): { weekDays: ResolvedDay[]; visibleWeek: VisibleWeek } {
  const overrideContexts = useProgramStore.getState().overrideContexts ?? {};
  const weekDays = buildProgramTabProjectedWeek({
    mondayISO,
    todayISO: todayISOLocal(),
    state,
    overrideContexts,
    modalityPreferences: (state as any).modalityPreferences,
  });
  return { weekDays, visibleWeek: project({ week: weekDays, weekStart: mondayISO }) };
}

/**
 * The projected day the DAY-DETAIL screen renders.
 *
 * Same projection the week card reads, located by date. `useResolvedDay` stays
 * beside it in `useDayWorkout` and keeps its job — it is the INPUT state (weights,
 * receipts, keyboard, cues all key off the raw workout's rows). This one owns
 * the words and the part list.
 */
export function useVisibleDay(date: string | undefined): VisibleDay | null {
  const state = useScheduleState();
  if (!date) return null;
  const { visibleWeek } = projectWeekFor(getMondayStrForDate(date), state);
  return visibleWeek.days.find((day) => day.date === date) ?? null;
}

/**
 * Navigable week resolution. Used by Program tab (HomeScreen).
 * Includes week navigation (prev/next/this week) and week label.
 */
export function useResolvedWeek() {
  const state = useScheduleState();

  // Subscribe to focus changes — forces re-render when tab gains focus
  // after being frozen by React Navigation's freezeOnBlur
  useIsFocused();

  // Week offset: 0 = this week, -1 = last week, +1 = next week
  const [weekOffset, setWeekOffset] = useState(0);

  // The program's own dated span is the navigation owner. This is deliberately
  // not a fixed block length: generation may make any number of weeks, and the
  // arrows follow the dates that were actually accepted.
  const weekBounds = programWeekOffsetBounds(state.currentProgram, todayISOLocal());
  const boundedWeekOffset = clampProgramWeekOffset(weekOffset, weekBounds);

  const mondayStr = getMondayStr(boundedWeekOffset);
  // THE ONE PROJECTION, computed once beside `weekDays` — the card surface
  // (HomeScreenV2) renders `visibleWeek.days[*].headline` / `.parts[*].headline`
  // and reads no raw `workout.name`. Shared with the day-detail screen through
  // `projectWeekFor`, so the two surfaces cannot be handed different arguments.
  const { weekDays, visibleWeek } = projectWeekFor(mondayStr, state);
  const weekLabel = formatWeekLabel(mondayStr);
  const isThisWeek = boundedWeekOffset === 0;
  const canGoPrev = boundedWeekOffset > weekBounds.min;
  const canGoNext = boundedWeekOffset < weekBounds.max;

  // Debug (dev only)
  if (__DEV__) {
    const summary = weekDays.map(d =>
      `${d.short} ${d.date}: ${d.source}${d.workout ? ` → ${d.workout.name}` : ' → rest'}`
    );
    logger.debug(`[useSchedule] week=${mondayStr}`, summary);
  }

  const goToPrev = useCallback(() => {
    setWeekOffset(clampProgramWeekOffset(boundedWeekOffset - 1, weekBounds));
  }, [boundedWeekOffset, weekBounds.max, weekBounds.min]);
  const goToNext = useCallback(() => {
    setWeekOffset(clampProgramWeekOffset(boundedWeekOffset + 1, weekBounds));
  }, [boundedWeekOffset, weekBounds.max, weekBounds.min]);
  const goToThisWeek = useCallback(() => {
    setWeekOffset(clampProgramWeekOffset(0, weekBounds));
  }, [weekBounds.max, weekBounds.min]);

  /**
   * Jump to the week containing a specific date.
   * Computes the offset from "this week's Monday" to the target date's Monday.
   */
  const goToDate = useCallback((dateStr: string) => {
    const targetMonday = getMondayStr(0); // this week's Monday
    const targetDate = new Date(dateStr + 'T12:00:00');
    const thisMonday = new Date(targetMonday + 'T12:00:00');

    // Get the Monday of the target date's week
    const dow = targetDate.getDay(); // 0=Sun, 1=Mon, ...
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const targetWeekMonday = new Date(targetDate);
    targetWeekMonday.setDate(targetDate.getDate() + diffToMonday);

    // Compute offset in weeks
    const diffMs = targetWeekMonday.getTime() - thisMonday.getTime();
    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
    setWeekOffset(clampProgramWeekOffset(diffWeeks, weekBounds));
  }, [weekBounds.max, weekBounds.min]);

  return {
    weekDays,
    visibleWeek,
    weekLabel,
    weekOffset: boundedWeekOffset,
    isThisWeek,
    canGoPrev,
    canGoNext,
    goToPrev,
    goToNext,
    goToThisWeek,
    goToDate,
  };
}

/**
 * Month indicators for Calendar grid with conditioning awareness.
 * Returns a map of date → indicator for every day in the month.
 * Resolves week-by-week so conditioning placement has proper context.
 */
export function useMonthIndicators(year: number, month: number): Record<string, ResolvedDay['indicator']> {
  const state = useScheduleState();
  return resolveMonthIndicatorsWithConditioning(year, month, state);
}

/**
 * Block bounds for Calendar info card.
 */
export function useBlockBounds() {
  const state = useScheduleState();
  return getBlockBounds(state);
}

/**
 * The week that starts on `mondayISO`, through the one projection the Program
 * tab reads (`projectWeekFor`). The Coach Snapshot uses it for NEXT week
 * (R-397, plan slice S1, 2026-09-10) so the coach sees the week the athlete
 * will see, not a second derivation of it.
 */
export function useProjectedWeekFor(
  mondayISO: string,
): { weekDays: ResolvedDay[]; visibleWeek: VisibleWeek } {
  const state = useScheduleState();
  return projectWeekFor(mondayISO, state);
}
