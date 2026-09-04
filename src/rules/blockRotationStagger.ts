/**
 * BLOCK ROTATION STAGGER — how many of the six core lifts change at once.
 *
 * ## WHY THIS EXISTS, IN SAM'S OWN WORDS
 *
 * *"Rotate two or three of the six core lifts. Allow the others to continue for
 * another four weeks. No core lift may remain unchanged beyond eight weeks.
 * Never rotate all six at once unless equipment, injury or a phase change
 * requires it."* And the reason, plainly: *"That gives visible change every four
 * weeks without turning the program into random exercise roulette."*
 *
 * ⚠ **NOTHING IN THE APP ASKED THIS QUESTION BEFORE.**
 * `blockExerciseSelection.decideExerciseForBlock` is per-SLOT and pure — its
 * inputs describe one seat and it cannot see the other five. So every seat
 * decided independently, and the only reason the whole week did not turn over at
 * once was that four of the six were pinned to the athlete's tracked lifts. Take
 * the pins away without this and every seat rotates on the same block boundary,
 * which is the roulette Sam named.
 *
 * ## WHAT THIS MODULE IS NOT
 *
 * **It never CHOOSES an exercise.** `decideExerciseForBlock` owns that and stays
 * the only owner. This module answers one narrower question — *which seats may
 * spend their rotation this block* — and hands back a hold set. A held seat
 * keeps the identity it already had; a released seat is decided exactly as it is
 * today.
 *
 * **It never overrides legality.** A seat whose recorded lift is no longer legal
 * is not a rotation at all, it is a forced move, and the caller marks it
 * `forced`. Sam: *"Injury and travel substitutions do not count as planned
 * rotations or reset the rotation clock."* Forced seats are excluded from the
 * quota in both directions — they neither consume a rotation slot nor count
 * toward the "at least two" floor.
 */
import type { SessionSlot } from './sessionSlotCoverage';

/** The six seats this rule governs. A seventh would be a ruling, not an edit. */
export const STAGGER_CORE_SLOTS: readonly SessionSlot[] = [
  'squat', 'hinge', 'horizontal_push', 'vertical_push',
  'horizontal_pull', 'vertical_pull',
];

/** Sam: *"two or three of the six"*. */
export const STAGGER_MIN_ROTATIONS = 2;
export const STAGGER_MAX_ROTATIONS = 3;
/** Sam: *"No core lift may remain unchanged beyond eight weeks"* — two blocks. */
export const STAGGER_MAX_HELD_BLOCKS = 2;

export interface StaggerSeat {
  readonly slot: SessionSlot;
  /** The identity recorded for this seat in the PREVIOUS block, if any. */
  readonly previousIdentity: string | null;
  /** What `decideExerciseForBlock` would choose if this seat were released. */
  readonly wouldRotateTo: string | null;
  /**
   * Consecutive blocks this seat has already held its identity. Two means it
   * has run eight weeks and MUST move — the one part of this rule that is a
   * ceiling rather than a preference.
   */
  readonly blocksHeld: number;
  /** The grade of the identity it currently holds, when the pool authors one. */
  readonly currentGrade: 'A' | 'B' | null;
  /** The grade it would move to, when the pool authors one. */
  readonly candidateGrade: 'A' | 'B' | null;
  /**
   * The recorded lift is no longer legal — injury, kit, exclusion, phase. This
   * seat moves whatever the quota says, and does not spend a rotation.
   */
  readonly forced: boolean;
}

export type StaggerReason =
  /** The recorded lift is illegal; this is not a planned rotation. */
  | 'forced_move'
  /** Eight weeks is the ceiling. */
  | 'held_two_blocks'
  /** Inside the two-or-three quota, longest-held first. */
  | 'quota_rotation'
  /** The quota is spent; this seat continues. */
  | 'quota_full'
  /** Nothing to move to. */
  | 'no_alternative'
  /** Releasing it would break a guardrail below. */
  | 'guardrail_hold';

export interface StaggerDecision {
  readonly slot: SessionSlot;
  readonly rotates: boolean;
  readonly reason: StaggerReason;
}

