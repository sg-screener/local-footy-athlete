/**
 * BLOCK EXERCISE SELECTION — the typed history record of WHAT WAS CHOSEN, and
 * the one pure selector that reads it.
 *
 * ## ⚠ WHY THIS RECORD EXISTS — MEASURED, NOT ASSUMED
 *
 * `scripts/trace-selection-history.ts` drove the REAL boot
 * (`rebuildDerivedWorld`) and asked three questions:
 *
 *   A. boot with UNCHANGED inputs              → identities return identical
 *   B. boot after the equipment answer changed → identities REWRITTEN
 *   C. any identity in durable storage         → NONE
 *
 * **B is why this file exists.** An athlete builds a block on a commercial-gym
 * answer, loses the rack before relaunching, and the block they already accepted
 * comes back changed underneath them:
 *
 *     hinge:  Trap Bar Deadlift  →  Deadlift
 *     squat:  Front Squat        →  Leg Press
 *
 * Nothing was reloaded — it was RE-DERIVED. `program-store` persists six input
 * keys and no exercise name appears in the persisted bytes, so identities
 * survived a boot only because replay happened to be deterministic *when nothing
 * changed*. Sam: *"Do not infer the previous selection by replaying the current
 * candidate list: equipment, injury and preferences may have changed, and replay
 * would rewrite history."*
 *
 * ## WHAT IS STORED — THE DECISION, NEVER A SNAPSHOT
 *
 * One row per movement slot per block: which block, which slot and group, what
 * role it played, and the canonical identity chosen. **Not the program, not the
 * dose, not the load.** Loads already have an owner (`blockBoundaryProgression`
 * reading recorded history by exercise name); duplicating them here would be a
 * second owner of the same fact.
 *
 * ## WHAT THE SELECTOR IS NOT
 *
 * ⚠ **THERE IS NO CURSOR, NO BLOCK-NUMBER INDEX AND NO SIMULATED WALK.** The
 * previous owner indexed the candidate list by block number and reconstructed
 * past choices by re-deriving them; Sam ruled that out outright — *"Do not select
 * `candidates[blockNumber]`. Do not advance a stored or simulated cursor."* The
 * selector below reads the RECORDED past and applies ordered rules to it. Same
 * inputs always produce the same result; there is no randomness and no AI.
 */

import type { SessionSlot } from './sessionSlotCoverage';
import type { ComposedExerciseIdentity } from './composedRowLegality';
import { stableDecisionOrder } from './stableDecisionDiversity';
import { sourceBoundSelectionIdentity } from './sourceBoundExerciseRegression';
import {
  preferredMovementPlaneCohort,
  type MovementPlaneTieBreakContext,
} from './movementPlaneProgramming';

/** What part a slot plays — it decides which rotation rules apply. */
export type SelectionRole = 'main_bilateral' | 'single_leg' | 'accessory';

/**
 * ONE RECORDED DECISION. Written when a block is accepted, read by the selector
 * for the next one. Deliberately small and flat so it survives persistence
 * without a migration story.
 */
export interface BlockExerciseSelection {
  /** 1-based block this selection belonged to. */
  readonly blockNumber: number;
  /** Monday ISO the block started on — block identity a renumber cannot break. */
  readonly blockStartISO: string;
  readonly slot: SessionSlot;
  /**
   * Zero-based occurrence of this slot in the authored week.
   *
   * A slot is a movement pattern, not a complete weekly seat. Keying history by
   * slot alone made every horizontal press in a four-day week restore the same
   * Bench Press row. The occurrence keeps those seats distinct while each one
   * remains stable for the block. Legacy rows pre-date this field and lift to 0
   * at the store boundary via `selectionSeatIndex`.
   */
  readonly seatIndex: number;
  /** Authored muscle group, when the pool declares one. Scopes "same group". */
  readonly group: string | null;
  readonly role: SelectionRole;
  readonly identity: ComposedExerciseIdentity;
}

/** Read-ingress lift for selection rows written before weekly seats existed. */
export function selectionSeatIndex(
  selection: Pick<BlockExerciseSelection, 'seatIndex'> | { readonly seatIndex?: number },
): number {
  return Number.isInteger(selection.seatIndex) && Number(selection.seatIndex) >= 0
    ? Number(selection.seatIndex)
    : 0;
}

export type SelectionDecisionKind =
  /** No recorded past for this slot — the first block it appeared in. */
  | 'first_selection'
  /** The recorded previous identity is kept. */
  | 'retained'
  /** A different legal identity was chosen. */
  | 'rotated';

