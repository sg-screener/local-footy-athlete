/**
 * THE ONE TRANSACTION OWNER FOR "LEAVE THIS EXERCISE OUT".
 *
 * Sam's approved contract
 * (`docs/BLOCK_TWO_PROGRESSION_CONTRACT_APPROVED_2026-08-16.md`) requires that
 * *"changing or restoring must use the same canonical transaction owner"*. This
 * is that owner. Three doors call it and no fourth exists:
 *
 *   1. the day screen's per-row Remove button, after the scope question;
 *   2. My Status — "Change scope" and "Restore exercise";
 *   3. the coach path (`coachActions.banExerciseGlobally`), which has no scope
 *      question of its own and therefore records the `until_changed` answer.
 *
 * ⚠ **`rules/exerciseExclusions.ts` IS PURE AND STAYS PURE.** It owns the SHAPE
 * of the decision and every question asked of it; this file owns the two impure
 * things a decision needs and a pure module must not do: reading the live block
 * grid to stamp the expiry, and writing the store.
 *
 * ── WHY THE BLOCK IS READ HERE AND STAMPED ONCE ────────────────────────────
 *
 * "This block" is an answer about the block the athlete is standing in AT THE
 * MOMENT THEY ANSWER. The anchor moves (rollover advances it), so re-deriving
 * the expiry later would answer for a different block than the one they meant.
 * The expiry is therefore an INPUT, resolved here, stored once, never
 * recomputed — see the docstring in `rules/exerciseExclusions.ts`.
 *
 * WRITER: this file. READER: `store/athletePreferencesStore.getAthletePrefs`
 * (generation), `utils/activeProgramModifiers` (Status).
 * TEST: `src/__tests__/exerciseExclusionScopeTests.ts`.
 */

import {
  findExclusion,
  resolveExclusionActiveThrough,
  type ExerciseExclusion,
  type ExerciseExclusionScope,
} from '../rules/exerciseExclusions';
import {
  getAthleteExclusions,
  useAthletePreferencesStore,
} from '../store/athletePreferencesStore';
import { useProgramStore } from '../store/programStore';
import { getStoredBlockStateForDate } from './programBlockState';
import { canonicalExerciseName } from './exerciseCanonicalisation';
import { todayISOLocal } from './appDate';
import { logger } from './logger';

export interface ExerciseExclusionDecision {
  /** Raw or canonical — canonicalised here, once, so no caller can skip it. */
  exercise: string;
  scope: ExerciseExclusionScope;
  /** The day the athlete answered. Defaults to today. */
  decidedOnISO?: string;
  /** The athlete's own words. Never invented, never defaulted to a sentence. */
  reason?: string;
}

export interface ExerciseExclusionTransactionResult {
  ok: boolean;
  /** The record as stored. `null` on refusal, and on restore. */
  exclusion: ExerciseExclusion | null;
  /** True when this replaced an existing decision rather than adding one. */
  changedExistingDecision: boolean;
  /**
   * The future program is now wrong until it is rebuilt: a decision that reaches
   * `future_generation` has changed what generation may choose.
   */
  rebuildRequired: boolean;
  reason?: 'no_exercise_named';
}

/**
 * WHICH BLOCK IS THE ATHLETE STANDING IN, AND WHEN DOES IT END.
 *
 * Reads the SAME stored anchor generation reads (`programStore.blockState` via
 * `getStoredBlockStateForDate`) rather than recomputing a block grid here — two
 * block grids is exactly the defect `resolveBlockGridPosition` was written to
 * close. `null` when there is no program yet, which
 * `resolveExclusionActiveThrough` degrades to the decision day: a scope the app
 * cannot honour must under-apply rather than silently ban forever.
 */
export function resolveExclusionBlockContext(dateISO: string): {
  blockNumber: number | null;
  blockEndISO: string | null;
} {
  const stored = useProgramStore.getState().blockState;
  if (!stored) return { blockNumber: null, blockEndISO: null };
  const state = getStoredBlockStateForDate(stored, dateISO);
  return { blockNumber: state.blockNumber, blockEndISO: state.blockEnd };
}

