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
  return {
    ok: true,
    exclusion: null,
    changedExistingDecision: Boolean(previous),
    rebuildRequired: Boolean(previous) && previous!.scope !== 'today_only',
  };
}