export type SelectionReason =
  | 'no_previous_selection'
  /** This block was already authored and its recorded choice is restored. */
  | 'restored_recorded_selection'
  /** Phase policy pins this slot to one movement; the cap does not apply. */
  | 'phase_policy'
  /** The athlete's explicit preference, and it is legal. */
  | 'athlete_preference'
  /** The existing progression decision supports a second block on this lift. */
  | 'progressed_from_own_history'
  /** Held the default maximum of two consecutive blocks. */
  | 'two_block_maximum_reached'
  /** The recorded history does not support keeping it. */
  | 'history_does_not_support_retention'
  /** Single-leg and accessory slots change at every new block. */
  | 'structured_variety'
  /** The recorded previous identity is no longer legal. */
  | 'previous_selection_no_longer_legal'
  /** Only one legal candidate exists — a pool-content gap, reported. */
  | 'single_legal_candidate';

export interface ExerciseSelectionDecision {
  readonly identity: ComposedExerciseIdentity;
  readonly decisionKind: SelectionDecisionKind;
  readonly reason: SelectionReason;
  /** What the RECORD says was selected last time, or null if nothing is recorded. */
  readonly previousIdentity: ComposedExerciseIdentity | null;
  /** The legal candidates this decision actually chose between, in the order used. */
  readonly consideredCandidates: readonly ComposedExerciseIdentity[];
}

export interface ExerciseSelectionInputs {
  readonly phase: 'Off-season' | 'Pre-season' | 'In-season';
  readonly blockNumber: number;
  readonly slot: SessionSlot;
  readonly group: string | null;
  readonly role: SelectionRole;
  /**
   * Already filtered by equipment, injury, active exclusions and experience.
   * **The selector cannot restore an illegal option** — it only ever returns a
   * member of this list, so rule 1 holds by construction rather than by a branch.
   */
  readonly legalCandidates: readonly ComposedExerciseIdentity[];
  /** The RECORDED selection for this slot in the previous block, if any. */
  readonly previousSelection: BlockExerciseSelection | null;
  /**
   * The recorded selection for THIS block, when it has been authored before.
   *
   * ⚠ **THIS IS WHAT MAKES A BOOT A RESTORE RATHER THAN A RE-DERIVATION.**
   * Re-authoring a block the athlete already has is not a rotation decision —
   * the decision was made and recorded when the block was accepted. Without
   * this, a relaunch re-runs the rules against TODAY's legality and silently
   * hands back a different block, which is exactly the defect
   * `scripts/trace-selection-history.ts` measured.
   */
  readonly currentBlockSelection: BlockExerciseSelection | null;
  /**
   * Recorded selections for this slot, most recent FIRST. Drives "least recently
   * used" — the structured variety rule that replaces the cursor.
   */
  readonly recentSelections: readonly BlockExerciseSelection[];
  /** Identities `blockBoundaryProgression.progressedFromOwnHistory` supports. */
  readonly progressedIdentities: readonly ComposedExerciseIdentity[];
  readonly pinnedIdentities: readonly ComposedExerciseIdentity[];
  /** Plane preference is applied only inside the already-legal, equally suitable cohort. */
  readonly movementPlaneContext?: MovementPlaneTieBreakContext;
}

/**
 * ⚠ **PHASE POLICY — IN-SEASON, THE BILATERAL HINGE IS ANCHORED.**
 *
 * *"RDLs are primary and may remain across more than two blocks. Do not rotate
 * RDLs merely because time passed."* The preference order is authored here, and
 * the fallback chain falls out of it: RDLs, then Trap Bar Deadlift when RDLs are
 * unavailable/excluded/contraindicated, then conventional Deadlift — which is
 * therefore reached only when both preferred options are illegal, never to
 * manufacture variety.
 */
const IN_SEASON_HINGE_ORDER: readonly string[] = [
  'RDLs', 'Trap Bar Deadlift', 'Deadlift',
];

/** Preferred ahead of conventional Deadlift in EVERY phase. */
const HINGE_PREFERENCE_ORDER: readonly string[] = ['RDLs', 'Trap Bar Deadlift'];

function orderByPreference(
  candidates: readonly ComposedExerciseIdentity[],
  preference: readonly string[],
  decisionIdentity: string,
): ComposedExerciseIdentity[] {
  const rank = (id: ComposedExerciseIdentity): number => {
    const index = preference.indexOf(id);
    return index === -1 ? preference.length : index;
  };
  const stable = stableDecisionOrder(candidates, decisionIdentity, sourceBoundSelectionIdentity);
  return stable.sort((a, b) => rank(a) - rank(b));
}

