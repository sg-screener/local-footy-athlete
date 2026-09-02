/**
 * R-124 session-level injury policy: retain safe work, pause affected patterns,
 * and add coherent unaffected-area work within the established volume limits.
 * Pure policy helpers consumed by canonicalWeeklyInjuryCompiler and the review
 * preview. The resolver does not run a second session builder.
 *
 * Clear/restart rebuild the original accepted inputs through the compiler;
 * these derived additions are never recorded as athlete add-exercise decisions.
 * Guard: compilerYear/sourceFacts compiler_owns_visible_rows, including the
 * overlapping-injury/one-remaining regression and render-writer mutation.
 */
import type { OnboardingData, Workout, WorkoutExercise } from '../types/domain';
import { legalAddCandidates, type AddCandidate, type AddLeafId } from './addExerciseCandidates';
import type { TapSwapEnvironment } from './tapSwapHierarchy';
import { getExerciseTags, type InjuryKey } from '../data/exerciseTags';
import { SET_CEILING } from '../rules/weeklyLegality';
import { POOL_REGISTRY } from '../data/exercisePools';
import { finerPatternIdentityOf } from '../rules/injuryFallbackLadder';
import { mainPatternForExerciseMovement, type MainStrengthPattern } from '../rules/strengthPatternContributions';
import { getSessionComponentRows } from './sessionComponents';
import { formatExerciseDisplayName } from './exerciseDisplay';
import { stableDecisionOrder } from '../rules/stableDecisionDiversity';
import {
  automaticExerciseRouteForIdentity,
  automaticMainFamilyForExercise,
  createAutomaticWeeklyExerciseSelector,
  realMovementSlotsForAutomaticExercise,
} from '../rules/automaticWeeklyExerciseSelection';
import { slotDayKindForPatterns, type SessionSlot } from '../rules/sessionSlotCoverage';

/** Sam: *"add no more than three safe exercises"*. */
export const INJURY_ADJUSTMENT_MAX_ADDED = 3;

export interface InjurySessionAddition extends AddCandidate {
  /** Declared by the compound slot; midline additions never claim this role. */
  mainStrengthPattern?: MainStrengthPattern | null;
}

export interface InjurySessionAdjustment {
  /** The one line the active session shows instead of five greyed-out cards. */
  summary: string;
  /**
   * Rows the injury pauses, **in the name the athlete could see** (R-121).
   * Hidden from the session; still carried as data.
   */
  paused: readonly string[];
  /**
   * ⚠ **THE SAME ROWS, IN THE NAME THE DAY ACTUALLY CARRIES.** The two differ
   * exactly when an earlier injury substituted a row and the settle could not
   * re-write that substitution — the athlete was looking at `Kettlebell Swings`
   * while the day underneath had reverted to `Bulgarian Split Squats`. The
   * REPORT must use the first (that is what R-121 rules) and the FILTER must use
   * the second, or nothing is removed at all and the untrained-pattern
   * disclosure goes silent (`test:injury-fallback-journey`, five worlds).
   */
  pausedOnTheDay: readonly string[];
  /** The block that replaces them — attached to the SESSION, named against nothing. */
  added: readonly InjurySessionAddition[];
}

/**
 * ── HOW THE BLOCK IS CHOSEN, AND WHY IT IS A SHAPE RATHER THAN A LIST ──────
 *
 * *"a coherent session adjustment, not fake one-for-one substitutions"*. A
 * coherent gym session is one compound plus some trunk work, so that is what
 * this builds — in that order, one slot at a time:
 *
 *   1. **ONE upper compound**, from the pulling or pressing family the rest of
 *      the athlete's week carries LESS of. Measured on the real week: pressing
 *      appears three times (Explosive Push-up, Single-Arm DB Floor Press, DB
 *      Shoulder Press) and pulling twice (Barbell Row, Lat Pulldown), so pulling
 *      wins and the block opens with a row.
 *   2. **MIDLINE, ONE PER PRESCRIPTION TYPE** — one counted, one held. This is
 *      what stops the block being three variants of the same drill: `Dead Bug`,
 *      `Banded Dead Bug` and `Weighted Dead Bug` sit next to each other in the
 *      pool, and a plain "take the next legal name" rule would have taken two of
 *      them.
 *
 * ⚠ **NOTHING ALREADY ANYWHERE IN THE WEEK IS ELIGIBLE.** Sam: *"do not create
 * duplicate or excessive upper-body volume."* The per-row loop this replaces
 * could only see the current session, which is how it proposed `Band Pull-Apart`
 * (already Tuesday's) and `Single-Arm DB Floor Press` (already Thursday's) and
 * took the athlete's upper rows for the week from 7 to 12. **The week-level view
 * is the one genuinely new input in this unit.**
 *
 * Safety is not re-decided here: `legalAddCandidates` asks
 * `assessTapSwapCandidateSafety`, the same gate the ladder asks, so the injury
 * matrix is untouched and a merely `caution` exercise is still refused at 6-7.
 * Loaded carries and kneeling are refused before this by R-124's rule in
 * `rules/injuryExerciseRisk` — the shared authority, not a rule of this file's.
 */
