/**
 * EXERCISE ROTATION — the one owner of whether a movement slot KEEPS its
 * exercise or ROTATES to the next legal one at a block boundary.
 *
 * Subject: `docs/BLOCK_TWO_PROGRESSION_CONTRACT_APPROVED_2026-08-16.md`,
 * "Exercise rotation" and "Athlete substitutions and exclusions".
 *
 * ## ⚠ WHY THIS MODULE EXISTS — THE ONLY ENFORCER WAS DELETED
 *
 * `composeWeek.ts:292` records it plainly: *"the rule whose only enforcer,
 * `applyPoolRotation`, was deleted in the B2 rebuild."* What replaced it was one
 * line — `preferred[step % preferred.length]` — where `step` is the PHASE WEEK
 * NUMBER. **Selection was keyed by the week, and the contract keys it by the
 * BLOCK.** Measured on a real `generateProgramLocally` full-gym world before
 * this module landed:
 *
 *   block 1 horizontal_push/anchor:  w1 Bench Press → w2 Incline Bench
 *                                    → w3 Close Grip Bench
 *   block 1 horizontal_pull/anchor:  w1 Barbell Row → w2 Chest Supported Row
 *                                    → w3 Single-Arm DB Row
 *
 * Three different main lifts inside ONE build block, against the contract's
 * *"Main and secondary lifts may remain for a second consecutive block"* — an
 * athlete cannot progress a lift they never meet twice.
 *
 * ⚠ **`exercisePoolsStrength.selectPoolEntry` / `selectPoolEntryAvoiding` DO
 * carry a block cadence, a pin bias and the legality filters — and they have
 * ZERO production callers.** Every reference outside their own file is a test or
 * a comment. They are the deleted authority's machinery, still standing, still
 * green in `test:pools`, and running on nothing. This module does not call them;
 * naming a second implementation the owner would be the second-owner defect this
 * repo names outright.
 *
 * ## WHAT IT DECIDES, AND WHAT IT REFUSES TO DECIDE
 *
 * It decides ONE thing: **given the ordered list of candidates that are already
 * legal, which one does this block get.** It does not filter. Kit legality,
 * active injuries and the athlete's typed exclusions are resolved by
 * `composeWeek` BEFORE this function is asked, and an empty candidate list is
 * the composer's typed gap — never this module's problem to paper over.
 *
 * That ordering is the contract's, not a convenience: *"Exclusion always beats
 * preference pinning"*, and *"If the legal pool has another same-pattern option,
 * use it. If not, carry the typed gap—never fall back to the raw illegal pool."*
 * Because this module only ever indexes INTO the legal list, **an excluded or
 * illegal exercise is unreachable here by construction** — including a pinned
 * one. There is no branch to get wrong.
 *
 * ## THE CADENCE — BLOCK FOR MAIN LIFTS, BLOCK+WEEK FOR ACCESSORIES
 *
 * The contract gives the two roles different freedoms:
 *
 *   *"Main and secondary exercises are stable throughout their block."*
 *   *"Accessories may rotate more freely, including between microcycles where
 *    the approved pool already allows it."*
 *
 * So a main lift's index moves once per BLOCK and an accessory's moves once per
 * WEEK — the same two cadences the deleted `selectPoolEntry` used, restored at
 * the seam that actually runs.
 *
 * **A DELOAD IS NOT A NEW BLOCK AND MUST NOT ADVANCE EITHER CADENCE.** *"A
 * deload uses the current block's exercises with reduced volume; it does not
 * rotate them."* A main lift gets this free — the deload is week 4 of the same
 * block, so its block index is unchanged. An accessory would rotate on a weekly
 * cadence, so a deload week is pinned to the LAST BUILD WEEK's index, which is
 * what "the current block's exercises" means for a slot whose exercise moved
 * during the block.
 *
 * ## RETENTION — THE EXISTING PROGRESSION DECISION ANSWERS, NOT A NEW RULE
 *
 * *"Main and secondary lifts may remain for a second consecutive block when the
 * existing progression/continuity decision supports it."* The mission is
 * explicit that this is the EXISTING decision, so nothing new is ruled here:
 * `blockBoundaryProgression.decideBlockBoundaryLoads` already classifies every
 * lift, and exactly one of its kinds means "this athlete trained it and it went
 * up" — `history_progressed`. That is the retention signal, read, not invented.
 *
 * Anything else rotates: `history_held` (trained, did not move), `unset`,
 * `authored_estimate` and `bodyweight_default` (never logged) all leave the
 * athlete no continuity to protect.
 *
 * ## THE TWO-BLOCK CAP, WITHOUT STORING ANYTHING
 *
 * *"The default maximum is two consecutive blocks for the same main or secondary
 * exercise."* NORTH_STAR: store only decisions, derive everything else. A
 * "consecutive blocks" counter would be new stored state that is not an input,
 * so it is presumed wrong — and this app **regenerates the program on every
 * boot**, so a counter would have to survive a rebuild that recreates the very
 * thing it counts.
 *
 * It does not need to be stored, because a retention is VISIBLE IN THE
 * ARITHMETIC. The base cadence is a pure function of the block number, so
 * "block b-1 was itself a retention" is exactly "what block b-1 actually got is
 * not what its base cadence would have given it". One comparison, no recursion
 * past one step, no state:
 *
 *     retainedLastBlock(b) ⟺ selected(b-1) ≠ baseIdentity(b-1)
 *
 * and a block that retained last time must rotate this time. A missing or
 * unreadable history answers "no retention" and the slot rotates, which is the
 * contract's default — *"Most exercises normally rotate at a new build block"* —
 * so an absent fact can never manufacture a third consecutive block.
 *
 * ## PINNING BIASES, IT DOES NOT OVERRIDE
 *
 * *"A pin biases the next legal rotation choice; it does not create a second
 * program owner; it never defeats exclusion, injury, equipment or scheduling
 * safety."* A pin moves its exercise to the FRONT of the already-legal ordered
 * list, so the block's index walk meets it first. It does not skip the two-block
 * cap: a pinned lift held for two consecutive blocks still steps aside for one
 * block. **No product copy anywhere promises otherwise** — the only "pinned"
 * wording on glass belongs to `ExerciseVideoModal`'s demo videos, which is a
 * different mechanism the mission excludes by name.
 */

