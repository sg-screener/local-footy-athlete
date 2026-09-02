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

import type { OnboardingData, SeasonPhase, Workout, WorkoutExercise } from '../types/domain';
import type { SessionFeedback } from '../store/programStore';
import type { FeedbackFeeling, FeedbackSoreness } from '../types/sessionOutcome';
import {
  normaliseAutomaticExerciseLoadChange,
  resolveLoadAuthority,
  resolveExerciseName,
  startingWeightForAthlete,
  resolveLoadControlMode,
} from '../utils/loadEstimation';
import { participatesInCounting } from './sessionRowCounting';
import { carriesStrengthComponent } from '../utils/sessionComponents';
import { classifyProgressionEligibility } from '../utils/strengthProgressionIntegration';
import type { ExerciseRole } from '../utils/progressionHelpers';
import {
  composeConditioningRows,
  selectConditioningTemplate,
  workoutTypeForTemplate,
} from './conditioningSelection';
import { CONDITIONING_TEMPLATES, type ConditioningModality } from '../data/conditioningTemplates';
import {
  nextAuthoredDose,
  type ConditioningNoStepReason,
  type ConditioningStep,
} from './conditioningDoseStep';
import { isEffortRating } from './effortScale';
import { slotCountsTowardSetBudget } from './weeklyProgrammingContract';
import { SET_CEILING } from './weeklyLegality';
import type { WeekKind } from '../types/domain';

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
 * lift silently held its load forever. The typed load lattice rules all of it —
 * barbell/cable/machine 2.5 kg steps, kettlebell 4 kg, dumbbells 1 kg to 10
 * then 2.5 kg rungs. R-313 adds the explicit external-load class for weighted
 * bodyweight work without changing the movement's equipment feasibility.
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
  const next = normaliseAutomaticExerciseLoadChange({
    exerciseName,
    baseKg,
    targetKg: baseKg + 1,
  });
  return next === null || next <= baseKg ? null : next - baseKg;
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
  | 'bodyweight_default'
  /**
   * R-343 (Sam, 2026-09-02): authored as unloaded, never logged with added
   * load, but completed at the TOP of its rep range in a qualifying block, and
   * the athlete can add external load to it (`bodyweight_plus`) — so the next
   * block suggests the lattice's smallest added load (BW + 2.5 kg for a
   * Pull-Up). From then on PRIORITY 1 governs it like any loaded lift.
   */
  | 'bodyweight_progressed';

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
  /**
   * THE THREE-WAY ANSWER. `recoveryGood` alone could not tell "the athlete said
   * it was brutal" from "the athlete said nothing", and those two want opposite
   * behaviour: one REDUCES the next block, the other holds it exactly where it
   * is. See `BlockRecoveryVerdict`.
   */
  recoveryVerdict: BlockRecoveryVerdict;
  /** Last recorded load per exercise NAME. Absent name = no recorded load. */
  lastRecordedLoadByExercise: Readonly<Record<string, number>>;
  /**
   * Last recorded PRESCRIBED set count per exercise NAME — what the app asked
   * the athlete to do, not what it thinks they did.
   *
   * ⚠ **THIS IS A PROGRAM FACT, NOT A COMPLETION INFERENCE.**
   * `StrengthExercisePerformanceLog.prescribedSets` is written by the app from
   * its own prescription when the session is logged. The contract's ban is on
   * claiming to know *which sets were completed* — `completedSets` — and this
   * module still does not read that field. The difference matters: "your main
   * lift was programmed at four sets" is something the app knows for certain,
   * and it is the only place block 1's four-set main lift survives into block 2.
   */
  lastRecordedPrescribedSetsByExercise: Readonly<Record<string, number>>;
  /**
   * R-343 (Sam, 2026-09-02): the exact exercises the athlete completed IN THIS
   * BLOCK at the top of their prescribed rep range, proven by real logged sets
   * (`actualReps >= prescribedRepsMax`, non-skipped, full completion). A
   * session merely marked complete says nothing about reps and is not here —
   * the same line the load-moved sentence already holds.
   */
  topOfRangeCompletedByExercise: Readonly<Record<string, true>>;
  /**
   * THE SAME QUESTION, ASKED SEPARATELY OF EACH QUALITY.
   *
   * The contract's "High readiness and low soreness" section gives three
   * different answers depending on WHICH quality the athlete is tolerating —
   * *"strength easy, conditioning difficult"*, *"conditioning easy, strength
   * difficult"*, *"everything consistently easy"* — and one block-level verdict
   * cannot tell them apart. See `QualityRecoveryVerdicts` for what each half is
   * allowed to read.
   *
   * ⚠ **IT DOES NOT REPLACE `recoveryVerdict` AND MUST NOT.** That verdict is
   * R-098's reduction trigger and is deliberately left exactly as it was; this
   * is an ADDITIONAL, narrower read that only the ladder consults.
   */
  byQuality: QualityRecoveryVerdicts;
  /** True when there is enough completed, well-recovered work to progress on. */
  qualifies: boolean;
  /**
   * True when the athlete told the app the block was very hard, recovery was
   * low or soreness was high. Drives the reduction, and is deliberately NOT
   * `!qualifies` — see `BlockRecoveryVerdict`.
   */
  reduces: boolean;
}

/**
 * WHAT THE ATHLETE SAID ABOUT THE BLOCK THAT JUST ENDED.
 *
 * ⚠ **THREE ANSWERS, BECAUSE TWO WERE DOING THREE JOBS.** `recoveryGood: false`
 * used to mean both *"they reported it was brutal"* and *"they never answered"*,
 * and the approved contract gives those opposite treatments — the first REDUCES
 * the next block, the second holds it unchanged. Collapsing them would either
 * cut a silent athlete's programme for no stated reason, or leave a cooked one
 * on the same volume.
 *
 * `unknown` therefore behaves exactly as it did before this slice: hold the
 * load, change no volume. Only `very_hard` is new behaviour.
 */
export type BlockRecoveryVerdict =
  /** Every recovery answer came back inside the good band. */
  | 'good'
  /** At least one answer was `very_hard` effort or `high` soreness. */
  | 'very_hard'
  /** No recovery answer at all, or answers outside the good band but not the hard band. */
  | 'unknown';

/**
 * WHAT THE ATHLETE SAID ABOUT EACH QUALITY, SEPARATELY — and the two recorded
 * fields that are allowed to answer.
 *
 * ## ⚠ THE SESSION FEELING CANNOT ANSWER THIS ON ITS OWN
 *
 * Measured at `3b5b59d0` over 24 athlete worlds (16 built): a generated week has
 * **144 strength-only days, 64 combined days and ZERO conditioning-only days** —
 * conditioning always rides a strength day as an attached component. So on a
 * combined day `feeling` answers *"how was the session"* and there is no honest
 * way to split that between the squats and the intervals.
 *
 * ## THE TWO FIELDS
 *
 * **CONDITIONING → `SessionFeedback.conditioning.rpe`.** It is the CONDITIONING
 * RPE input on the feedback panel (`SessionFeedbackPanel.tsx:1412`, written at
 * `:850`) and is never written from a strength answer. Measured: the
 * `aerobic_base` component generation actually emits returns
 * `getConditioningLoggingConfig → level 'trackable'` with `rpe` among its
 * fields, so the input is on the screen for the work the athlete is given.
 *
 * **STRENGTH → `feeling` / `soreness`, on a date carrying strength logs and NO
 * conditioning log.** That is the only date whose session answer is
 * unambiguously about lifting, and there are plenty of them.
 *
 * ⚠ **`SessionFeedback.difficulty` IS DELIBERATELY NOT READ.**
 * `SessionFeedbackPanel.tsx:911` writes it as
 * `executionSummary ? sessionRpeValue : conditioningRpeValue` — the field does
 * not say which question it answered, so using it would be inventing a signal
 * out of two.
 *
 * ## AND NO SECOND SCALE IS MINTED
 *
 * `HARD_EFFORT_RATING` maps the 1-10 RPE onto the SAME words the feeling bands
 * already use. See its own note.
 */
export interface QualityRecoveryVerdicts {
  strength: BlockRecoveryVerdict;
  conditioning: BlockRecoveryVerdict;
  /**
   * How many dates actually carried an answer for each quality. Returned
   * because "unknown" has two causes — no answer, or answers outside both
   * bands — and a caller reporting on the athlete must be able to say which.
   */
  strengthAnswerDays: number;
  conditioningAnswerDays: number;
  /**
   * *"EVERYTHING CONSISTENTLY EASY"* — the contract's third case, and the ONLY
   * one that reaches the ladder's third rung.
   *
   * `good` is not this. The good band runs `very_easy | easy | good | hard`, and
   * an athlete finding sessions `hard` is training exactly as intended — load
   * and a set are the right answer for them. The offer of an extra SESSION is
   * for the athlete whose answers sit at the bottom of the scale, where the
   * small rungs are demonstrably insufficient rather than merely available.
   *
   * True only when there was an answer AND every answer was in the easy band —
   * silence is not ease, for the same reason silence is not good recovery.
   */
  strengthEasy: boolean;
  conditioningEasy: boolean;
}

/**
 * THE RPE THAT MEANS *"very hard"* — 8, AND IT IS NOT A NEW POLICY NUMBER.
 *
 * `rules/effortScale.ts` is Sam's signed 1-10 vocabulary (2026-08-12) and it
 * names `7 — hard` and `8 — very hard`. The feeling bands above already put
 * `hard` in the GOOD set and `very_hard` in the HARD set. So 8 is where the
 * effort scale's own word crosses into the band this module already treats as
 * hard — the two vocabularies are joined by the WORD, not by a threshold
 * somebody chose here.
 *
 * A second, differently-drawn RPE band would be exactly the two-owners defect
 * the effort scale was written to end.
 */
export const HARD_EFFORT_RATING = 8;

