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
 * PROPOSED — batch 28. Every word here is the terminal's and none of it has
 * Sam's signature.
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
  provenance: 'proposed' as JournalReminderCopyProvenance,
  source: 'PROPOSED — C6 requires Sam sees the sentence before it ever fires',
} as const;

/**
 * THE ONLY DOOR. Nothing schedules a notification without asking this first,
 * and a cell asserts the service reaches the words through here rather than
 * through the object.
 */
export function isJournalReminderSentenceSigned(): boolean {
  return JOURNAL_REMINDER_COPY.provenance === 'signed';
}
