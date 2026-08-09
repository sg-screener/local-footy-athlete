/**
 * THE MONDAY REMINDER — Sam's decision C6, 2026-08-09.
 *
 * *"BUILD THE MONDAY NOTIFICATION — its own slice, after the flip lands:
 * expo-notifications dependency, permission asked politely and refusable (a
 * refusal is a fact, not an error), Monday-morning local schedule, opens the
 * Journal tab. Notification sentence comes to Sam PROPOSED before it ever
 * fires."*
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ZERO NEW STORED STATE, AND THE REASON IS THE NORTH STAR RATHER THAN THRIFT.
 *
 * The obvious build stores a `journalReminderEnabled` flag and a
 * `permissionAsked` marker. **Both would be second copies of facts the OS
 * already owns.** `getPermissionsAsync()` returns `granted` and `canAskAgain`,
 * and between them they answer every question this feature has:
 *
 *   granted                      -> schedule it
 *   !granted && canAskAgain      -> we may ask; the athlete has not said no
 *   !granted && !canAskAgain     -> **the athlete refused. That is the fact.**
 *
 * A stored mirror of that goes stale the moment the athlete changes their mind
 * in Settings — and it would go stale silently, which is how an app ends up
 * certain it has permission it does not have. **The OS is the store.**
 *
 * ONE NOTIFICATION, ONE PERMISSION, and that is what keeps the above true. The
 * moment a second kind of notification exists, "is notifications on" stops
 * answering "does this athlete want the Monday nudge" and a real preference has
 * to be recorded. It would be an INPUT and the north star would allow it — but
 * it does not exist yet, so it is not minted yet.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * A REFUSAL IS A FACT, NOT AN ERROR — SAM'S WORDS, BUILT AS A RETURN VALUE.
 *
 * `refused` is a first-class state of this module, sitting beside `scheduled`
 * rather than in a catch block. Nothing retries it, nothing logs it as a
 * failure, and the surface says nothing at all — an athlete who declined a
 * notification does not need a card explaining that they declined it.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THIS MODULE IS PURE (L14) AND TOUCHES NO NATIVE MODULE. It decides WHAT
 * should happen from facts handed to it; `services/journalReminderService.ts`
 * is the only thing that talks to `expo-notifications`. That split is what
 * makes the scheduling rule — which Monday, at what hour, in the athlete's own
 * timezone — testable at all on a machine with no notification centre.
 */

import { JOURNAL_REMINDER_COPY_ID, isJournalReminderSentenceSigned } from './journalReminderCopy';

/**
 * What the OS says about our one permission.
 *
 * MODELLED ON THE TWO FLAGS RATHER THAN ON THE STATUS STRING, because the
 * string has platform-specific members (`provisional` on iOS) and the decision
 * does not depend on which of them we got — only on "may we send" and "may we
 * ask".
 */
export interface NotificationPermission {
  readonly granted: boolean;
  /** False once the athlete has declined and the OS will not surface us again. */
  readonly canAskAgain: boolean;
}

export type JournalReminderState =
  /** Permission is ours; the reminder is scheduled. */
  | { readonly kind: 'scheduled'; readonly nextFireISO: string }
  /** We have never asked, or the OS will still let us. The surface may offer. */
  | { readonly kind: 'may_ask' }
  /** The athlete said no. A FACT — nothing retries, nothing is shown. */
  | { readonly kind: 'refused' }
  /**
   * The sentence is not signed yet, so nothing may be scheduled at all.
   * Sam's C6: "Notification sentence comes to Sam PROPOSED before it ever
   * fires." This is that sentence made structural — see below.
   */
  | { readonly kind: 'unsigned_copy'; readonly copyId: string };

/** 08:00 on Monday, in whatever timezone the athlete's device is in. */
export const JOURNAL_REMINDER_HOUR = 8;
export const JOURNAL_REMINDER_MINUTE = 0;
/** `Date.getDay()` — 0 is Sunday, so Monday is 1. */
export const JOURNAL_REMINDER_WEEKDAY = 1;

/**
 * THE DECISION, AND IT REFUSES BEFORE IT ASKS.
 *
 * "THE SENTENCE COMES TO SAM PROPOSED BEFORE IT EVER FIRES" IS A GATE, NOT A
 * PROMISE, and it is the same mechanism the load model's constants use. An
 * unsigned sentence returns `unsigned_copy` and **no permission is requested and
 * nothing is scheduled** — so the notification cannot fire early even if every
 * other piece is wired and working.
 *
 * IT IS DELIBERATELY THE FIRST BRANCH. Asking for permission and then declining
 * to use it would spend the one permission prompt an athlete ever sees on a
 * feature that cannot run yet — and iOS does not give it back.
 */
export function decideJournalReminder(input: {
  readonly permission: NotificationPermission;
  readonly now: Date;
  readonly copySigned?: boolean;
}): JournalReminderState {
  const signed = input.copySigned ?? isJournalReminderSentenceSigned();
  if (!signed) return { kind: 'unsigned_copy', copyId: JOURNAL_REMINDER_COPY_ID };
  if (input.permission.granted) {
    return { kind: 'scheduled', nextFireISO: nextMondayMorning(input.now).toISOString() };
  }
  return input.permission.canAskAgain ? { kind: 'may_ask' } : { kind: 'refused' };
}

/**
 * The next Monday 08:00 strictly after `now`, in LOCAL time.
 *
 * LOCAL, NOT UTC, AND THAT IS THE ONE PLACE THIS UNIT DEPARTS FROM THE REST OF
 * THE JOURNAL. Every date in the Journal is parsed as UTC because a week's
 * IDENTITY must not shift with the reader's offset. **A notification is the
 * opposite kind of fact**: "Monday morning" means Monday morning where the
 * athlete is standing, and a UTC 08:00 would reach a Melbourne athlete at 6pm
 * on Monday and a London athlete at 8am — the same instant, two different
 * mornings, one of them not a morning.
 *
 * STRICTLY AFTER, so a call at exactly 08:00 on a Monday schedules the NEXT
 * one rather than a notification for the instant that has just passed.
 */
export function nextMondayMorning(now: Date): Date {
  const candidate = new Date(now.getTime());
  candidate.setHours(JOURNAL_REMINDER_HOUR, JOURNAL_REMINDER_MINUTE, 0, 0);

  const daysUntilMonday = (JOURNAL_REMINDER_WEEKDAY - candidate.getDay() + 7) % 7;
  candidate.setDate(candidate.getDate() + daysUntilMonday);

  // Today IS Monday and 08:00 has already gone by — or has arrived exactly.
  if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 7);
  return candidate;
}
