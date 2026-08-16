/**
 * BLOCK-BOUNDARY PROGRESSION — the one owner of what a lift weighs in the next
 * block, decided WHILE THE BLOCK IS BUILT and stored with it.
 *
 * Sam, 2026-08-16: *"Block Two progression must be resolved before storage as
 * part of building Block Two—not later when the screen draws it. Stored, visible
 * and reloaded prescriptions must be identical. Do not preserve the existing
 * projection-time rewrite as the new authority."*
 *
 * ## ⚠ THE AUTHORING-TIME FREEZE ALREADY EXISTS. THIS IS NOT A SECOND OWNER.
 *
 * `generateProgram.ts:1460` already calls `bakeMicrocycleStrengthProgression`,
 * whose own comment says *"materialise strength progression into the stored
 * microcycles once. Resolution then merely projects these loads — it no longer
 * recomputes progression on read."* **The architecture Sam asked for is built.**
 *
 * **What is broken is what it is FED.** That call site passes, verbatim:
 *
 *     sessionFeedback: {},
 *     weightOverrides: {},
 *     workoutHistory: [],
 *     blockState: null,
 *
 * So the freeze runs against an athlete with no history and no block identity —
 * it bakes a history-free number — and then the resolver, drawing the screen
 * from the LIVE store, re-derives with the real history and shows a different
 * one. **That is the stored ≠ visible split, and its cause is four empty
 * arguments, not a missing layer.**
 *
 * This module therefore owns the DECISION ONLY — retain, rotate, and how much —
 * and is fed INTO that existing freeze. Adding a parallel apply-and-stamp pass
 * beside it would be the second-owner defect this repo names outright.
 *
 * ## WHAT IT MAY READ — the contract's "evidence the app may use"
 *
 * `docs/BLOCK_TWO_PROGRESSION_CONTRACT_APPROVED_2026-08-16.md` limits
 * progression to information the app genuinely records. This module reads
 * exactly three things, all of them recorded facts:
 *
 *   1. whether a session was COMPLETED   — `SessionFeedback.completion`
 *   2. how recovery went                 — `SessionFeedback.soreness` / `feeling`
 *   3. the load that was on the bar      — `SessionFeedback.strength[].weightKg`
 *
 * ⚠ **IT NEVER INFERS REPS OR SETS FROM A COMPLETED MARKER.** The contract:
 * *"It must not claim to know which rep was missed, whether extra reps were
 * completed or whether every prescribed rep was achieved merely because a
 * session was marked complete."* `completedSets` and `actualReps` are optional
 * on `StrengthExercisePerformanceLog` and are written only when the athlete
 * logged per-set detail. This module does not read them at all, so it cannot
 * accidentally treat their ABSENCE as a zero or their presence as a licence.
 *
 * ## THE CANONICAL PRIORITY — SAM'S, NOT THIS MODULE'S
 *
 * Sam, 2026-08-16 (FINAL): *"DO NOT INVENT OR RE-RULE LOAD BEHAVIOUR... The
 * missing work is integration, not policy."* Every number below comes from a
 * source he authored; this module only decides WHICH source answers.
 *
 * **1. EXACT-EXERCISE HISTORY WINS.** A valid recorded load from a completed
 * exposure is the base — including after the exercise vanished for one or more
 * blocks. Then the approved progression rules: good completion and recovery
 * earn the smallest practical increment; very hard or low readiness HOLDS the
 * load. **The athlete's number is never rounded or "corrected".**
 *
 * **2. UNSEEN → SAM'S OWN ESTIMATE.** `startingWeightForAthlete` reads
 * `EXERCISE_LOAD_MAP`'s squat/bench anchor and rounds through the equipment
 * lattice. **No second ratio table and no second estimator is defined here.**
 *
 * **3. BODYWEIGHT IS A DEFAULT, NOT A PROHIBITION.** An authored-unloaded row
 * with no recorded load shows BW and this module writes nothing to it. It does
 * NOT skip rule 1: *"when the exact exercise returns, its recorded added-load
 * history wins."* A weighted Pull-Up the athlete logged is history like any
 * other. **`loadRatio 0` means no automatic estimate — never that the athlete
 * may not add weight**, and no weight control is removed, hidden or disabled.
 *
 * **4. NOTHING VALID → BLANK.** No history, no authored mapping, or missing
 * anchor inputs: the suggestion is left empty and the athlete chooses.
 *
 * **5. NO REPLACEMENT CONTAMINATION.** A rotated exercise is NEVER seeded from
 * the outgoing exercise's weight because they share a slot, role or movement
 * pattern. The `loadRatio` sibling table in `data/exercisePoolsStrength.ts` is
 * consulted nowhere in this module. **This is the one clause that survived all
 * three revisions of the instruction unchanged.**
 *
 * ## ⚠ TWO SUPERSEDED INTERPRETATIONS, NAMED SO THEY STAY DEAD
 *
 * Earlier revisions of this file implemented, and its guards asserted:
 *   · *"rotated exercises are always blank"* — wrong: rule 2 gives an unseen
 *     mapped exercise Sam's authored estimate, and blank is only rule 4.
 *   · *"bodyweight has no weight field"* — wrong, and the more damaging of the
 *     two: it short-circuited authored-unloaded rows BEFORE reading history and
 *     would have discarded an athlete's recorded weighted Pull-Up.
 * Both are removed from the code, the guards and the registry row.
 */

