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
} from '../utils/sessionResolver';
import { logger } from '../utils/logger';
import type { ScheduleState, ResolvedDay } from '../utils/sessionResolver';
import {
  DEFAULT_ATHLETE_CONTEXT,
  type AthleteContext,
} from '../utils/sessionBuilder';
import { resolveEquipmentAvailability } from '../utils/equipmentAvailability';
import {
  buildExtraConstraintsForVisibleProgram,
  buildProgramTabProjectedWeek,
  getResolvedVisibleProgramForDate,
} from '../utils/visibleProgramReadModel';
import { todayISOLocal } from '../utils/appDate';
import { profileCapacityBandOrNull } from '../utils/readiness';
import { ownSeasonPhase } from '../rules/seasonPhaseOwner';
import { buildReadinessActiveConstraints } from '../utils/readinessConstraints';
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
/** Map day name → JS getDay() number. */
const DAY_NAME_TO_NUMBER: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

function useScheduleState(): ScheduleState & {
  activeConstraints: any[];
  modalityPreferences: Record<string, any>;
} {
  const currentProgram = useProgramStore((s) => s.currentProgram);
  const currentMicrocycle = useProgramStore((s) => s.currentMicrocycle);
  const manualOverrides = useProgramStore((s) => s.dateOverrides);
  const weekScopedOverlays = useProgramStore((s) => s.weekScopedOverlays);
  const blockState = useProgramStore((s) => s.blockState);
  const sessionFeedback = useProgramStore((s) => s.sessionFeedback);
  const weightOverrides = useProgramStore((s) => s.weightOverrides);
  const acceptedContext = useProgramStore((s) => s.acceptedMaterialContext);
  const mirroredMarkedDays = useCalendarStore((s) => s.markedDays);
  const markedDays = acceptedContext.revision > 0
    ? acceptedContext.markedDays
    : mirroredMarkedDays;
  const athleteContext = useAthleteContext();
  const onboardingData = useProfileStore((s) => s.onboardingData);
  // Reactive subscription on the recurring modality preference store.
  // Without this, the visible-program projection reads via .getState()
  // (one-shot, not reactive) and HomeScreen / DayWorkoutScreen never
  // re-render when the coach writes a new preference — the live-app
  // bug that caused future Wednesday's Easy Aerobic Flush to keep
  // showing "20min Rower" even after the coach said "Done".
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useCoachPreferencesStore } = require('../store/coachPreferencesStore');
  const modalityPreferences = useCoachPreferencesStore(
    (s: any) => s.modalityPreferences,
  );
  // Subscribe to activeInjury so the resolver-level filter runs in the
  // LIVE React app. Without this, useScheduleState used to return
  // ScheduleState without activeInjury — applyInjuryFilterPass would
  // early-return and future weeks would render unfiltered (the live
  // bug where Deadlift / Nordic Lower kept showing after hammy 6/10).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useCoachUpdatesStore } = require('../store/coachUpdatesStore');
  const mirroredActiveInjury = useCoachUpdatesStore((s: any) => s.activeInjury);
  // Subscribe to the FULL activeConstraints[] too. Non-injury entries
  // (fatigue / soreness / schedule / missed_session) flow through the
  // visible-program projection's `extraConstraints` seam — see
  // useResolvedDay / useResolvedWeek below.
  const mirroredCoachActiveConstraints = useCoachUpdatesStore((s: any) => s.activeConstraints) ?? [];
  const activeInjury = acceptedContext.revision > 0
    ? acceptedContext.activeInjury
    : mirroredActiveInjury;
  const coachActiveConstraints = acceptedContext.revision > 0
    ? acceptedContext.activeConstraints
    : mirroredCoachActiveConstraints;

  // Season phase from THE owner (rules/seasonPhaseOwner). This used to read
  // `onboardingData.seasonPhase` directly while the home chrome read the
  // program's clock — two answers, and a failed phase-shift rebuild left the
  // visible week built from one and labelled by the other. The clock owns it;
  // the profile selection is the input the clock was minted from.
  const seasonPhase = ownSeasonPhase({
    program: currentProgram,
    profile: onboardingData,
  }).phase;

  // Game day fields — feed the resolver's virtual-game logic.
  // `usualGameDay` is the new-style field set by the phase-shift modal.
  // `gameDay` is the legacy field set by onboarding's GameDayScreen.
  // The resolver uses `usualGameDay || gameDay` (excluding 'Varies') as the
  // effective game day for In-season virtual games.
  const usualGameDay = useProfileStore((s) => s.onboardingData?.usualGameDay);
  const gameDay = useProfileStore((s) => s.onboardingData?.gameDay);

  // Preferred training days → day-of-week numbers for the availability hard-filter.
  // This is a HARD CONSTRAINT — the resolver must never schedule sessions on
  // days the user did not select as available.
  const preferredDays = useProfileStore((s) => s.onboardingData?.preferredTrainingDays);
  const availableDayNumbers = preferredDays && preferredDays.length > 0
    ? preferredDays.map((name: string) => DAY_NAME_TO_NUMBER[name]).filter((n: number | undefined) => n !== undefined)
    : undefined;

  // Readiness: profile-derived baseline, replacing the old hard-coded
  // `medium`. Today's quick signal is applied as a date-scoped constraint
  // below so it doesn't reshape the whole week.
  const todayISO = todayISOLocal();
  const mirroredTodayReadinessSignal = useReadinessStore(
    (s) => s.signalsByDate[todayISO],
  );
  const todayReadinessSignal = acceptedContext.revision > 0
    ? acceptedContext.readinessSignalsByDate[todayISO]
    : mirroredTodayReadinessSignal;
  // Structural readiness changes are already materialised through the
  // accepted-state transaction. Keep constraints here only for legacy state
  // that predates the accepted material context.
  const readinessActiveConstraints = acceptedContext.revision > 0
    ? []
    : buildReadinessActiveConstraints(todayReadinessSignal);
  // RENDER MUST NOT THROW (Sam, 2026-07-30). This is a read, not a prescription,
  // so it asks for the band OR NULL. `deriveProfileReadiness` still throws and
  // is still what generation calls — an unscoreable profile is refused a
  // program, it is not refused a screen. `null` travels as null; see
  // rules note in utils/readiness.ts.
  const readiness = profileCapacityBandOrNull(onboardingData);

  return {
    currentProgram,
    currentMicrocycle,
    manualOverrides: manualOverrides || {},
    weekScopedOverlays: weekScopedOverlays || {},
    markedDays: markedDays || {},
    athleteContext,
    seasonPhase,
    usualGameDay,
    gameDay,
    readiness,
    blockState,
    sessionFeedback: sessionFeedback || {},
    weightOverrides: weightOverrides || {},
    availableDayNumbers,
    activeInjury: activeInjury ?? null,
    activeConstraints: [...coachActiveConstraints, ...readinessActiveConstraints],
    modalityPreferences: modalityPreferences ?? {},
  };
}