/**
 * ⚠ **RETIRED BY R-374, ON SAM'S WORD — 2026-09-04.**
 *
 * This returned true for the in-season hinge, and an anchored slot has NO
 * rotation at all: it took the phase's first choice every block, forever. That
 * is why `RDLs` shipped 51 weeks out of 52.
 *
 * Asked whether RDLs should rotate in-season he said **yes — "only at block
 * boundaries"**, which is not a new constraint but the existing one: every
 * rotation in this module happens at a block boundary and nothing here can move
 * a lift mid-block. `IN_SEASON_HINGE_ORDER` survives as a PREFERENCE
 * (`HINGE_PREFERENCE_ORDER` already ordered RDLs and Trap Bar ahead of a
 * conventional Deadlift in every phase), so in-season still LEADS with RDLs —
 * it just no longer refuses to ever leave them.
 *
 * The function is deleted rather than made to return false, because a predicate
 * that is always false is a branch nobody can see is dead.
 */

/**
 * How long ago this identity was last selected for the slot. `Infinity` means
 * never — which is what makes an unused option the most eligible.
 */
function blocksSinceLastUse(
  identity: ComposedExerciseIdentity,
  recent: readonly BlockExerciseSelection[],
): number {
  const index = recent.findIndex((entry) => entry.identity === identity);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

/**
 * THE ONE SELECTION OWNER. Ordered rules, never a points score.
 *
 *   1. legality      — already applied to `legalCandidates`
 *   2. preference    — a legal pin wins
 *   3. phase policy  — phase-specific preferences outrank generic variety
 *   4. continuity    — a progressed main lift may hold a second block
 *   5. variety       — otherwise the least-recently-used legal same-group option
 *   6. equal cohort  — decision-keyed identity diversity, never catalogue order
 */
export function decideExerciseForBlock(
  inputs: ExerciseSelectionInputs,
): ExerciseSelectionDecision {
  const previousIdentity = inputs.previousSelection?.identity ?? null;

  if (inputs.legalCandidates.length === 0) {
    throw new Error(
      'decideExerciseForBlock was given no legal candidates. An empty slot is the '
      + "composer's typed gap and must be resolved before selection is asked.",
    );
  }

  const decisionIdentity = [
    inputs.phase, inputs.blockNumber, inputs.slot, inputs.group ?? '', inputs.role,
  ].join('|');
  // Equal candidates are ordered from the decision and candidate identities,
  // never from their current position in a catalogue array.
  // Sam, 2026-08-28: these stay manual choices and suitable fallbacks, not
  // automatic variety while another legal movement can fill the same slot.
  const fallback = inputs.slot === 'hinge' ? 'Deadlift' : inputs.slot === 'squat' ? 'Leg Press' : null;
  const preferred = inputs.legalCandidates.filter(id => id !== fallback);
  const automaticCandidates = fallback && preferred.length > 0 && !inputs.pinnedIdentities.includes(fallback as ComposedExerciseIdentity)
    ? preferred : inputs.legalCandidates;
  const phaseOrdered = inputs.slot === 'hinge'
    ? orderByPreference(
      automaticCandidates,
      // R-374: in-season still LEADS with RDLs; it no longer refuses to leave.
      inputs.phase === 'In-season' ? IN_SEASON_HINGE_ORDER : HINGE_PREFERENCE_ORDER,
      decisionIdentity,
    )
    : stableDecisionOrder(automaticCandidates, decisionIdentity, sourceBoundSelectionIdentity);

  const decide = (
    identity: ComposedExerciseIdentity,
    decisionKind: SelectionDecisionKind,
    reason: SelectionReason,
    consideredCandidates: readonly ComposedExerciseIdentity[] = phaseOrdered,
  ): ExerciseSelectionDecision => ({
    identity, decisionKind, reason, previousIdentity, consideredCandidates,
  });

  // ── RESTORE BEFORE DECIDE ─────────────────────────────────────────────────
  // A block that was already authored is not re-decided; its recorded choice is
  // returned. Legality still binds: an exercise the athlete has since excluded,
  // been injured out of, or lost the kit for CANNOT be restored, and the slot
  // falls through to an honest new decision rather than programming something
  // illegal. That is the one case where a boot legitimately differs, and it
  // differs because the world did.
  const recorded = inputs.currentBlockSelection?.identity ?? null;
  if (recorded !== null && inputs.legalCandidates.includes(recorded)) {
    return {
      identity: recorded,
      decisionKind: 'retained',
      reason: 'restored_recorded_selection',
      previousIdentity,
      consideredCandidates: stableDecisionOrder(inputs.legalCandidates, decisionIdentity, sourceBoundSelectionIdentity),
    };
  }

  // ── RULE 5b — ONE LEGAL OPTION IS A POOL GAP, REPORTED HONESTLY ────────────
  // "If only one legal candidate exists, retain it honestly and report the
  // pool-content gap." Answered before everything else so the reason is the
  // true one rather than whichever rule happened to pick the only option.
  if (phaseOrdered.length === 1) {
    return decide(
      phaseOrdered[0],
      previousIdentity === phaseOrdered[0] ? 'retained' : 'first_selection',
      'single_legal_candidate',
    );
  }

  // ── RULE 2 — ATHLETE PREFERENCE ───────────────────────────────────────────
  // A pin is a preference, not "keep forever": it cannot reach an illegal
  // option (it is matched against the already-legal list) and it cannot defeat
  // a mandatory rotation break, which is why the two-block check below still
  // runs for a pinned main lift.
  const legalPin = phaseOrdered.find((id) => inputs.pinnedIdentities.includes(id));

  // ── RULE 3 — PHASE POLICY ─────────────────────────────────────────────────
  // An anchored slot has no rotation at all: it takes the athlete's legal pin
  // when there is one, else the phase's own first choice, every block.
  if (legalPin) {
    // A pinned lift is still subject to the mandatory break below when it is the
    // one that has already been held twice.
    const heldTwice = inputs.role === 'main_bilateral'
      && previousIdentity === legalPin
      && inputs.recentSelections.length >= 2
      && inputs.recentSelections[0]?.identity === legalPin
      && inputs.recentSelections[1]?.identity === legalPin;
    if (!heldTwice) return decide(legalPin, 'retained', 'athlete_preference');
  }

  // Plane metadata narrows only the remaining equal cohort. Current-block
  // restoration, legality, athlete preference and phase policy have already
  // answered above; recorded progression can still retain its accepted lift.
  const planeCohort = preferredMovementPlaneCohort(
    phaseOrdered,
    inputs.movementPlaneContext,
  );

  // ── RULE 4 — CONTINUITY ───────────────────────────────────────────────────
  if (previousIdentity !== null && !phaseOrdered.includes(previousIdentity)) {
    return decide(
      leastRecentlyUsed(planeCohort, inputs.recentSelections, decisionIdentity),
      'rotated',
      'previous_selection_no_longer_legal',
      planeCohort,
    );
  }

  if (inputs.role === 'main_bilateral' && previousIdentity !== null) {
    const heldTwice = inputs.recentSelections.length >= 2
      && inputs.recentSelections[0]?.identity === previousIdentity
      && inputs.recentSelections[1]?.identity === previousIdentity;
    if (heldTwice) {
      return decide(
        leastRecentlyUsed(planeCohort, inputs.recentSelections, decisionIdentity),
        'rotated',
        'two_block_maximum_reached',
        planeCohort,
      );
    }
    if (inputs.progressedIdentities.includes(previousIdentity)) {
      return decide(previousIdentity, 'retained', 'progressed_from_own_history');
    }
    return decide(
      leastRecentlyUsed(planeCohort, inputs.recentSelections, decisionIdentity),
      'rotated',
      'history_does_not_support_retention',
      planeCohort,
    );
  }

  // ── RULE 5 — STRUCTURED VARIETY ───────────────────────────────────────────
  // Single-leg and accessory slots change at every new block, to the legal
  // same-group option used least recently. Never across groups: the caller
  // scopes `legalCandidates` to the slot, so a cross-group option is not here.
  if (previousIdentity === null) {
    return decide(planeCohort[0], 'first_selection', 'no_previous_selection', planeCohort);
  }
  /* ⚠ NO `!== previousIdentity` FILTER HERE, AND ITS ABSENCE IS DELIBERATE.
   * An earlier revision filtered the previous identity out before the walk. It
   * was DEAD: the previous selection is `recentSelections[0]`, so its age is 0 —
   * the minimum — and "least recently used" can never return it while any other
   * candidate exists. A mutation removing the filter reddened nothing, which is
   * how it was found. The one-candidate case is answered far above. */
  return decide(
    leastRecentlyUsed(planeCohort, inputs.recentSelections, decisionIdentity),
    'rotated',
    'structured_variety',
    planeCohort,
  );
}

/**
 * The least recently used candidate. Equal ages use decision-keyed identity
 * diversity, so catalogue insertion order is not programming policy.
 *
 * ⚠ **THIS IS WHAT REPLACED THE CURSOR.** It reads the RECORDED past instead of
 * reconstructing it from a block number, so an athlete whose kit or exclusions
 * changed keeps a truthful history rather than a re-derived one.
 */
function leastRecentlyUsed(
  candidates: readonly ComposedExerciseIdentity[],
  recent: readonly BlockExerciseSelection[],
  decisionIdentity: string,
): ComposedExerciseIdentity {
  const bestAge = Math.max(...candidates.map((candidate) => blocksSinceLastUse(candidate, recent)));
  const cohort = candidates.filter((candidate) => blocksSinceLastUse(candidate, recent) === bestAge);
  return stableDecisionOrder(cohort, decisionIdentity, sourceBoundSelectionIdentity)[0];
}