/**
 * ⚠ **THE BLOCK COMES FROM THE HALF THE INJURY IS NOT IN, AND HARD-CODING IT TO
 * "UPPER" WAS A REAL BUG.** Caught by `test:injury-fallback-journey` and
 * `test:exercise-restore-owner`: for a SHOULDER at the same band, every upper
 * candidate is refused by the safety gate — correctly — so the block came back
 * empty and the session was left with the forbidden rows still standing. Sam's
 * own words are about a knee (*"adjusted to safe upper-body and core work"*);
 * the general form is *"unaffected-area work"*, and which area that is depends
 * on where the injury is.
 */
const COMPOUND_LEAVES: Readonly<Record<'upper' | 'lower', AddLeafId[]>> = {
  upper: ['upper_pull', 'upper_push'],
  lower: ['lower_squat', 'lower_hinge', 'lower_single_leg', 'lower_accessories'],
};

/** `duration` and `reps` are the two shapes a midline row comes in. */
type PrescriptionShape = 'counted' | 'held';

/**
 * ⚠ **THE POOL IS THE AUTHORITY ON HELD-vs-COUNTED, NOT THE ADD DOOR'S BAND.**
 * MEASURED: `Side Plank` is authored `prescriptionType: 'duration'` and the Add
 * door hands it back as `2 x 8-12` with no prescription type at all, because
 * the muscle-experience band overwrites the pool's numbers. Reading the band
 * here made every midline drill look "counted", the held slot never filled, and
 * the block came back `Dead Bug, Banded Dead Bug` — two variants of one drill,
 * which is the thing this slot exists to prevent.
 */
const POOL_BY_NAME = new Map(
  Object.values(POOL_REGISTRY).flat().map((entry) => [entry.name.trim().toLowerCase(), entry]),
);

function shapeOf(candidate: AddCandidate): PrescriptionShape {
  const authored = POOL_BY_NAME.get(candidate.name.trim().toLowerCase())?.prescriptionType
    ?? candidate.prescriptionType;
  return authored === 'duration' || authored === 'duration_minutes' ? 'held' : 'counted';
}

/**
 * ⚠ **A VARIANT OF SOMETHING ALREADY ADDED IS NOT A SECOND EXERCISE.**
 * `dead-bug`, `banded-dead-bug` and `weighted-dead-bug` sit next to each other
 * in the pool; so do `side-plank` and `side-plank-row`. Their POOL IDS say so —
 * one contains the other — which is a fact in the data rather than a list of
 * name prefixes this file would have to keep up to date.
 */
function poolIdOf(name: string): string | null {
  return POOL_BY_NAME.get(name.trim().toLowerCase())?.id ?? null;
}

function isVariantOfAlreadyChosen(name: string, chosen: readonly AddCandidate[]): boolean {
  const id = poolIdOf(name);
  if (!id) return false;
  return chosen.some((entry) => {
    const other = poolIdOf(entry.name);
    if (!other) return false;
    return other === id || other.includes(id) || id.includes(other);
  });
}

function normalise(name: string): string {
  return name.trim().toLowerCase();
}

/** Working sets a row contributes. The cap below is the app's own, not a new one. */
function setsOf(row: { prescribedSets?: number | null } | AddCandidate): number {
  const value = (row as { prescribedSets?: number | null }).prescribedSets
    ?? (row as AddCandidate).sets;
  return typeof value === 'number' && value > 0 ? value : 0;
}

