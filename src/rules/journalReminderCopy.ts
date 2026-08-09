/**
 * THE NOTIFICATION'S WORDS, AND THE GATE THAT KEEPS THEM OFF A LOCK SCREEN
 * UNTIL SAM HAS READ THEM.
 *
 * Sam's C6, verbatim: *"Notification sentence comes to Sam PROPOSED before it
 * ever fires."*
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A MODULE AND NOT A COMMENT.
 *
 * Every other PROPOSED string in this app is a string on a screen. If it ships
 * before Sam rules on it he sees it on his own phone, in context, and can say
 * so. **A notification is the one athlete-visible surface he cannot review by
 * using the app**, because it appears on a lock screen at 8am on a Monday and
 * nowhere else. "Remember to get it signed first" is not a mechanism for a
 * sentence nobody will notice shipping.
 *
 * SO THE PROVENANCE IS STRUCTURAL, THE SAME MOVE THE LOAD MODEL MADE FOR ITS
 * CONSTANTS. `decideJournalReminder` returns `unsigned_copy` while this reads
 * PROPOSED, and in that state **no permission is requested and nothing is
 * scheduled at all.** Sam's signature flips one field and the reminder starts
 * working — no code change, exactly like the eight constants he signed on
 * 2026-08-09.
 *
 * THE PERMISSION PROMPT IS BEHIND THE SAME GATE ON PURPOSE. iOS gives an app
 * ONE chance to ask; spending it on a feature that cannot fire yet would burn
 * the prompt and leave the athlete refusing something they never got.
 */

export type JournalReminderCopyProvenance = 'signed' | 'proposed';

/** Stable id, so the words can change without a rename. */
export const JOURNAL_REMINDER_COPY_ID = 'journal.reminder.monday';

/**
 * SIGNED — batch 28, Sam 2026-08-09.
 *
 * THE SECOND SURFACE A SIGNATURE HAS ARMED IN ONE DAY. This entry read
 * `proposed` for the length of one slice, during which the reminder could not be
 * scheduled and no permission could be requested. Sam signed it and the feature
 * became reachable — no code change, the same mechanism as the eight load
 * constants that morning.
 *
 * ARMING IS NOT ENABLING, AND THE DISTINCTION IS THE WHOLE SAFETY MARGIN.
 * Signing removed THIS terminal's gate. The athlete's own opt-in tap and iOS
 * permission both still stand in front of every notification, and neither is
 * something a signature can grant.
 *
 * THE SENTENCE IS DELIBERATELY NOT A COACHING CLAIM. It does not say the week
 * went well or badly, does not name a number, and does not tell the athlete
 * what to do — it says the week is over and the Journal is there. Anything
 * stronger would be a verdict delivered to a lock screen before the athlete has
 * opened anything, which is the opposite of "observation, never diagnosis".
 *
 * AND IT CARRIES NO DERIVED VALUE, which is a second deliberate limit. A title
 * like "You did 4 of 5 sessions" would need the whole projection resolved in a
 * background task, on a schedule, with no screen — and a notification that is
 * WRONG about the athlete's week is worse than a notification that is plain.
 */
export const JOURNAL_REMINDER_COPY = {
  id: JOURNAL_REMINDER_COPY_ID,
  title: 'Last week',
  body: 'Your week is in the Journal.',
  provenance: 'signed' as JournalReminderCopyProvenance,
  source: 'Sam 2026-08-09, batch 28 — signed as proposed, arming the reminder',
} as const;

/**
 * THE ONLY DOOR. Nothing schedules a notification without asking this first,
 * and a cell asserts the service reaches the words through here rather than
 * through the object.
 */
export function isJournalReminderSentenceSigned(): boolean {
  return JOURNAL_REMINDER_COPY.provenance === 'signed';
}
