/**
 * BATCH 30 — EVERY WORD THE COACH TAB PUTS ON THE GLASS. PROPOSED 2026-08-09.
 *
 * Slice 1 of the coach rebuild. Nothing here is signed; the kickoff's own line
 * is *"All copy PROPOSED -> batch"*, and Sam rules the words against his
 * "get to the point" ruling once he has seen them on the phone.
 *
 * WHY A MODULE AND NOT `SignedCopy` ENTRIES YET. The signed-copy sheet is where
 * words go once Sam has ruled them; putting unruled prose in it would make the
 * registry claim a provenance that does not exist. The `undoToastCopy`
 * precedent (batch 29) is the same shape: a plain module, one owner, declared
 * PROPOSED in its docblock, promoted to the sheet at signing.
 *
 * DECLARED, NOT RIDDEN SILENTLY: this module lives in `rules/`, which
 * `signedCopyExtractionTests` does not walk (it walks `screens`, `components`,
 * `navigation`). So batch 30 exists here and NOT on the sheet — the same known
 * ~150-string `utils`/`rules` gap batch 29 sits in. The copy gates staying green
 * is not evidence about these words, and `coachTabSlice1Tests` asserts the
 * SCREEN authors none of its own instead.
 */

/**
 * The opener's fragments.
 *
 * Sam's ruling 1 on the mock: *"I think the initial message can be shorter, I
 * want the coach to mostly get to the point."* The mock's opener carried three
 * clauses of reasoning ("so this week trains heavy early… then we back off
 * Friday"); what survives is the week's shape and nothing else. **The reasoning
 * is the part that would have had to be invented**, which is L-C1 deciding a
 * wording question before Sam had to.
 *
 * THE SEPARATORS ARE ENTRIES, for the reason `joinSignedCopy` exists: a call
 * site choosing `'. '` is a call site authoring athlete-visible text.
 */
export const COACH_OPENER_COPY = {
  /** Leads the sentence when a fixture is further off than tomorrow. */
  fixtureLead: 'Game',
  /** Suffixes naming the day a session sits on. */
  today: 'today',
  tomorrow: 'tomorrow',
  /** Between clauses, and after the last one. */
  clauseJoin: '. ',
  fullStop: '.',
  /**
   * The honest answer when the projection holds no day for today at all. It
   * says what is true rather than greeting the athlete into an empty
   * conversation — the coach does not pretend to a week it cannot see.
   */
  noWeek: "I can't see your week yet.",
} as const;

/** The tab's own chrome and its one answer. */
export const COACH_TAB_COPY = {
  /** The tab bar label and the screen title — the mock's own word. */
  title: 'Coach',
  placeholder: 'Ask your coach anything…',
  /** Screen-reader names. The send control is a glyph, so it needs one. */
  sendAccessibilityLabel: 'Send',
  conversationAccessibilityLabel: 'Conversation with your coach',
  /**
   * SLICE 1 HAS NO ANSWERING LAYER, AND THIS IS IT SAYING SO.
   *
   * Not a stub and not a placeholder: L-C1 says that when no recorded rule
   * answers, the coach **says it doesn't know** and never invents policy. In
   * slice 1 no rule answers anything, so this is the law running at its
   * boundary rather than a screen apologising for being unfinished. S2 replaces
   * it with answers grounded in the program; until then an invented answer
   * would be the exact failure the kickoff was written to prevent.
   */
  noAnswerYet: "I don't have an answer for that yet.",
} as const;