import type { OnboardingData, Workout, WorkoutExercise } from '../types/domain';
import type { SessionFeedback } from '../store/programStore';
import type { FeedbackFeeling, FeedbackSoreness } from '../types/sessionOutcome';
import {
  equipmentClassFor,
  resolveLoadAuthority,
  startingWeightForAthlete,
} from '../utils/loadEstimation';
import { EQUIPMENT } from '../data/equipmentLattice';
import { participatesInCounting } from './sessionRowCounting';
import { classifyProgressionEligibility } from '../utils/strengthProgressionIntegration';

/**
 * THE SMALLEST PRACTICAL INCREMENT FOR THIS EXERCISE, from SAM'S OWN LATTICE.
 *
 * Sam, 2026-08-16 (final): *"Use the existing authored equipment lattice for the
 * smallest practical suggestion."* and *"DO NOT INVENT OR RE-RULE LOAD
 * BEHAVIOUR... The missing work is integration, not policy."*
 *
 * ⚠ **THIS REPLACED A HARDCODED 2.5 kg PLUS A BARBELL NAME-CHECK.** That was
 * policy this module had no business authoring: it made 2.5 the answer for
 * every barbell and NO answer for anything else, so a dumbbell or kettlebell
 * lift silently held its load forever. `EQUIPMENT` already rules all of it —
 * barbell/cable/machine 2.5 kg steps, kettlebell 4 kg, dumbbells 1 kg to 10
 * then 2.5 kg rungs.
 *
 * `null` means **the lattice does not say**, which is a real answer and not a
 * zero: Sam's *"if the equipment required for an optional external load is
 * unknown, preserve the recorded load and leave the next choice editable rather
 * than guessing."* The caller HOLDS on null; it never falls back to a default.
 */
export function smallestPracticalIncrementKg(
  exerciseName: string,
  baseKg: number,
): number | null {
  const equipment = equipmentClassFor(exerciseName);
  if (!equipment) return null;
  const { lattice } = EQUIPMENT[equipment];
  if (lattice.kind === 'step') return lattice.stepKg;
  if (lattice.kind === 'rungs') {
    const next = lattice.rungsKg.find((rung) => rung > baseKg);
    return next === undefined ? null : next - baseKg;
  }
  // 'none' — bodyweight. Added external load is legal and may be recorded, but
  // NOTHING AUTHORED says what it is added in, so the next step is the
  // athlete's to choose. Holding is the honest answer; guessing 2.5 is not.
  return null;
}

/**
 * ⚠ SUPERSEDED 2026-08-16 by Sam's FINAL LOAD-AUTHORITY CLARIFICATION, and kept
 * only so the retired instruction is greppable rather than silently vanished.
 *
 * The earlier ruling was *"rotated lift → no inherited load and no automatic
 * estimate"* — blanket. The final order refines it: a genuinely UNSEEN exercise
 * now takes Sam's authored squat/bench-anchor estimate (PRIORITY 2), and blank
 * is the answer only when nothing authored covers it (PRIORITY 3).
 *
 * **What did NOT change, and is the part that mattered all along:** nothing is
 * ever seeded from the OUTGOING exercise's weight because the two share a slot
 * or a movement pattern. The `loadRatio` sibling table remains unconsulted.
 */
export const ROTATED_NEVER_INHERITS_FROM_OUTGOING = true;

