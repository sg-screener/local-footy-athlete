/**
 * BATCH 30 — EVERY WORD THE COACH TAB PUTS ON THE GLASS. RULED 2026-08-09.
 *
 * Slice 1 of the coach rebuild, and every string below now carries a ruling:
 *
 * - **THE GREETING IS SAM'S OWN SENTENCE, VERBATIM** (2026-08-09): *"G'day, I'm
 *   your S&C coach. I can answer fitness questions and make changes to your
 *   program."* It is the one string in this batch that came out of his mouth
 *   word for word, so it is the one string that goes into the SIGNED-COPY SHEET
 *   rather than staying a module constant — `signed_sentence` provenance is
 *   exactly what it has.
 * - **THE OPENER FRAGMENTS ARE APPROVED AS SHIPPED** — *"the week-shape line
 *   stays as built, second bubble"*. The words did not change; their status did.
 * - **THE HONEST NO-ANSWER REPLY IS APPROVED AS SHIPPED** (slice-1 boundary
 *   parked item 3).
 *
 * ## THE GREETING SHIPS AHEAD OF THE ABILITY, AND THAT IS RULED TOO
 *
 * *"I can … make changes to your program"* is not true on the day it ships —
 * S3 is what makes it true. Sam ruled the gap himself: *"we aren't releasing
 * the app yet - we are going to build that shit now."* The app has no users but
 * his own devices, so the claim becomes true before any athlete reads it. **If
 * a beta gate arrives before S3, this sentence is re-checked** — recorded here
 * because a sentence whose honesty depends on a release plan should say so in
 * the file that holds it, not only in a boundary doc.
 *
 * ## WHY THE REST IS STILL A MODULE AND NOT THE SHEET
 *
 * The opener does not merely SHOW its fragments, it COMPOSES them — a space
 * between a day's name and "today", ". " between clauses, and a trailing full
 * stop. Under the sheet's strict regime each of those separators is
 * athlete-visible text and would need its own joiner entry, and `joinSignedCopy`
 * cannot express a trailing suffix at all; the alternative is widening
 * `FILLED_PLACEHOLDER` to admit WORDS, which is the global loosening of the L-P2
 * runtime law that `signedCopy.ts` explicitly warns against. So the branded
 * conversion of the OPENER is owed work with a stated price, not an oversight —
 * and in its place `coachTabSlice1Tests` [8] decomposes the produced sentence
 * back into these fragments plus projection-signed day names, and reds if a word
 * from anywhere else ever appears in it.
 *
 * DECLARED, NOT RIDDEN SILENTLY: this module lives in `rules/`, which
 * `signedCopyExtractionTests` does not walk (it walks `screens`, `components`,
 * `navigation`) — the same known ~150-string `utils`/`rules` gap batch 29 sits
 * in. The copy gates staying green is not evidence about these words.
 */

import { registerSignedCopy, signedCopy } from './signedCopy';

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

/**
 * SAM'S GREETING, IN THE SHEET.
 *
 * The registry is the only place in this repo where a string carries a
 * provenance a reader can check without reading code, and this sentence is the
 * only one in batch 30 that has the strongest kind — a verbatim quote. It is
 * registered here, in the batch's own module, so the words and their receipt
 * cannot end up in different files.
 *
 * `registerSignedCopy` throws when one id is registered twice with different
 * words, so the id below is a lock on the sentence: changing Sam's greeting
 * without changing this entry is not a thing that can happen quietly.
 */
export const COACH_GREETING_COPY_ID = 'coach.tab.greeting';

registerSignedCopy([
  {
    id: COACH_GREETING_COPY_ID,
    source: 'signed_sentence',
    provenance: "Sam, 2026-08-09 — verbatim, relayed through docs/SEAT_INBOX.md "
      + 'item 1(a) of the fifty-ninth pass. Ships ahead of the ability by his own '
      + "ruling (\"we aren't releasing the app yet - we are going to build that "
      + 'shit now"); the seat owns re-checking it if a beta gate arrives before S3.',
    text: "G'day, I'm your S&C coach. I can answer fitness questions and make "
      + 'changes to your program.',
  },
]);

/**
 * THE GREETING THE ATHLETE READS, THROUGH THE ONE CONSTRUCTOR.
 *
 * A function rather than a constant because `signedCopy` is the sheet's only
 * door and it THROWS on a missing entry — calling it at use time means a
 * deleted entry fails loudly at the screen instead of resolving to a stale
 * literal captured at module load.
 */
export function coachGreeting() {
  return signedCopy(COACH_GREETING_COPY_ID);
}

/**
 * BATCH 31 — WHAT THE COACH SAYS WHEN IT ANSWERS. PROPOSED 2026-08-10.
 *
 * Slice 2. Five entries, and the smallness is the point: every answer the coach
 * gives is built from the PROJECTION's own signed words — a day's name, a
 * part's headline — so the only new athlete-visible text is the punctuation
 * between them and the two sentences for the things the week cannot answer.
 *
 * THE SEPARATORS ARE ENTRIES for the reason `joinSignedCopy` exists: a call
 * site choosing `': '` is a call site authoring athlete-visible text. Batch 30's
 * opener still spells its single space inline (`${lead} ${weekday}`) and that
 * inconsistency is NAMED rather than fixed here — slice 1 is Sam-approved as
 * shipped and re-cutting it to route one space through a constant is a change
 * to signed-off code for no athlete-visible difference.
 *
 * PROPOSED, not ruled: Sam has not read these. They go to him with the slice.
 */
