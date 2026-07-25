/**
 * The single owner of "generation failed — what do we tell the athlete, and do
 * we try again?".
 *
 * Sam's ruling (2026-07-25): onboarding NEVER silently substitutes
 * DEFAULT_PROGRAM. Before this owner existed, CompleteScreen caught every
 * generation failure, installed DEFAULT_PROGRAM (which carries no
 * `exposureContractV2`), and the install throw that followed was reported to
 * the athlete as *"Your program was created, but it could not be saved"* — the
 * wrong reason for the wrong event, and a hard stop at the front door of
 * onboarding. See docs/ONBOARDING_SAVE_BLOCKER_DIAGNOSIS_2026-07-25.md.
 *
 * Ownership: generation owns the outcome AND its reason. This module only
 * translates a typed `ProgramGenError` into athlete-facing copy plus a
 * retryability flag, and applies the one approved retry policy. It never
 * chooses a different program — there is no second generation authority.
 *
 * Retry policy: exactly one cheap automatic retry, and only for failures that
 * waiting can genuinely fix (network / server outage / provider overload). A
 * contract violation or a config error is surfaced immediately — retrying it
 * would just spend the athlete's time to reach the same answer.
 */
import { ProgramGenError, type ProgramGenErrorKind } from '../services/api/generateProgram';
import type { TrainingProgram } from '../types/domain';

/**
 * The failures a second attempt can plausibly fix, because nothing about the
 * request was wrong — the far side was briefly unavailable.
 *
 * `bad_response` is deliberately EXCLUDED even though it is marked retryable:
 * it covers the cueless-card refusal and other contract violations, where an
 * immediate silent retry would hide a real generation-contract problem. Those
 * still offer the athlete a manual Try Again; the decision just belongs to
 * them, not to us.
 */
export const TRANSIENT_GENERATION_KINDS: ReadonlySet<ProgramGenErrorKind> = new Set<ProgramGenErrorKind>([
  'network',
  'server_outage',
  'overloaded',
]);

/** Copy for a throw that carried no typed reason. Never echoes the raw message. */
export const UNTYPED_GENERATION_FAILURE_COPY =
  'Something went wrong building your program. Please try again.';

export interface ClassifiedGenerationFailure {
  /** Athlete-facing copy. Always safe — raw payloads never reach here. */
  userMessage: string;
  canRetry: boolean;
  failureKind: ProgramGenErrorKind;
  isTransient: boolean;
  /** Developer detail. Log-side only; never rendered. */
  diagnostic: string | null;
}

function isProgramGenError(error: unknown): error is ProgramGenError {
  return error instanceof ProgramGenError
    || (typeof error === 'object' && error !== null
      && (error as { name?: unknown }).name === 'ProgramGenError');
}

/**
 * Translate a generation throw into the athlete's account of it. A typed
 * `ProgramGenError` already carries safe copy (`generateProgram.ts` redacts
 * payloads before throwing), so it is passed through unchanged; anything else
 * gets generic copy and stays retryable, because an unknown failure is almost
 * always transient on our side.
 */
export function classifyProgramGenerationFailure(
  error: unknown,
): ClassifiedGenerationFailure {
  if (isProgramGenError(error)) {
    const failureKind = error.kind ?? 'unknown';
    return {
      userMessage: error.userMessage || UNTYPED_GENERATION_FAILURE_COPY,
      canRetry: error.canRetry !== false,
      failureKind,
      isTransient: TRANSIENT_GENERATION_KINDS.has(failureKind),
      diagnostic: error.diagnostic ?? null,
    };
  }
  return {
    userMessage: UNTYPED_GENERATION_FAILURE_COPY,
    canRetry: true,
    failureKind: 'unknown',
    isTransient: false,
    diagnostic: error instanceof Error ? error.message : String(error),
  };
}

export type OnboardingGenerationOutcome =
  | { kind: 'generated'; program: TrainingProgram }
  | ({ kind: 'failed' } & ClassifiedGenerationFailure);

/**
 * Run generation with the approved retry policy and return a typed outcome.
 *
 * Callers render the outcome; they do not re-decide it. There is intentionally
 * no fallback program parameter — a failure is a failure, reported honestly.
 */
export async function runOnboardingProgramGeneration(args: {
  generate: () => Promise<TrainingProgram>;
  /** Called once per failed attempt, for diagnostics. */
  onAttemptFailed?: (failure: ClassifiedGenerationFailure, attempt: number) => void;
}): Promise<OnboardingGenerationOutcome> {
  const MAX_ATTEMPTS = 2; // the original attempt + one automatic retry
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return { kind: 'generated', program: await args.generate() };
    } catch (error) {
      const failure = classifyProgramGenerationFailure(error);
      args.onAttemptFailed?.(failure, attempt);
      const canTryAgain = attempt < MAX_ATTEMPTS && failure.isTransient && failure.canRetry;
      if (!canTryAgain) return { kind: 'failed', ...failure };
    }
  }
  /* istanbul ignore next — the loop always returns. */
  return { kind: 'failed', ...classifyProgramGenerationFailure(new Error('exhausted')) };
}