/**
 * How much of the block must have been completed before history counts.
 *
 * The contract's own threshold, from the missed-session clause: *"When the
 * athlete completes less than roughly 75 percent of required sessions across the
 * block, ask whether the weekly commitment is unrealistic."* Below that line the
 * app is meant to ASK, not to progress, so 75% is the same number in both
 * directions. **The asking half is NOT built in this slice** — this module only
 * declines to progress.
 */
export const QUALIFYING_COMPLETION_RATIO = 0.75;

export type BlockBoundaryDecisionKind =
  /** PRIORITY 1 — own history, and the progression rules raised it. */
  | 'history_progressed'
  /** PRIORITY 1 — own history seeded it; progression rules did not raise it. */
  | 'history_held'
  /** PRIORITY 2 — never logged: Sam's authored squat/bench-anchor estimate. */
  | 'authored_estimate'
  /** PRIORITY 3 — no history and nothing authored: the athlete chooses. */
  | 'unset'
  /**
   * Authored as unloaded AND never logged with added load: BW is the DEFAULT
   * shown. Not a prohibition — the athlete may add load, and once they record
   * it, PRIORITY 1 governs this exercise from then on.
   */
  | 'bodyweight_default';

export interface BlockBoundaryLiftDecision {
  exerciseId: string;
  exerciseName: string;
  kind: BlockBoundaryDecisionKind;
  /** The most recent valid load recorded for THIS exact exercise, ever. */
  previousLoadKg: number | null;
  /**
   * What the next block stores.
   *
   * **THREE VALUES, THREE DIFFERENT THINGS.** A number is a decided load.
   * `null` is UNSET — decided to be blank, the athlete chooses. `undefined` is
   * DO NOT TOUCH — this module has no business writing here at all, which is
   * what keeps an authored bodyweight row's BW semantics intact.
   */
  nextLoadKg: number | null | undefined;
  /** Present only on `history_progressed`. */
  incrementKg?: number;
}

/**
 * What the app actually recorded across one block, reduced to the three facts
 * progression is allowed to use. Built by `readBlockHistory` and by nothing
 * else, so there is one place that decides what "the athlete trained well" is.
 */
export interface BlockHistorySignal {
  completedStrengthSessions: number;
  recordedStrengthSessions: number;
  /** Every session that reported soreness/effort came back inside the good band. */
  recoveryGood: boolean;
  /** Last recorded load per exercise NAME. Absent name = no recorded load. */
  lastRecordedLoadByExercise: Readonly<Record<string, number>>;
  /** True when there is enough completed, well-recovered work to progress on. */
  qualifies: boolean;
}

export const EMPTY_BLOCK_HISTORY: BlockHistorySignal = {
  completedStrengthSessions: 0,
  recordedStrengthSessions: 0,
  recoveryGood: false,
  lastRecordedLoadByExercise: {},
  qualifies: false,
};

/**
 * Soreness/effort answers that still count as "recovery is good".
 *
 * The contract progresses only when *"training is being completed and recovery
 * is good"*, and separately reduces work on *"low readiness or high soreness"*.
 * `hard` is a legal, well-recovered session; `very_hard` is the contract's
 * "completed but very hard", which reduces VOLUME and must never buy load.
 */
/**
 * TYPED, so that adding a feeling or a soreness level to the vocabulary is a
 * COMPILE error here rather than a silent "not in the good set" — which would
 * quietly stop an athlete progressing and look like a rule working.
 */
const GOOD_RECOVERY_FEELINGS: ReadonlySet<FeedbackFeeling> =
  new Set<FeedbackFeeling>(['very_easy', 'easy', 'good', 'hard']);
const GOOD_RECOVERY_SORENESS: ReadonlySet<FeedbackSoreness> =
  new Set<FeedbackSoreness>(['none', 'mild', 'moderate']);

/**
 * Reduce the persisted per-date `SessionFeedback` for one block to the signal.
 *
 * `blockStartISO`/`blockEndISO` are inclusive. Dates outside them are ignored,
 * which is what keeps block N+1's decision a read of block N and not of the
 * athlete's whole life.
 */
