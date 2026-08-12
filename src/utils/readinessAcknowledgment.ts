/**
 * readinessAcknowledgment — athlete-facing acknowledgment for a TAP DOOR result.
 *
 * Ownership boundary (docs/READINESS_SOURCE_FACT_REASSESSMENT_2026-07-22.md, part a):
 * acknowledgment is owned by the reporting surface UNCONDITIONALLY — separate from
 * "did the program rebuild". The old handler gated feedback on `requiresRebuild`
 * (`useHomeScreen.ts` early-return), so a `requiresRebuild:false` contextual signal
 * — exactly the tired/sore/poor-sleep case — closed the sheet in silence. This
 * function always returns an acknowledgment for a readiness action result, whether
 * it succeeded or not, so the athlete always sees that they were heard.
 *
 * IT OWNS SCHEDULE-DOOR ACK COPY TOO, from 2026-07-31. Sam's ruling 2 split the
 * busy/away sheet into two week-screen buttons, and both landed with the same
 * defect this module exists to prevent: the tap discarded its result, so a
 * refused commit read as a success and the away sheet closed over it. Adding a
 * second module would have meant two owners for "what the athlete is told when a
 * tap does not land", which is how the two sentences drift apart.
 *
 * NEITHER FUNCTION EVER FORWARDS AN ENGINE SENTENCE. The refusal these results
 * carry today is written in the store layer — "The report was not applied
 * because the visible program could not be verified."
 * (`store/temporarySourceFactTransaction.ts`) — which is a sentence about a
 * verifier, not about the athlete's week. The ack layer answers in the
 * athlete's own terms and the engine text stops here.
 */

export interface ReadinessAcknowledgment {
  tone: 'success' | 'error';
  message: string;
}

interface ReadinessResultLike {
  ok?: boolean;
  changedProgram?: boolean;
  message?: string;
  /** WHY an inert commit changed nothing, typed by the transaction
   *  (`TemporarySourceFactInertReason`) — the committed result's own word. */
  inertReason?: string;
  /** The fixture's own kind, from the one owner that also picks the card
   *  label (`FixtureAvailabilityKind`) — selects the §10 sentence variant. */
  inertFixtureVariant?: string;
}

/**
 * Build an acknowledgment from a readiness ProgramControlActionResult. Never
 * null for a readiness result — silence is the defect this replaces.
 */
export function buildReadinessAcknowledgment(
  result: ReadinessResultLike | null | undefined,
): ReadinessAcknowledgment | null {
  if (!result) return null;
  if (result.ok) {
    // When the report actually changed the program (e.g. a severe illness authors
    // the illness_recovery week), surface the authored disclosure so the athlete
    // reads exactly what changed ("nothing's required this week…"). A record-only
    // report (no program change) keeps the generic "logged how you're feeling".
    const disclosure = result.message?.trim();
    if (result.changedProgram && disclosure) {
      return { tone: 'success', message: disclosure };
    }
    return {
      tone: 'success',
      message: "Got it — logged how you're feeling. Your week's adjusted to match.",
    };
  }
  return {
    tone: 'error',
    message: "Couldn't log that just now — give it another go in a moment.",
  };
}

/** Which schedule door is speaking. Both write the same fact kind; they promise
 *  the athlete different things, so they acknowledge differently. */
export type ScheduleDoor = 'short_on_time' | 'away' | 'away_equipment';

/**
 * Build an acknowledgment from a schedule-door result. Never null — a tap that
 * says nothing is the defect.
 *
 * THE SUCCESS SENTENCES CLAIM ONLY WHAT IS TRUE, AND NOW CARRY THEIR EFFECT
 * CLAUSE (declared reds 1-2 paid 2026-08-03; the re-signing the copy sheet's
 * §6-V caveat required — PROPOSED as copy sheet Batch 9). The clause is
 * selected by the COMMITTED result, never by the door alone: a short-on-time
 * commit that compressed today says so; one that changed nothing (rest day,
 * already short) keeps the plain logged sentence, because a signed sentence
 * must never claim a state-dependent outcome. **Away STOPPED being record-only on
 * 2026-08-13** — Sam ruled its effect (*"yes clear team training and games while
 * away"*), the fact derives, and both away sentences now name a change the app
 * actually made. A commit the
 * transaction marked inert FOR THE FIXTURE DAY (`inertReason: 'fixture_day'`,
 * Sam's §7 answer 2026-08-03) gets the signed game-day sentence — the third
 * clause, still selected by the committed result.
 */