import type { ComposedExerciseIdentity } from './composedRowLegality';

/** What the rotation owner did, and why — carried for the athlete-facing reason. */
export type RotationDecisionKind =
  /** No previous block to retain from: the block's cadence chose. */
  | 'first_block'
  /** Main/secondary lift kept for a second consecutive block. */
  | 'retained'
  /** The block's cadence advanced to the next legal candidate. */
  | 'rotated';

export type RotationReason =
  /** There is no block before this one. */
  | 'no_previous_block'
  /** The existing progression decision progressed this lift from its own history. */
  | 'progressed_from_own_history'
  /** Already held for two consecutive blocks — the default maximum. */
  | 'two_block_maximum_reached'
  /** The athlete's recorded history does not support keeping it. */
  | 'history_does_not_support_retention'
  /** Single-leg and accessory slots rotate at every new block, never retained. */
  | 'accessory_cadence'
  /** The previously selected exercise is no longer legal or no longer offered. */
  | 'previous_choice_not_legal_now'
  /** Only one legal candidate exists, so there is nothing to rotate to. */
  | 'single_legal_candidate';

export interface RotationDecision {
  readonly identity: ComposedExerciseIdentity;
  readonly kind: RotationDecisionKind;
  readonly reason: RotationReason;
  /** The identity the block's own cadence would have taken, retention aside. */
  readonly cadenceIdentity: ComposedExerciseIdentity;
  /** True when a pin moved this identity ahead of the authored order. */
  readonly pinBiased: boolean;
}

export interface RotationInputs {
  /**
   * Candidates for this slot, in authored order, ALREADY filtered for kit
   * legality, active injuries and the athlete's exclusions by `composeWeek`.
   * Must be non-empty — an empty slot is the composer's typed gap and is
   * resolved before this function is reached.
   */
  readonly legalCandidates: readonly ComposedExerciseIdentity[];
  /**
   * May this slot RETAIN its exercise for a second consecutive block?
   *
   * ⚠ **ONLY MAIN BILATERAL LIFTS MAY.** Sam, 2026-08-17: *"Main bilateral lifts
   * may remain for two consecutive blocks, then rotate. Single-leg knee,
   * single-leg hip and true accessory exercises rotate at every new block."*
   * Everything rotates on the same block cadence; this flag decides only whether
   * a well-progressed lift is allowed to stay for a second one.
   */
  readonly retentionEligible: boolean;
  /** 1-based block number. The deload shares its build block's number. */
  readonly blockNumber: number;
  /** Exercises the athlete prefers, as canonical identities. */
  readonly pinnedIdentities: readonly ComposedExerciseIdentity[];
  /**
   * Identities the existing progression owner would classify
   * `history_progressed` — i.e. the athlete trained them and they earned a
   * rise. Built by `blockBoundaryProgression.progressedFromOwnHistory`, which is
   * the same predicate `decideBlockBoundaryLoads` uses, so this module reads the
   * existing decision and rules nothing new.
   *
   * An identity that is absent has no recorded support for retention, and the
   * slot rotates — the contract's default.
   */
  readonly progressedIdentities: readonly ComposedExerciseIdentity[];
}

/**
 * Move pinned candidates to the front, preserving authored order inside each
 * group. Exclusion, injury, equipment and EXPERIENCE have already removed
 * anything the athlete may not be given, so a pin that survives to here is legal
 * by construction.
 */