export function readBlockHistory(args: {
  feedbackByDate: Readonly<Record<string, SessionFeedback>>;
  /**
   * The block that just ended. It scopes the COMPLETION/RECOVERY gate — "is
   * this athlete training well *right now*" is a question about recent weeks.
   *
   * ⚠ **IT DOES NOT SCOPE THE RECORDED LOADS.** Sam, 2026-08-16: *"A returning
   * exercise keeps its own history even after being absent for one or more
   * blocks."* Windowing loads to the previous block is exactly how a lift that
   * sat out block 2 comes back in block 3 pretending it had never been lifted.
   */
  blockStartISO: string;
  blockEndISO: string;
  /** Strength sessions the block asked for. Drives the 75% gate. */
  requiredStrengthSessions: number;
}): BlockHistorySignal {
  const { feedbackByDate, blockStartISO, blockEndISO, requiredStrengthSessions } = args;

  const allSorted = Object.entries(feedbackByDate)
    .sort(([a], [b]) => a.localeCompare(b));
  const inBlock = allSorted
    .filter(([dateStr]) => dateStr >= blockStartISO && dateStr <= blockEndISO);

  let completedStrengthSessions = 0;
  let recordedStrengthSessions = 0;
  let recoveryGood = true;
  let sawRecoveryAnswer = false;
  const lastRecordedLoadByExercise: Record<string, number> = {};

  for (const [, feedback] of inBlock) {
    const strengthLogs = feedback.strength ?? [];
    if (strengthLogs.length === 0) continue;
    recordedStrengthSessions++;
    // 'full' is the only completion that counts. 'partial' is real work but the
    // app does not know WHICH work was done — see the header's no-inference
    // rule — and 'skipped' is not work at all.
    if (feedback.completion === 'full') completedStrengthSessions++;

    if (feedback.feeling !== undefined) {
      sawRecoveryAnswer = true;
      if (!GOOD_RECOVERY_FEELINGS.has(feedback.feeling)) recoveryGood = false;
    }
    if (feedback.soreness !== undefined) {
      sawRecoveryAnswer = true;
      if (!GOOD_RECOVERY_SORENESS.has(feedback.soreness)) recoveryGood = false;
    }
  }

  // ── RECORDED LOADS ARE READ OVER ALL TIME, NOT OVER THE BLOCK ──
  // Walk every dated entry in order so the LAST valid load for each EXACT
  // canonical exercise wins, however many blocks ago it was set. A `skipped`
  // exposure is not a completed one and cannot seed anything.
  for (const [, feedback] of allSorted) {
    for (const log of feedback.strength ?? []) {
      if (log.completion === 'skipped') continue;
      const load = log.weightKg;
      if (typeof load === 'number' && Number.isFinite(load) && load > 0) {
        lastRecordedLoadByExercise[log.exerciseName] = load;
      }
    }
  }

  // NO RECOVERY ANSWER IS NOT GOOD RECOVERY. An athlete who ticked sessions off
  // and never answered how they felt has told the app nothing about recovery,
  // and the contract progresses only when recovery IS good. Treating silence as
  // good is how a tired athlete gets loaded.
  const resolvedRecoveryGood = sawRecoveryAnswer && recoveryGood;

  const enoughCompleted =
    requiredStrengthSessions > 0 &&
    completedStrengthSessions >= Math.ceil(requiredStrengthSessions * QUALIFYING_COMPLETION_RATIO);

  return {
    completedStrengthSessions,
    recordedStrengthSessions,
    recoveryGood: resolvedRecoveryGood,
    lastRecordedLoadByExercise,
    qualifies: enoughCompleted && resolvedRecoveryGood,
  };
}

/**
 * EVERY STRENGTH ROW IS SEEDABLE. NOT every strength row may be INCREASED.
 *
 * Sam, 2026-08-16 (product close): *"Every strength exercise may restore its own
 * exact-exercise recorded load or receive its authored initial estimate,
 * including accessories and bodyweight exercises with athlete-added load.
 * Automatic load INCREASES remain limited to the approved progressable main and
 * secondary lifts."*
 *
 * ⚠ **THESE WERE ONE SCOPE UNTIL NOW, AND THAT WAS THE DEFECT.** The row filter
 * used `classifyProgressionEligibility` — the MAIN/SECONDARY test — to decide
 * what this module looked at, so an accessory was invisible to seeding as well
 * as to progression. Measured consequence: a Bicep Curl the athlete had loaded
 * came back at `0`, and an unseen one showed `0` instead of the authored
 * estimate that exists for it. **Two different questions were sharing one
 * predicate.**
 */
function seedableStrengthRows(workouts: readonly Workout[]): WorkoutExercise[] {
  const rows: WorkoutExercise[] = [];
  for (const workout of workouts) {
    if (workout.workoutType !== 'Strength' && workout.workoutType !== 'Mixed') continue;
    for (const exercise of workout.exercises ?? []) {
      if (!participatesInCounting(exercise)) continue;
      if (!(exercise.exercise?.name ?? '')) continue;
      rows.push(exercise);
    }
  }
  return rows;
}