/**
 * THE DOOR. One decision per exercise: a second answer for the same exercise
 * REPLACES the first (proof case 5 — "Change scope updates the same fact, no
 * duplicate exclusions"), because the store's write goes through
 * `upsertExclusion`, which is keyed on the canonical identity.
 */
export function applyExerciseExclusionDecision(
  decision: ExerciseExclusionDecision,
): ExerciseExclusionTransactionResult {
  const exercise = canonicalExerciseName(String(decision.exercise ?? '').trim());
  if (!exercise) {
    return {
      ok: false,
      exclusion: null,
      changedExistingDecision: false,
      rebuildRequired: false,
      reason: 'no_exercise_named',
    };
  }

  const decidedOnISO = (decision.decidedOnISO ?? todayISOLocal()).slice(0, 10);
  const previous = findExclusion(getAthleteExclusions(), exercise);
  const { blockNumber, blockEndISO } = resolveExclusionBlockContext(decidedOnISO);

  const exclusion: ExerciseExclusion = {
    exercise,
    scope: decision.scope,
    decidedOnISO,
    activeThroughISO: resolveExclusionActiveThrough({
      scope: decision.scope,
      decidedOnISO,
      blockEndISO,
    }),
    blockNumber,
    // An absent reason stays absent. A reason the athlete did not give is a
    // sentence Status would attribute to them.
    ...(decision.reason?.trim() ? { reason: decision.reason.trim() } : {}),
  };

  useAthletePreferencesStore.getState().setExclusion(exclusion);

  logger.debug('[exercise-exclusion] decision applied', {
    scope: exclusion.scope,
    activeThroughISO: exclusion.activeThroughISO,
    blockNumber: exclusion.blockNumber,
    replaced: previous?.scope ?? null,
  });

  return {
    ok: true,
    exclusion,
    changedExistingDecision: Boolean(previous),
    // `today_only` changes THIS session, which the removal override already did;
    // it does not change what future generation may choose, so it asks for no
    // rebuild. The other two do.
    rebuildRequired: exclusion.scope !== 'today_only',
  };
}

/**
 * RESTORE — the same owner, in the other direction (proof case 4).
 *
 * It deletes the decision and does nothing else. It does not pin, prioritise or
 * re-prescribe: the exercise becomes ELIGIBLE again and the next generation
 * chooses it or not on its ordinary merits. Forcing it back in would be the app
 * overruling an athlete who only said "stop leaving it out".
 *
 * ── A REMOVAL WRITES TWO FACTS, SO ITS REVERSAL CLEARS TWO ──────────────────
 *
 * The canonical exclusion in athlete preferences is one. The `remove_exercise`
 * program-control action on the decision ledger is the other, and it keeps
 * REPLAYING: every boot rebuilds the world from the ledger, so a reversal that
 * clears only the exclusion is undone by the next re-derivation. Measured on
 * device 2026-08-19 (exclusions `[]`, ledger still holding `remove_exercise`)
 * and again headlessly 2026-08-20 — restoring, then settling, put the exclusion
 * straight back and the row stayed off the day.
 *
 * `annulOutstandingRemovalFor` lived at ONE caller
 * (`activeProgramModifiers`' Status control) and every other door through this
 * owner got half a reversal. Sam's contract is *"changing or restoring must use
 * the same canonical transaction owner"*, so both writes are reversed HERE, and
 * no caller re-assembles the pair. It is the SAME reversal mechanism undo
 * appends, aimed at a named entry — not a second undo authority — and a world
 * with no outstanding removal (a coach-written exclusion, or an undo that has
 * already appended its own reversal) appends nothing and returns false.
 *
 * WRITER: this file. READER: `store/quiescentBoot`'s replay set.
 */