/**
 * Convert non-injury active constraints (fatigue / soreness / schedule
 * / missed_session) into engine `Constraint[]` so the visible-program
 * projection can layer them on top of the injury constraint. Injury
 * entries are skipped here — the projection already builds the injury
 * Constraint from `activeInjury`.
 */
const buildExtraConstraints = buildExtraConstraintsForVisibleProgram;

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

  const mondayStr = getMondayStr(weekOffset);
  // THE ONE PROJECTION, computed once beside `weekDays` — the card surface
  // (HomeScreenV2) renders `visibleWeek.days[*].headline` / `.parts[*].headline`
  // and reads no raw `workout.name`. Shared with the day-detail screen through
  // `projectWeekFor`, so the two surfaces cannot be handed different arguments.
  const { weekDays, visibleWeek } = projectWeekFor(mondayStr, state);
  const weekLabel = formatWeekLabel(mondayStr);
  const isThisWeek = weekOffset === 0;

  // Debug (dev only)
  if (__DEV__) {
    const summary = weekDays.map(d =>
      `${d.short} ${d.date}: ${d.source}${d.workout ? ` → ${d.workout.name}` : ' → rest'}`
    );
    logger.debug(`[useSchedule] week=${mondayStr}`, summary);
  }

  const goToPrev = useCallback(() => setWeekOffset(o => o - 1), []);
  const goToNext = useCallback(() => setWeekOffset(o => o + 1), []);
  const goToThisWeek = useCallback(() => setWeekOffset(0), []);

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
    setWeekOffset(diffWeeks);
  }, []);

  return {
    weekDays,
    visibleWeek,
    weekLabel,
    weekOffset,
    isThisWeek,
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