export function buildScheduleAcknowledgment(
  result: ReadinessResultLike | null | undefined,
  door: ScheduleDoor,
): ReadinessAcknowledgment {
  if (result?.ok) {
    if (door === 'away') {
      // ── THE SENTENCE SAYS EXACTLY WHAT IS TRUE, AND NO MORE ──
      // "Your program stays as planned for now" was honest while away was
      // record-only and meant nothing. Sam then ruled the effect — *"yes clear
      // team training and games while away"* — so that sentence became a lie.
      // **AND ITS FIRST REPLACEMENT WAS A LIE THE OTHER WAY**: it said the club
      // was off, and on a week the athlete is ALREADY LOOKING AT it is not —
      // the ruling is carried out when a week is BUILT, and re-authoring one
      // already on screen is still owed (SEAT_INBOX item 30). So the tense is
      // future and the promise is exact. PROPOSED, copy sheet batch 34.
      return {
        tone: 'success',
        message: "Got it — logged that you're away. Team training and games come off as your plan updates.",
      };
    }
    // ── ITEM 28: THE AWAY DOOR THAT DOES CHANGE SOMETHING ──
    // PROPOSED (copy sheet batch 34, 2026-08-13). The sentence above is the
    // record-only away answer and it is still correct for the athlete who has
    // their normal kit. **It is a LIE for the athlete who just marked gear
    // missing** — that commit substitutes exercises for a dated span, which is
    // the opposite of "stays as planned". One door word, two honest sentences,
    // rather than one sentence that is true half the time.
    if (door === 'away_equipment') {
      return {
        tone: 'success',
        message: "Got it — your sessions will work around the gear you're without until you're back.",
      };
    }
    if (result.inertReason === 'fixture_day') {
      // Sam's §7 answer, both sentences SIGNED verbatim (2026-08-03, copy
      // sheet 9-d and 9-e): a fixture-day tap records the fact inert — a
      // fixture has no trainable session to compress — and the athlete gets
      // the truth in the fixture's OWN words. Selected by the COMMITTED
      // result's typed `inertReason` plus the fixture's kind, never by the
      // door or the date alone, per this module's contract.
      //
      // §10 (Sam, 2026-08-03): the variant is the SAME
      // `FixtureAvailabilityKind` that picks the day's card label (6-IV-4),
      // so the card and the sentence cannot disagree about what the day is.
      return {
        tone: 'success',
        message: result.inertFixtureVariant === 'practice_match'
          ? "It's a practice match — nothing to shorten. Go play."
          : "It's game day — there's nothing to shorten. Go play.",
      };
    }
    return {
      tone: 'success',
      message: result.changedProgram
        ? "Got it — logged that you're short on time today. Today's session is "
          + 'compressed to fit — main lift kept, inside 35 minutes.'
        : "Got it — logged that you're short on time today.",
    };
  }
  return {
    tone: 'error',
    message: "That didn't save — your week is unchanged. Give it another go in a moment.",
  };
}

/**
 * The block-rollover refusal, in the athlete's words (Sam's interim ruling,
 * 2026-07-31, built 2026-08-01 — "the existing rollover must SUCCEED, or
 * REFUSE HONESTLY with a sentence"; the silent stop IS the defect).
 *
 * Null for a rollover that succeeded or was not needed — nothing to say.
 * Never null for a refusal: silence here is the exact defect this pays. The
 * sentence claims only what is true — the current weeks stand untouched
 * (the rebuild candidate is validated whole and was never committed) and a
 * retry is offered, not promised. It never forwards an engine code; the
 * typed `refusal.code` stays on the tape where it belongs.
 */
export function buildRolloverAcknowledgment(
  result: { rolledOver?: boolean; refusal?: { code: string } } | null | undefined,
): ReadinessAcknowledgment | null {
  if (!result?.refusal) return null;
  return {
    tone: 'error',
    message: "Your next training block couldn't be built — your current weeks are "
      + 'unchanged. Try again in a moment.',
  };
}
