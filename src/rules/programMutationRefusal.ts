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
  /**
   * The athlete asked for a change their plan already carries. Same family as
   * `no_change` — nothing applied, retrying changes nothing — but a different
   * subject, so it gets its own sentence rather than borrowing the settings one.
   * Added for Sam's ruling #6 (2026-07-30): the accepted-state transactions
   * short-circuit a repeat mutation as `already_applied`, and that used to reach
   * the athlete as "Done." over a day nothing had happened to.
   */
  | 'already_applied'
  /** Something else changed the accepted program first. Re-open and re-apply. */
  | 'accepted_revision_changed'
  /** The command's fixture identity disagreed with the owned season phase. */
  | 'season_phase_mismatch'
  /** An In-season shift reached the commit without a game-anchor answer. */
  | 'game_anchor_unanswered'
  /**
   * THE NEW SETUP CANNOT MAKE A LEGAL WEEK AT ALL.
   *
   * The weekly scheduler refused with a typed finding — too few legal gym days
   * for the athlete's fixtures and club nights, no authored layout for that
   * phase-and-availability pair, or no arrangement that satisfies the spacing
   * rules. The transaction rolled the whole change back, so the athlete still
   * has the program they had; what they needed was to be TOLD WHY.
   *
   * **Added 2026-08-20 because it reached the athlete as `unknown`.** Measured
   * through the real Profile setup door: an In-season athlete with two club
   * nights and a Saturday game cut their gym days to one, the scheduler refused
   * with `not_enough_legal_gym_days` (WC-142), and the app said *"Something went
   * wrong. Please try again."* — the exact sentence this module's own header
   * names as the disease it exists to cure. It fell through because the
   * transaction stringified the error's MESSAGE instead of carrying its CODE.
   */
  | 'week_cannot_be_built'
  /** Committed, could not be verified, and was rolled back whole. */
  | 'verification_rolled_back'
  | 'exercise_choice_not_preserved'
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
  already_applied: false,
  accepted_revision_changed: true,
  season_phase_mismatch: false,
  game_anchor_unanswered: false,
  // FALSE for the same reason `season_phase_mismatch` is: pressing Save on the
  // same selection reproduces the same refusal exactly. Offering "Try again" on
  // an unchanged setup is the app lying about what it already knows. The copy
  // therefore asks them to CHANGE something first.
  week_cannot_be_built: false,
  verification_rolled_back: true,
  exercise_choice_not_preserved: false,
  invalid_change: false,
  generation_failed: true,
  unknown: true,
};

const COPY: Record<ProgramMutationRefusalKind, string> = {
  no_change: 'Nothing to update — those settings are already what your program is built on.',
  already_applied: 'Your plan already has that, so nothing changed.',
  accepted_revision_changed:
    'Your program changed while this was open, so nothing was applied. Close this and try the change again.',
  season_phase_mismatch:
    'This change is for a different season phase than your program is currently built on. Update your phase first, then make this change.',
  game_anchor_unanswered:
    'Tell us your usual game day first — or say you do not have one — and we will build the week around that answer.',
  week_cannot_be_built:
    'Those training days cannot make a full week alongside your club nights and your game, so nothing changed. Pick different days, or change your club nights or game day, and save again.',
  exercise_choice_not_preserved:
    'We could not keep an exercise you chose, so your settings and program have been left unchanged.',
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

  athlete_mutation_already_applied: 'already_applied',

  accepted_revision_changed: 'accepted_revision_changed',
  accepted_revision_conflict: 'accepted_revision_changed',

  fixture_kind_phase_mismatch: 'season_phase_mismatch',
  season_phase_mismatch: 'season_phase_mismatch',

  game_anchor_unanswered: 'game_anchor_unanswered',

  // THE SCHEDULER'S OWN TYPED REFUSAL, carried by its `code` rather than parsed
  // out of its message. `WeeklyScheduleRefusedError` has three findings
  // (`not_enough_legal_gym_days`, `no_layout_for_phase_and_availability`,
  // `no_legal_arrangement_within_spacing_rules`) and one athlete-facing answer:
  // this combination of days cannot make a week. **The FINDING stays in the
  // developer diagnostic** — athlete-facing copy never carries an internal
  // identifier, and the athlete cannot act on a clause id.
  weekly_schedule_refused: 'week_cannot_be_built',

  accepted_exercise_choice_not_preserved: 'exercise_choice_not_preserved',
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