/**
 * MAY THIS EXERCISE'S LOAD RISE ON ITS OWN?
 *
 * Main and secondary lifts only. An accessory restores and seeds an editable
 * load and then STAYS THERE until Sam separately rules an increment for it —
 * *"do not automatically increase unless separately ruled."*
 */
function mayAutomaticallyIncrease(exerciseName: string): boolean {
  return classifyProgressionEligibility(exerciseName) !== null;
}

/**
 * Decide every strength row's load for the block about to be stored.
 *
 * Pure. Takes the freshly built next-block workouts and the previous block's
 * signal; returns one decision per progressable row. Applying them is
 * `applyBlockBoundaryProgression`, so the DECISION can be asserted without a
 * workout tree and the APPLICATION can be asserted without re-deriving history.
 */
export function decideBlockBoundaryLoads(args: {
  history: BlockHistorySignal;
  nextBlockWorkouts: readonly Workout[];
  /**
   * Needed for PRIORITY 2 only — the authored anchor estimate is a function of
   * the athlete's own squat/bench answers. Absent means no estimate is
   * available, which falls to PRIORITY 3 (unset) rather than to a guess.
   */
  onboardingData?: OnboardingData;
}): BlockBoundaryLiftDecision[] {
  const { history, nextBlockWorkouts, onboardingData } = args;
  const seen = new Set<string>();
  const decisions: BlockBoundaryLiftDecision[] = [];

  for (const row of seedableStrengthRows(nextBlockWorkouts)) {
    const exerciseName = row.exercise?.name ?? '';
    if (seen.has(exerciseName)) continue;
    seen.add(exerciseName);

    const base = { exerciseId: row.exerciseId, exerciseName };

    const recorded = history.lastRecordedLoadByExercise[exerciseName];
    const previousLoadKg = typeof recorded === 'number' ? recorded : null;

    // ── PRIORITY 1 — THE EXACT EXERCISE'S OWN HISTORY OUTRANKS EVERYTHING ──
    // Sam, 2026-08-16: *"The athlete's recorded history for the EXACT canonical
    // exercise always outranks the initial squat/bench percentage estimate."*
    // Keyed by canonical NAME, over ALL TIME — which is what lets a lift that
    // sat out a block resume from its own number instead of being re-estimated.
    if (previousLoadKg !== null) {
      // ⚠ THIS RUNS FOR BODYWEIGHT EXERCISES TOO, AND MUST.
      // Sam, 2026-08-16 (final): *"when the exact exercise returns, its recorded
      // added-load history wins"* and *"loadRatio 0 ... never means the athlete
      // is forbidden from adding weight."* An earlier revision of this module
      // short-circuited every authored-bodyweight row BEFORE reading history,
      // which threw away exactly the weighted Pull-Up the athlete had recorded.
      //
      // THE ATHLETE'S NUMBER IS THE BASE, UNROUNDED. *"Never round, rewrite or
      // 'correct' the athlete's recorded number; their number remains the
      // base."* The increment is added to what they lifted, not to a
      // lattice-tidied version of it.
      const increment = mayAutomaticallyIncrease(exerciseName)
        ? smallestPracticalIncrementKg(exerciseName, previousLoadKg)
        : null;
      if (history.qualifies && increment !== null) {
        decisions.push({
          ...base,
          kind: 'history_progressed',
          previousLoadKg,
          nextLoadKg: previousLoadKg + increment,
          incrementKg: increment,
        });
      } else {
        // HOLD. Either recovery/completion did not earn a rise, or nothing
        // authored says what this load moves in. Both keep the recorded number
        // and leave the next choice to the athlete.
        decisions.push({
          ...base,
          kind: 'history_held',
          previousLoadKg,
          nextLoadKg: previousLoadKg,
        });
      }
      continue;
    }

    // ── NO HISTORY, AND AUTHORED AS UNLOADED — BW IS THE DEFAULT ──
    // *"Bodyweight is a default, not a prohibition."* The row keeps whatever its
    // own authored owner renders (BW / no additional external load). This module
    // writes nothing: the weight control stays, and the moment the athlete
    // records added load, PRIORITY 1 above picks it up on the next block.
    const authority = resolveLoadAuthority(exerciseName);
    if (authority.kind === 'bodyweight' || authority.kind === 'athlete_chosen') {
      decisions.push({
        ...base,
        kind: 'bodyweight_default',
        previousLoadKg: null,
        nextLoadKg: undefined,
      });
      continue;
    }

    // ── PRIORITY 2 — NEVER LOGGED: SAM'S AUTHORED ANCHOR ESTIMATE ──
    // `startingWeightForAthlete` reads EXERCISE_LOAD_MAP's squat/bench ratio
    // and the athlete's own answers. **It cannot see the outgoing exercise**,
    // which is precisely why it satisfies rule 4: there is no path by which a
    // replacement can be seeded from what it replaced. The `loadRatio` sibling
    // table is still not consulted anywhere in this module.
    const estimate = onboardingData
      ? startingWeightForAthlete(exerciseName, onboardingData)
      : null;
    if (typeof estimate === 'number' && Number.isFinite(estimate) && estimate > 0) {
      decisions.push({
        ...base,
        kind: 'authored_estimate',
        previousLoadKg: null,
        nextLoadKg: estimate,
      });
      continue;
    }

    // ── PRIORITY 3 — NOTHING HONEST TO SAY. THE ATHLETE CHOOSES. ──
    decisions.push({
      ...base,
      kind: 'unset',
      previousLoadKg: null,
      nextLoadKg: null,
    });
  }

  return decisions;
}

