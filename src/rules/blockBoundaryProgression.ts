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
 * ## THE TWO DECISIONS, AND THE ONE SAM RULED TWICE
 *
 * **RETAINED** — the same lift ran last block and history qualifies: seed its
 * last recorded load and add the smallest authorised increment (2.5 kg).
 *
 * **ROTATED** — the lift did not run last block: **the load is left UNSET and
 * the athlete chooses.** Sam, 2026-08-16, choosing option B: *"When an exercise
 * rotates, leave its starting load unset and let the athlete choose. Suggest a
 * conservative load only where an explicit, validated exercise-to-exercise load
 * mapping already exists—never infer one from the movement pattern, exercise
 * name or previous weight."* and, for this slice specifically, *"rotated lift →
 * no inherited load and no automatic estimate."*
 *
 * **THE `loadRatio` SIBLING TABLE IS EXACTLY THE MAPPING HE MEANS**
 * (`data/exercisePoolsStrength.ts` — `{ name: 'Deadlift', loadRatio: 1.00 }`),
 * and this slice still does not use it. His sentence licenses it in general and
 * forbids it here; a module that reached for it anyway because it "exists"
 * would be answering the general sentence and ignoring the specific one.
 * **`ROTATED_LOAD_STAYS_UNSET` below is that decision, in one place, so the day
 * the mapping is switched on there is one line to change and one guard to move.**
 *
 * ## WHY "IS IT A BARBELL" COMES FROM SAM'S SHEET, NOT FROM THE NAME
 *
 * The 2.5 kg increment is a BARBELL rule. Asking the exercise NAME whether it is
 * barbell work is precisely the name-inference Sam forbade in the same message,
 * and it is wrong in both directions (`Speed Trap Bar Deadlift` is not a
 * barbell; `DB Bench Press` contains "Bench Press"). `equipmentRequiredFor`
 * (`data/exerciseEquipmentRequirement.ts`) is Sam's own transcribed sheet and is
 * the only source consulted.
 *
 * ⚠ **AN OR-GROUP IS NOT BARBELL WORK.** `Romanian Deadlift` is
 * `[['barbell','dumbbells']]` — it MAY be run with a barbell, and a
 * dumbbell-only athlete legally runs it without one. Only a REQUIRED bare
 * `'barbell'` earns the barbell increment. Everything else HOLDS its load this
 * slice and is listed as a remaining clause rather than guessed at.
 */

import type { Workout, WorkoutExercise } from '../types/domain';
import type { SessionFeedback } from '../store/programStore';
import type { FeedbackFeeling, FeedbackSoreness } from '../types/sessionOutcome';
import { equipmentRequiredFor } from '../data/exerciseEquipmentRequirement';
import { participatesInCounting } from './sessionRowCounting';
import { classifyProgressionEligibility } from '../utils/strengthProgressionIntegration';

/**
 * THE SMALLEST AUTHORISED INCREMENT, in kilograms.
 *
 * Contract: *"For barbell work, the normal increase is the smallest practical
 * increment, usually 2.5 kg. Ten percent is an exceptional upper bound, not the
 * default."* This slice implements the normal case only; nothing here may ever
 * produce the exceptional one, which is why it is a constant and not a band.
 */
export const SMALLEST_AUTHORISED_INCREMENT_KG = 2.5;

/**
 * Sam's ruling of 2026-08-16, held as a constant so it is greppable and so the
 * guard that proves it names the same symbol the production path reads.
 * `true` = a rotated lift carries NO load and NO estimate.
 */
export const ROTATED_LOAD_STAYS_UNSET = true;

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
  /** Same lift as last block, history qualified: load seeded and incremented. */
  | 'retained_progressed'
  /** Same lift as last block, history did not qualify: load seeded, not raised. */
  | 'retained_held'
  /** New lift this block: no load, no estimate — the athlete chooses. */
  | 'rotated_unset'
  /** Same lift, but the increment rule does not cover its equipment yet. */
  | 'retained_uncovered_equipment';