export function chooseInjurySessionAdditions(args: {
  environment: TapSwapEnvironment;
  profile: OnboardingData | null | undefined;
  /** Rows staying on this session. Never offered again, and they cost set budget. */
  keptRowNames: readonly string[];
  /**
   * ⚠ **THE ROWS THIS INJURY JUST PAUSED — NEVER OFFERED BACK.**
   *
   * MEASURED by `test:session-change-sequence`: without this, an injury paused
   * `Bench Press@107.5` and the block added `Bench Press@82.5` straight back —
   * the same movement at the athlete's *starting* load instead of their
   * progressed one, on the very session that had just refused it. The week list
   * could not catch it because it is read from the AUTHORED microcycle and this
   * athlete had already edited their day.
   */
  pausedRowNames: readonly string[];
  /** Every exercise name anywhere in the athlete's week, this session included. */
  weekExerciseNames: readonly string[];
  /** Automatic-only names for R-318; athlete additions do not spend its state. */
  weekAutomaticExerciseNames?: readonly string[];
  otherMainStrengthPatterns?: readonly MainStrengthPattern[];
  /**
   * ⚠ **THE ATHLETE'S OWN "LEAVE THIS OUT" DECISIONS — NEVER OFFERED BACK.**
   *
   * MEASURED by `test:session-change-sequence`: the athlete removed
   * `Bench Press`, then declared a knee injury, and the block **added Bench
   * Press straight back** — at the add door's starting load, 82.5kg, instead of
   * the 107.5kg they had been lifting. Two defects in one row, and the same
   * cause: *an injury adjustment may not undo an athlete's own decision.*
   *
   * The week list could not catch it. A removal that survives a restart does so
   * by RE-AUTHORING the accepted week WITHOUT the row, so by the time this runs
   * the exercise is genuinely absent from the microcycle and looks like a fresh,
   * legal, unused candidate. The only place the decision still exists is the
   * exclusion record, so that is what is read.
   *
   * Sam's boundary, 2026-08-20, stated from the other side: *"Injury and
   * ordinary Remove must remain separate."*
   */
  excludedByAthlete: readonly string[];
  /** How many rows the injury paused — the block is never larger than the hole. */
  pausedCount: number;
  /** The session's ORIGINAL row count. Sam: *"never exceed the original session size"*. */
  originalRowCount: number;
  /** The half of the body the injury is in. The block comes from the other one. */
  injuredHalf: 'upper' | 'lower' | null;
  /** Sets already on the session after pausing — the ceiling is per session. */
  keptSets: number;
  /**
   * The day being adjusted. Sam, 2026-08-27 (injury over-restriction fix):
   * every affected day of the week derived the SAME replacement, because this
   * chooser always took the first legal candidate. The date rotates the
   * starting point of each candidate list — deterministic per day (the review
   * and the view door pass the same date, so the promise still holds), varied
   * across the week. Absent, the pool order stands as before.
   */
  dateISO?: string;
  dayKind?: ReturnType<typeof slotDayKindForPatterns>;
}): InjurySessionAddition[] {
  /**
   * ⚠ **THREE CAPS, AND THE SMALLEST WINS.** Sam: *"Cap newly added work at
   * three exercises and never exceed the original session size or the existing
   * weekly limits."* The third is `SET_CEILING`, which is the app's own
   * `rules/weeklyLegality` number and not one invented here — it binds nothing
   * in the measured case (9 sets against a ceiling of 16) and it is still the
   * honest place to read it from.
   */
  const roomForRows = Math.min(
    INJURY_ADJUSTMENT_MAX_ADDED,
    args.pausedCount,
    Math.max(0, args.originalRowCount - args.keptRowNames.length),
  );
  if (roomForRows <= 0) return [];

  const inTheWeek = new Set([
    ...args.weekExerciseNames,
    ...args.keptRowNames,
    ...args.pausedRowNames,
    ...args.excludedByAthlete,
  ].map(normalise));
  const chosen: InjurySessionAddition[] = [];
  let sets = args.keptSets;
  const automaticDelivered = [...(args.weekAutomaticExerciseNames ?? args.weekExerciseNames)];
  for (const paused of args.pausedRowNames) {
    const index = automaticDelivered.indexOf(paused);
    if (index >= 0) automaticDelivered.splice(index, 1);
  }
  const weeklySelector = createAutomaticWeeklyExerciseSelector(automaticDelivered);

  // R-355: the DAY's own pattern load. A day already carrying two rows of a
  // main pattern (two presses) does not get a third from this block — the
  // chooser used to read only the week, and Friday took DB Bench Press, Seated
  // DB Press and then Push-ups.
  const patternOf = (name: string) => mainPatternForExerciseMovement(getExerciseTags(name)?.movement);
  const patternCountToday = (pattern: ReturnType<typeof patternOf>): number => pattern
    ? [...args.keptRowNames, ...chosen.map((entry) => entry.name)]
      .filter((name) => patternOf(name) === pattern).length
    : 0;
  const take = (candidate: InjurySessionAddition | undefined, options?: { repeat?: boolean }): boolean => {
    if (!candidate) return false;
    if (chosen.length >= roomForRows) return false;
    if (sets + setsOf(candidate) > SET_CEILING) return false;
    if (isVariantOfAlreadyChosen(candidate.name, chosen)) return false;
    if (candidate.mainStrengthPattern && patternCountToday(candidate.mainStrengthPattern) >= 2) return false;
    if (options?.repeat) {
      // A REPEAT of work the week already carries (R-355 doubling): the weekly
      // once-per-identity rule is deliberately not asked — that rule is the
      // reason the unused bench is empty on limited kit. Everything else
      // (room, sets, variants, the day's pattern cap) still holds.
      chosen.push(candidate);
      sets += setsOf(candidate);
      return true;
    }
    const requestedAsMain = !!candidate.mainStrengthPattern;
    const route = automaticExerciseRouteForIdentity(candidate.name);
    const realSlots = realMovementSlotsForAutomaticExercise(candidate.name);
    const requestedSlot = (automaticMainFamilyForExercise(candidate.name, {
      route, requestedAsMain,
    }) ?? realSlots[0] ?? 'core') as SessionSlot;
    const weeklyCandidate = {
      identity: candidate.name,
      requestedSlot,
      dayKind: args.dayKind ?? null,
      route,
      requestedAsMain,
    } as const;
    if (!weeklySelector.canUse(weeklyCandidate)) return false;
    chosen.push(candidate);
    inTheWeek.add(normalise(candidate.name));
    sets += setsOf(candidate);
    weeklySelector.accept(weeklyCandidate);
    return true;
  };

  /* A date-specific rendezvous order gives consecutive affected days different
   * coherent blocks without reading catalogue position. The old array rotation
   * changed its answer when a source pool was reversed: the same injury and
   * same day could become Bodyweight Squat or Goblet Squat solely because an
   * author reordered the catalogue. */
  const legal = (leaf: AddLeafId): AddCandidate[] => stableDecisionOrder(
    legalAddCandidates({
      leaf,
      environment: args.environment,
      profile: args.profile ?? null,
      // Everything the week already has is "existing" as far as the door is
      // concerned, so it never offers a duplicate in the first place.
      existingExerciseNames: [...inTheWeek],
    }).filter((candidate) => !inTheWeek.has(normalise(candidate.name))),
    `injury-session:${args.dateISO ?? 'undated'}:${leaf}`,
    (candidate) => normalise(candidate.name),
  );

  // ── 1. ONE COMPOUND, FROM THE UNAFFECTED HALF ────────────────────────────
  //
  // Within that half, the family the week carries LESS of. Counted from the
  // WEEK'S OWN ROWS through `finerPatternIdentityOf` — the same owner the ladder
  // and the untrained-pattern sentence read, so "how much pulling does this
  // athlete already do" has one answer in this app. Measured on the real week:
  // pulling 2 (Barbell Row, Lat Pulldown), pressing 3 (Explosive Push-up,
  // Single-Arm DB Floor Press, DB Shoulder Press) — so pulling wins and the
  // block opens with a row.
  /**
   * ⚠ **COUNTED FROM THE REST OF THE WEEK, NOT FROM TODAY — AND THAT IS WHAT
   * MAKES THE BLOCK STABLE.**
   *
   * MEASURED by `test:session-change-sequence`: with today's rows in the count,
   * restoring an exercise the athlete had removed changed the PRESSING total by
   * one, flipped the pull/press tie-break, and silently swapped the injury's
   * added exercise from `Incline Bench` to `Chest Supported Row`. The athlete
   * would have opened the same session and found different work in it, for a
   * reason that had nothing to do with their injury.
   *
   * The question this is asking is *"what does the rest of the athlete's week
   * already cover?"*, so today's own rows were never part of the answer. Taking
   * them out makes the block immune to every edit made to the day it is
   * adjusting — which is the property that was missing.
   */
  const todayNames = [...args.keptRowNames, ...args.pausedRowNames].map(normalise);
  const restOfWeek: string[] = [];
  const spent = new Map<string, number>();
  for (const name of args.weekExerciseNames) {
    const key = normalise(name);
    const budget = todayNames.filter((entry) => entry === key).length;
    const used = spent.get(key) ?? 0;
    if (used < budget) { spent.set(key, used + 1); continue; }
    restOfWeek.push(name);
  }
  const identityCount = (identities: readonly string[]): number => restOfWeek
    .filter((name) => identities.includes(String(finerPatternIdentityOf(name)))).length;
  const safeHalf: 'upper' | 'lower' = args.injuredHalf === 'upper' ? 'lower' : 'upper';
  const leaves = [...COMPOUND_LEAVES[safeHalf]];
  if (safeHalf === 'upper') {
    const pulling = args.otherMainStrengthPatterns
      ? args.otherMainStrengthPatterns.filter(pattern => pattern === 'pull').length
      : identityCount(['horizontal_pull', 'vertical_pull']);
    const pressing = args.otherMainStrengthPatterns
      ? args.otherMainStrengthPatterns.filter(pattern => pattern === 'push').length
      : identityCount(['horizontal_push', 'vertical_push']);
    // Ties go to pulling: with equal amounts of both, an extra press is the more
    // fatiguing addition for a footballer's shoulders.
    if (pressing < pulling) leaves.reverse();
  }
  /* The first leaf in the unaffected half that has anything legal left. A half
   * whose every leaf is empty simply contributes nothing, and the midline slots
   * below still fill — which is what stops an upper injury emptying the day. */
  // Lower-body replacements use the same least-covered-pattern principle.
  // Search the existing eligible leaves together: a legal hinge may live in
  // Accessories, so exhausting only the Hinge drawer must not force more
  // squats while the unchanged weekly balance rule still requires a hinge.
  const lowerCount = (candidate: AddCandidate): number => {
    const pattern = mainPatternForExerciseMovement(getExerciseTags(candidate.name)?.movement);
    if (!pattern) return Number.MAX_SAFE_INTEGER;
    return args.otherMainStrengthPatterns
      ? args.otherMainStrengthPatterns.filter(existing => existing === pattern).length
      : restOfWeek.filter(name => mainPatternForExerciseMovement(getExerciseTags(name)?.movement) === pattern).length;
  };
  const compounds = safeHalf === 'lower'
    ? leaves.flatMap(legal).sort((left, right) => lowerCount(left) - lowerCount(right))
    : leaves.flatMap(leaf => legal(leaf).slice(0, 1));
  for (const candidate of compounds) {
    if (candidate && take({ ...candidate,
      mainStrengthPattern: mainPatternForExerciseMovement(getExerciseTags(candidate.name)?.movement),
    })) break;
  }
  // ── 1b. R-355 DOUBLING: NOTHING UNUSED? REPEAT SOMETHING SAFE THE WEEK HAS ──
  //
  // Sam, 2026-09-02: "if you have limited equipment you can double up on
  // things when injured." When every unused legal compound in the unaffected
  // half is gone (limited kit), a safe compound the REST of the week already
  // carries is repeated on this day rather than an unrelated filler or an
  // empty position. Today's own rows, the paused rows and the athlete's
  // exclusions are never repeated.
  if (chosen.length === 0) {
    const neverRepeated = new Set([
      ...args.keptRowNames, ...args.pausedRowNames, ...args.excludedByAthlete,
    ].map(normalise));
    const repeatable = new Set(restOfWeek.map(normalise));
    const repeats = stableDecisionOrder(
      leaves.flatMap((leaf) => legalAddCandidates({
        leaf,
        environment: args.environment,
        profile: args.profile ?? null,
        existingExerciseNames: [],
      })).filter((candidate) => repeatable.has(normalise(candidate.name))
        && !neverRepeated.has(normalise(candidate.name))),
      `injury-session-repeat:${args.dateISO ?? 'undated'}`,
      (candidate) => normalise(candidate.name),
    );
    for (const candidate of repeats) {
      if (take({ ...candidate, mainStrengthPattern: patternOf(candidate.name) }, { repeat: true })) break;
    }
  }

  // ── 2. MIDLINE, ONE PER PRESCRIPTION SHAPE ───────────────────────────────
  const midline = legal('midline_carries');
  for (const shape of ['counted', 'held'] as PrescriptionShape[]) {
    if (chosen.length >= roomForRows) break;
    take(midline.find((candidate) => shapeOf(candidate) === shape
      && !chosen.some((entry) => normalise(entry.name) === normalise(candidate.name))));
  }

  // ── 3. ANYTHING LEFT IN THE BUDGET GOES TO MIDLINE, IN POOL ORDER ────────
  for (const candidate of midline) {
    if (chosen.length >= roomForRows) break;
    if (chosen.some((entry) => normalise(entry.name) === normalise(candidate.name))) continue;
    take(candidate);
  }

  return chosen;
}

