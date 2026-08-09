/**
 * THE ONLY MODULE IN THIS APP THAT TALKS TO `expo-notifications`.
 *
 * Sam's C6, 2026-08-09. The decision — whether to schedule, whether we may ask,
 * when the next Monday morning is — lives in `rules/journalReminder.ts` and is
 * pure. **This file is the hands, not the head**, and the split is what lets
 * the rule be tested on a machine with no notification centre.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * NATIVE DEPENDENCY — SAM MUST REBUILD. Stated here as well as in the boundary
 * report, because the person who next edits this file is the person most likely
 * to wonder why nothing happens on their simulator.
 *
 * `expo-notifications` ships native code. **A JS reload will not pick it up: the
 * app has to be rebuilt with pods installed** (`npx expo prebuild` then
 * `pod install` in `ios/`, or `npx expo run:ios`). Until that rebuild every
 * function here is inert on the running binary.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * EVERY CALL IS WRAPPED, AND NOT OUT OF SUPERSTITION. This module runs against
 * a native module that may be absent from the binary — which is the NORMAL
 * state between adding the dependency and Sam rebuilding, not an edge case. A
 * throw from the notification centre must not take the Journal tab down with
 * it: **a missing reminder is a missing reminder; a white screen is a broken
 * app.**
 *
 * A FAILURE AND A REFUSAL ARE DIFFERENT ANSWERS AND THIS FILE KEEPS THEM APART.
 * `refused` is Sam's fact, returned by the rule. `unavailable` is this layer
 * admitting it could not reach the OS. Collapsing them would report the athlete
 * as having declined something they were never asked.
 */

import * as Notifications from 'expo-notifications';
import {
  JOURNAL_REMINDER_HOUR,
  JOURNAL_REMINDER_MINUTE,
  JOURNAL_REMINDER_WEEKDAY,
  decideJournalReminder,
  type JournalReminderState,
  type NotificationPermission,
} from '../rules/journalReminder';
import { JOURNAL_REMINDER_COPY } from '../rules/journalReminderCopy';

/**
 * A stable identifier so a reschedule REPLACES rather than stacks.
 *
 * WITHOUT THIS THE ATHLETE GETS ONE NOTIFICATION PER APP LAUNCH. Every visit to
 * the Journal tab would schedule another weekly trigger, and by the third week
 * a moderately active athlete would have a dozen identical Monday alerts. The
 * cancel-then-schedule below is what makes this operation idempotent.
 */
export const JOURNAL_REMINDER_IDENTIFIER = 'journal-monday-reminder';

/** What the surface gets back. `unavailable` is this layer's own admission. */
export type JournalReminderOutcome =
  | JournalReminderState
  | { readonly kind: 'unavailable'; readonly reason: string };

function unavailable(error: unknown): JournalReminderOutcome {
  return {
    kind: 'unavailable',
    reason: error instanceof Error ? error.message : String(error),
  };
}

async function readPermission(): Promise<NotificationPermission> {
  const current = await Notifications.getPermissionsAsync();
  return { granted: current.granted, canAskAgain: current.canAskAgain };
}

/**
 * WHERE WE STAND, WITHOUT ASKING THE ATHLETE ANYTHING.
 *
 * READ-ONLY BY CONSTRUCTION — it calls `getPermissionsAsync`, never
 * `requestPermissionsAsync`. The surface renders from this on every mount, and
 * a mount must never be able to raise a system prompt: a permission dialog the
 * athlete did not tap anything to summon is exactly the impolite version C6
 * rules out.
 */
export async function readJournalReminderState(
  now: Date,
): Promise<JournalReminderOutcome> {
  try {
    return decideJournalReminder({ permission: await readPermission(), now });
  } catch (error) {
    return unavailable(error);
  }
}

/**
 * ASK, THEN SCHEDULE IF THE ANSWER IS YES. Called from a tap and from nowhere
 * else.
 *
 * THE UNSIGNED-COPY CHECK RUNS BEFORE THE PROMPT, and that ordering is the
 * whole point of the gate. iOS grants an app ONE permission prompt; spending it
 * on a reminder whose sentence Sam has not read would burn the prompt on a
 * feature that cannot fire, and the OS does not hand it back.
 */
