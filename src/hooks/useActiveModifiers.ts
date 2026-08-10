/**
 * THE ATHLETE'S ACTIVE PROGRAM MODIFIERS — ONE DERIVATION, EVERY SURFACE.
 *
 * Ruling 4 of the UI merge moves the modifiers off the day screen and onto the
 * coach page, and the seat's note on ruling 7 adds a third surface: *"the '2
 * active modifiers' row appears at the top of the WEEK view too — same component
 * as the day screen's, not a second one."*
 *
 * **THREE SURFACES IS THREE CHANCES TO DISAGREE, AND THIS FILE IS WHY THEY
 * CANNOT.** `selectActiveCoachNotes` was already the one selector; what was
 * missing was a way to REACH it from anywhere but `useHomeScreen`, which is a
 * 2000-line hook belonging to one screen. A second screen that assembled the
 * same snapshot by hand would be a second reading of the athlete's state — the
 * exact defect every law in this repo exists to kill — and it would drift the
 * first time an input was added, silently, because nothing compares two lists
 * nobody knows are two.
 *
 * IT ADDS NO STORED STATE AND NO NEW SOURCE. Every input is read from the store
 * that already owns it; the week comes from `useResolvedWeek`, the same
 * derivation the coach tab and the program tab already share. This is the north
 * star's own sentence — store only decisions, derive everything else — applied
 * to a list that was already derived and merely unreachable.
 */

import { useMemo } from 'react';
import { selectActiveCoachNotes } from '../utils/activeCoachNotes';
import type { ActiveCoachNote } from '../utils/activeCoachNotes';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useAthletePreferencesStore } from '../store/athletePreferencesStore';
import { useCoachPreferencesStore } from '../store/coachPreferencesStore';
import { useReadinessStore } from '../store/readinessStore';
import { useProfileStore } from '../store/profileStore';

export interface ActiveModifiersSnapshotInput {
  /**
   * The days the athlete is looking at, and the week's kind if it is known.
   *
   * PASSED IN, NEVER RE-DERIVED HERE, for the reason `CoachTabScreen`'s own
   * comment gives about `executePlanChangeAction`: a surface that re-derived its
   * own week would be free to describe a week nobody is reading. Callers hand it
   * the week they are showing.
   */
  readonly visibleWeekDays?: readonly unknown[];
  readonly weekKind?: string;
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
}

export function useActiveModifiers(
  input: ActiveModifiersSnapshotInput = {},
): ActiveModifiers {
  const activeConstraints = useCoachUpdatesStore((s) => s.activeConstraints);
  const activeInjury = useCoachUpdatesStore((s) => s.activeInjury);
  const dismissedCoachNoteIds = useCoachUpdatesStore((s) => s.dismissedCoachNoteIds);
  const athletePrefs = useAthletePreferencesStore((s) => s.prefs);
  const modalityPreferences = useCoachPreferencesStore((s) => s.modalityPreferences);
  const readinessSignalsByDate = useReadinessStore((s) => s.signalsByDate);
  const onboardingData = useProfileStore((s) => s.onboardingData);
  const { visibleWeekDays, weekKind } = input;

  const modifiers = useMemo(
    () => selectActiveCoachNotes({
      activeConstraints,
      activeInjury,
      dismissedCoachNoteIds,
      athletePrefs,
      modalityPreferences,
      onboardingData,
      readinessSignalsByDate,
      weekKind,
      visibleWeekDays,
    } as Parameters<typeof selectActiveCoachNotes>[0]),
    [
      activeConstraints,
      activeInjury,
      dismissedCoachNoteIds,
      athletePrefs,
      modalityPreferences,
      onboardingData,
      readinessSignalsByDate,
      weekKind,
      visibleWeekDays,
    ],
  );

  return useMemo(
    () => ({ modifiers, count: modifiers.length }),
    [modifiers],
  );
}