/**
 * ── THE SENTENCE, AND IT IS SAM'S OWN ─────────────────────────────────────
 *
 * Sam, 2026-08-21, gave the shape verbatim: *"5 lower-body exercises paused for
 * your knee. Today's session has been adjusted to safe upper-body and core
 * work."* The count and the body part are read from what actually happened; the
 * second half names the actual added work, because the unaffected region is
 * not always upper body and a session may have room for only one replacement.
 */
export function injuryAdjustmentSummary(args: {
  pausedCount: number;
  bodyPart: string;
  /** `'lower'` / `'upper'` when every paused row is from one half, else null. */
  pausedRegion?: 'lower' | 'upper' | null;
  added: readonly AddCandidate[];
}): string {
  /* SAM'S OWN SENTENCE, 2026-08-21: *"5 lower-body exercises paused for your
   * knee."* The half of the body is DERIVED from the rows that were paused, so
   * it can never say "lower-body" over a shoulder — and it is simply left out
   * when they are not all from one half. */
  const half = args.pausedRegion ? `${args.pausedRegion}-body ` : '';
  const noun = args.pausedCount === 1 ? 'exercise' : 'exercises';
  const paused = `${args.pausedCount} ${half}${noun} paused for your ${args.bodyPart.toLowerCase()}.`;
  if (args.added.length === 0) {
    return `${paused} Nothing safe could be added in its place today.`;
  }
  const work = args.added.map(candidate => formatExerciseDisplayName(candidate.name)).join(', ');
  return `${paused} Today’s session has been adjusted with unaffected work: ${work}.`;
}

