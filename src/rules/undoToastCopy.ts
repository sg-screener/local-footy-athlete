/**
 * THE UNDO TOAST'S WORDS — PROPOSED, per the surface ruling's item 3.
 *
 * `docs/UNDO_SURFACE_RULING_2026-08-09.md`: the mock's question ④ *"stands
 * reduced: toast wording ships PROPOSED to a copy batch as all new strings do."*
 *
 * ONLY TWO STRINGS ARE MINE. The sentence's VERB comes from
 * `rules/journalChanges.phraseFor` — the owner that already turns a decision
 * into the athlete's words ("moved a session", "removed a session") — so this
 * module owns the frame and the action label and deliberately not the
 * vocabulary. A second list of decision words would be a rival for a question
 * that already has an owner, which the week-job slice refused once already.
 *
 * NOT GATED BY PROVENANCE, and that is a deliberate difference from
 * `journalReminderCopy`. The reminder gated itself because Sam could not review
 * a lock-screen sentence by using the app. **These two strings he sees the
 * first time he moves a session**, which is exactly the review the gate exists
 * to substitute for. Adding a signature gate here would hide undo's only
 * affordance behind a signature and cost the unit its visible face for nothing.
 */

/** Batch 29 — PROPOSED 2026-08-09, unruled. */
export const UNDO_TOAST_COPY = {
  /**
   * Reads as "You moved a session." — the frame plus `phraseFor`'s verb.
   * Second person because the athlete did it; past tense because it already
   * happened. The alternative Sam may prefer is no frame at all ("Moved a
   * session"), which is shorter and less warm.
   */
  sentencePrefix: 'You',
  /** The action. One word, because the ruled shape is one step. */
  undoAction: 'Undo',
} as const;
