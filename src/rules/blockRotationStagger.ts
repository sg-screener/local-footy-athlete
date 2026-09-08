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
import type { BlockExerciseSelection } from './blockExerciseSelection';

/** Count calendar time for the delivered identity, including its other seats. */
export function consecutiveIdentityWeeks(history: readonly BlockExerciseSelection[],
  identity: string, beforeISO: string): number {
  const prior = history.filter(row => row.blockStartISO < beforeISO);
  const starts = [...new Set(prior.map(row => row.blockStartISO))].sort().reverse();
  let first = beforeISO;
  for (const start of starts) {
    if (!prior.some(row => row.blockStartISO === start && row.identity === identity)) break;
    first = start;
  }
  return (Date.parse(`${beforeISO}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / 604800000;
}

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
  /** Dated identity tenure; legacy pure callers may still supply block counts. */
  readonly weeksHeld?: number;
  /** The grade of the identity it currently holds, when the pool authors one. */
  readonly currentGrade: 'A' | 'B' | null;
  /** The grade it would move to, when the pool authors one. */
  readonly candidateGrade: 'A' | 'B' | null;
  /** Next suitable A-grade alternative from the same selection owner. */
  readonly aGradeAlternative?: string | null;
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
  readonly replacementIdentity?: string;
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
  const queue = seats.slice().sort((a, b) =>
    (b.weeksHeld ?? b.blocksHeld * 4) - (a.weeksHeld ?? a.blocksHeld * 4)
    || (order.get(a.slot) ?? 99) - (order.get(b.slot) ?? 99));
  const due = (seat: StaggerSeat) => seat.weeksHeld !== undefined
    ? seat.weeksHeld + 4 > 8 : seat.blocksHeld >= STAGGER_MAX_HELD_BLOCKS;
  type Option = { rotates: boolean; identity: string | null; grade: 'A' | 'B' | null; alternate: boolean };
  const options = (seat: StaggerSeat): Option[] => {
    const normal: Option = { rotates: seat.wouldRotateTo !== seat.previousIdentity,
      identity: seat.wouldRotateTo, grade: seat.candidateGrade, alternate: false };
    if (seat.forced) return [{ ...normal, rotates: true }];
    const result: Option[] = [{ rotates: false, identity: seat.previousIdentity,
      grade: seat.currentGrade, alternate: false }];
    if (seat.wouldRotateTo !== null && normal.rotates) result.push(normal);
    if (seat.aGradeAlternative && seat.aGradeAlternative !== seat.previousIdentity
      && seat.aGradeAlternative !== seat.wouldRotateTo) result.push({ rotates: true,
        identity: seat.aGradeAlternative, grade: 'A', alternate: true });
    return result;
  };
  const available = queue.map(options);
  const overdueCount = queue.filter((seat, i) => !seat.forced && due(seat)
    && available[i].some(option => option.rotates)).length;
  const target = Math.max(STAGGER_MIN_ROTATIONS,
    Math.min(queue.filter((seat, i) => !seat.forced && available[i].some(o => o.rotates)).length,
      Math.max(STAGGER_MAX_ROTATIONS, overdueCount)));
  let best: Option[] | null = null;
  let bestScore: number[] | null = null;
  const beats = (score: number[], prior: number[]) => {
    for (let i = 0; i < score.length; i++) if (score[i] !== prior[i]) return score[i] > prior[i];
    return false;
  };
  // Six seats give at most 3^6 plans. Judge the resulting week, never an
  // intermediate prefix where the next quality-preserving move has not landed.
  const visit = (plan: Option[]) => {
    if (plan.length < queue.length) {
      for (const option of available[plan.length]) visit([...plan, option]);
      return;
    }
    if (!staggerGuardrailsHold(plan.map(option => option.grade))) return;
    const moved = plan.filter((option, i) => option.rotates && !queue[i].forced).length;
    const overdueMoved = plan.filter((option, i) => option.rotates && !queue[i].forced && due(queue[i])).length;
    const score = [overdueMoved, -Math.abs(moved - target),
      ...plan.map((option, i) => !queue[i].forced && option.rotates ? 1 : 0),
      -plan.filter(option => option.alternate).length];
    if (!bestScore || beats(score, bestScore)) { best = [...plan]; bestScore = score; }
  };
  visit([]);
  const chosen = best as Option[] | null;
  const result = new Map<SessionSlot, StaggerDecision>();
  queue.forEach((seat, i) => {
    const option = chosen?.[i];
    const rotates = seat.forced || option?.rotates === true;
    const movable = available[i].some(candidate => candidate.rotates);
    const blockedByGrade = chosen && available[i].filter(candidate => candidate.rotates)
      .every(candidate => !staggerGuardrailsHold(chosen.map((current, index) =>
        index === i ? candidate.grade : current.grade)));
    const reason: StaggerReason = seat.forced ? 'forced_move'
      : !movable ? 'no_alternative'
      : rotates ? due(seat) ? 'held_two_blocks' : 'quota_rotation'
      : chosen && !blockedByGrade ? 'quota_full' : 'guardrail_hold';
    result.set(seat.slot, { slot: seat.slot, rotates, reason,
      ...(rotates && option?.alternate && option.identity ? { replacementIdentity: option.identity } : {}) });
  });
  return seats.map(seat => result.get(seat.slot)!);
}
