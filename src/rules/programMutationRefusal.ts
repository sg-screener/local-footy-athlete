/**
 * The one owner of "a program mutation did not apply — what do we tell the
 * athlete, and can they retry?".
 *
 * `classifyProgramGenerationFailure` already owns the same question for a
 * failed GENERATION. This is its sibling for a failed or refused MUTATION,
 * and the split is real: a generation throw is about building a program, a
 * mutation refusal is about a transaction declining to publish one.
 *
 * The defect this closes: every mutation refusal reached the athlete as
 * "Something went wrong. Please try again." The transaction had already
 * produced a precise typed reason — `accepted_revision_changed`,
 * `fixture_kind_phase_mismatch`, a durable read-back mismatch — and the
 * surface threw it into `new Error(...)` and classified the result as
 * unknown. Two consequences:
 *
 *   - the athlete was told to retry things retrying cannot fix, and
 *   - `no_change` was reported as plain success, so a shift that did nothing
 *     looked exactly like one that worked.
 *
 * `canRetry` is derived from the KIND here, in one table. It is never a
 * default that a caller forgets to override.
 */

export type ProgramMutationRefusalKind =
  /** Nothing needed doing. An OUTCOME, not a failure. */
  | 'no_change'
  /** Something else changed the accepted program first. Re-open and re-apply. */
  | 'accepted_revision_changed'
  /** The command's fixture identity disagreed with the owned season phase. */
  | 'season_phase_mismatch'
  /** An In-season shift reached the commit without a game-anchor answer. */
  | 'game_anchor_unanswered'
  /** Committed, could not be verified, and was rolled back whole. */
  | 'verification_rolled_back'
  /** The change itself is not something we can apply. Retrying is pointless. */
  | 'invalid_change'
  /** Generation failed inside the transaction; that owner supplies the copy. */
  | 'generation_failed'
  | 'unknown';

export interface ProgramMutationRefusal {
  kind: ProgramMutationRefusalKind;
  /** Athlete-facing copy. Never a reason code, never a raw payload. */
  userMessage: string;
  canRetry: boolean;
  /** Developer detail. Log-side only; never rendered. */
  diagnostic: string | null;
}

/**
 * Whether a kind can be retried into a different answer.
 *
 * A phase mismatch is FALSE on purpose: the command and the owned phase
 * disagree, and pressing the same button again reproduces the disagreement
 * exactly. Offering "Try again" there is the app lying about what it knows.
 */
const CAN_RETRY: Record<ProgramMutationRefusalKind, boolean> = {
  no_change: false,
  accepted_revision_changed: true,
  season_phase_mismatch: false,
  game_anchor_unanswered: false,
  verification_rolled_back: true,
  invalid_change: false,
  generation_failed: true,
  unknown: true,
};

const COPY: Record<ProgramMutationRefusalKind, string> = {
  no_change: 'Nothing to update — those settings are already what your program is built on.',
  accepted_revision_changed:
    'Your program changed while this was open, so nothing was applied. Close this and try the change again.',
  season_phase_mismatch:
    'This change is for a different season phase than your program is currently built on. Update your phase first, then make this change.',
  game_anchor_unanswered:
    'Tell us your usual game day first — or say you do not have one — and we will build the week around that answer.',
  verification_rolled_back:
    'We could not confirm the rebuilt program, so nothing changed and your previous plan is intact. You can try again.',
  invalid_change: 'That change cannot be applied to your program as it stands, so nothing changed.',
  generation_failed: 'Something went wrong building your program. Please try again.',
  unknown: 'Something went wrong. Please try again.',
};

/**
 * Typed reasons the transaction layer emits, mapped to the kind that owns
 * them. Anything absent here lands in `unknown` — and the gate in
 * `phaseShiftAtomicityTests` fails if a shipped reason falls through, so the
 * table cannot silently drift behind the transaction.
 */
const REASON_KINDS: Record<string, ProgramMutationRefusalKind> = {
  no_change: 'no_change',

  accepted_revision_changed: 'accepted_revision_changed',
  accepted_revision_conflict: 'accepted_revision_changed',

  fixture_kind_phase_mismatch: 'season_phase_mismatch',
  season_phase_mismatch: 'season_phase_mismatch',

  game_anchor_unanswered: 'game_anchor_unanswered',

  accepted_profile_candidate_mismatch: 'verification_rolled_back',
  accepted_composition_base_candidate_mismatch: 'verification_rolled_back',
  accepted_profile_durable_readback_mismatch: 'verification_rolled_back',
  profile_program_durable_readback_mismatch: 'verification_rolled_back',
  profile_program_changed_temporary_facts: 'verification_rolled_back',
  profile_program_candidate_test_rejection: 'verification_rolled_back',
  profile_program_readback_test_rejection: 'verification_rolled_back',

  temporary_profile_constraints_require_source_facts: 'invalid_change',
  permanent_session_time_cap_invalid: 'invalid_change',
  profile_setup_transaction_failed: 'invalid_change',
};

function isProgramGenError(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && (error as { name?: unknown }).name === 'ProgramGenError';
}

interface CarriedRefusal {
  kind?: unknown;
  userMessage?: unknown;
  canRetry?: unknown;
  message?: unknown;
}

/**
 * Translate a refused mutation into the athlete's account of it.
 *
 * Accepts either the transaction's typed `reason` string or the thrown error,
 * because both shapes reach the surfaces — `commitProfileProgramTransaction`
 * returns a reason, `applyPhaseShift` throws one.
 */
export function classifyProgramMutationRefusal(input: {
  reason?: string | null;
  error?: unknown;
}): ProgramMutationRefusal {
  const { error, reason } = input;

  // A refusal that already carries its own typed copy is passed through
  // rather than re-decided. There is one author per refusal.
  const carried = error as CarriedRefusal | undefined;
  if (carried && typeof carried.kind === 'string' && carried.kind in CAN_RETRY) {
    const kind = carried.kind as ProgramMutationRefusalKind;
    return {
      kind,
      userMessage: typeof carried.userMessage === 'string' && carried.userMessage
        ? carried.userMessage
        : COPY[kind],
      canRetry: CAN_RETRY[kind],
      diagnostic: typeof carried.message === 'string' ? carried.message : null,
    };
  }

  if (isProgramGenError(error)) {
    const generation = error as { userMessage?: string; canRetry?: boolean; diagnostic?: string };
    return {
      kind: 'generation_failed',
      userMessage: generation.userMessage || COPY.generation_failed,
      // Generation owns its own retryability; this layer does not re-decide it.
      canRetry: generation.canRetry !== false,
      diagnostic: generation.diagnostic ?? null,
    };
  }

  const code = (reason ?? (error instanceof Error ? error.message : null))?.trim() || null;
  const kind = (code && REASON_KINDS[code]) || 'unknown';
  return {
    kind,
    userMessage: COPY[kind],
    canRetry: CAN_RETRY[kind],
    diagnostic: code,
  };
}