function pinnedFirst(
  candidates: readonly ComposedExerciseIdentity[],
  pinned: readonly ComposedExerciseIdentity[],
): ComposedExerciseIdentity[] {
  if (pinned.length === 0) return [...candidates];
  const pins = new Set<string>(pinned);
  return [
    ...candidates.filter((id) => pins.has(id)),
    ...candidates.filter((id) => !pins.has(id)),
  ];
}

/**
 * The cadence index for a block, before any retention.
 *
 * ⚠ **ONE CADENCE, KEYED BY THE BLOCK, FOR EVERY SLOT.** An earlier revision
 * gave accessories a per-WEEK index and had to special-case the deload back onto
 * the last build week to stop it rotating. Sam's ruling (2026-08-17) removes the
 * whole problem: *"Single-leg knee, single-leg hip and true accessory exercises
 * rotate at every new block. They remain stable within the block and its
 * deload."* With the index a pure function of the block number, the deload is
 * week 4 of the same block and therefore identical for free — no deload branch,
 * no `weekInBlock`, and nothing left to get wrong.
 */
function cadenceIndex(blockNumber: number, length: number): number {
  return Math.max(0, blockNumber - 1) % length;
}

/**
 * THE OWNER. One deterministic decision per movement slot per block.
 *
 * Nothing downstream may reselect or rewrite the identity this returns —
 * `exerciseRotationOwnershipTests` walks the real generated program and proves
 * the stored, visible and reloaded identities are the ones decided here.
 */
export function decideRotation(inputs: RotationInputs): RotationDecision {
  const ordered = pinnedFirst(inputs.legalCandidates, inputs.pinnedIdentities);
  if (ordered.length === 0) {
    throw new Error(
      'decideRotation was given no legal candidates — an empty slot is the '
      + "composer's typed gap and must be resolved before rotation is asked.",
    );
  }
  const pins = new Set<string>(inputs.pinnedIdentities);

  const indexFor = (blockNumber: number): number =>
    cadenceIndex(blockNumber, ordered.length);

  const cadenceIdentity = ordered[indexFor(inputs.blockNumber)];
  const pinBiased = pins.has(cadenceIdentity)
    && inputs.legalCandidates.indexOf(cadenceIdentity) !== ordered.indexOf(cadenceIdentity);

  const rotated = (reason: RotationReason): RotationDecision => ({
    identity: cadenceIdentity,
    kind: inputs.blockNumber <= 1 ? 'first_block' : 'rotated',
    reason: inputs.blockNumber <= 1 ? 'no_previous_block' : reason,
    cadenceIdentity,
    pinBiased,
  });

  // A single legal option cannot rotate anywhere. Answered BEFORE retention so
  // the reason is the honest one — Sam's ruling 3: "If no different legal
  // same-pattern exercise exists, retain the only legal exercise and report that
  // exact pool-content gap."
  if (ordered.length === 1) {
    return {
      identity: ordered[0],
      kind: inputs.blockNumber <= 1 ? 'first_block' : 'rotated',
      reason: 'single_legal_candidate',
      cadenceIdentity,
      pinBiased,
    };
  }

  // Only main bilateral lifts may be retained. An accessory's freer cadence
  // is the contract's own answer for it.
  if (!inputs.retentionEligible) return rotated('accessory_cadence');
  if (inputs.blockNumber <= 1) return rotated('no_previous_block');

  // What the block before this one actually got, and what its own cadence would
  // have given it. A difference between the two IS last block's retention —
  // which is how the two-block maximum is enforced without storing a counter.
  const previousCadence = ordered[indexFor(inputs.blockNumber - 1)];
  const progressed = new Set<string>(inputs.progressedIdentities);

  // Still legal this block? A previous choice the athlete has since excluded, or
  // that their kit no longer allows, is simply absent from `legalCandidates`.
  if (!inputs.legalCandidates.includes(previousCadence)) {
    return rotated('previous_choice_not_legal_now');
  }

  // Was block b-1 itself a retention? It was iff what it actually selected
  // differs from its own cadence — i.e. iff the block before THAT progressed.
  const twoBackCadence = ordered[indexFor(inputs.blockNumber - 2)];
  const retainedLastBlock = inputs.blockNumber >= 3
    && twoBackCadence !== previousCadence
    && progressed.has(twoBackCadence)
    && inputs.legalCandidates.includes(twoBackCadence);
  if (retainedLastBlock) return rotated('two_block_maximum_reached');

  if (progressed.has(previousCadence)) {
    return {
      identity: previousCadence,
      kind: 'retained',
      reason: 'progressed_from_own_history',
      cadenceIdentity,
      pinBiased: false,
    };
  }

  return rotated('history_does_not_support_retention');
}