/**
 * The derived rows, as `WorkoutExercise`es the session screen can render, tick
 * off and log against.
 *
 * ⚠ **THE IDS ARE DERIVED AND STABLE.** They are built from the workout id and
 * the exercise name — never from an index and never from a counter — because
 * this projection is recomputed on every render and on every boot, and a row
 * whose id moved would lose the tick the athlete had already put in it.
 */
export function injuryAdjustmentRows(args: {
  workout: Workout;
  added: readonly InjurySessionAddition[];
  startOrder: number;
}): WorkoutExercise[] {
  const replacesMainStrength = args.workout.exercises.some(row => row.section18Evidence?.role === 'main_strength');
  return args.added.map((candidate, index) => {
    const mainStrengthPattern = replacesMainStrength ? candidate.mainStrengthPattern ?? null : null;
    const slug = candidate.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return {
      id: `injury-adjustment-${args.workout.id}-${slug}`,
      workoutId: args.workout.id,
      exerciseId: `injury-adjustment-${slug}`,
      exerciseOrder: args.startOrder + index,
      prescribedSets: candidate.sets,
      prescribedRepsMin: candidate.repsMin,
      prescribedRepsMax: candidate.repsMax,
      section18Evidence: {
        protocolVersion: 1,
        role: mainStrengthPattern ? 'main_strength' : 'strength_accessory',
        strengthPattern: mainStrengthPattern,
        mainStrengthPattern,
        provenance: 'composer_declaration',
      },
      ...(candidate.weightKg !== null ? { prescribedWeightKg: candidate.weightKg } : {}),
      restSeconds: 60,
      exercise: {
        id: `injury-adjustment-${slug}`,
        name: candidate.name,
      },
      ...(candidate.prescriptionType ? { prescriptionType: candidate.prescriptionType } : {}),
      ...(candidate.perSide ? { perSide: true } : {}),
      /** So every downstream reader can tell a derived row from an authored one. */
      addedForInjury: true,
    } as unknown as WorkoutExercise;
  });
}