export interface BlockBoundaryLiftDecision {
  exerciseId: string;
  exerciseName: string;
  kind: BlockBoundaryDecisionKind;
  /** The load recorded for this lift last block, when there was one. */
  previousLoadKg: number | null;
  /** What the next block stores. `null` means UNSET — the athlete chooses. */
  nextLoadKg: number | null;
  /** Present only on `retained_progressed`. */
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

function isBarbellRequired(exerciseName: string): boolean {
  const requirement = equipmentRequiredFor(exerciseName);
  if (!requirement) return false;
  // A bare 'barbell' is REQUIRED. A nested array is an OR-group, where the
  // athlete may legally be using something else — see the header.
  return requirement.some((entry) => entry === 'barbell');
}

/**
 * Reduce the persisted per-date `SessionFeedback` for one block to the signal.
 *
 * `blockStartISO`/`blockEndISO` are inclusive. Dates outside them are ignored,
 * which is what keeps block N+1's decision a read of block N and not of the
 * athlete's whole life.
 */
export function readBlockHistory(args: {
  feedbackByDate: Readonly<Record<string, SessionFeedback>>;
  blockStartISO: string;
  blockEndISO: string;
  /** Strength sessions the block asked for. Drives the 75% gate. */
  requiredStrengthSessions: number;
}): BlockHistorySignal {
  const { feedbackByDate, blockStartISO, blockEndISO, requiredStrengthSessions } = args;

  const inBlock = Object.entries(feedbackByDate)
    .filter(([dateStr]) => dateStr >= blockStartISO && dateStr <= blockEndISO)
    .sort(([a], [b]) => a.localeCompare(b));

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

    // Walk in date order so the LAST recorded load for a lift wins.
    for (const log of strengthLogs) {
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

function progressableStrengthRows(workouts: readonly Workout[]): WorkoutExercise[] {
  const rows: WorkoutExercise[] = [];
  for (const workout of workouts) {
    if (workout.workoutType !== 'Strength' && workout.workoutType !== 'Mixed') continue;
    for (const exercise of workout.exercises ?? []) {
      if (!participatesInCounting(exercise)) continue;
      const name = exercise.exercise?.name ?? '';
      if (!name) continue;
      if (!classifyProgressionEligibility(name)) continue;
      rows.push(exercise);
    }
  }
  return rows;
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
}): BlockBoundaryLiftDecision[] {
  const { history, nextBlockWorkouts } = args;
  const seen = new Set<string>();
  const decisions: BlockBoundaryLiftDecision[] = [];

  for (const row of progressableStrengthRows(nextBlockWorkouts)) {
    const exerciseName = row.exercise?.name ?? '';
    if (seen.has(exerciseName)) continue;
    seen.add(exerciseName);

    const previous = history.lastRecordedLoadByExercise[exerciseName];
    const previousLoadKg = typeof previous === 'number' ? previous : null;

    // ROTATED. No prior recorded load for THIS exercise means it did not run
    // last block (or ran and was never loaded). Either way there is nothing
    // this module is allowed to carry across, and it does not estimate.
    if (previousLoadKg === null) {
      decisions.push({
        exerciseId: row.exerciseId,
        exerciseName,
        kind: 'rotated_unset',
        previousLoadKg: null,
        nextLoadKg: ROTATED_LOAD_STAYS_UNSET ? null : null,
      });
      continue;
    }

    if (!history.qualifies) {
      decisions.push({
        exerciseId: row.exerciseId,
        exerciseName,
        kind: 'retained_held',
        previousLoadKg,
        nextLoadKg: previousLoadKg,
      });
      continue;
    }

    if (!isBarbellRequired(exerciseName)) {
      decisions.push({
        exerciseId: row.exerciseId,
        exerciseName,
        kind: 'retained_uncovered_equipment',
        previousLoadKg,
        nextLoadKg: previousLoadKg,
      });
      continue;
    }

    decisions.push({
      exerciseId: row.exerciseId,
      exerciseName,
      kind: 'retained_progressed',
      previousLoadKg,
      nextLoadKg: previousLoadKg + SMALLEST_AUTHORISED_INCREMENT_KG,
      incrementKg: SMALLEST_AUTHORISED_INCREMENT_KG,
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
      touched = true;
      const { prescribedWeightKg: _dropped, ...withoutLoad } = exercise;
      return {
        ...withoutLoad,
        // Absent when the decision is UNSET; a real number otherwise.
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
  nextLoadKg: number | null;
  incrementKg?: number;
}

export function buildBlockBoundaryExplanation(
  decisions: readonly BlockBoundaryLiftDecision[],
): BlockBoundaryExplanationRow[] {
  const order: Record<BlockBoundaryDecisionKind, number> = {
    retained_progressed: 0,
    retained_held: 1,
    retained_uncovered_equipment: 2,
    rotated_unset: 3,
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
