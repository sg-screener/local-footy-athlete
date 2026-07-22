/**
 * readinessAcknowledgment — athlete-facing acknowledgment for a readiness report.
 *
 * Ownership boundary (docs/READINESS_SOURCE_FACT_REASSESSMENT_2026-07-22.md, part a):
 * acknowledgment is owned by the reporting surface UNCONDITIONALLY — separate from
 * "did the program rebuild". The old handler gated feedback on `requiresRebuild`
 * (`useHomeScreen.ts` early-return), so a `requiresRebuild:false` contextual signal
 * — exactly the tired/sore/poor-sleep case — closed the sheet in silence. This
 * function always returns an acknowledgment for a readiness action result, whether
 * it succeeded or not, so the athlete always sees that they were heard.
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