export const COACH_ANSWER_COPY = {
  /** Between the day's name and what is on it — "Friday: Upper Push". */
  dayLabelJoin: ': ',
  /** Between two things on the same day. */
  itemJoin: ', ',
  /** Between two words of one clause — "Game" + "Saturday". */
  wordJoin: ' ',
  /**
   * THE WEEK HOLDS NO FIXTURE. Said as what the coach can SEE rather than as a
   * fact about the athlete's season — the projection is one week, and "you have
   * no game" would be a claim about a horizon the coach was not given.
   */
  noGameInWeek: "No game in the week I can see.",
  /**
   * THE DAY IS REAL AND THE COACH CANNOT SEE IT. Distinct from the no-answer
   * reply on purpose: the athlete asked a perfectly good question and the
   * limit is the coach's, not theirs.
   */
  dayNotInWeek: 'I can only see this week.',
} as const;

/**
 * BATCH 31, SLICE 3's HALF — WHAT THE COACH SAYS WHEN IT CHANGES SOMETHING.
 * PROPOSED 2026-08-10, ONE SIGNING SITTING WITH THE FIVE ABOVE.
 *
 * The seat's order: *"Batch 31 stays PROPOSED; new S3 strings join it — ONE
 * signing sitting when S3's surface settles, not a drip."* So these are batch
 * 31, not a batch 32.
 *
 * ## WHY THERE ARE THIS FEW, AND WHERE THE REST OF THE CARD'S WORDS COME FROM
 *
 * The change card names two days and says what is on each of them. **Not one of
 * those words is here** — they come out of `describeVisibleDay`, which is the
 * projection's own naming, the same call the answer and the week row make. What
 * is left is the card's frame (two field labels, two button labels), the coach's
 * two asks, and the sentences for a change it cannot make or did not make.
 *
 * ## THE ONE THAT NEEDED A RULING AND GOT A REFUSAL INSTEAD
 *
 * `cannotMoveLead` says *"I can't move"* and NOT why. The why for a fixture is
 * *"a game is fixed in your week"*, which is COACHING POLICY, and L-C1 forbids
 * the coach stating policy no recorded rule authorised. Where a rule DOES
 * answer, the coach speaks it verbatim: `DayCapabilities.refusal` is already a
 * signed sentence and `coachProposal` prefers it over anything in this module.
 * This lead is the honest floor for the days that carry no recorded refusal.
 */
export const COACH_CHANGE_COPY = {
  /** The card's own name for what it is about to do. */
  moveTitle: 'Move a session',
  fromLabel: 'From',
  toLabel: 'To',
  whyLabel: 'Why',
  /**
   * THE WHY, AND IT IS THE TRUE ONE. An athlete-requested move has no coaching
   * reason behind it — the reason is that they asked. Anything more would be
   * the coach inventing a rationale for the athlete's own decision.
   */
  whyYouAsked: 'You asked me to.',
  confirmLabel: 'Make the change',
  cancelLabel: 'Not now',
  /**
   * THE TWO ASKS — L-C1's *"it ASKS the athlete"*, as coach turns.
   *
   * BOTH TEACH THE WHOLE SHAPE, and that is not politeness — it is the slice's
   * limit said out loud. Slice 3 carries no conversation context: a reply of
   * *"friday"* to a bare *"which day?"* has no move verb in it, so the reader
   * would read it as a question about Friday and answer with Friday's work.
   * **An ask whose answer the asker cannot understand is a dead end**, and the
   * honest repair is not to guess from the previous turn — it is to ask for a
   * message that stands on its own. Follow-up context is the named gap; these
   * two sentences are what makes its absence survivable rather than hidden.
   */
  askWhichDay: 'Which day do you want to move? Say the whole thing — like "move Friday to Sunday".',
  askWhereTo: 'Where should it go? Say the whole thing — like "move Friday to Sunday".',
  /** The one chip. One kind is built, so one affordance has somewhere to send. */
  moveChipLabel: 'Move a session',
  /** Leads *"I can't move"* + a day name from the projection + a full stop. */
  cannotMoveLead: "I can't move",
  /** The destination is the day it is already on. */
  alreadyThere: "It's already on that day.",
  /** The athlete declined the card. Not an error, and not silence either. */
  changeCancelled: 'Left it as it was.',
  /**
   * THE DOOR REFUSED, AND THE COACH HAS NO WORDS OF ITS OWN FOR THAT.
   *
   * Used only when the door returns a refusal carrying no message. When it
   * carries one, the coach speaks the DOOR's sentence verbatim — the door is
   * the owner of why it refused, and paraphrasing it here would be a second
   * account of one refusal.
   */
  changeRefused: "I couldn't make that change.",
  /**
   * THE DOOR RAN AND THE WEEK DID NOT MOVE. Distinct from a refusal: nothing
   * went wrong and nothing happened, and the athlete is owed the difference.
   */
  changeNoOp: 'That left your week the same.',
  /**
   * LEADS THE CONFIRMATION: *"I moved"* + the two day names + a full stop.
   *
   * FIRST PERSON ON PURPOSE, and it is the one wording decision in this batch
   * made by a gate rather than by taste. `FORBIDDEN_WHEN_NO_APPLIED` scans for
   * claims that require a verified visible change, and it scans for phrases —
   * *"I moved"* is one it can catch, *"Moved"* is not. A confirmation the truth
   * gate cannot read is a confirmation the truth gate cannot refuse, which
   * would make slice 2's keystone decorative for the one sentence slice 3 adds.
   */
  movedLead: 'I moved',
  movedJoin: ' to ',
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
   *
   * SAM APPROVED THIS AS SHIPPED (2026-08-09), which is why it is still here
   * after the greeting arrived: he was asked to choose between the coach saying
   * this and the tab shipping with a dead input, and he chose this.
   */
  noAnswerYet: "I don't have an answer for that yet.",
} as const;