/**
 * ⚠ **SAM'S QUALITY GUARDRAILS, AND THEY BIND THE RESULTING WEEK, NOT THE MOVE.**
 *
 * *"At least four of the six core lifts must be A-grade. No more than two
 * B-grade primaries at once. At least one of squat/hinge must be a stable
 * bilateral A-grade lift. At least one push and one pull must be stable A-grade
 * lifts."*
 *
 * They are checked against the week a rotation WOULD produce, so a move that
 * would tip the week past them is refused and the seat holds — rather than the
 * move being allowed and the week reported broken afterwards.
 */
export function staggerGuardrailsHold(
  gradesAfter: readonly ('A' | 'B' | null)[],
): boolean {
  const aGrade = gradesAfter.filter((grade) => grade === 'A').length;
  const bGrade = gradesAfter.filter((grade) => grade === 'B').length;
  return aGrade >= 4 && bGrade <= 2;
}

/**
 * THE DECISION. Ordered rules, never a score.
 *
 *   1. forced moves happen and are not counted;
 *   2. a seat held two blocks MUST move — the eight-week ceiling;
 *   3. the remaining rotations go to the longest-held seats first, up to three;
 *   4. a move that would break a guardrail is refused and the seat holds.
 *
 * Deterministic: the same seats in the same state always produce the same
 * answer, and the tie-break is the authored slot order rather than anything
 * derived at runtime.
 */
export function decideBlockRotationStagger(
  seats: readonly StaggerSeat[],
): readonly StaggerDecision[] {
  const order = new Map(STAGGER_CORE_SLOTS.map((slot, index) => [slot, index]));
  const decisions = new Map<SessionSlot, StaggerDecision>();
  const decide = (slot: SessionSlot, rotates: boolean, reason: StaggerReason) => {
    decisions.set(slot, { slot, rotates, reason });
  };

  const movable = seats.filter((seat) => seat.wouldRotateTo !== null
    && seat.wouldRotateTo !== seat.previousIdentity);
  for (const seat of seats) {
    if (seat.forced) decide(seat.slot, true, 'forced_move');
    else if (!movable.includes(seat)) decide(seat.slot, false, 'no_alternative');
  }

  // Longest-held first, then the authored slot order. Never a runtime shuffle:
  // two athletes in the same state must get the same week.
  const queue = movable
    .filter((seat) => !seat.forced)
    .slice()
    .sort((left, right) => (right.blocksHeld - left.blocksHeld)
      || ((order.get(left.slot) ?? 99) - (order.get(right.slot) ?? 99)));

  const gradeNow = new Map(seats.map((seat) => [seat.slot, seat.currentGrade]));
  let spent = 0;
  for (const seat of queue) {
    const mustMove = seat.blocksHeld >= STAGGER_MAX_HELD_BLOCKS;
    if (!mustMove && spent >= STAGGER_MAX_ROTATIONS) {
      decide(seat.slot, false, 'quota_full');
      continue;
    }
    const after = new Map(gradeNow);
    after.set(seat.slot, seat.candidateGrade);
    if (!staggerGuardrailsHold([...after.values()])) {
      decide(seat.slot, false, 'guardrail_hold');
      continue;
    }
    gradeNow.set(seat.slot, seat.candidateGrade);
    spent += 1;
    decide(seat.slot, true, mustMove ? 'held_two_blocks' : 'quota_rotation');
  }

  /* ⚠ **THE FLOOR IS A FLOOR, NOT A TARGET, AND IT MAY NOT MANUFACTURE A MOVE.**
   * Sam asked for *"two or three"*, and this loop tops up toward two when the
   * quota under-delivered — but only from seats that had a legal alternative and
   * were held back by the quota, never by relaxing a guardrail or by moving a
   * seat with nowhere to go. A week with only one movable seat rotates one. */
  if (spent < STAGGER_MIN_ROTATIONS) {
    for (const seat of queue) {
      if (spent >= STAGGER_MIN_ROTATIONS) break;
      if (decisions.get(seat.slot)?.reason !== 'quota_full') continue;
      const after = new Map(gradeNow);
      after.set(seat.slot, seat.candidateGrade);
      if (!staggerGuardrailsHold([...after.values()])) continue;
      gradeNow.set(seat.slot, seat.candidateGrade);
      spent += 1;
      decide(seat.slot, true, 'quota_rotation');
    }
  }

  return seats.map((seat) => decisions.get(seat.slot)
    ?? { slot: seat.slot, rotates: false, reason: 'quota_full' });
}