export { setsOf as injuryAdjustmentSetsOf };

/** Explicit stage inputs, shared by compiler output and its review. */
export interface InjurySessionAdjustmentInputs {
  workout: Workout | null | undefined;
  /**
   * ⚠ **THE ENVIRONMENT IS AN INPUT, NOT SOMETHING THIS DERIVES.** The REVIEW
   * runs BEFORE the injury fact exists — that is the whole point of a review —
   * so a version of this that read the facts to find the injury returned
   * `null` at exactly the moment the athlete needed to see the block. The
   * caller that knows the injury passes it.
   */
  environment: TapSwapEnvironment;
  profile: OnboardingData | null | undefined;
  /** The athlete's own word for the area — theirs at review time, the worst
   *  active episode's at the view door. */
  bodyPart: string;
  /**
   * ⚠ **A RED FLAG GETS NO SESSION ADJUSTMENT AT ALL.**
   *
   * Sam, 2026-08-21: *"An 8-10 red flag continues through the existing full-stop
   * rule."* That rule (R-115) leaves every row ON the session, marked, and
   * refuses the day's completion while it is withholding something — and the
   * whole point of it is that the athlete is told to stop and get advice, not
   * handed a different session to do instead. MEASURED by
   * `test:injury-fallback-journey`, which asserts in five cells that the athlete
   * *"still sees those rows, not an emptied day"* and that the refusal *"blames
   * the INJURY, not a missing session"*.
   */
  redFlag: boolean;
  /** Every exercise name in the athlete's authored week, this day included. */
  weekExerciseNames: readonly string[];
  weekAutomaticExerciseNames?: readonly string[];
  otherMainStrengthPatterns?: readonly MainStrengthPattern[];
  /** Exercises the athlete has removed. Never offered back — see the field of
   *  the same name on `chooseInjurySessionAdditions`. */
  excludedByAthlete: readonly string[];
  /** The rows this injury pauses, decided by the ladder, never re-decided here. */
  pausedRowNames: readonly string[];
  /** The same rows in the day's own names. Defaults to `pausedRowNames`, which
   *  is correct whenever no earlier injury renamed a slot. */
  pausedOnTheDay?: readonly string[];
  /** The day being adjusted — rotates the added block's candidate pool so
   *  consecutive affected days do not all receive the same replacement. Both
   *  callers (the review and the view door) pass the same date, so the review
   *  stays an exact promise. */
  dateISO?: string;
}