/**
 * Write the decisions onto the workouts that are about to be stored.
 *
 * UNSET IS ABSENCE — the key is deleted, not set to `0`.
 *
 * `WorkoutExercise.prescribedWeightKg` is `number | undefined`, so absence is
 * the type's own "no load decided". It is deliberately NOT `0`: generation's
 * placeholder for an undecided load IS `0` (measured — a freshly generated
 * block-2 Goblet Squat carries `weightKg=0`), and a screen cannot tell "you
 * choose" from "zero kilograms" when both are the same number. Deleting the key
 * is the only value that reads as unset to the type, to the UI and to JSON.
 */
export function applyBlockBoundaryProgression(args: {
  workouts: readonly Workout[];
  decisions: readonly BlockBoundaryLiftDecision[];
}): Workout[] {
  const { workouts, decisions } = args;
  const byName = new Map(decisions.map((decision) => [decision.exerciseName, decision]));

  return workouts.map((workout) => {
    if (workout.workoutType !== 'Strength' && workout.workoutType !== 'Mixed') return workout;
    let touched = false;
    const exercises = (workout.exercises ?? []).map((exercise) => {
      const decision = byName.get(exercise.exercise?.name ?? '');
      if (!decision) return exercise;
      // DO NOT TOUCH. An authored bodyweight/athlete-chosen row keeps whatever
      // its own owner decided — writing OR deleting here would both be wrong.
      if (decision.nextLoadKg === undefined) return exercise;
      touched = true;
      const { prescribedWeightKg: _dropped, ...withoutLoad } = exercise;
      return {
        ...withoutLoad,
        // Key absent when UNSET; a real number otherwise.
        ...(decision.nextLoadKg === null ? {} : { prescribedWeightKg: decision.nextLoadKg }),
      };
    });
    return touched ? { ...workout, exercises } : workout;
  });
}

/**
 * The athlete-facing explanation of what changed at the boundary and why.
 *
 * Returns the DECISIONS worth telling them about, most important first, as
 * structured rows. **Rendering them is the screen's job, not this module's** —
 * a rule that returns a sentence is a rule that owns copy, and copy has its own
 * signed-extraction gate.
 */
export interface BlockBoundaryExplanationRow {
  exerciseName: string;
  kind: BlockBoundaryDecisionKind;
  previousLoadKg: number | null;
  nextLoadKg: number | null | undefined;
  incrementKg?: number;
}

export function buildBlockBoundaryExplanation(
  decisions: readonly BlockBoundaryLiftDecision[],
): BlockBoundaryExplanationRow[] {
  const order: Record<BlockBoundaryDecisionKind, number> = {
    history_progressed: 0,
    history_held: 1,
    authored_estimate: 2,
    unset: 3,
    bodyweight_default: 4,
  };
  return [...decisions]
    .sort((a, b) => order[a.kind] - order[b.kind] || a.exerciseName.localeCompare(b.exerciseName))
    .map((decision) => ({
      exerciseName: decision.exerciseName,
      kind: decision.kind,
      previousLoadKg: decision.previousLoadKg,
      nextLoadKg: decision.nextLoadKg,
      ...(decision.incrementKg !== undefined ? { incrementKg: decision.incrementKg } : {}),
    }));
}
