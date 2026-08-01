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
export type ScheduleDoor = 'short_on_time' | 'away';

/**
 * Build an acknowledgment from a schedule-door result. Never null — a tap that
 * says nothing is the defect.
 *
 * THE SUCCESS SENTENCES CLAIM ONLY WHAT IS TRUE TODAY. Both doors currently
 * record a fact and change nothing an athlete can see (declared red 2,
 * `programControlDurableOwnershipTests`), so neither sentence promises a lighter
 * session or a cleared day. When that red is paid the sentences gain the effect
 * clause and Sam signs them again — that re-check is recorded in the copy sheet
 * beside them, so the wording cannot quietly outlive the behaviour.
 */
export function buildScheduleAcknowledgment(
  result: ReadinessResultLike | null | undefined,
  door: ScheduleDoor,
): ReadinessAcknowledgment {
  if (result?.ok) {
    return {
      tone: 'success',
      message: door === 'away'
        ? "Got it — logged the days you're away."
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