/**
 * THE WHOLE ANSWER FOR ONE DAY, or `null` when this injury pauses nothing here.
 */
export function deriveInjurySessionAdjustment(
  args: InjurySessionAdjustmentInputs,
): InjurySessionAdjustment | null {
  const workout = args.workout;
  if (!workout || args.pausedRowNames.length === 0) return null;
  // The full-stop rule owns a red flag, start to finish. See `redFlag` above.
  if (args.redFlag) return null;

  const paused = new Set(args.pausedRowNames.map(normalise));
  const rows = workout.exercises ?? [];
  const rowNameOf = (row: unknown): string => String(
    (row as { exercise?: { name?: string } }).exercise?.name
    ?? (row as { name?: string }).name ?? '',
  ).trim();
  const keptRowNames = rows.map(rowNameOf).filter(Boolean)
    .filter((name) => !paused.has(normalise(name)));
  // The ceiling counts lifting sets, not minutes/rounds stored in an energy
  // row's prescribedSets field. A 41-minute aerobic component once consumed
  // all 16 "sets" and prevented every safe strength replacement from landing.
  const parts = getSessionComponentRows(workout);
  const keptSets = [...parts.strengthRows, ...parts.supportRows, ...parts.powerRows]
    .filter((row) => !paused.has(normalise(rowNameOf(row))))
    .reduce((total, row) => total + setsOf(row as { prescribedSets?: number }), 0);

  /* Which half of the body the paused work was, read from the rows themselves.
   * `null` unless every one of them agrees — a mixed set gets no adjective in
   * the sentence and no preference in the block. */
  const halves = new Set(args.pausedRowNames
    .map((name) => getExerciseTags(name)?.region)
    .filter((region): region is 'lower' | 'upper' => region === 'lower' || region === 'upper'));
  const pausedRegion = halves.size === 1 ? [...halves][0]! : null;

  // R-355 (Sam, 2026-09-02): a Mobility or Recovery session never receives
  // strength fillers — a paused stretch simply comes off. Measured: a knee
  // injury paused Crab Hold on a Mobility day and the block added Push-ups.
  const strengthSession = workout.workoutType !== 'Mobility' && workout.workoutType !== 'Recovery';
  const added = !strengthSession ? [] : chooseInjurySessionAdditions({
    environment: args.environment,
    profile: args.profile,
    keptRowNames,
    weekExerciseNames: args.weekExerciseNames,
    weekAutomaticExerciseNames: args.weekAutomaticExerciseNames,
    otherMainStrengthPatterns: args.otherMainStrengthPatterns,
    excludedByAthlete: args.excludedByAthlete,
    pausedRowNames: args.pausedRowNames,
    pausedCount: args.pausedRowNames.length,
    originalRowCount: rows.length,
    injuredHalf: pausedRegion,
    keptSets,
    dateISO: args.dateISO,
    dayKind: slotDayKindForPatterns(workout.strengthIntent?.plannedPatterns ?? []),
  });

  return {
    pausedOnTheDay: args.pausedOnTheDay ?? [...args.pausedRowNames],
    summary: injuryAdjustmentSummary({
      pausedCount: args.pausedRowNames.length,
      bodyPart: args.bodyPart,
      pausedRegion,
      added,
    }),
    paused: [...args.pausedRowNames],
    added,
  };
}