export function restoreExcludedExercise(
  exercise: string,
): ExerciseExclusionTransactionResult {
  const identity = canonicalExerciseName(String(exercise ?? '').trim());
  if (!identity) {
    return {
      ok: false,
      exclusion: null,
      changedExistingDecision: false,
      rebuildRequired: false,
      reason: 'no_exercise_named',
    };
  }
  const previous = findExclusion(getAthleteExclusions(), identity);
  useAthletePreferencesStore.getState().removeExclusion(identity);
  // Lazily required: `store/undoLastDecision` imports this module for the same
  // reversal in the other direction, and a static import would close the cycle.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { annulOutstandingRemovalFor } = require('../store/undoLastDecision');
  // The ledger stores the action VERBATIM, so its payload carries whatever the
  // athlete's control named — which canonicalisation may have rewritten
  // ("rdl" -> "RDLs"). Try the identity first, then the name as given; the
  // annul is keyed on the ledger's own text and matches at most one entry.
  const asNamed = String(exercise ?? '').trim();
  if (!annulOutstandingRemovalFor(identity)
    && asNamed && asNamed.toLowerCase() !== identity.toLowerCase()) {
    annulOutstandingRemovalFor(asNamed);
  }
  return {
    ok: true,
    exclusion: null,
    changedExistingDecision: Boolean(previous),
    /**
     * ⚠ **EVERY SCOPE NOW NEEDS THE WORLD RE-DERIVED, INCLUDING `today_only`.**
     *
     * This line read `previous!.scope !== 'today_only'`, and that was true while
     * a removal was only ever a read-time filter: restoring un-hid a row the
     * stored week still held, so nothing had to be rebuilt.
     *
     * **Sam, 2026-08-20 changed that premise:** *"A settings change must not
     * re-add an excluded lift to the stored accepted program and rely on
     * projection to hide it. Stored truth and visible truth must agree."*
     * `generateProgram` now applies `applyExclusionsToAuthoredWeek` to the week
     * it authors, so the FIRST generation after any removal — and boot
     * regenerates on every launch — bakes it into storage, for all three
     * scopes. There is then nothing left to un-hide, and a Restore that reports
     * "no rebuild needed" reports success over an unchanged session.
     *
     * MEASURED 2026-08-20 (`test:session-change-durability` [2]): remove,
     * restart, restore — the row did not come back, because this line said the
     * world was already right.
     */
    rebuildRequired: Boolean(previous),
  };
}

/**
 * RESTORE, WITH THE WORLD SETTLED ON RETURN — the door every surface takes.
 *
 * The exact mirror of `executeProgramControlActionDurably`, and the same shape
 * for the same reason: the function above owns the DECISION, this owns the
 * ACT. A caller that awaits this has a world already re-derived, so it never
 * has to run a rebuild of its own.
 *
 * ⚠ **AND THE RE-DERIVATION IS THE ONLY INSTRUMENT THAT WORKS HERE.**
 * `settleDerivedWorldAfterDecision` is `rebuildDerivedWorld` — generation under
 * `recordSelections: 'replay'`, then the ledger replayed — so the composer
 * RESTORES what the block recorded (`blockSelectionHistoryStore`) instead of
 * deciding the emptied slot afresh, and the athlete's own later swaps and adds
 * are re-applied on top of a day that has the row back. That is what returns
 * the EXACT original item, in its place, at its load.
 *
 * The author-path rebuild a `rebuildRequired: true` used to buy is measurably
 * the WRONG instrument for a restore: walked headlessly 2026-08-20 through the
 * real Status control plus `generateProgramForProfileFromStore({
 * recordSelections: 'author' })`, the restored lift went from 3 stored rows to
 * **0** — re-authoring re-decides the slot, which is the one thing Sam's Remove
 * contract forbids the app doing to a slot the athlete emptied.
 *
 * READER: `screens/coach/useCoachNoteActions` (My Status' "Restore exercise"),
 * `__tests__/support/athleteJourney.restoreExercise`.
 * TEST: `src/__tests__/exerciseRestoreOwnerTests.ts`.
 */
export async function restoreExcludedExerciseDurably(
  exercise: string,
): Promise<ExerciseExclusionTransactionResult> {
  const result = restoreExcludedExercise(exercise);
  if (!result.ok || !result.rebuildRequired) return result;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { settleDerivedWorldAfterDecision } = require('../store/quiescentBoot');
  await settleDerivedWorldAfterDecision();
  // The world IS settled. Reporting a rebuild still to come would send the
  // caller into the author-path rebuild this door exists to keep it out of.
  return { ...result, rebuildRequired: false };
}