/**
 * THE TOP OF THE EASY BAND — 6, AND THE DELOAD LAW PUT IT THERE.
 *
 * `rules/effortScale.ts` records Sam's own correction: *"my deload law says RPE
 * 5-6 is easy"*, aligned against `deloadWeekRules.ts:39` — *"Every set easy —
 * RPE 5-6"*. So 6 is the highest rating the app already calls easy, and the
 * ladder does not get to draw its own line.
 */
export const EASY_EFFORT_RATING = 6;

/**
 * The feelings and soreness levels that mean *"consistently easy"*.
 *
 * ⚠ **A STRICT SUBSET OF THE GOOD BAND, AND THAT IS THE POINT.** `good` and
 * `hard` are legal, well-recovered answers that buy load and a set; they do NOT
 * buy a fourth training day. Typed, so a new level added to the vocabulary is a
 * compile error here rather than a silent "not easy".
 */
const EASY_BLOCK_FEELINGS: ReadonlySet<FeedbackFeeling> =
  new Set<FeedbackFeeling>(['very_easy', 'easy']);
const EASY_BLOCK_SORENESS: ReadonlySet<FeedbackSoreness> =
  new Set<FeedbackSoreness>(['none', 'mild']);

export const EMPTY_BLOCK_HISTORY: BlockHistorySignal = {
  completedStrengthSessions: 0,
  recordedStrengthSessions: 0,
  recoveryGood: false,
  recoveryVerdict: 'unknown',
  byQuality: {
    strength: 'unknown',
    conditioning: 'unknown',
    strengthAnswerDays: 0,
    conditioningAnswerDays: 0,
    strengthEasy: false,
    conditioningEasy: false,
  },
  lastRecordedLoadByExercise: {},
  lastRecordedPrescribedSetsByExercise: {},
  topOfRangeCompletedByExercise: {},
  qualifies: false,
  reduces: false,
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
 * The answers that mean *"completed, but very hard"* — the contract's own state.
 *
 * TYPED FOR THE SAME REASON THE GOOD SETS ARE: a new effort or soreness level
 * must be a COMPILE error here rather than silently landing outside the hard
 * band, which would look like a working rule while an athlete reporting the new
 * worst answer got no reduction at all.
 *
 * ⚠ **`high` IS THE TOP OF THE SORENESS SCALE.** The vocabulary is
 * `none | mild | moderate | high` — there is no `severe`, and a fixture written
 * with one type-errors but still RUNS under sucrase, where it reads as "not in
 * the good set" and looks like a passing guard.
 */
const HARD_BLOCK_FEELINGS: ReadonlySet<FeedbackFeeling> =
  new Set<FeedbackFeeling>(['very_hard']);
const HARD_BLOCK_SORENESS: ReadonlySet<FeedbackSoreness> =
  new Set<FeedbackSoreness>(['high']);

/**
 * THE STRENGTH SESSIONS AN ACCEPTED BLOCK ACTUALLY REQUIRED OF THE ATHLETE.
 *
 * **Sam ruled this, 2026-08-17:** *"The completion denominator must be the
 * required strength sessions in the accepted block the athlete actually
 * received—not requested gym availability and not a recalculated planning
 * target. Give that block-specific delivered requirement one durable owner at
 * block acceptance, and make rollover and restart read the same value. Do not
 * add a fallback to either of the two refuted numbers."*
 *
 * ## THE TWO REFUTED NUMBERS, SO NEITHER COMES BACK
 *
 * Both were measured on a real journey athlete (`test:athlete-journey`); neither
 * is a hypothetical.
 *
 * 1. **`plan.coreSessions * WEEKS_PER_BLOCK` = 12.** Requested gym availability.
 *    The athlete asked for three gym days; Friday is protected as G-1 before
 *    their Saturday game, so the app gave two. They completed 7 of the 8 offered,
 *    recovery read `good`, and the gate compared 7 against `ceil(12 * 0.75) = 9`.
 *    **Every continuing lift held, silently** — the boundary ran, read their real
 *    125 kg, and wrote 125 kg back.
 * 2. **`weeklyExposureContract.strength.targetCount * WEEKS_PER_BLOCK` = 12.** A
 *    recalculated planning target. It reads 3 while the accepted week ships 2, so
 *    the plan is not the block the athlete received.
 *
 * **There is no fallback here and there must never be one.** An absent
 * requirement returns 0, `readBlockHistory`'s `requiredStrengthSessions > 0`
 * fails, and nothing progresses — which is the truthful answer for block 1 and
 * for a speculative probe, both of which have no accepted previous block. A
 * fallback would restore one of the numbers above on exactly the path that lacks
 * the fact, which is the path where it is most wrong.
 *
 * ## WHY IT IS DERIVED HERE AND STORED, RATHER THAN DERIVED AT READ TIME
 *
 * This is the ONE place the count can be taken: at acceptance the accepted
 * program is in hand. It cannot be re-derived later, and re-deriving it was
 * measured fatal. `quiescentBoot` regenerates with **`previousProgram: null`**
 * (`quiescentBoot.ts:538`) and its clean slate nulls `blockState`, so a read-time
 * count returns 0 on every app launch and **every load the boundary raised would
 * be un-raised the next time the athlete opened the app** — the defect
 * `test:block-two-boot-preservation` exists to catch. Caught by a control run at
 * base, not by reasoning.
 *
 * So the requirement is a recorded FACT about a block that happened, in the same
 * family as `generationAnchorISO`: *"One home, one value, read off the program:
 * never a caller's idea of today"* (`programStore.setCurrentProgram`). It is not
 * derived state pretending to be an input — the block it describes is gone by the
 * time anyone asks.
 *
 * ## WHAT IS COUNTED
 *
 * Sessions that could have PRODUCED a strength log, because that is what
 * `readBlockHistory` counts on the other side of the ratio: it increments
 * `recordedStrengthSessions` only for a feedback day carrying non-empty
 * `strength` logs. A workout with no counted strength row can never be a
 * completed strength session, so including it would deflate the athlete's rate
 * against work that was never loggable.
 *
 * ⚠ **A `Workout` HAS `dayOfWeek`, NOT A DATE** — the date lives on the
 * microcycle. The window is applied to `microcycle.startDate`, and a reader that
 * looked for `workout.date` would find nothing and return 0, which reads exactly
 * like "this athlete was programmed no work".
 */
export function deriveAcceptedBlockStrengthRequirement(args: {
  program: { microcycles?: readonly {
    startDate: string; workouts?: readonly Workout[];
  }[] } | null | undefined;
  /** Inclusive, and compared against each microcycle's own start date. */
  blockStartISO: string;
  blockEndISO: string;
}): number {
  let count = 0;
  for (const microcycle of args.program?.microcycles ?? []) {
    const weekStart = String(microcycle.startDate ?? '').slice(0, 10);
    if (!weekStart) continue;
    if (weekStart < args.blockStartISO || weekStart > args.blockEndISO) continue;
    for (const workout of microcycle.workouts ?? []) {
      // ── THE DENOMINATOR IS COMPONENT-AWARE, NOT TYPE-AWARE (Sam, 2026-08-20) ──
      //
      // *"Club training must not erase the completed gym component from the
      // commitment/completion denominator. Guard both sides of that ratio so
      // generation and later block-history evaluation use the same
      // component-aware count."*
      //
      // This used to gate on `workoutType`, which files a gym session that
      // shares a date with club training as `Team Training` and skipped it. The
      // NUMERATOR is `readBlockHistory`'s count of days carrying strength logs,
      // and `buildStrengthPerformanceLogs` carried the identical `workoutType`
      // gate — so both sides were wrong together, agreed with each other, and
      // credited a twice-a-week athlete once. `carriesStrengthComponent` is the
      // shared answer both now ask.
      if (!carriesStrengthComponent(workout)) continue;
      count += 1;
    }
  }
  return count;
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
  let sawHardAnswer = false;
  const lastRecordedLoadByExercise: Record<string, number> = {};
  const lastRecordedPrescribedSetsByExercise: Record<string, number> = {};
  const topOfRangeCompletedByExercise: Record<string, true> = {};

  // ── THE PER-QUALITY READ, RUN OVER THE SAME WINDOW ──
  // Separate accumulators, on purpose: the block-level verdict below counts a
  // combined day's feeling and this one does not, and folding them would make
  // one of the two answers wrong.
  let strengthQualityGood = true;
  let sawStrengthQualityAnswer = false;
  let sawStrengthQualityHard = false;
  let strengthAnswerDays = 0;
  let conditioningQualityGood = true;
  let sawConditioningQualityAnswer = false;
  let sawConditioningQualityHard = false;
  let conditioningAnswerDays = 0;
  // "EVERYTHING CONSISTENTLY EASY" — tracked separately from "good", because the
  // good band includes `hard`, which is a session working as intended.
  let strengthAllEasy = true;
  let conditioningAllEasy = true;

  for (const [, feedback] of inBlock) {
    // CONDITIONING — its own input, on any date that carries one.
    const conditioningRpe = feedback.conditioning?.rpe;
    if (isEffortRating(conditioningRpe)) {
      conditioningAnswerDays++;
      sawConditioningQualityAnswer = true;
      if (conditioningRpe >= HARD_EFFORT_RATING) {
        conditioningQualityGood = false;
        sawConditioningQualityHard = true;
      }
      if (conditioningRpe > EASY_EFFORT_RATING) conditioningAllEasy = false;
    }

    /**
     * STRENGTH — assessed INDEPENDENTLY of the conditioning on the same day.
     *
     * **Sam ruled it, 2026-08-18:** *"Strength and conditioning on a combined day
     * must be assessed independently. If the athlete reports both components easy,
     * that day may contribute to both the strength-easy and conditioning-easy
     * evidence. Do not require a strength-only day."*
     *
     * This read used to require `!carriesConditioning`, and the reason was real:
     * `feeling` and `soreness` are SESSION-level answers, so on a combined day
     * there was no telling whether "hard" meant the lifting or the running. The
     * guard resolved that ambiguity by discarding the day.
     *
     * ⚠ **BUT THE AMBIGUITY ONLY EXISTS WHILE THE CONDITIONING IS UNACCOUNTED
     * FOR.** When the athlete answers the conditioning RPE, that component has its
     * own explicit evidence, and the session-level answer is then attributable to
     * the strength — which is exactly what "assessed independently" means. A
     * combined day with NO conditioning answer stays ambiguous and is still
     * discarded, so the original protection is intact where it was actually
     * needed.
     *
     * **MEASURED, and it is why the extra-session offer was unreachable.** A
     * pre-season athlete whose two gym days are combined days could reach
     * `strengthEasy` only by leaving the conditioning question blank, and
     * `conditioningEasy` only by answering it — never both, whatever they did. The
     * offer requires both, so it could not fire for any athlete of that shape no
     * matter how easy they found their training.
     */
    const carriesStrength = (feedback.strength ?? []).length > 0;
    const carriesConditioning = feedback.conditioning !== undefined;
    const conditioningAccountedFor = isEffortRating(feedback.conditioning?.rpe);
    if (carriesStrength && (!carriesConditioning || conditioningAccountedFor)) {
      let answered = false;
      if (feedback.feeling !== undefined) {
        answered = true;
        if (!GOOD_RECOVERY_FEELINGS.has(feedback.feeling)) strengthQualityGood = false;
        if (HARD_BLOCK_FEELINGS.has(feedback.feeling)) sawStrengthQualityHard = true;
        if (!EASY_BLOCK_FEELINGS.has(feedback.feeling)) strengthAllEasy = false;
      }
      if (feedback.soreness !== undefined) {
        answered = true;
        if (!GOOD_RECOVERY_SORENESS.has(feedback.soreness)) strengthQualityGood = false;
        if (HARD_BLOCK_SORENESS.has(feedback.soreness)) sawStrengthQualityHard = true;
        if (!EASY_BLOCK_SORENESS.has(feedback.soreness)) strengthAllEasy = false;
      }
      if (answered) {
        strengthAnswerDays++;
        sawStrengthQualityAnswer = true;
      }
    }
  }

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
      if (HARD_BLOCK_FEELINGS.has(feedback.feeling)) sawHardAnswer = true;
    }
    if (feedback.soreness !== undefined) {
      sawRecoveryAnswer = true;
      if (!GOOD_RECOVERY_SORENESS.has(feedback.soreness)) recoveryGood = false;
      if (HARD_BLOCK_SORENESS.has(feedback.soreness)) sawHardAnswer = true;
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
        lastRecordedLoadByExercise[resolveExerciseName(log.exerciseName)] = load;
      }
    }
  }

  // ── THE PRESCRIBED SET COUNT IS READ OVER THE BLOCK, NOT OVER ALL TIME ──
  //
  // ⚠ **AND THAT ASYMMETRY WITH LOADS IS DELIBERATE.** A load is a property of
  // the ATHLETE that survives the exercise sitting out a block — Sam's *"a
  // returning exercise keeps its own history"*. A set count is a property of the
  // BLOCK that prescribed it: "your main lift was four sets" is a statement
  // about the block that just ended, and reading it over all time would let a
  // four-set prescription from six months ago drive today's reduction.
  for (const [, feedback] of inBlock) {
    for (const log of feedback.strength ?? []) {
      if (log.completion === 'skipped') continue;
      const sets = log.prescribedSets;
      if (typeof sets === 'number' && Number.isFinite(sets) && sets > 0) {
        lastRecordedPrescribedSetsByExercise[resolveExerciseName(log.exerciseName)] = sets;
      }
    }
  }

  // ── R-343: TOP OF THE RANGE, PROVEN BY LOGGED SETS ──
  // `actualReps` is the builder's conservative minimum across the logged
  // working sets, so "every set reached the top" is what this records. No
  // per-set detail, no claim.
  for (const [, feedback] of inBlock) {
    for (const log of feedback.strength ?? []) {
      if (log.completion !== 'full') continue;
      const top = log.prescribedRepsMax;
      if (typeof log.actualReps !== 'number' || !Number.isFinite(top) || top <= 0) continue;
      if (log.actualReps >= top) {
        topOfRangeCompletedByExercise[resolveExerciseName(log.exerciseName)] = true;
      }
    }
  }

  // NO RECOVERY ANSWER IS NOT GOOD RECOVERY. An athlete who ticked sessions off
  // and never answered how they felt has told the app nothing about recovery,
  // and the contract progresses only when recovery IS good. Treating silence as
  // good is how a tired athlete gets loaded.
  const resolvedRecoveryGood = sawRecoveryAnswer && recoveryGood;

  // ⚠ THE HARD ANSWER OUTRANKS THE GOOD ONE, NOT THE OTHER WAY ROUND.
  // A block where eleven sessions felt fine and one was `very_hard` is a block
  // the athlete told us was very hard. Requiring EVERY answer to be hard would
  // make the reduction unreachable for any real athlete, and the failure would
  // be silent — the rule would look built and never fire.
  const recoveryVerdict: BlockRecoveryVerdict = sawHardAnswer
    ? 'very_hard'
    : (resolvedRecoveryGood ? 'good' : 'unknown');

  const enoughCompleted =
    requiredStrengthSessions > 0 &&
    completedStrengthSessions >= Math.ceil(requiredStrengthSessions * QUALIFYING_COMPLETION_RATIO);

  // THE SAME THREE-WAY SHAPE AS THE BLOCK VERDICT, FOR THE SAME REASON:
  // silence must not read as "it went well" for either quality.
  const verdictOf = (hard: boolean, answered: boolean, good: boolean): BlockRecoveryVerdict =>
    (hard ? 'very_hard' : (answered && good ? 'good' : 'unknown'));

  return {
    completedStrengthSessions,
    recordedStrengthSessions,
    recoveryGood: resolvedRecoveryGood,
    recoveryVerdict,
    byQuality: {
      strength: verdictOf(sawStrengthQualityHard, sawStrengthQualityAnswer, strengthQualityGood),
      conditioning: verdictOf(
        sawConditioningQualityHard, sawConditioningQualityAnswer, conditioningQualityGood,
      ),
      strengthAnswerDays,
      conditioningAnswerDays,
      // SILENCE IS NOT EASE. An athlete who never answered has not told the app
      // their training is too small, and an unanswered block must never buy a
      // fourth training day.
      strengthEasy: sawStrengthQualityAnswer && strengthAllEasy,
      conditioningEasy: sawConditioningQualityAnswer && conditioningAllEasy,
    },
    lastRecordedLoadByExercise,
    lastRecordedPrescribedSetsByExercise,
    topOfRangeCompletedByExercise,
    qualifies: enoughCompleted && recoveryVerdict === 'good',
    // ⚠ NO COMPLETION GATE ON THE REDUCTION, AND THAT IS THE CONTRACT'S SHAPE.
    // Its "Low readiness or high soreness" section states the reduction order
    // with no attendance condition attached — a cooked athlete is a cooked
    // athlete whether they finished the block or not. Attendance is the OTHER
    // question (the missed-session ask), and answering both with one gate is
    // how one predicate ends up doing two jobs.
    reduces: recoveryVerdict === 'very_hard',
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
/**
 * ⚠ **READ THE PARTS, NEVER THE DAY'S LABEL** (Sam, 2026-08-26, verbatim: *"it
 * should be considered team training and strength like 2 separate things just
 * on the same fucking day"*).
 *
 * A club night stores ONE workout typed `'Team Training'` whose row list
 * carries the club session (role `team_training`, exempt from counting) AND the
 * app-authored strength component (counted roles). The old filter here read the
 * DAY'S label — `Strength`/`Mixed` only — so every lift riding a club night got
 * no load decision at all. Measured over a simulated year: a fully compliant
 * athlete's bench stayed at 67.5 kg from the day upper strength moved onto club
 * nights (pre-season entry) to season's end, and `progressedFromOwnHistory`
 * being permanently false forced every main lift to rotate every block.
 *
 * `participatesInCounting` is the row-level fence that makes this safe: club
 * rows, conditioning, mobility and power are role-exempt, so widening to Team
 * Training days admits exactly the strength component and nothing else. Game /
 * Conditioning / Mobility / Recovery days stay out — they author no counted
 * strength rows this pass may seed.
 */
function seedableStrengthRows(workouts: readonly Workout[]): WorkoutExercise[] {
  const rows: WorkoutExercise[] = [];
  for (const workout of workouts) {
    if (workout.workoutType !== 'Strength'
      && workout.workoutType !== 'Mixed'
      && workout.workoutType !== 'Team Training') continue;
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
/**
 * ⚠ **THE `history_progressed` CONDITION, EXPORTED SO ROTATION READS IT RATHER
 * THAN COPYING IT.**
 *
 * `rules/blockExerciseSelection.ts` needs the contract's *"main and secondary lifts
 * may remain for a second consecutive block when progression, comfort and
 * technical continuity justify it"*. The mission is explicit that this is the
 * EXISTING progression decision, and the existing decision says exactly one
 * thing means "this athlete trained it and it earned a rise": the branch below
 * that emits `history_progressed`.
 *
 * Rotation cannot call `decideBlockBoundaryLoads` to ask — that function takes
 * `nextBlockWorkouts`, and rotation runs BEFORE those workouts exist, because it
 * is what decides which exercises are in them. So the condition is lifted here
 * and `decideBlockBoundaryLoads` calls it too. **One owner of the predicate, two
 * readers** — the alternative is the same rule written twice and drifting.
 */
/**
 * R-343: has this authored-unloaded lift EARNED its first added load?
 *
 * Three typed facts, all recorded: the athlete can add load to it at all
 * (`bodyweight_plus` — a Pull-Up, a Dip; never a Nordic), the block qualified
 * on completion and recovery exactly as a loaded rise does, and real logged
 * sets reached the top of the prescribed range for this exact exercise inside
 * the block. The lattice must also name a rung above zero. One owner; read by
 * the load decision and by rotation's "earned a rise" retention.
 */
export function bodyweightAddedLoadEarned(args: {
  exerciseName: string;
  history: BlockHistorySignal;
}): boolean {
  const canonical = resolveExerciseName(args.exerciseName);
  if (typeof args.history.lastRecordedLoadByExercise[canonical] === 'number') return false;
  if (resolveLoadControlMode(args.exerciseName) !== 'bodyweight_plus') return false;
  if (!args.history.qualifies) return false;
  if (args.history.topOfRangeCompletedByExercise[canonical] !== true) return false;
  if (!mayAutomaticallyIncrease(args.exerciseName)) return false;
  return smallestPracticalIncrementKg(args.exerciseName, 0) !== null;
}

export function progressedFromOwnHistory(args: {
  exerciseName: string;
  history: BlockHistorySignal;
}): boolean {
  const recorded = args.history.lastRecordedLoadByExercise[resolveExerciseName(args.exerciseName)];
  // R-343: a bodyweight lift that earned its first added load has progressed
  // from its own history too — rotation reads the same answer the load does.
  if (typeof recorded !== 'number') return bodyweightAddedLoadEarned(args);
  if (!args.history.qualifies) return false;
  if (!mayAutomaticallyIncrease(args.exerciseName)) return false;
  return smallestPracticalIncrementKg(args.exerciseName, recorded) !== null;
}

/**
 * WHAT LOAD A REPLACEMENT EXERCISE STARTS AT — one owner, two readers.
 *
 * **Sam's correction, 2026-08-18:** *"Do not make every replacement automatically
 * blank. The replacement exercise owns its load: 1. its own recorded
 * history/override; 2. otherwise its authored starting estimate; 3. otherwise
 * blank/bodyweight default. It must never inherit the outgoing exercise's load."*
 *
 * That is the SAME ladder `decideBlockBoundaryLoads` walks for a rotated-in lift,
 * so it is lifted here and both call it — the mid-block substitution door
 * (`replaceExerciseAtDate`) and the block boundary. The alternative is the rule
 * written twice and drifting, which is the defect class this repo fights.
 *
 * ⚠ **THE OUTGOING EXERCISE IS NOT AN INPUT AND CANNOT BE.** There is no
 * parameter by which the row being replaced could reach this function, which is
 * how *"Bench Press and Close-Grip Bench, RDL and Glute Bridge … remain separate"*
 * is held — by construction, not by a branch that chooses not to look.
 *
 * `undefined` means UNSET: the athlete chooses, and the weight control stays.
 */
/**
 * EVERY LOAD THE ATHLETE EVER LOGGED, BY CANONICAL NAME — the one map a fresh
 * estimate must lose to (Sam, 2026-09-03: "approve 2"). Read by the composer's
 * base load, the injury block's added rows and the injury swap alike.
 */
export function recordedLoadsFromFeedback(
  feedbackByDate: Readonly<Record<string, SessionFeedback>>,
): Readonly<Record<string, number>> {
  return readBlockHistory({
    feedbackByDate, blockStartISO: '0000-01-01', blockEndISO: '9999-12-31', requiredStrengthSessions: 0,
  }).lastRecordedLoadByExercise;
}

export function loadForReplacementExercise(args: {
  exerciseName: string;
  onboardingData?: OnboardingData | null;
  /** Every load this athlete has recorded, by exact canonical exercise name. */
  recordedLoadByExercise?: Readonly<Record<string, number>>;
}): number | undefined {
  const name = resolveExerciseName(args.exerciseName);
  if (!name) return undefined;

  // ── 1. ITS OWN RECORDED HISTORY WINS, ALWAYS ──
  // The exact-exercise load-ownership rule, untouched: a movement the athlete has
  // loaded before resumes at their number, however long ago they last did it.
  const recorded = args.recordedLoadByExercise?.[name];
  if (typeof recorded === 'number' && Number.isFinite(recorded) && recorded > 0) {
    return recorded;
  }

  // ── 2. AUTHORED AS UNLOADED — BW IS THE DEFAULT, NOT A PROHIBITION ──
  const authority = resolveLoadAuthority(name);
  if (authority.kind === 'bodyweight' || authority.kind === 'athlete_chosen') return undefined;

  // ── 3. SAM'S AUTHORED ANCHOR ESTIMATE, from the athlete's own answers ──
  const estimate = args.onboardingData
    ? startingWeightForAthlete(name, args.onboardingData)
    : null;
  if (typeof estimate === 'number' && Number.isFinite(estimate) && estimate > 0) return estimate;

  // ── 4. NOTHING HONEST TO SAY. THE ATHLETE CHOOSES. ──
  return undefined;
}

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
      const routeAllowsIncrease = row.section18Evidence?.slot !== 'shoulder_prehab';
      const increment = routeAllowsIncrease && mayAutomaticallyIncrease(exerciseName)
        ? smallestPracticalIncrementKg(exerciseName, previousLoadKg)
        : null;
      // The same predicate `blockExerciseSelection` reads, so the two can never drift.
      if (routeAllowsIncrease && progressedFromOwnHistory({ exerciseName, history }) && increment !== null) {
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
      // ── R-343: THE FIRST ADDED LOAD IS EARNED, NOT INVENTED ──
      // Sam, on the generated year's Pull-Ups sitting at BW for 52 weeks: the
      // athlete *"would add weight"*. The earning condition is the same shape
      // as PRIORITY 1's rise — a qualifying block — plus the one fact BW has
      // no load number to carry: real logged sets at the top of the range.
      const routeAllowsIncrease = row.section18Evidence?.slot !== 'shoulder_prehab';
      const firstIncrement = routeAllowsIncrease
        && bodyweightAddedLoadEarned({ exerciseName, history })
        ? smallestPracticalIncrementKg(exerciseName, 0)
        : null;
      if (firstIncrement !== null) {
        decisions.push({
          ...base,
          kind: 'bodyweight_progressed',
          previousLoadKg: null,
          nextLoadKg: firstIncrement,
          incrementKg: firstIncrement,
        });
        continue;
      }
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
    // Club nights included — see seedableStrengthRows: the decision side reads
    // them now, so the apply side must reach the same rows (Sam, 2026-08-26).
    if (workout.workoutType !== 'Strength'
      && workout.workoutType !== 'Mixed'
      && workout.workoutType !== 'Team Training') return workout;
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

/* ══════════════════════════════════════════════════════════════════════════
 * COMPLETED, BUT VERY HARD — THE VOLUME THE NEXT BLOCK CARRIES
 *
 * The contract, verbatim: *"Keep meaningful load/intensity and reduce volume
 * first: reduce a four-set main lift to three sets; reduce secondary-lift sets
 * where necessary; reduce the number of hard conditioning sessions; replace
 * removed hard conditioning with easier aerobic work when the weekly
 * conditioning requirement still needs to be met."*
 *
 * ## ⚠ WHY THE BOUNDARY OWNS THIS AND NOT THE AUTHORING-TIME FREEZE
 *
 * The freeze already reduces a very-hard block, and **it reduces it to the wrong
 * numbers**. Measured at `6117a9fd`, same athlete, three histories differing
 * only in the recovery answers:
 *
 *     good / mild        Deadlift   3 × 4-6 @ 102.5
 *     very_hard / high   Deadlift   1 × 4-4 @ 100      ← every row, 3 → 1 sets
 *     very_easy / none   Deadlift   4 × 4-6 @ 102.5
 *
 * `drop_two` collapses every strength row to a single set and drags the rep
 * range down with it. **One set is not the contract's number and reps are not
 * on the contract's reduction list at all.** The freeze is the in-block
 * progression owner and stays that way; at a BLOCK BOUNDARY the approved
 * contract states the answer, so the boundary has the last word on volume
 * exactly as it already has the last word on load.
 *
 * ## WHAT IT DOES NOT TOUCH, AND WHY
 *
 * **REPS.** The contract's reduction list names sets and conditioning. Clause 7
 * of this mission forbids ADDING repetitions, and restoring the freeze's pulled
 * rep range would be exactly that. The rep answer is left where the freeze put
 * it, and a strained main lift therefore reads `3 × 4-4 @ 100 kg` — less total
 * work at a retained load, which is the contract's clause 4.
 *
 * **ACCESSORIES.** `classifyProgressionEligibility` returns null for them; they
 * are already at the bottom of the authored dose and the contract's reduction
 * order never reaches them.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * A four-set main lift becomes THREE. Sam's number, quoted in the contract's
 * "Completed but very hard" section and in this mission's clause A2.
 *
 * Written as a CEILING rather than a subtraction: *"reduce a four-set main lift
 * to three sets"* names the result, so a lift already at three stays at three
 * and one at two is not raised.
 */
export const HARD_BLOCK_MAIN_LIFT_SETS = 3;

/**
 * A secondary lift drops ONE set and stops at two.
 *
 * The floor is `setsMin` from every phase's authored band
 * (`MAIN_LIFT_REP_SCHEMES`, `LOADED_LOWER_SECONDARY`) — two is the smallest set
 * count Sam's sheet authorises for real work, so reducing past it would be this
 * module inventing a dose rather than spending an authored one.
 */
export const HARD_BLOCK_SECONDARY_SETS_FLOOR = 2;

export type BlockBoundaryVolumeKind =
  /** A main lift capped at `HARD_BLOCK_MAIN_LIFT_SETS`. */
  | 'main_lift_sets_reduced'
  /** A secondary lift down one set, floored. */
  | 'secondary_sets_reduced'
  /** Looked at, nothing to do — already at or below the contract's number. */
  | 'sets_unchanged';

export interface BlockBoundaryVolumeDecision {
  /**
   * THE ROW, NOT THE NAME. A decision keyed by exercise name would write one
   * answer over every week of the block — and week 4 is a DELOAD, whose set
   * count R-034 has already halved. One `Leg Press` decision spread by name
   * would undo the deload law in the act of obeying the contract.
   */
  rowId: string;
  exerciseName: string;
  role: ExerciseRole;
  /**
   * THE ATHLETE'S OWN RECORDED PRESCRIPTION for this exact exercise in the block
   * that just ended, when there is one; otherwise this week's authored dose.
   *
   * This is the field that carries block 1's four-set main lift into block 2.
   * The composer never authors four sets (`resolveComposedDose` clamps every
   * main lift to three) — four is what the freeze ADDS after an easy block, so
   * the only surviving record of it is the logged prescription.
   */
  previousSets: number;
  /**
   * ⚠ THE AUTHORED DOSE, READ BEFORE THE AUTHORING-TIME FREEZE SPENT IT.
   *
   * **NOT `row.prescribedSets`.** By the time the boundary runs, the freeze has
   * already collapsed a very-hard block's every row to a single set, so reading
   * the row would make the reduction's own ceiling the number it exists to
   * correct — a `min()` against 1 that can only ever return 1. Measured: with
   * the row as the ceiling, exactly ONE lift in the block moved (the one with
   * recorded history) and every other main lift stayed at one set.
   *
   * It is also the DELOAD's protection: in week 4 the authored dose is already
   * halved, and clamping to it keeps the reduction from raising a deload week.
   */
  authoredSets: number;
  nextSets: number;
  kind: BlockBoundaryVolumeKind;
}

/**
 * Decide every progressable strength row's set count for a block following a
 * very-hard one. Returns an EMPTY list for any other verdict — the boundary
 * writes no volume at all unless the athlete said the block was very hard.
 *
 * Pure, and split from its application for the same reason the load decision is:
 * the decision can be asserted without a workout tree and the application
 * without re-deriving history.
 */
export function decideBlockBoundaryVolume(args: {
  history: BlockHistorySignal;
  nextBlockWorkouts: readonly Workout[];
  /**
   * `WorkoutExercise.id` → the set count the composer authored for that row,
   * snapshotted before the authoring-time freeze ran. A row missing from the
   * map falls back to its current count, which is the honest answer for a row
   * the snapshot never saw.
   */
  authoredSetsByRowId: Readonly<Record<string, number>>;
}): BlockBoundaryVolumeDecision[] {
  const { history, nextBlockWorkouts, authoredSetsByRowId } = args;
  if (!history.reduces) return [];

  const decisions: BlockBoundaryVolumeDecision[] = [];

  for (const row of seedableStrengthRows(nextBlockWorkouts)) {
    const exerciseName = row.exercise?.name ?? '';
    const role = classifyProgressionEligibility(exerciseName);
    // Accessories and isolation work are not on the contract's reduction list.
    if (role === null) continue;

    const snapshot = authoredSetsByRowId[row.id];
    const authoredSets = typeof snapshot === 'number' ? snapshot : row.prescribedSets;
    const recorded = history.lastRecordedPrescribedSetsByExercise[exerciseName];
    const previousSets = typeof recorded === 'number' ? recorded : authoredSets;

    const target = role === 'primary_strength'
      ? Math.min(previousSets, HARD_BLOCK_MAIN_LIFT_SETS)
      : Math.max(previousSets - 1, HARD_BLOCK_SECONDARY_SETS_FLOOR);
    // TWO CEILINGS, AND BOTH ARE LOAD-BEARING. Never more than the athlete was
    // already doing, and never more than this week authored — the second is
    // what keeps a deload week deloaded.
    const nextSets = Math.min(target, previousSets, authoredSets);

    decisions.push({
      rowId: row.id,
      exerciseName,
      role,
      previousSets,
      authoredSets,
      nextSets,
      kind: nextSets === row.prescribedSets
        ? 'sets_unchanged'
        : (role === 'primary_strength' ? 'main_lift_sets_reduced' : 'secondary_sets_reduced'),
    });
  }

  return decisions;
}

/**
 * Write the volume decisions onto the workouts about to be stored.
 *
 * REPS, LOAD AND REST ARE UNTOUCHED. Only `prescribedSets` moves — the one
 * number the contract's reduction list names.
 */
export function applyBlockBoundaryVolume(args: {
  workouts: readonly Workout[];
  decisions: readonly BlockBoundaryVolumeDecision[];
}): Workout[] {
  const { workouts, decisions } = args;
  const byRowId = new Map(
    decisions
      .filter((decision) => decision.kind !== 'sets_unchanged')
      .map((decision) => [decision.rowId, decision]),
  );
  if (byRowId.size === 0) return [...workouts];

  return workouts.map((workout) => {
    // Club nights included — see seedableStrengthRows (Sam, 2026-08-26).
    if (workout.workoutType !== 'Strength'
      && workout.workoutType !== 'Mixed'
      && workout.workoutType !== 'Team Training') return workout;
    let touched = false;
    const exercises = (workout.exercises ?? []).map((exercise) => {
      const decision = byRowId.get(exercise.id);
      if (!decision) return exercise;
      if (exercise.prescribedSets === decision.nextSets) return exercise;
      touched = true;
      return { ...exercise, prescribedSets: decision.nextSets };
    });
    return touched ? { ...workout, exercises } : workout;
  });
}

/**
 * Every progressable strength row's authored set count, taken BEFORE the
 * authoring-time freeze runs.
 *
 * Lives here rather than at the call site so that "what the composer authored"
 * has one definition, and so the boundary's ceiling and the snapshot that feeds
 * it cannot come to disagree about which rows are in it.
 */
export function snapshotAuthoredSets(
  microcycles: readonly { workouts: readonly Workout[] }[],
): Record<string, number> {
  const snapshot: Record<string, number> = {};
  for (const microcycle of microcycles) {
    for (const row of seedableStrengthRows(microcycle.workouts)) {
      snapshot[row.id] = row.prescribedSets;
    }
  }
  return snapshot;
}

/* ═══ THE LADDER'S SECOND RUNG — ONE SET, WHEN LOAD DID NOT MOVE ═══════════ */

/**
 * THE PROGRESSION ORDER, AND WHY A SECOND RUNG HAD TO EXIST AT THE BOUNDARY.
 *
 * The approved contract: *"1. Increase load by the smallest practical
 * increment. 2. Add one set when more volume is appropriate and the session
 * remains inside its approved cap. 3. Add another session only when phase,
 * schedule and gym availability permit it, and after athlete confirmation."*
 *
 * ⚠ **THE IN-BLOCK FREEZE ALREADY ADDS SETS, AND IT ADDS THEM IN THE WRONG
 * ORDER.** `utils/progressionRules.ts` `buildBuildOutput` returns
 * `loadDelta: 'up'` **and** `setsDelta: 'add_one'` on the SAME lift in the SAME
 * rollover once there are three consecutive full completions, and
 * `buildOverreach` does the same. That is both rungs at once on one exercise,
 * which the contract's order forbids, and it is applied with no session set
 * ceiling anywhere in the path. **This module is the boundary's last word on a
 * set count exactly as `decideBlockBoundaryVolume` is** — R-098 gave the
 * boundary that authority for the reduction, and the addition answers to the
 * same owner rather than to a second one.
 *
 * ## WHAT IT WILL NOT DO
 *
 *   - **It never runs when the athlete is beaten up.** `history.reduces` returns
 *     an empty list before anything else is read: the contract's *"Do not add
 *     sessions or load in this state"*, applied to volume as well.
 *   - **It never runs on a quality the athlete found hard.** The strength half
 *     of `byQuality` must read `good`; that is *"strength easy, conditioning
 *     difficult: progress strength"* and its mirror image in one gate.
 *   - **It never touches a lift whose load this same rollover raised.**
 *     *"Do not increase load and sets on the same exercise in the same
 *     rollover"* — keyed by exercise NAME, because that is what "the same
 *     exercise" means across the sessions of one block.
 *   - **It never touches reps.** *"Do not add repetitions merely to manufacture
 *     progression."* Only `prescribedSets` moves, exactly as the reduction does.
 *   - **It never raises a deload week.** `weekKind === 'deload'` returns empty;
 *     R-034 owns that week's dose and this module does not get a vote.
 */

/** *"Add at most one set"* — the contract's own number, and the only one. */
export const LADDER_SET_ADDITION = 1;

/**
 * The ceiling the addition must respect, taken from the WEEK CONTRACT'S OWN
 * constant rather than re-declared here.
 *
 * WC-030, `rules/weeklyLegality.ts`: *"Prefer 12-15 main/secondary working sets;
 * 16 is a hard ceiling."*
 *
 * ⚠ **AND WC-030's WEEK-TIME CHECK DOES NOT MEASURE THIS.** It compares the
 * LAYOUT's declared ceiling against the contract's — `w.setsPerSession >
 * SET_CEILING` where `setsPerSession` is the layout's number — so no owner in
 * the app has ever counted an actual session's main/secondary sets. The ladder
 * is the first thing that can push a real session over the line, so it counts.
 */
export const LADDER_SESSION_SET_CEILING = SET_CEILING;

export interface BlockBoundarySetAdditionDecision {
  /** 0-based index of the microcycle the session sits in. */
  weekIndex: number;
  workoutId: string;
  /** THE ROW, not the name — see `BlockBoundaryVolumeDecision.rowId`. */
  rowId: string;
  exerciseName: string;
  role: ExerciseRole;
  fromSets: number;
  toSets: number;
  /** Counting sets in this session before and after. Stored so the ceiling is auditable. */
  sessionCountingSetsBefore: number;
  sessionCountingSetsAfter: number;
}

/**
 * The main/secondary working sets in one session, counted the way WC-030 counts
 * them.
 *
 * ⚠ **THE SLOT DECIDES, NEVER THE ROLE.** `slotCountsTowardSetBudget` is Sam's
 * own rule (*"Ab Wheel is outside that ceiling"*, *"Band Pull-Apart is accessory
 * work outside that count"*), and its input is the composer's declared slot,
 * which `materialiseComposedWeek` writes onto every row. A row with no slot —
 * legacy, or non-composed — counts for nothing, which is what
 * `slotCountsTowardSetBudget(undefined)` already answers.
 *
 * Exported so a guard can assert the ceiling directly rather than inferring it
 * from whether an addition happened.
 */
export function countMainSecondarySets(workout: Workout): number {
  let total = 0;
  for (const row of workout.exercises ?? []) {
    if (!slotCountsTowardSetBudget(row.section18Evidence?.slot)) continue;
    const sets = row.prescribedSets;
    if (typeof sets === 'number' && Number.isFinite(sets) && sets > 0) total += sets;
  }
  return total;
}

/**
 * Decide the ONE set this session may gain, or nothing.
 *
 * Pure, and split from its application for the same reason the load and volume
 * decisions are.
 *
 * ⚠ **ONE SET PER SESSION, NOT ONE PER ELIGIBLE LIFT.** The contract's rung is
 * *"add one set"* — singular — and a session with four eligible lifts gaining
 * four sets is a jump of four, not the smallest next step. The lift that gets it
 * is the session's first eligible MAIN lift in exercise order, and only if no
 * main lift is eligible does a secondary take it: the same priority the rest of
 * this module already gives `primary_strength` over `secondary_strength`.
 */
export function decideBlockBoundarySetAdditions(args: {
  history: BlockHistorySignal;
  nextBlockWorkouts: readonly Workout[];
  weekIndex: number;
  /** The block plan's statement about this week. A deload gets nothing. */
  weekKind?: WeekKind;
  /**
   * The LOAD decisions this same rollover already made. A lift that took the
   * first rung does not also take the second.
   */
  loadDecisions: readonly BlockBoundaryLiftDecision[];
  /**
   * ⚠ **THE AUTHORED DOSE, READ BEFORE THE FREEZE SPENT IT — AND IT IS LOAD-
   * BEARING HERE FOR A DIFFERENT REASON THAN IN `decideBlockBoundaryVolume`.**
   *
   * `utils/progressionRules.buildBuildOutput` ALREADY hands the authoring-time
   * freeze `setsDelta: 'add_one'` after three consecutive full completions. By
   * the time the boundary runs, that set is on the row. Adding to
   * `row.prescribedSets` would therefore hand a well-training athlete **two**
   * sets in one rollover while every comment in this file said one, and no cell
   * comparing against a silent control could see it — the control never got
   * either set.
   */
  authoredSetsByRowId: Readonly<Record<string, number>>;
  /**
   * IN-SEASON ADDS NO SETS (Bible §5/§16: in-season progression "should be
   * slower. The goal is mainly to maintain strength and stay fresh"; "Do not
   * chase high-rep lower-body soreness in-season"). Measured before this gate:
   * a compliant athlete's midweek squat grew 4×5-8 → 5×5-8 at week 36 of the
   * simulated year and held 5 sets to season's end — volume ratcheting in the
   * one phase whose law is maintain. Omitted/undefined keeps the old behaviour
   * for callers that do not know the phase.
   */
  seasonPhase?: SeasonPhase | null;
}): BlockBoundarySetAdditionDecision[] {
  const {
    history, nextBlockWorkouts, weekIndex, weekKind, loadDecisions, authoredSetsByRowId,
  } = args;
  if (args.seasonPhase === 'In-season') return [];

  // ── THE THREE STATE GATES, IN THE CONTRACT'S OWN ORDER ──
  //
  // *"When training is being completed and recovery is good"* — the same gate
  // the load rung answers to, and the same 75%.
  //
  // ⚠ **AND IT IS ALSO THE LOW-READINESS GATE. A SEPARATE `history.reduces`
  // CHECK STOOD HERE AND WAS DECORATION.** `reduces` is
  // `recoveryVerdict === 'very_hard'` and `qualifies` requires
  // `recoveryVerdict === 'good'`, so `reduces` STRICTLY IMPLIES `!qualifies` and
  // no world can reach the second check with the first one false. Mutation M1
  // deleted the `reduces` line and **all 41 cells stayed green** — three gates
  // were catching one fixture, which is the "two doors, one fixture" shape R-098
  // already paid for. The contract's *"Do not add sessions or load in this
  // state"* is enforced here, once, and the very-hard cell proves it.
  if (!history.qualifies) return [];
  // *"progress the quality the athlete is tolerating well"*. Sets are strength
  // volume, so the STRENGTH half must be the one reading good — not the block.
  if (history.byQuality.strength !== 'good') return [];
  // R-034 owns a deload's dose. Adding to it would be this module overruling a
  // signed law from outside its subject.
  if (weekKind === 'deload') return [];

  // "THE SAME EXERCISE", KEYED BY NAME. A block runs one exercise across several
  // sessions and the load decision is per exercise, not per row, so the ban has
  // to be per exercise too — otherwise Monday's Deadlift takes the load and
  // Friday's takes the set, which is both rungs on one lift in one rollover.
  const loadRaisedNames = new Set(
    loadDecisions
      .filter((decision) => decision.kind === 'history_progressed')
      .map((decision) => decision.exerciseName),
  );

  const decisions: BlockBoundarySetAdditionDecision[] = [];

  for (const workout of nextBlockWorkouts) {
    // Club nights included — see seedableStrengthRows (Sam, 2026-08-26).
    if (workout.workoutType !== 'Strength'
      && workout.workoutType !== 'Mixed'
      && workout.workoutType !== 'Team Training') continue;

    const before = countMainSecondarySets(workout);

    const eligible: { row: WorkoutExercise; role: ExerciseRole }[] = [];
    for (const row of workout.exercises ?? []) {
      if (!participatesInCounting(row)) continue;
      // The ceiling counts it, so the ladder may add to it — and nothing else.
      // An accessory or core row is outside the count and outside the rung.
      if (!slotCountsTowardSetBudget(row.section18Evidence?.slot)) continue;
      const exerciseName = row.exercise?.name ?? '';
      if (!exerciseName) continue;
      const role = classifyProgressionEligibility(exerciseName);
      if (role === null) continue;
      if (loadRaisedNames.has(exerciseName)) continue;
      eligible.push({ row, role });
    }
    if (eligible.length === 0) continue;

    const chosen = eligible.find((candidate) => candidate.role === 'primary_strength')
      ?? eligible[0];
    const exerciseName = chosen.row.exercise?.name ?? '';
    const currentSets = chosen.row.prescribedSets;
    if (typeof currentSets !== 'number' || !Number.isFinite(currentSets) || currentSets <= 0) {
      continue;
    }

    // ── WHAT "ONE MORE" IS ONE MORE THAN ──
    //
    // The SAME `previousSets` the reduction uses: the athlete's own recorded
    // prescription for this exact exercise in the block that just ended, and the
    // week's AUTHORED dose when there is none. Two owners of "how many sets was
    // this lift on" would be free to disagree about the same lift in the same
    // rollover, one adding and one reducing from different bases.
    //
    // It is also what lets the rung COMPOUND across blocks — the composer
    // re-authors three sets every block, so an athlete who earned four last block
    // would be handed three again and "progress" to four forever. Reading the
    // recorded prescription is what makes block 4 five sets, and it is a program
    // fact (what the app ASKED for), never a claim about what was completed.
    const authoredSets = authoredSetsByRowId[chosen.row.id];
    const recordedSets = history.lastRecordedPrescribedSetsByExercise[exerciseName];
    const previousSets = typeof recordedSets === 'number'
      ? recordedSets
      : (typeof authoredSets === 'number' ? authoredSets : currentSets);
    const toSets = previousSets + LADDER_SET_ADDITION;

    // NOTHING TO ADD IS NOT AN ADDITION. If the freeze already put the row at or
    // above the rung, the rung has been spent and this module writes nothing —
    // it must never REDUCE a row on the way to "adding" to it.
    if (toSets <= currentSets) continue;

    // ── THE CEILING, MEASURED ON THE RESULT ──
    // A session at 16 may not go to 17; a session at 15 may land exactly on 16.
    const after = before - currentSets + toSets;
    if (after > LADDER_SESSION_SET_CEILING) continue;

    decisions.push({
      weekIndex,
      workoutId: workout.id,
      rowId: chosen.row.id,
      exerciseName,
      role: chosen.role,
      fromSets: currentSets,
      toSets,
      sessionCountingSetsBefore: before,
      sessionCountingSetsAfter: after,
    });
  }

  return decisions;
}

/**
 * Write the set additions onto the workouts about to be stored.
 *
 * REPS, LOAD AND REST ARE UNTOUCHED — only `prescribedSets` moves, the mirror
 * image of `applyBlockBoundaryVolume`. *"Do not add repetitions merely to
 * manufacture progression"* is enforced by there being nothing here that could.
 */
export function applyBlockBoundarySetAdditions(args: {
  workouts: readonly Workout[];
  decisions: readonly BlockBoundarySetAdditionDecision[];
}): Workout[] {
  const { workouts, decisions } = args;
  const byRowId = new Map(decisions.map((decision) => [decision.rowId, decision]));
  if (byRowId.size === 0) return [...workouts];

  return workouts.map((workout) => {
    // Club nights included — see seedableStrengthRows (Sam, 2026-08-26).
    if (workout.workoutType !== 'Strength'
      && workout.workoutType !== 'Mixed'
      && workout.workoutType !== 'Team Training') return workout;
    let touched = false;
    const exercises = (workout.exercises ?? []).map((exercise) => {
      const decision = byRowId.get(exercise.id);
      if (!decision) return exercise;
      if (exercise.prescribedSets === decision.toSets) return exercise;
      touched = true;
      return { ...exercise, prescribedSets: decision.toSets };
    });
    return touched ? { ...workout, exercises } : workout;
  });
}

/* ── HARD CONDITIONING FALLS FIRST, AND IS REPLACED RATHER THAN REMOVED ── */

/**
 * THE HARD CONDITIONING CATEGORIES — the app's existing definition, not a new
 * one. `coachingEngine` already tests `vo2 || glycolytic || sprint` in two
 * places when it asks whether a day carries hard conditioning; `cod_decel`
 * joins them because `TIER_FOR_QUALITY` puts it in tier A with the sprint
 * family, and Sam calls COD *"cut first"*.
 *
 * `aerobic_base` and `tempo` are NOT here. Tempo is the app's own "TRUE medium
 * conditioning ... worked but composed" (`domain.ts`), and the contract reduces
 * HARD work before easy — so tempo is what remains, never what is cut.
 */
export const HARD_CONDITIONING_CATEGORIES: ReadonlySet<HardConditioningCategory> =
  new Set<HardConditioningCategory>(['sprint', 'vo2', 'glycolytic', 'repeat_sprint', 'cod_decel']);

export type HardConditioningCategory = 'sprint' | 'vo2' | 'glycolytic' | 'repeat_sprint' | 'cod_decel';

/**
 * The category a replaced session becomes.
 *
 * `aerobic_base` is the contract's *"approved easier aerobic work"* and is an
 * existing authored demand category with its own template pool — nothing new is
 * minted, and the replacement rows come from
 * `conditioningSelection.selectConditioningTemplate`, the one owner that is
 * allowed to choose a conditioning template.
 */
export const EASIER_AEROBIC_CATEGORY = 'aerobic_base' as const;

export interface BlockBoundaryConditioningDecision {
  /** 0-based index of the microcycle the session sits in. */
  weekIndex: number;
  workoutId: string;
  fromCategory: HardConditioningCategory;
  toCategory: typeof EASIER_AEROBIC_CATEGORY;
}

/**
 * Which conditioning sessions in the next block are hard, on a block the athlete
 * reported as very hard.
 *
 * ⚠ **IT REPLACES; IT NEVER DELETES.** The contract's clause 5 —
 * *"replace removed hard conditioning with easier aerobic work when the weekly
 * conditioning requirement still needs to be met"* — and this mission's clause
 * A6, *"preserve movement-pattern and safety requirements"*, together mean the
 * session stays in the week and changes its quality. Deleting it would take the
 * week below the §18 weekly conditioning minimum and the week would be refused,
 * which is not a reduction, it is a broken block.
 *
 * ⚠ **NO GENERATED WORLD REACHES THIS TODAY.** 48 athlete worlds were swept at
 * `6117a9fd` (3 phases × 2 training-day counts × 2 conditioning levels × 2
 * sprint exposures × club/no-club); every world that built carried ONLY
 * `aerobic_base` and `tempo`. The rule is wired into the real generation path
 * and guarded against constructed trees; making generation emit hard
 * conditioning is a scheduler change and is out of this mission's scope.
 */
export function decideBlockBoundaryConditioning(args: {
  history: BlockHistorySignal;
  nextBlockWorkouts: readonly Workout[];
  weekIndex: number;
}): BlockBoundaryConditioningDecision[] {
  const { history, nextBlockWorkouts, weekIndex } = args;
  if (!history.reduces) return [];

  const decisions: BlockBoundaryConditioningDecision[] = [];
  for (const workout of nextBlockWorkouts) {
    const category = workout.conditioningCategory;
    if (category === undefined) continue;
    if (!HARD_CONDITIONING_CATEGORIES.has(category as HardConditioningCategory)) continue;
    decisions.push({
      weekIndex,
      workoutId: workout.id,
      fromCategory: category as HardConditioningCategory,
      toCategory: EASIER_AEROBIC_CATEGORY,
    });
  }
  return decisions;
}

/**
 * Replace each decided hard conditioning session with easier aerobic work.
 *
 * ⚠ **THE TEMPLATE COMES FROM `selectConditioningTemplate` AND NOWHERE ELSE.**
 * That is the one owner allowed to choose a conditioning template — it applies
 * the kit filters, the role caps, the availability gates and the block-stable
 * rotation. This module names a CATEGORY and lets the owner answer; it does not
 * pick a session, and there is no name list in it.
 *
 * The rows are recomposed by `composeConditioningRows`, the same emitter
 * generation used, so the replacement row carries the authored dose text rather
 * than a re-authored one.
 */
export function applyBlockBoundaryConditioning(args: {
  workouts: readonly Workout[];
  decisions: readonly BlockBoundaryConditioningDecision[];
  /**
   * The week's start date, used as the selection seed and the row-id stem.
   *
   * ⚠ `Workout` CARRIES NO DATE — only `dayOfWeek`. The caller owns the grid, so
   * the caller states the day; deriving one here from a day number and an
   * assumed week start would be this module inventing a second calendar.
   */
  seedISO: string;
  /** Block-stable rotation input, same value generation passes. */
  miniCycleNumber?: number;
  /** The athlete's owned machines, when known — a kit filter, not a preference. */
  availableMachines?: readonly ConditioningModality[];
}): Workout[] {
  const { workouts, decisions, seedISO, miniCycleNumber, availableMachines } = args;
  const byWorkoutId = new Map(decisions.map((decision) => [decision.workoutId, decision]));
  if (byWorkoutId.size === 0) return [...workouts];

  return workouts.map((workout) => {
    const decision = byWorkoutId.get(workout.id);
    if (!decision) return workout;

    const existingRows = workout.exercises ?? [];
    const conditioningRows = existingRows.filter((row) => row.role === 'conditioning');
    // NOTHING TO REPLACE IS NOT AN ERROR AND IS NOT A SILENT SUCCESS EITHER.
    // A session tagged hard that carries no conditioning row has already lost
    // its content elsewhere; retagging it would make the store claim a swap it
    // did not perform, so the row is left exactly as found.
    if (conditioningRows.length === 0) return workout;

    const dateStr = seedISO;
    const standalone = workout.workoutType !== 'Mixed';
    const template = selectConditioningTemplate({
      category: EASIER_AEROBIC_CATEGORY,
      dateStr,
      ...(miniCycleNumber !== undefined ? { miniCycleNumber } : {}),
      ...(availableMachines !== undefined ? { availableMachines } : {}),
      role: standalone ? 'standalone' : 'component',
    });

    const firstIndex = existingRows.findIndex((row) => row.role === 'conditioning');
    const replacement = composeConditioningRows(template, dateStr, {
      idPrefix: `cond-${dateStr}-eased`,
      orderBase: conditioningRows[0].exerciseOrder,
      omitWarmup: !standalone,
    }).map((row) => ({ ...row, workoutId: workout.id }));

    const kept = existingRows.filter((row) => row.role !== 'conditioning');
    const exercises = [
      ...kept.slice(0, firstIndex),
      ...replacement,
      ...kept.slice(firstIndex),
    ];

    return {
      ...workout,
      exercises,
      conditioningCategory: EASIER_AEROBIC_CATEGORY,
      // The three display facts that would otherwise still say "hard".
      conditioningFlavour: 'aerobic' as const,
      ...(standalone ? { workoutType: workoutTypeForTemplate(template) } : {}),
      ...(workout.conditioningBlock
        ? {
          conditioningBlock: {
            ...workout.conditioningBlock,
            intent: 'aerobic' as const,
            options: workout.conditioningBlock.options.map((option, index) => (
              index === 0 ? { ...option, title: template.name } : option
            )),
          },
        }
        : {}),
    };
  });
}

/* ── WC-137: THE OTHER DIRECTION — conditioning easy, strength difficult ── */

/**
 * WHAT THE BOUNDARY DECIDED FOR ONE CONDITIONING SESSION THAT FELT EASY.
 *
 * `stepped: false` is a FIRST-CLASS ANSWER, not an absence. Sam's rule 5:
 * *"If the authoritative templates provide no valid next dose, hold the session
 * and report that no progression step exists. Never invent one."* A caller that
 * only looked at the stepped rows could not tell "nothing was easy" from "the
 * sheet had nothing left", and those are different things to tell an athlete.
 */
export type BlockBoundaryConditioningAdvance =
  | {
    readonly weekIndex: number;
    readonly workoutId: string;
    readonly templateName: string;
    readonly stepped: true;
    readonly step: ConditioningStep;
  }
  | {
    readonly weekIndex: number;
    readonly workoutId: string;
    readonly templateName: string;
    readonly stepped: false;
    readonly reason: ConditioningNoStepReason;
  };

/**
 * ── WC-137: ADVANCE CONDITIONING BY EXACTLY ONE AUTHORED STEP ─────────────
 *
 * The approved contract's *"conditioning easy, strength difficult"* case:
 * *"progress conditioning within the phase-approved template progression while
 * keeping strength volume manageable."*
 *
 * **FOUR GATES, AND EACH ONE ANSWERS A DIFFERENT SENTENCE OF THE RULING.**
 *
 * 1. `conditioningEasy` — the athlete actually said so, on the conditioning
 *    question, on days that carried an answer. Silence is not ease.
 * 2. `!strengthEasy` — this is the *"conditioning easy, STRENGTH DIFFICULT"*
 *    branch. When everything is easy the contract sends the athlete to the
 *    load/sets/session ladder instead, and running both would progress two
 *    qualities off one block of evidence.
 * 3. `!history.reduces` — an athlete who reported the block very hard or their
 *    recovery low is the REDUCE case, and reduce outranks advance. Belt and
 *    braces with gate 1, deliberately: `reduces` reads soreness and recovery,
 *    `conditioningEasy` reads the conditioning RPE, and a block can carry both.
 * 4. **`phase !== 'In-season'` — Sam's rule 1, *"check the phase; in-season may
 *    hold for freshness."*** In-season conditioning exists to keep the athlete
 *    fresh for Saturday, and the app's only in-season addition is the sprint.
 *
 * **THE QUALITY NEVER CHANGES.** Rule 4 — *"Aerobic Power never automatically
 * becomes Anaerobic merely because it felt easy"* — holds structurally: this
 * function reads the session's OWN template and asks `nextAuthoredDose` for a
 * bigger dose OF THAT TEMPLATE. There is no code path here that can name a
 * different quality, so no check can be forgotten.
 */
export function decideBlockBoundaryConditioningAdvance(args: {
  history: BlockHistorySignal;
  nextBlockWorkouts: readonly Workout[];
  weekIndex: number;
  phase: SeasonPhase | null | undefined;
}): BlockBoundaryConditioningAdvance[] {
  const { history, nextBlockWorkouts, weekIndex, phase } = args;
  if (!history.byQuality.conditioningEasy) return [];
  if (history.byQuality.strengthEasy) return [];
  if (history.reduces) return [];
  if (phase === 'In-season') return [];

  const advances: BlockBoundaryConditioningAdvance[] = [];
  for (const workout of nextBlockWorkouts) {
    if (workout.conditioningCategory === undefined) continue;
    const rows = (workout.exercises ?? []).filter((row) => row.role === 'conditioning');
    if (rows.length === 0) continue;
    // The template is named by the row the emitter wrote, never re-selected —
    // re-selecting would roll the rotation and step a DIFFERENT session.
    const templateName = conditioningTemplateNameFromRows(rows);
    if (templateName === null) continue;
    const template = CONDITIONING_TEMPLATES.find((row) => row.name === templateName);
    if (template === undefined) continue;

    // ⚠ NARROWED WITH `in`, NOT WITH THE `stepped` FLAG. The flag reads like a
    // discriminant and the compiler declined to narrow through it here, which
    // is worth the two extra lines rather than a cast: `in` narrows on the
    // property that actually differs, so a third member added to the union
    // would be a compile error rather than a silently dropped branch.
    const outcome = nextAuthoredDose(template);
    const step = 'step' in outcome ? outcome.step : null;
    const reason = 'reason' in outcome ? outcome.reason : null;
    if (step !== null) {
      advances.push({ weekIndex, workoutId: workout.id, templateName, stepped: true, step });
    } else if (reason !== null) {
      advances.push({ weekIndex, workoutId: workout.id, templateName, stepped: false, reason });
    }
  }
  return advances;
}

/** The authored template name a composed conditioning row carries, or null. */
function conditioningTemplateNameFromRows(
  rows: readonly WorkoutExercise[],
): string | null {
  for (const row of rows) {
    const name = (row as unknown as { exercise?: { name?: string } }).exercise?.name;
    if (typeof name !== 'string' || name.length === 0) continue;
    if (CONDITIONING_TEMPLATES.some((template) => template.name === name)) return name;
  }
  return null;
}

/**
 * Apply the authored step to the session's prescribed dose.
 *
 * ⚠ **ONLY `prescribedSets` MOVES, AND ONLY TO THE AUTHORED NUMBER.** The
 * template, the category, the flavour, the block intent and every athlete-facing
 * string are untouched — the athlete is doing the SAME authored session, one
 * authored rung up. Rewriting the name or the cue would make the sheet's own
 * words describe a dose the sheet did not author.
 *
 * A `stepped: false` decision changes nothing, which is rule 5's "hold the
 * session" in code rather than in a comment.
 */
export function applyBlockBoundaryConditioningAdvance(args: {
  workouts: readonly Workout[];
  advances: readonly BlockBoundaryConditioningAdvance[];
}): Workout[] {
  const stepped = new Map(
    args.advances.filter((a) => a.stepped).map((a) => [a.workoutId, a as Extract<
      BlockBoundaryConditioningAdvance, { stepped: true }>]));
  if (stepped.size === 0) return [...args.workouts];

  return args.workouts.map((workout) => {
    const advance = stepped.get(workout.id);
    if (!advance) return workout;
    const rows = workout.exercises ?? [];
    const headlineIndex = rows.findIndex((row) => row.role === 'conditioning'
      && (row as unknown as { exercise?: { name?: string } }).exercise?.name
        === advance.templateName);
    if (headlineIndex < 0) return workout;
    return {
      ...workout,
      exercises: rows.map((row, index) => (index === headlineIndex
        ? { ...row, prescribedSets: advance.step.to }
        : row)),
    };
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
export interface BlockBoundaryLoadExplanationRow {
  exerciseName: string;
  kind: BlockBoundaryDecisionKind;
  previousLoadKg: number | null;
  nextLoadKg: number | null | undefined;
  incrementKg?: number;
}

/**
 * THE ONE ROW A REDUCED BLOCK CARRIES.
 *
 * Block-level, not per-exercise, because the sentence Sam approved is
 * block-level: *"You completed the last block, but it felt very hard and
 * recovery was low, so we've kept your training weights and reduced the amount
 * of work in this block."* One decision, one row, one sentence.
 *
 * ⚠ **IT NAMES ONLY RECORDED FACTS AND STORED CHANGES.** `sessionsCompleted`
 * and `sessionsRecorded` are counts of logged sessions; `loadsHeld` is a
 * property of the load decisions that were stored beside it. Nothing here
 * claims a rep or a set was completed — the contract's standing ban.
 */
export interface BlockBoundaryReductionExplanationRow {
  kind: 'hard_block_reduced';
  /** Completed sessions in the block that ended — a counted fact. */
  sessionsCompleted: number;
  /** Sessions that recorded any strength work at all. */
  sessionsRecorded: number;
  /** True when no strength row's load rose at this boundary. */
  loadsHeld: boolean;
  /** Every set count this boundary actually moved, in the order it moved them. */
  setsReduced: readonly {
    exerciseName: string;
    role: ExerciseRole;
    previousSets: number;
    nextSets: number;
  }[];
  /** Every hard conditioning session replaced with easier aerobic work. */
  hardConditioningReplaced: readonly {
    fromCategory: HardConditioningCategory;
    toCategory: typeof EASIER_AEROBIC_CATEGORY;
  }[];
}

/**
 * ONE UNION, DISCRIMINATED BY `kind`, AND PERSISTED ROWS STAY VALID.
 *
 * The five load kinds were the whole vocabulary until this slice;
 * `hard_block_reduced` is a sixth value of the SAME field, so a program stored
 * before today narrows to the load row exactly as it did and no migration is
 * owed. A second array on `TrainingProgram` would have been two facts about one
 * decision.
 */
export type BlockBoundaryExplanationRow =
  | BlockBoundaryLoadExplanationRow
  | BlockBoundaryReductionExplanationRow;

/**
 * ONE NARROWING DOOR, SO NO READER WRITES ITS OWN CAST.
 *
 * Every surface that reads a stored explanation needs to tell the two row kinds
 * apart, and a reader that reaches for `row.exerciseName` behind an `as` is a
 * reader that will silently read `undefined` off a reduction row the day one
 * appears in its list.
 */
export function isLoadExplanationRow(
  row: BlockBoundaryExplanationRow,
): row is BlockBoundaryLoadExplanationRow {
  return row.kind !== 'hard_block_reduced';
}

export function isReductionExplanationRow(
  row: BlockBoundaryExplanationRow,
): row is BlockBoundaryReductionExplanationRow {
  return row.kind === 'hard_block_reduced';
}

export function buildBlockBoundaryExplanation(
  decisions: readonly BlockBoundaryLiftDecision[],
): BlockBoundaryLoadExplanationRow[] {
  const order: Record<BlockBoundaryDecisionKind, number> = {
    history_progressed: 0,
    bodyweight_progressed: 1,
    history_held: 2,
    authored_estimate: 3,
    unset: 4,
    bodyweight_default: 5,
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

/**
 * The reduction row, built from the decisions that were actually applied.
 *
 * `null` when nothing was reduced — a reduced-block sentence with no reductions
 * behind it would be the app telling the athlete about a change it did not make.
 */
export function buildBlockBoundaryReductionExplanation(args: {
  history: BlockHistorySignal;
  loadDecisions: readonly BlockBoundaryLiftDecision[];
  volumeDecisions: readonly BlockBoundaryVolumeDecision[];
  conditioningDecisions: readonly BlockBoundaryConditioningDecision[];
}): BlockBoundaryReductionExplanationRow | null {
  const { history, loadDecisions, volumeDecisions, conditioningDecisions } = args;
  if (!history.reduces) return null;

  // ONE ROW PER EXERCISE IN THE EXPLANATION, THOUGH THE DECISIONS ARE PER ROW.
  // The athlete reads "your main lift went from four sets to three", not the
  // same sentence once per week of the block. The FIRST decision for a name
  // wins, which is the earliest week it was reduced in.
  const seenInExplanation = new Set<string>();
  const setsReduced = volumeDecisions
    // ⚠ **A REDUCTION IS `nextSets < previousSets`, NOT `kind !== 'sets_unchanged'`.**
    // Those are two different questions and using the wrong one shipped a
    // dishonest explanation: `kind` says whether the STORED row moved, and on a
    // very-hard block the freeze has already collapsed every row to a single
    // set, so restoring a main lift to its authored three IS a stored change —
    // while the athlete's own experience of it is 3 sets before and 3 sets
    // after. The first draft listed `Leg Press 3 → 3` and `Landmine Press 2 → 2`
    // underneath a sentence claiming the work had been reduced. The EXPLANATION
    // answers to what the ATHLETE did, so it is filtered on their numbers.
    .filter((decision) => decision.nextSets < decision.previousSets)
    .filter((decision) => {
      if (seenInExplanation.has(decision.exerciseName)) return false;
      seenInExplanation.add(decision.exerciseName);
      return true;
    })
    .map((decision) => ({
      exerciseName: decision.exerciseName,
      role: decision.role,
      previousSets: decision.previousSets,
      nextSets: decision.nextSets,
    }));
  const hardConditioningReplaced = conditioningDecisions.map((decision) => ({
    fromCategory: decision.fromCategory,
    toCategory: decision.toCategory,
  }));
  if (setsReduced.length === 0 && hardConditioningReplaced.length === 0) return null;

  return {
    kind: 'hard_block_reduced',
    sessionsCompleted: history.completedStrengthSessions,
    sessionsRecorded: history.recordedStrengthSessions,
    // READ OFF THE DECISIONS, NOT ASSUMED FROM THE VERDICT. The sentence claims
    // the weights were kept; the only honest source for that claim is the load
    // decisions this same boundary stored.
    loadsHeld: loadDecisions.every((decision) => decision.kind !== 'history_progressed'),
    setsReduced,
    hardConditioningReplaced,
  };
}