/**
 * ── COMPILER MATERIALISATION: PAUSED ROWS COME OFF, THE BLOCK GOES ON ──────────
 *
 * Sam, 2026-08-21: *"The five paused exercises appear in the review, but
 * disappear from the active workout after Apply. Do not show five greyed-out
 * SKIP cards … show one concise summary."*
 *
 * ⚠ **ORIGINAL INPUTS STAY IN THE LEDGER; THE COMPILED SESSION CARRIES THE ADJUSTMENT.** `injuryAdjustment.paused`
 * carries them at the session level, because a red-flag injury blocks the day's
 * completion *while it is withholding something*
 * (`rules/injuryWithheldRows.injurySessionOutcomeRefusal`) — and a rule that
 * reads the visible rows would have stopped firing the moment those rows became
 * invisible. Hiding a row is not the same as the injury forgetting about it.
 *
 * ⚠ **A DAY WITH NOTHING PAUSED COMES OUT IDENTICAL**, object for object — the
 * same discipline `markInjuryWithheldRows` and `applyExclusionsToAuthoredDay`
 * both state, and for the same reason: every identity comparison downstream
 * would otherwise start reporting a change this projection did not make.
 */
export function applyInjurySessionAdjustment<T extends Workout | null | undefined>(args: {
  workout: T;
  adjustment: InjurySessionAdjustment | null;
}): T {
  const workout = args.workout;
  const adjustment = args.adjustment;
  if (!workout || !adjustment || adjustment.paused.length === 0) return workout;
  /* THE DAY'S OWN NAMES — see `pausedOnTheDay`. Reporting and filtering are two
   * questions and they have two answers exactly when an earlier injury renamed
   * a slot the settle could not re-write. */
  const paused = new Set(adjustment.pausedOnTheDay.map(normalise));
  const rowNameOf = (row: unknown): string => String(
    (row as { exercise?: { name?: string } }).exercise?.name
    ?? (row as { name?: string }).name ?? '',
  ).trim();
  const kept = (workout.exercises ?? []).filter((row) => !paused.has(normalise(rowNameOf(row))));
  /**
   * ⚠ **THE ATHLETE IS NEVER LEFT WITH AN EMPTY SESSION, AND THAT BOUNDARY IS
   * OLDER THAN THIS RULING.**
   *
   * Sam's third decision — paused rows leave the active workout — is about a
   * session that has something to show instead. A RED-FLAG injury withholds
   * EVERY row and has nothing safe to add, and hiding them there produces the
   * blank day R-115 was written to prevent (*"Restore works by RE-DERIVING, it
   * replayed them and the day was empty forever"*). MEASURED by
   * `test:injury-fallback-journey`, which asserts in five cells that the
   * athlete *"still sees those rows, not an emptied day"* and that the refusal
   * *"blames the INJURY, not a missing session"*.
   *
   * So when nothing is kept and nothing could be added, the rows stay and keep
   * the mark `markInjuryWithheldRows` already put on them. Hiding is the
   * treatment for an ADJUSTED session, not for a paused one.
   */
  if (kept.length === 0 && adjustment.added.length === 0) return workout;
  return {
    ...workout,
    exercises: [
      ...kept,
      ...injuryAdjustmentRows({
        workout,
        added: adjustment.added,
        startOrder: kept.length + 1,
      }),
    ],
    injuryAdjustment: {
      summary: adjustment.summary,
      /* R-121 — the athlete reads the row they were looking at. */
      paused: [...adjustment.paused],
      added: adjustment.added.map((candidate) => candidate.name),
    },
  } as T;
}
