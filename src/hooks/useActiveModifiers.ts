/** Shared, read-only modifier projection for Program and My Status (R-262).
 * Accepted facts own restrictions; the ledger owns opted-in lighter days;
 * canonical week metadata owns generated changes. No display output is saved.
 */

import { useMemo } from 'react';
import { useResolvedWeekForDate } from './useSchedule';
import { todayISOLocal } from '../utils/appDate';
import { getMondayForDate } from '../utils/sessionResolver';
import type { ActiveProgramModifierVisibleDay } from '../utils/activeProgramModifiers';
import { selectActiveCoachNotes } from '../utils/activeCoachNotes';
import type { ActiveCoachNote } from '../utils/activeCoachNotes';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useAthletePreferencesStore } from '../store/athletePreferencesStore';
import { useCoachPreferencesStore } from '../store/coachPreferencesStore';
import { useReadinessStore } from '../store/readinessStore';
import { useProfileStore } from '../store/profileStore';
import { useProgramStore } from '../store/programStore';
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import { useDecisionLedgerStore } from '../store/decisionLedgerStore';
import { isTemporaryEquipmentFact } from '../rules/temporarySourceFact';
import { factHorizonCoversWeek } from '../rules/durableFactHorizon';

export interface ActiveModifiersSnapshotInput {
  /** Reuse Program's displayed days, or resolve the requested week on My Status. */
  readonly visibleWeekDays?: readonly ActiveProgramModifierVisibleDay[];
  readonly weekStartISO?: string;
}

/**
 * The active modifiers, and the count the strip shows.
 *
 * `count` is not a second fact — it is `modifiers.length`, returned so no
 * surface writes `notes.length` beside a list it might have filtered. A count
 * taken separately from the list it counts is the shape this repo has been
 * bitten by fourteen times.
 */
export interface ActiveModifiers {
  readonly modifiers: readonly ActiveCoachNote[];
  readonly count: number;
  /**
   * WHICH OF THE ATHLETE'S SOURCE FACTS ARE EQUIPMENT, FOR THE WEEK ON SCREEN.
   *
   * `ActiveModifiersSection` needs this to pick the equipment-specific testIDs
   * for `clear_adjustment` and `update_adjustment` — the ids the explorer, the
   * walker and every dev-e2e finder resolve those two controls by.
   *
   * IT LIVES HERE BECAUSE IT IS PART OF THE SAME DERIVATION, and until
   * 2026-08-12 it was not: `useHomeScreen` computed it and `CoachTabScreen`,
   * having no way to reach it, passed an EMPTY SET. That is not a stub — an
   * empty set does not disable those ids, it silently swaps them for the
   * fallback, so the one screen that owns the controls advertised coordinates
   * nothing could resolve. A second derivation at that call site would have
   * been the same defect one layer up; this is the same fix `modifiers` itself
   * got when this file was written.
   */
  readonly equipmentFactIds: ReadonlySet<string>;
}

export function useActiveModifiers(
  input: ActiveModifiersSnapshotInput = {},
): ActiveModifiers {
  // THE ACCEPTED PROGRAM CONTEXT IS THE AUTHORITY; CoachUpdates is only its
  // compatibility mirror. Reading the mirror here made My Status the one
  // athlete-facing surface that could lose an injury while Program still
  // showed the canonical injury episode (device reproduction, 2026-08-24).
  // Normalisation also re-composes the constraint from the stored typed fact,
  // so a stale/empty compatibility array cannot turn a saved injury invisible.
  const acceptedMaterialContext = useProgramStore((s) => s.acceptedMaterialContext);
  const acceptedContext = useMemo(
    () => normalizeAcceptedMaterialContext(acceptedMaterialContext),
    [acceptedMaterialContext],
  );
  const { activeConstraints, temporarySourceFacts } = acceptedContext;
  const decisionEntries = useDecisionLedgerStore(s => s.entries);
  const reversibleAdjustments = useProgramStore(s => s.reversibleAdjustmentLedger.adjustments);
  const sessionConstraints = useProgramStore(s => s.userRemovalConstraints);
  const dismissedCoachNoteIds = useCoachUpdatesStore((s) => s.dismissedCoachNoteIds);
  const athletePrefs = useAthletePreferencesStore((s) => s.prefs);
  const modalityPreferences = useCoachPreferencesStore((s) => s.modalityPreferences);
  const readinessSignalsByDate = useReadinessStore((s) => s.signalsByDate);
  const onboardingData = useProfileStore((s) => s.onboardingData);
  const currentProgram = useProgramStore(s => s.currentProgram);
  const todayISO = todayISOLocal();
  const targetWeek = getMondayForDate(input.weekStartISO ?? input.visibleWeekDays?.[0]?.date ?? todayISO);
  const resolvedDays = useResolvedWeekForDate(input.visibleWeekDays ? undefined : targetWeek);
  const visibleWeekDays = input.visibleWeekDays ?? resolvedDays;
  const compiledWeek = currentProgram?.microcycles.find(week => week.startDate.slice(0, 10) === targetWeek);
  const weekKind = compiledWeek?.weekKind;

  const modifiers = useMemo(
    () => selectActiveCoachNotes({
      activeConstraints,
      temporarySourceFacts,
      decisionEntries,
      reversibleAdjustments,
      sessionConstraints,
      dismissedCoachNoteIds,
      athletePrefs,
      modalityPreferences,
      onboardingData,
      readinessSignalsByDate,
      weekKind,
      compiledWeek,
      todayISO,
      visibleWeekDays,
    }),
    [
      activeConstraints,
      temporarySourceFacts,
      decisionEntries,
      reversibleAdjustments,
      sessionConstraints,
      dismissedCoachNoteIds,
      athletePrefs,
      modalityPreferences,
      onboardingData,
      readinessSignalsByDate,
      weekKind,
      compiledWeek,
      todayISO,
      visibleWeekDays,
    ],
  );

  // THE SAME TWO FILTERS `useHomeScreen` HAS ALWAYS APPLIED, IN THE SAME ORDER.
  // The horizon filter is not optional: comparing `scope.until` directly drops
  // every OPEN fact, which blanks exactly the durable reports (severe illness,
  // cooked, no gym for a month) that most need showing.
  const visibleWeekStart = (visibleWeekDays?.[0] as { date?: string } | undefined)?.date;
  const equipmentFactIds = useMemo(() => new Set(temporarySourceFacts
    .filter(isTemporaryEquipmentFact)
    .filter((fact) => !visibleWeekStart || factHorizonCoversWeek(fact, visibleWeekStart))
    .map((fact) => fact.factId)),
  [temporarySourceFacts, visibleWeekStart]);

  return useMemo(
    () => ({ modifiers, count: modifiers.length, equipmentFactIds }),
    [modifiers, equipmentFactIds],
  );
}
