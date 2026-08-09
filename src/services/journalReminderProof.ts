/**
 * THE PROOF PATH — Sam's order, 2026-08-09: *"a way for SAM (never an athlete)
 * to make the journal reminder fire ~2 minutes from now on his own device."*
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT IS ACTUALLY UNPROVEN, AND WHY A 2-MINUTE FIRE IS ONLY HALF OF IT.
 *
 * The notification boundary report named one thing as most likely to be wrong:
 * **the weekday conversion.** `JOURNAL_REMINDER_WEEKDAY` is 1 in
 * `Date.getDay()` terms; expo's `WeeklyTriggerInput` counts Sunday as 1, so the
 * service passes `weekday + 1`. Both numbering schemes are documented. Neither
 * has ever been observed, and no unit test can observe it — **the OS performs
 * the conversion, so only the OS can be asked.**
 *
 * A NOTIFICATION FIRING IN TWO MINUTES DOES NOT TOUCH THAT. It uses a
 * TIME_INTERVAL trigger; the weekday never enters it. Firing one would prove
 * the native module, the permission, the words and the tap — and would leave
 * the single flagged unknown exactly as unproven as before, while feeling like
 * a pass. **That is the shape this repo calls a green gate that lies**, so the
 * proof path is TWO instruments and the report says which proves what:
 *
 *   `previewWeeklyFireDate()` — asks the OS what date the REAL weekly trigger
 *     would next fire, and reports the weekday it lands on. **This is the
 *     weekday-conversion proof**, and it needs no waiting and no permission.
 *
 *   `fireJournalReminderIn(seconds)` — schedules the REAL content on a short
 *     interval. Proves the native module, the permission prompt, the sentence
 *     as it will read, and that tapping lands on the Journal tab.
 *
 * BOTH READ THE REAL OBJECTS FROM THE SERVICE. `journalReminderWeeklyTrigger()`
 * and `journalReminderContent()` are exported for exactly this — a proof that
 * builds its own trigger proves its own trigger, and the conversion is precisely
 * the byte a hand-written copy gets right by accident.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THIS FILE SHIPS. IT IS ITS CALLER THAT DOES NOT.
 *
 * The `__DEV__` double gate lives at the panel's require and render sites in
 * `JournalScreen`, which is the convention `ScheduleDebugPanel` established and
 * `signedCopyExtractionTests` already asserts. Putting the gate here as well
 * would look safer and be worse: a module that no-ops under a flag is a module
 * whose caller can still be written, and the thing that must be unreachable is
 * the DOOR, not the function behind it.
 */

import * as Notifications from 'expo-notifications';
import {
  JOURNAL_REMINDER_WEEKDAY,
  nextMondayMorning,
} from '../rules/journalReminder';
import {
  journalReminderContent,
  journalReminderWeeklyTrigger,
} from './journalReminderService';

/** A separate id, so a proof never overwrites or cancels the athlete's real one. */
export const JOURNAL_REMINDER_PROOF_IDENTIFIER = 'journal-monday-reminder-proof';

export const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

export interface WeeklyFirePreview {
  /** What the OS says, as an instant. Null when it will not answer. */
  readonly nextFire: Date | null;
  /** The weekday that instant lands on, named. */
  readonly weekday: string | null;
  /** THE VERDICT: did the conversion survive the round trip through the OS? */
  readonly landsOnMonday: boolean;
  /** What our own pure rule predicted, for the side-by-side. */
  readonly predicted: Date;
  readonly error: string | null;
}

/**
 * ASK THE OS WHAT DATE THE REAL WEEKLY TRIGGER WOULD NEXT FIRE.
 *
 * THE COMPARISON IS THE POINT, NOT THE DATE. `nextMondayMorning` is our pure
 * rule's answer and `getNextTriggerDateAsync` is the OS's answer to the same
 * question, reached through the `+ 1`. **If the conversion is wrong they
 * disagree by a day and the weekday name says so in a word Sam can read** —
 * which is the whole reason this reports "Tuesday" rather than a timestamp.
 *
 * IT SCHEDULES NOTHING AND ASKS FOR NOTHING. No permission, no pending
 * notification, no cleanup — so Sam can run it before deciding whether to let
 * the app notify him at all.
 */
export async function previewWeeklyFireDate(now: Date): Promise<WeeklyFirePreview> {
  const predicted = nextMondayMorning(now);
  try {
    const timestamp = await Notifications.getNextTriggerDateAsync(
      journalReminderWeeklyTrigger(),
    );
    if (timestamp === null) {
      return {
        nextFire: null,
        weekday: null,
        landsOnMonday: false,
        predicted,
        error: 'the OS returned no next fire date for this trigger',
      };
    }
    const nextFire = new Date(timestamp);
    return {
      nextFire,
      weekday: WEEKDAY_NAMES[nextFire.getDay()] ?? null,
      landsOnMonday: nextFire.getDay() === JOURNAL_REMINDER_WEEKDAY,
      predicted,
      error: null,
    };
  } catch (error) {
    return {
      nextFire: null,
      weekday: null,
      landsOnMonday: false,
      predicted,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export interface ProofFireResult {
  readonly scheduled: boolean;
  /** When it should land, so the panel can say "watch for it at 14:32". */
  readonly expectedAt: Date | null;
  readonly error: string | null;
}

/**
 * FIRE THE REAL NOTIFICATION ON A SHORT INTERVAL.
 *
 * THE PERMISSION IS REQUESTED HERE AND NOT BORROWED. Sam may not have granted
 * it — the athlete-facing offer is a separate tap he has no reason to have made
 * — so the proof asks, and reports a refusal as a refusal rather than as a
 * failure to schedule.
 *
 * IT USES A SEPARATE IDENTIFIER, so running the proof can never cancel or
 * overwrite a real Monday reminder that is already pending. The two live side
 * by side and the proof cleans up after itself below.
 *
 * IOS FLOORS A TIME_INTERVAL AT 60 SECONDS in practice; two minutes is Sam's
 * number and sits clear of it.
 */
export async function fireJournalReminderIn(
  seconds: number,
  now: Date,
): Promise<ProofFireResult> {
  try {
    const permission = await Notifications.getPermissionsAsync();
    const granted = permission.granted
      || (permission.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) {
      return { scheduled: false, expectedAt: null, error: 'notification permission refused' };
    }

    await Notifications.cancelScheduledNotificationAsync(JOURNAL_REMINDER_PROOF_IDENTIFIER)
      .catch(() => undefined);
    await Notifications.scheduleNotificationAsync({
      identifier: JOURNAL_REMINDER_PROOF_IDENTIFIER,
      // THE REAL CONTENT, INCLUDING THE REAL PAYLOAD — so tapping this proves
      // the navigation too, not just the delivery.
      content: journalReminderContent(),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
    });
    return {
      scheduled: true,
      expectedAt: new Date(now.getTime() + seconds * 1000),
      error: null,
    };
  } catch (error) {
    return {
      scheduled: false,
      expectedAt: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Clear a pending proof, so a forgotten one cannot surprise anybody later. */
export async function cancelJournalReminderProof(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(JOURNAL_REMINDER_PROOF_IDENTIFIER)
    .catch(() => undefined);
}