export async function enableJournalReminder(now: Date): Promise<JournalReminderOutcome> {
  try {
    const before = decideJournalReminder({ permission: await readPermission(), now });
    if (before.kind === 'unsigned_copy' || before.kind === 'refused') return before;

    if (!(await Notifications.getPermissionsAsync()).granted) {
      const asked = await Notifications.requestPermissionsAsync();
      const after = decideJournalReminder({
        permission: { granted: asked.granted, canAskAgain: asked.canAskAgain },
        now,
      });
      // NOT GRANTED IS THE END OF IT. No retry, no second prompt, no error path
      // — Sam's "a refusal is a fact, not an error", as control flow.
      if (after.kind !== 'scheduled') return after;
    }

    await scheduleJournalReminder();
    return decideJournalReminder({ permission: await readPermission(), now });
  } catch (error) {
    return unavailable(error);
  }
}

/**
 * THE WEEKLY TRIGGER, AS ONE OBJECT WITH ONE OWNER.
 *
 * EXPORTED SO THE PROOF PATH FIRES THE REAL THING. The dev panel asks the OS
 * what date THIS trigger would next fire — which is the only honest way to
 * check the `+ 1` below. **A proof that built its own trigger would prove its
 * own trigger**, and the weekday conversion is exactly the byte a hand-written
 * copy would get right by accident and the real one wrong.
 *
 * THE `+ 1` IS THE LINE THE BOUNDARY REPORT FLAGGED. `JOURNAL_REMINDER_WEEKDAY`
 * is 1 in `Date.getDay()` terms (Sunday 0); expo's `WeeklyTriggerInput` counts
 * Sunday as 1. Both are documented; neither has ever been observed on a device,
 * and a unit test cannot observe it either — the OS does the conversion.
 */
export function journalReminderWeeklyTrigger(): Notifications.WeeklyTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: JOURNAL_REMINDER_WEEKDAY + 1, // expo counts Sunday as 1
    hour: JOURNAL_REMINDER_HOUR,
    minute: JOURNAL_REMINDER_MINUTE,
  };
}

/**
 * THE CONTENT, ALSO ONE OBJECT WITH ONE OWNER, and for the same reason: the
 * 2-minute proof must deliver the sentence the athlete will actually get,
 * including the payload the tap handler reads. A proof that sent "test" would
 * prove the notification centre works and nothing about this feature.
 */
export function journalReminderContent(): Notifications.NotificationContentInput {
  return {
    title: JOURNAL_REMINDER_COPY.title,
    body: JOURNAL_REMINDER_COPY.body,
    // READ BY THE TAP HANDLER TO OPEN THE JOURNAL TAB — C6's "opens the
    // Journal tab". The route name is the navigator's own, not a copy.
    data: { route: 'JournalTab' },
  };
}

/**
 * The weekly schedule itself.
 *
 * CANCEL FIRST, ALWAYS. See `JOURNAL_REMINDER_IDENTIFIER` — without the cancel
 * this stacks a duplicate on every call.
 *
 * THE OS OWNS THE RECURRENCE, NOT US. A weekly trigger is handed to the
 * notification centre once and fires every Monday whether the app is opened or
 * not; the alternative — scheduling the next one each time the athlete visits —
 * would silently stop working for the athlete who stops visiting, which is
 * precisely the athlete a reminder is for.
 */
async function scheduleJournalReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(JOURNAL_REMINDER_IDENTIFIER)
    .catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier: JOURNAL_REMINDER_IDENTIFIER,
    content: journalReminderContent(),
    trigger: journalReminderWeeklyTrigger(),
  });
}

/**
 * Take it away again.
 *
 * TURNING IT OFF DOES NOT REVOKE THE PERMISSION, and cannot — only the OS
 * Settings app can. So after this the state reads `may_ask` again, which is
 * honest: we still hold permission, we have simply scheduled nothing.
 */
export async function disableJournalReminder(): Promise<JournalReminderOutcome | null> {
  try {
    await Notifications.cancelScheduledNotificationAsync(JOURNAL_REMINDER_IDENTIFIER);
    return null;
  } catch (error) {
    return unavailable(error);
  }
}
