/**
 * THE LOAD MODEL — Sam's ruling (docs/JOURNAL_LOAD_MODEL_RULING_2026-08-08.md)
 * as a pure derivation over facts the app already stores.
 *
 * L14 domain purity: no React, no navigation, no stores, no device clock. Every
 * input arrives explicitly, so this module is callable from a plain test. The
 * only modules it reaches for are AUTHORED DATA and their existing owners —
 * never a surface, never a store.
 *
 * THE NORTH STAR ANSWER, up front: this slice stores NOTHING. Every number below
 * is derived on read from `SessionFeedback` — an input the app already persists —
 * so none of it can go stale beside the facts it came from. Measured before it
 * was built: docs/JOURNAL_LOAD_SLICE_PLAN_2026-08-09.md.
 *
 * ── THE ONE ARCHITECTURAL IDEA: PROVENANCE TRAVELS WITH THE NUMBER ──
 *
 * The seat order requires that no athlete-facing number be derived from an
 * unsigned constant. Written as a rule for the surface to obey, that is a
 * promise somebody has to keep every time they add a line. Written this way it
 * is a mechanism:
 *
 *   - every constant is an entry in ONE table carrying its own provenance;
 *   - every derived value carries the COMBINED provenance of the constants that
 *     fed it — `signed` only if all of them were;
 *   - `signedValue()` is the only door a surface may read through, and it
 *     returns null for anything proposed.
 *
 * Two properties fall out, and both are why it is built this way rather than
 * documented:
 *
 *   1. SAM'S SIGNATURE ALONE TURNS THE LINES ON. Flipping a constant to
 *      `signed` makes its line appear with no code change — which is also how
 *      the gate mutation-proves the mechanism in both directions.
 *   2. A NEW CONSTANT CANNOT LEAK. Adding one without provenance fails the
 *      compiler; adding one marked proposed makes everything downstream of it
 *      proposed automatically, so nobody has to remember which lines to hide.
 *
 * ── WHAT THIS MODULE DELIBERATELY REFUSES TO DO ──
 *
 * It never re-derives a fact that has an owner. Hardness belongs to
 * `countWeeklyExposures`; main-strength patterns belong to
 * `mainPatternForExerciseMovement`; muscles belong to the two signed sheets.
 * A second authority for any of them is the defect class this repo has already
 * paid for twice (`intensity-never-feeds-identity`, phase skew).
 *
 * It also does not carry Sam's 2/1/0 FALLBACK RUNG, and that absence is a
 * ruling rather than a gap — `journalWeek` already derives it, from the week's
 * days rather than from its recorded sessions. See the note where the rung used
 * to be computed.
 */

import { conditioningSessionMuscles } from '../data/conditioningMuscleMetadata';
import { getExerciseTags } from '../data/exerciseTags';
import { muscleMetadataFor, type MuscleGroup } from '../data/muscleExperienceMetadata';
import { JOURNAL_LOAD_WEIGHTS } from './journalWeek';
import { displayReps } from './prescriptionDisplay';
import {
  STRENGTH_PATTERN_ORDER,
  mainPatternForExerciseMovement,
  type MainStrengthPattern,
  emptyMainStrengthLedger,
} from './strengthPatternContributions';
import type { ConditioningPerformanceLog } from '../utils/conditioningLogging';
import type { GameSessionOutcome, TeamTrainingSessionOutcome } from '../types/sessionOutcome';
import type { StrengthExercisePerformanceLog } from '../utils/strengthLogging';

// ─── Provenance ──────────────────────────────────────────────────────────

/**
 * Whether Sam has signed the number, or it is this terminal's proposal awaiting
 * his signing batch. There is no third state on purpose: "probably fine" is how
 * an unsigned number reaches an athlete.
 */
export type ConstantProvenance = 'signed' | 'proposed';

export interface JournalLoadConstant<T> {
  readonly value: T;
  readonly provenance: ConstantProvenance;
  /** Where the value came from — a ruling line, or the proposal it awaits. */
  readonly source: string;
}

/**
 * EVERY CONSTANT IN THE LOAD MODEL, IN ONE PLACE (the seat order's requirement).
 *
 * SIGNED entries quote Sam. PROPOSED entries are this terminal's numbers and
 * are the load slice's signing batch — nothing derived from one of them can
 * reach the athlete while it reads `proposed`.
 */
export const JOURNAL_LOAD_CONSTANTS = {
  /**
   * The fallback rung. Sam's own numbers, 2026-08-08: "do 2 - 1 - 0 though,
   * easy days don't effect fatigue but count as sessions."
   *
   * THE VALUE IS `journalWeek`'S OBJECT, NOT A COPY THAT AGREES WITH IT. The
   * rung is APPLIED by the day-shape derivation, which owns it; this table's job
   * is to be the one place Sam's signing batch is read from, and it does that by
   * pointing at the owner rather than restating the numbers. Two literals that
   * happen to match is the shape a gate can only notice after they stop
   * matching.
   *
   * NOTHING IN THIS MODULE CONSUMES IT, and that is deliberate — see the note on
   * `JournalLoadModel`. It is listed here because it is a load constant Sam
   * signed, and a signing table that omits the signed ones is a worse record
   * than no table.
   */
  fallbackDayWeights: {
    value: JOURNAL_LOAD_WEIGHTS,
    provenance: 'signed',
    source: 'Sam 2026-08-08, JOURNAL_LOAD_AND_DAY_SHAPE_RULING §1',
  },
  /**
   * The window each stream is compared with itself over. SIGNED because it is
   * in the ruling's own body: "Each stream vs ITS OWN rolling 4-week normal."
   */
  streamNormalWindowWeeks: {
    value: 4,
    provenance: 'signed',
    source: 'Sam 2026-08-08, JOURNAL_LOAD_MODEL_RULING §2',
  },
  /**
   * How the two unitless stream ratios weigh into the one headline. The ruling
   * names this as Sam's to sign and records the seat's proposal: "stream
   * weighting for the headline (default proposal 50/50)".
   */
  streamWeighting: {
    value: { strength: 0.5, conditioning: 0.5 },
    provenance: 'signed',
    source: 'Sam 2026-08-09, signing session — 50/50 as proposed',
  },
  /**
   * The sweet-spot band, in ratio-of-normal terms. The ruling records the
   * literature reference it is proposed from: "sweet-spot band edges
   * (literature reference ~0.8-1.3 of normal)".
   */
  sweetSpotBand: {
    value: { low: 0.8, high: 1.3 },
    provenance: 'signed',
    source: 'Sam 2026-08-09, signing session — 0.8-1.3 of normal as proposed',
  },
  /**
   * Whether tonnage is modulated by the session's effort rating.
   *
   * SIGNED AS OFF, which is a decision and not a default. Sam's signing session
   * took the recommendation "OFF" rather than leaving it unruled — so the
   * effort tap does not enter the load number, and if that is ever to change it
   * is a new ruling rather than a flipped default nobody signed.
   */
  tonnageModulatedByEffort: {
    value: false,
    provenance: 'signed',
    source: 'Sam 2026-08-09, signing session — signed as OFF',
  },
  /**
   * The window a REGION is compared with itself over. Proposed separately from
   * the stream window because the ruling names it separately: "and the
   * region-normal window".
   */
  regionNormalWindowWeeks: {
    value: 4,
    provenance: 'signed',
    source: 'Sam 2026-08-09, signing session — 4 weeks as proposed',
  },
  /**
   * How much of a session's load a SECONDARY muscle carries, relative to a
   * primary. The signed sheets say which muscles a session loads; they do not
   * say how much, so this share is the terminal's and it is proposed.
   */
  regionSecondaryShare: {
    value: 0.5,
    provenance: 'signed',
    source: 'Sam 2026-08-09, signing session — half a primary, as proposed',
  },
  /**
   * How far above its own previous best a region must run before the Journal
   * shows the "ran hot" card. The UI ruling names the region-hot line as one of
   * the three athlete-affecting thresholds that are Sam's to sign.
   *
   * IT EXISTS BECAUSE THE ALTERNATIVE IS A CARD EVERY WEEK. Before this, a
   * region was "observed" on ANY exceedance of its previous best — so an athlete
   * who trained one kilogram harder than last month earned an attention card,
   * and a card that appears every week is the exact opposite of the ruling's
   * organising rule ("an athlete learns that seeing a card means pay
   * attention").
   *
   * 1.15 WAS THE TERMINAL'S NUMBER AND SAM TOOK IT. The ruling said the line is
   * his; the signing session put it where the proposal put it.
   */
  regionHotRatio: {
    value: 1.15,
    provenance: 'signed',
    source: 'Sam 2026-08-09, signing session — 1.15 as proposed',
  },
  /**
   * How far a completed pattern share may drift from the planned one before the
   * journal says so. The ruling: "the threshold for 'outweighs' is a Sam-signed
   * constant in the same signing batch".
   *
   * UNTIL THE UI SLICE, NOTHING CONSUMED THIS VALUE. `patternBalance` carried
   * its PROVENANCE — so everything downstream was correctly dark — but no code
   * ever compared anything to 0.25, which means signing it would have changed
   * nothing on any screen. The drift verdict below is the first reader, and
   * that is what makes this entry mean what the table says it means — the
   * signature that landed on 2026-08-09 is the first one to change a screen.
   */
  patternDriftThreshold: {
    value: 0.25,
    provenance: 'signed',
    source: 'Sam 2026-08-09, signing session — 0.25 as proposed',
  },
  /**
   * How much of a week must be measured before a comparison against it is
   * honest. See THE COVERAGE REFUSAL below — this constant exists because a
   * well-logged week measured against thinly-logged history reads as a spike
   * that never happened.
   */
  minimumWeekCoverage: {
    value: 0.5,
    provenance: 'signed',
    source: 'Sam 2026-08-09, signing session — the honesty floor, flagged as '
      + 'the terminal\'s own and signed anyway',
  },
} as const satisfies Record<string, JournalLoadConstant<unknown>>;

/** A value plus the provenance of every constant that fed it. */
export interface Derived<T> {
  readonly value: T;
  readonly provenance: ConstantProvenance;
}

/**
 * Signed only when EVERY contributing constant was signed. Zero contributors is
 * `signed` on purpose and is load-bearing: a count of logged sessions is derived
 * from no constant at all, so it is honest without a signature.
 */
export function combineProvenance(
  ...provenances: readonly ConstantProvenance[]
): ConstantProvenance {
  return provenances.some((p) => p === 'proposed') ? 'proposed' : 'signed';
}

function derived<T>(value: T, ...from: readonly ConstantProvenance[]): Derived<T> {
  return { value, provenance: combineProvenance(...from) };
}

/**
 * THE ONLY DOOR A SURFACE MAY READ A DERIVED VALUE THROUGH.
 *
 * Returns null for anything whose provenance is `proposed`, so an athlete-facing
 * line cannot render an unsigned number even by accident. A surface that reads
 * `.value` directly is the violation this exists to make visible, and the gate
 * asserts no surface does.
 */
export function signedValue<T>(value: Derived<T>): T | null {
  return value.provenance === 'signed' ? value.value : null;
}

// ─── Inputs ──────────────────────────────────────────────────────────────

/**
 * One recorded session, as the load model reads it.
 *
 * THE TYPES ARE THE REAL STORED ONES, imported rather than re-declared, so a
 * change to what the app records reaches this module through the compiler
 * instead of through a hand-copied duplicate that quietly drifts.
 */
export interface JournalLoadSessionInput {
  readonly date: string;
  /** Main-lift snapshot as stored. Empty means no main lifts were recorded. */
  readonly strength: readonly StrengthExercisePerformanceLog[];
  /** The conditioning log as stored, or null when the flow never asked. */
  readonly conditioning: ConditioningPerformanceLog | null;
  /** The team-training result as stored, or null when the day was not one. */
  readonly teamTraining?: TeamTrainingSessionOutcome | null;
  /** The post-match result as stored, or null when the day was not a game. */
  readonly game?: GameSessionOutcome | null;
  /** Session effort 1-10 as stored — the strength half of strength sRPE. */
  readonly difficulty?: number | null;
  /** Actual strength minutes as stored. NEVER the planned value (Sam, option a). */
  readonly actualMinutes?: number | null;
}

export interface BuildJournalLoadInput {
  readonly weekStart: string;
  /** Every recorded session the app holds, this week's included, any order. */
  readonly sessions: readonly JournalLoadSessionInput[];
  /**
   * How many sessions THIS WEEK asked anything of the athlete. Supplied by the
   * caller because it is a fact about the projection, which this module does not
   * read — it is the denominator of coverage.
   */
  readonly sessionsPlannedThisWeek: number;
  /** This week's PLAN, for layer 4's plan-vs-done. Empty when unknown. */
  readonly plannedStrength: readonly PlannedLift[];
}

/** One planned main lift — the plan half of layer 4. */
export interface PlannedLift {
  readonly exerciseName: string;
  readonly sets: number;
  readonly repsMin: number;
  readonly repsMax: number;
  readonly weightKg: number | null;
}

// ─── Output ──────────────────────────────────────────────────────────────

export interface JournalSessionLoad {
  readonly date: string;
  /**
   * THE UNIT IS IN THE NAME, and that is not decoration. `SessionFeedback.strength`
   * holds MAIN LIFTS ONLY (`strengthLogging.isMainStrengthExercise`), so this is
   * main-lift tonnage and never whole-session tonnage. Naming it `tonnage` would
   * be `a-count-taken-for-a-record` in a new instrument.
   */
  readonly strengthMainLiftTonnageKg: number | null;
  /** sRPE AU — the athlete's difficulty rating times the session's minutes. */
  readonly conditioningSRPE: number | null;
  /** sRPE AU for team training — the same unit, from the same two halves. */
  readonly teamTrainingSRPE: number | null;
  /**
   * sRPE AU for a game — the same unit again, FULL and never weighted (Sam,
   * 2026-08-12). Null means the athlete did not supply both halves.
   */
  readonly gameSRPE: number | null;
  /**
   * sRPE AU for a strength session — effort times ACTUAL minutes. The fourth
   * and last kind. Null when either half is missing; planned minutes are never
   * substituted.
   */
  readonly strengthSRPE: number | null;
  /** Every completed component's athlete-reported minutes x RPE, in AU. */
  readonly completedLoadAU: number;
  /** Lifts whose tonnage could not be computed — reported, never assumed zero. */
  readonly liftsUnmeasured: number;
  /** True when either stream produced a number. */
  readonly measured: boolean;
  /** Per-muscle load. NEVER summed across regions — see distributeToRegions. */
  readonly regions: Readonly<Partial<Record<MuscleGroup, number>>>;
  readonly patternTonnageKg: Readonly<Record<MainStrengthPattern, number>>;
  readonly upperLowerTonnageKg: Readonly<{ upper: number; lower: number }>;
}

export interface JournalLoadWeekTotals {
  readonly weekStart: string;
  readonly strengthMainLiftTonnageKg: number;
  readonly conditioningSRPE: number;
  /** Canonical completed load across all recorded session kinds, in AU. */
  readonly completedLoadAU: number;
  readonly sessionsMeasured: number;
  readonly sessionsRecorded: number;
  readonly liftsUnmeasured: number;
  readonly regions: Readonly<Partial<Record<MuscleGroup, number>>>;
  readonly patternTonnageKg: Readonly<Record<MainStrengthPattern, number>>;
  readonly upperLowerTonnageKg: Readonly<{ upper: number; lower: number }>;
}

export interface StreamComparison {
  readonly thisWeek: number;
  /** The mean of the window's weeks that carried any measurement. */
  readonly normal: number;
  readonly ratio: number;
  readonly weeksUsed: number;
}

export type BandVerdict = 'below' | 'in' | 'above';

export interface JournalLoadHeadline {
  readonly ratio: number;
  readonly band: BandVerdict;
}

export interface RegionObservation {
  readonly region: MuscleGroup;
  readonly thisWeek: number;
  readonly previousBest: number;
  readonly weeksCompared: number;
}

export interface PatternShare {
  readonly pattern: MainStrengthPattern;
  readonly plannedShare: number;
  readonly doneShare: number;
}

/**
 * One pattern whose completed share has drifted past the signed threshold.
 *
 * THE SIGN IS KEPT, NOT ABSOLUTED. "You did more pushing than the week planned"
 * and "you did less" are different news to an athlete, and a magnitude alone
 * would report them identically.
 */
export interface PatternDrift {
  readonly pattern: MainStrengthPattern;
  /** Done share minus planned share. Positive means MORE than the plan asked. */
  readonly delta: number;
}

export interface PatternBalance {
  readonly shares: readonly PatternShare[];
  readonly upperSharePlanned: number;
  readonly upperShareDone: number;
  /**
   * The patterns past `patternDriftThreshold`, biggest drift first. Empty on a
   * balanced week — which is what makes the UI ruling's "balance drifting" card
   * an EARNED card rather than furniture.
   */
  readonly drifts: readonly PatternDrift[];
}

export interface JournalLoadCoverage {
  readonly sessionsMeasured: number;
  readonly sessionsPlanned: number;
  readonly liftsUnmeasured: number;
}

export interface JournalLoadModel {
  readonly weekStart: string;
  readonly thisWeek: JournalLoadWeekTotals;
  /** Completed weeks before this one, most recent first. */
  readonly history: readonly JournalLoadWeekTotals[];
  /** This week plus the three preceding calendar weeks, in completed-load AU. */
  readonly rollingFourWeekCompletedLoadAU: number;
  /** Constant-free facts about the evidence — signed by having no constants. */
  readonly coverage: Derived<JournalLoadCoverage>;
  readonly strengthStream: Derived<StreamComparison | null>;
  readonly conditioningStream: Derived<StreamComparison | null>;
  readonly headline: Derived<JournalLoadHeadline | null>;
  /**
   * The sweet-spot edges, in ratio-of-normal terms, for a surface that DRAWS the
   * band rather than speaking it.
   *
   * THE CONSTANT IS NOT READ DIRECTLY BY THE SURFACE, and that is the whole
   * reason this field exists. A screen that shaded a zone from
   * `JOURNAL_LOAD_CONSTANTS.sweetSpotBand.value` would put an unsigned number in
   * front of the athlete as a PICTURE — the same violation as printing it,
   * wearing a different medium, and invisible to the gate that watches for
   * `.value` on derived reads. Routed through `Derived` it is dark until Sam
   * signs it, exactly like the words are.
   */
  readonly sweetSpotBand: Derived<{ readonly low: number; readonly high: number }>;
  readonly regionObservations: Derived<readonly RegionObservation[]>;
  readonly patternBalance: Derived<PatternBalance | null>;
  /** Pattern shares alone are derived from NO constant, so they stand signed. */
  readonly patternSharesDone: Derived<readonly PatternShare[]>;
}

// ─── Week identity ───────────────────────────────────────────────────────

/**
 * The Monday an ISO date belongs to.
 *
 * Pure string in, string out — no device clock, so L14 holds. This is the ONE
 * owner of "which week does this record belong to" for the Journal; the screen's
 * history count reads it rather than repeating the arithmetic, because two
 * copies of a week boundary is `week-identity-two-owners` in miniature.
 */
export function journalWeekStartOf(dateISO: string): string | null {
  const date = new Date(`${dateISO}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const offsetToMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offsetToMonday);
  return date.toISOString().slice(0, 10);
}

/**
 * The `count` CALENDAR weeks immediately before `weekStart`, most recent first.
 *
 * THE WORD "CALENDAR" IS THE WHOLE POINT, and the first version of this module
 * got it wrong. It took the four most recently RECORDED weeks, which is a
 * different set the moment an athlete stops logging: a normal built from weeks
 * -1, -2, -3 and -20 is not a four-week normal, it is four scattered weeks
 * wearing that name, and the ratio computed against it would be confidently
 * false. "Rolling 4-week normal" in Sam's ruling means the four weeks that just
 * happened, and a gap in them is a gap — which the coverage rules then refuse
 * on, rather than quietly reaching further back to fill.
 */
export function calendarWeeksBefore(
  weekStart: string,
  count: number,
): readonly string[] {
  const weeks: string[] = [];
  const date = new Date(`${weekStart}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return weeks;
  for (let index = 0; index < count; index += 1) {
    date.setUTCDate(date.getUTCDate() - 7);
    weeks.push(date.toISOString().slice(0, 10));
  }
  return weeks;
}

// ─── Layer 1: the two native streams ─────────────────────────────────────

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * One main lift's tonnage — sets x reps x kg, from what was actually recorded.
 *
 * PREFERS THE ACTUAL, FALLS BACK TO THE PRESCRIBED, AND NEVER INVENTS. Real
 * logged sets win when the athlete logged them; otherwise the prescribed
 * snapshot stands in, which is the ruling's "assume-prescribed completion".
 *
 * THE ONE CASE THAT RETURNS NULL RATHER THAN A NUMBER: a PARTIAL completion with
 * no per-set detail. The app knows some of it happened and does not know how
 * much. Scaling the prescription by a guess would be exactly the "invents
 * precision" the ruling forbids, so the lift goes unmeasured and says so.
 */
export function liftTonnageKg(lift: StrengthExercisePerformanceLog): number | null {
  if (lift.completion === 'skipped') return 0;

  const weight = positive(lift.weightKg);
  if (weight === null) return null;

  const loggedSets = positive(lift.completedSets);
  if (lift.completion === 'partial' && loggedSets === null) return null;

  const sets = loggedSets ?? positive(lift.prescribedSets);
  if (sets === null) return null;

  const reps = positive(lift.actualReps)
    ?? displayReps(lift.prescribedRepsMin, lift.prescribedRepsMax);
  if (reps === null) return null;

  return sets * reps * weight;
}

/**
 * A conditioning session's sRPE AU — the athlete's rating times its minutes.
 *
 * Both halves are stored (`ConditioningPerformanceLog.rpe`, `.totalTimeMinutes`)
 * and both are optional, so a session logged without one is unmeasured rather
 * than half-counted.
 */
export function conditioningSRPE(log: ConditioningPerformanceLog | null): number | null {
  if (!log) return null;
  const rpe = positive(log.rpe);
  const minutes = positive(log.totalTimeMinutes);
  if (rpe === null || minutes === null) return null;
  return rpe * minutes;
}

/**
 * A team-training session's sRPE AU — the athlete's effort times its minutes.
 *
 * SAME SHAPE AS `conditioningSRPE` AND FOR THE SAME REASON: both halves are
 * stored (`TeamTrainingSessionOutcome.effort`, `.durationMinutes`), both are
 * validated at the transaction boundary, and a session missing either is
 * unmeasured rather than half-counted.
 *
 * WHY IT DID NOT EXIST UNTIL 2026-08-12 (seat item 6). The measurement that
 * opened that item said strength stores no effort and conditioning stores both
 * halves, and stopped there. Re-measured after the 1-10 effort scale landed,
 * TEAM TRAINING already stored both halves too — written by the feedback panel,
 * validated on the way in, and **read by nothing**. Third sighting in one day of
 * a value computed and never consumed (`achievedModerateDayCount`,
 * `canOverride`, this). `docs/EXPERIENCED_LOAD_MEASUREMENT_2026-08-12.md` §6.
 *
 * A GAME IS HERE NOW — see `gameSRPE` below. This comment used to say a game
 * was deliberately absent because nobody had ruled it. Sam ruled it 2026-08-12.
 */
export function teamTrainingSRPE(outcome: TeamTrainingSessionOutcome | null): number | null {
  if (!outcome) return null;
  const effort = positive(outcome.effort);
  const minutes = positive(outcome.durationMinutes);
  if (effort === null || minutes === null) return null;
  return effort * minutes;
}

/**
 * A game's sRPE AU — the athlete's body RPE times the minutes they were on.
 *
 * RULED BY SAM, 2026-08-12, after the question sat open under AWAITING SAM since
 * seat item 6: *"yes don't we do 'how long was your game?' and multiply by game
 * RPE for a score that counts toward load?"* — and the app already asked both
 * halves. `SessionFeedbackPanel` collects the duration and the 1-10 body RPE,
 * `parseGameSessionOutcome` validates both at the transaction boundary, and
 * until this function existed **nothing read either one.**
 *
 * FULL, NOT WEIGHTED, AND THAT IS THE RULING RATHER THAN THIS FILE'S CHOICE.
 * Sam was given the three options — full, discounted, or excluded — and chose
 * full: a game's minutes count in the same unit as every other session's. So
 * there is no coefficient here, and adding one later is a Bible change, not a
 * tweak. The earlier comment in `teamTrainingSRPE` said the opposite because
 * the question was genuinely open; it was replaced in the same commit that
 * closed it, because a stale comment beside a live reader is what sent four
 * previous measurements down the wrong path.
 *
 * SAME SHAPE AS ITS TWO SIBLINGS, INCLUDING THE PART THAT REFUSES: both halves
 * are stored and both are optional, so a game missing either is UNMEASURED
 * rather than half-counted. A game the athlete never rated must not read as a
 * light game.
 */
export function strengthSRPE(
  difficulty: number | null | undefined,
  actualMinutes: number | null | undefined,
): number | null {
  const effort = positive(difficulty ?? null);
  const minutes = positive(actualMinutes ?? null);
  if (effort === null || minutes === null) return null;
  return effort * minutes;
}

export function gameSRPE(outcome: GameSessionOutcome | null): number | null {
  if (!outcome) return null;
  const rpe = positive(outcome.bodyRpe);
  const minutes = positive(outcome.timeOnGroundMinutes);
  if (rpe === null || minutes === null) return null;
  return rpe * minutes;
}

/**
 * One completed-load owner. Each accepted feedback fact is visited once and
 * each genuinely measured component on that fact contributes once. Missing or
 * skipped work has no measured component and therefore contributes zero.
 */
export function completedSessionLoadAU(parts: {
  readonly strengthSRPE: number | null;
  readonly conditioningSRPE: number | null;
  readonly teamTrainingSRPE: number | null;
  readonly gameSRPE: number | null;
}): number {
  return (parts.strengthSRPE ?? 0)
    + (parts.conditioningSRPE ?? 0)
    + (parts.teamTrainingSRPE ?? 0)
    + (parts.gameSRPE ?? 0);
}

// ─── Layer 3: the region distribution ────────────────────────────────────

function addRegion(
  into: Partial<Record<MuscleGroup, number>>,
  muscle: MuscleGroup,
  amount: number,
): void {
  into[muscle] = (into[muscle] ?? 0) + amount;
}

/**
 * Spread one session's load over the muscles the SIGNED sheets say it loads.
 *
 * A primary muscle carries the whole load, a secondary carries
 * `regionSecondaryShare` of it. That deliberately does NOT conserve the total —
 * and it does not have to, because a region series is only ever compared with
 * ITS OWN history. Summing across regions would be meaningless and this module
 * never does it; the gate holds that line.
 */
function distributeToRegions(
  into: Partial<Record<MuscleGroup, number>>,
  load: number,
  primary: readonly MuscleGroup[],
  secondary: readonly MuscleGroup[],
): void {
  const share = JOURNAL_LOAD_CONSTANTS.regionSecondaryShare.value;
  for (const muscle of primary) addRegion(into, muscle, load);
  for (const muscle of secondary) addRegion(into, muscle, load * share);
}

/**
 * Which modality spelling the muscle sheet's owner understands.
 *
 * The logging vocabulary and the template vocabulary are two different sets and
 * always were — the logger says `assault_bike` and `rower` where the sheet says
 * `air_bike` and `row`. Translated ONCE, here, at the boundary between them,
 * rather than at every call site. A mode with no muscle row (`swim`, `other`)
 * answers null and its session simply carries no region load — an absent answer,
 * never an invented one.
 */
function modalityForMuscleLookup(
  mode: ConditioningPerformanceLog['mode'],
): 'run' | 'bike' | 'air_bike' | 'ski' | 'row' | 'mixed' | null {
  switch (mode) {
    case 'run': return 'run';
    case 'bike': return 'bike';
    case 'assault_bike': return 'air_bike';
    case 'ski': return 'ski';
    case 'rower': return 'row';
    case 'mixed': return 'mixed';
    default: return null;
  }
}

// ─── Layer 4: the pattern ledger ─────────────────────────────────────────

function emptyPatternLedger(): Record<MainStrengthPattern, number> {
  return emptyMainStrengthLedger();
}

/**
 * Which main pattern an exercise NAME belongs to.
 *
 * Two existing owners in series, no new mapping: `getExerciseTags` owns name →
 * movement, and `mainPatternForExerciseMovement` owns movement → main pattern.
 * A third table here would be the `one-predicate-grows-copies` shape, and this
 * repo has already paid for that one.
 */
function patternForExerciseName(name: string): MainStrengthPattern | null {
  return mainPatternForExerciseMovement(getExerciseTags(name)?.movement);
}

function upperOrLowerForExerciseName(name: string): 'upper' | 'lower' | null {
  const region = getExerciseTags(name)?.region;
  if (region === 'upper') return 'upper';
  if (region === 'lower') return 'lower';
  return null;
}

function plannedLiftTonnageKg(lift: PlannedLift): number | null {
  const weight = positive(lift.weightKg);
  const sets = positive(lift.sets);
  const reps = displayReps(lift.repsMin, lift.repsMax);
  if (weight === null || sets === null || reps === null) return null;
  return sets * reps * weight;
}

function sharesFromLedger(
  ledger: Record<MainStrengthPattern, number>,
): Record<MainStrengthPattern, number> {
  const total = STRENGTH_PATTERN_ORDER.reduce((sum, p) => sum + ledger[p], 0);
  const shares = emptyPatternLedger();
  if (total <= 0) return shares;
  for (const pattern of STRENGTH_PATTERN_ORDER) {
    shares[pattern] = ledger[pattern] / total;
  }
  return shares;
}

// ─── Session derivation ──────────────────────────────────────────────────

export function deriveSessionLoad(
  session: JournalLoadSessionInput,
): JournalSessionLoad {
  const regions: Partial<Record<MuscleGroup, number>> = {};
  const patternTonnageKg = emptyPatternLedger();
  const upperLower = { upper: 0, lower: 0 };

  let strengthTotal = 0;
  let strengthMeasuredLifts = 0;
  let liftsUnmeasured = 0;

  for (const lift of session.strength) {
    const tonnage = liftTonnageKg(lift);
    if (tonnage === null) {
      liftsUnmeasured += 1;
      continue;
    }
    strengthMeasuredLifts += 1;
    strengthTotal += tonnage;

    const pattern = patternForExerciseName(lift.exerciseName);
    if (pattern) patternTonnageKg[pattern] += tonnage;

    const side = upperOrLowerForExerciseName(lift.exerciseName);
    if (side) upperLower[side] += tonnage;

    const muscles = muscleMetadataFor(lift.exerciseName);
    if (muscles) distributeToRegions(regions, tonnage, muscles.primary, muscles.secondary);
  }

  const teamSrpe = teamTrainingSRPE(session.teamTraining ?? null);
  const matchSrpe = gameSRPE(session.game ?? null);
  const liftSrpe = strengthSRPE(session.difficulty ?? null, session.actualMinutes ?? null);
  const srpe = conditioningSRPE(session.conditioning);
  const completedLoadAU = completedSessionLoadAU({
    strengthSRPE: liftSrpe,
    conditioningSRPE: srpe,
    teamTrainingSRPE: teamSrpe,
    gameSRPE: matchSrpe,
  });
  if (srpe !== null && session.conditioning) {
    const muscles = conditioningSessionMuscles({
      exercise: session.conditioning.sessionName ?? '',
      modality: modalityForMuscleLookup(session.conditioning.mode),
    });
    if (muscles) distributeToRegions(regions, srpe, muscles.primary, muscles.secondary);
  }

  // AN EMPTY STRENGTH ARRAY IS ZERO, NOT UNKNOWN — a session that recorded no
  // main lifts genuinely put no main-lift tonnage on the athlete. Unknown is
  // reserved for lifts that exist and could not be computed, which is why the
  // two are counted separately rather than collapsed into one nullable number.
  const strengthMainLiftTonnageKg = session.strength.length === 0
    ? 0
    : (strengthMeasuredLifts > 0 ? strengthTotal : null);

  return {
    date: session.date,
    strengthMainLiftTonnageKg,
    conditioningSRPE: srpe,
    teamTrainingSRPE: teamSrpe,
    gameSRPE: matchSrpe,
    strengthSRPE: liftSrpe,
    completedLoadAU,
    liftsUnmeasured,
    // A TEAM NIGHT THE ATHLETE RATED IS A MEASURED SESSION. Leaving it out of
    // this flag would have the week report "unmeasured" for a day whose load
    // the athlete supplied in full. A RATED GAME IS THE SAME (Sam, 2026-08-12) —
    // and a game day is the one the athlete is most likely to notice missing.
    measured: strengthMeasuredLifts > 0
      || srpe !== null
      || teamSrpe !== null
      || matchSrpe !== null
      || liftSrpe !== null,
    regions,
    patternTonnageKg,
    upperLowerTonnageKg: upperLower,
  };
}

// ─── Week totals ─────────────────────────────────────────────────────────

function totalsForWeek(
  weekStart: string,
  sessions: readonly JournalSessionLoad[],
): JournalLoadWeekTotals {
  const regions: Partial<Record<MuscleGroup, number>> = {};
  const patternTonnageKg = emptyPatternLedger();
  const upperLower = { upper: 0, lower: 0 };
  let strength = 0;
  let conditioning = 0;
  let completedLoadAU = 0;
  let measured = 0;
  let liftsUnmeasured = 0;

  for (const session of sessions) {
    strength += session.strengthMainLiftTonnageKg ?? 0;
    conditioning += session.conditioningSRPE ?? 0;
    completedLoadAU += session.completedLoadAU;
    if (session.measured) measured += 1;
    liftsUnmeasured += session.liftsUnmeasured;
    for (const [muscle, amount] of Object.entries(session.regions)) {
      addRegion(regions, muscle as MuscleGroup, amount ?? 0);
    }
    for (const pattern of STRENGTH_PATTERN_ORDER) {
      patternTonnageKg[pattern] += session.patternTonnageKg[pattern];
    }
    upperLower.upper += session.upperLowerTonnageKg.upper;
    upperLower.lower += session.upperLowerTonnageKg.lower;
  }

  return {
    weekStart,
    strengthMainLiftTonnageKg: strength,
    conditioningSRPE: conditioning,
    completedLoadAU,
    sessionsMeasured: measured,
    sessionsRecorded: sessions.length,
    liftsUnmeasured,
    regions,
    patternTonnageKg,
    upperLowerTonnageKg: upperLower,
  };
}

// ─── Layer 2: ratio space ────────────────────────────────────────────────

/**
 * THE COVERAGE REFUSAL.
 *
 * A ratio is only honest when its two sides were measured the same way. A week
 * where the athlete logged everything, held against weeks where they logged
 * little, reads as a spike that never happened — the number would be right and
 * the story it tells would be false. So a comparison is REFUSED rather than
 * returned when this week is too thinly measured, and history weeks with no
 * measurement at all are excluded from the normal instead of averaged in as
 * zeroes.
 */
function compareStream(
  thisWeek: number,
  /** The window's weeks in calendar order, 0 where the week holds nothing. */
  windowValues: readonly number[],
): StreamComparison | null {
  const withData = windowValues.filter((value) => value > 0);
  if (withData.length < JOURNAL_LOAD_CONSTANTS.streamNormalWindowWeeks.value) return null;
  const normal = withData.reduce((sum, value) => sum + value, 0) / withData.length;
  if (normal <= 0) return null;
  return { thisWeek, normal, ratio: thisWeek / normal, weeksUsed: withData.length };
}

function bandFor(ratio: number): BandVerdict {
  const band = JOURNAL_LOAD_CONSTANTS.sweetSpotBand.value;
  if (ratio < band.low) return 'below';
  if (ratio > band.high) return 'above';
  return 'in';
}

// ─── The model ───────────────────────────────────────────────────────────

export function buildJournalLoadModel(input: BuildJournalLoadInput): JournalLoadModel {
  const byWeek = new Map<string, JournalSessionLoad[]>();
  for (const session of input.sessions) {
    const weekStart = journalWeekStartOf(session.date);
    if (weekStart === null) continue;
    const bucket = byWeek.get(weekStart);
    if (bucket) bucket.push(deriveSessionLoad(session));
    else byWeek.set(weekStart, [deriveSessionLoad(session)]);
  }

  const thisWeekSessions = byWeek.get(input.weekStart) ?? [];
  const thisWeek = totalsForWeek(input.weekStart, thisWeekSessions);
  const history = Array.from(byWeek.keys())
    .filter((weekStart) => weekStart < input.weekStart)
    .sort((a, b) => b.localeCompare(a))
    .map((weekStart) => totalsForWeek(weekStart, byWeek.get(weekStart) ?? []));

  /**
   * A window's weeks, resolved to totals. A calendar week the athlete recorded
   * nothing in resolves to `null` — an absent week, not a zero one — and each
   * reader decides what absence means for it. Both readers exclude it, and both
   * then find themselves short of their window, which is the refusal.
   */
  const windowTotals = (count: number): readonly (JournalLoadWeekTotals | null)[] =>
    calendarWeeksBefore(input.weekStart, count)
      .map((weekStart) => {
        const sessions = byWeek.get(weekStart);
        return sessions ? totalsForWeek(weekStart, sessions) : null;
      });

  const streamWindow = windowTotals(JOURNAL_LOAD_CONSTANTS.streamNormalWindowWeeks.value);
  const rollingFourWeekCompletedLoadAU = thisWeek.completedLoadAU
    + windowTotals(3).reduce((sum, week) => sum + (week?.completedLoadAU ?? 0), 0);

  // ── Coverage: derived from NO constant, so it stands signed ──
  const coverage = derived<JournalLoadCoverage>({
    sessionsMeasured: thisWeek.sessionsMeasured,
    sessionsPlanned: input.sessionsPlannedThisWeek,
    liftsUnmeasured: thisWeek.liftsUnmeasured,
  });

  // ── THE FALLBACK RUNG IS NOT HERE, AND ITS ABSENCE IS THE RULING ──
  //
  // Sam's 2/1/0 rung keeps the week's number whole when nothing was measured. It
  // is scored from a day's SHAPE, and a shape needs the projection plus the
  // hardness owner — so it exists for THIS week and for no past week (measured:
  // docs/JOURNAL_LOAD_SLICE_PLAN_2026-08-09.md §2b). It therefore cannot be a
  // term in a ratio, because a ratio needs both sides in the same unit.
  //
  // THE FIRST VERSION OF THIS MODULE CARRIED IT ANYWAY, taking a per-session
  // weight at its door and summing one. That was a SECOND OWNER of a number
  // `journalWeek` already derives (`JournalWeek.load.thisWeek`), computed over a
  // different input set — recorded sessions rather than the week's days — so the
  // two would have disagreed for any week the athlete had not finished logging.
  // It also read 0 for a week with nothing recorded, which is the "small week"
  // lie in its most direct form.
  //
  // So the rung is not passed in, not derived here, and not returned. The claim
  // "the rung never enters ratio space" stops being something a cell has to
  // check and becomes something this module cannot express: it has no access to
  // the rung at all. That is the same move the north star asks for everywhere —
  // remove the representation instead of guarding it.

  const coverageOk = input.sessionsPlannedThisWeek === 0
    ? false
    : thisWeek.sessionsMeasured / input.sessionsPlannedThisWeek
      >= JOURNAL_LOAD_CONSTANTS.minimumWeekCoverage.value;

  const strengthComparison = coverageOk
    ? compareStream(
      thisWeek.strengthMainLiftTonnageKg,
      streamWindow.map((week) => week?.strengthMainLiftTonnageKg ?? 0),
    )
    : null;
  const conditioningComparison = coverageOk
    ? compareStream(
      thisWeek.conditioningSRPE,
      streamWindow.map((week) => week?.conditioningSRPE ?? 0),
    )
    : null;

  const streamProvenance = combineProvenance(
    JOURNAL_LOAD_CONSTANTS.streamNormalWindowWeeks.provenance,
    JOURNAL_LOAD_CONSTANTS.minimumWeekCoverage.provenance,
  );
  const strengthStream = derived(strengthComparison, streamProvenance);
  const conditioningStream = derived(conditioningComparison, streamProvenance);

  // ── The headline: ratios only, never raw units (the ruling's law) ──
  const weighting = JOURNAL_LOAD_CONSTANTS.streamWeighting.value;
  let headlineValue: JournalLoadHeadline | null = null;
  if (strengthComparison && conditioningComparison) {
    const ratio = strengthComparison.ratio * weighting.strength
      + conditioningComparison.ratio * weighting.conditioning;
    headlineValue = { ratio, band: bandFor(ratio) };
  } else if (strengthComparison || conditioningComparison) {
    // ONE STREAM IS STILL A HONEST CONTINUUM — weighting two ratios when only
    // one exists would silently halve it, which is the arithmetic version of
    // inventing data.
    const only = (strengthComparison ?? conditioningComparison) as StreamComparison;
    headlineValue = { ratio: only.ratio, band: bandFor(only.ratio) };
  }
  const headline = derived(
    headlineValue,
    streamProvenance,
    JOURNAL_LOAD_CONSTANTS.streamWeighting.provenance,
    JOURNAL_LOAD_CONSTANTS.sweetSpotBand.provenance,
  );

  // ── Layer 3: observation lines, never diagnosis ──
  //
  // THE SAME CALENDAR WINDOW, for the same reason. "Biggest week in the last
  // four weeks" is a sentence about four weeks that happened; counting the last
  // four weeks the athlete happened to log would make it a sentence about an
  // unbounded stretch of time, and the line says a number of weeks out loud.
  const regionWindow = windowTotals(
    JOURNAL_LOAD_CONSTANTS.regionNormalWindowWeeks.value,
  );
  // Weeks that actually hold a record — what the line is honest to claim it
  // looked at. A brand-new athlete does not hear "in the last 4 weeks".
  const regionWeeksRecorded = regionWindow.filter((week) => week !== null).length;
  const observations: RegionObservation[] = [];
  if (regionWeeksRecorded > 0) {
    for (const [muscle, amount] of Object.entries(thisWeek.regions)) {
      const load = amount ?? 0;
      if (load <= 0) continue;
      const previousBest = regionWindow.reduce(
        (best, week) => Math.max(best, week?.regions[muscle as MuscleGroup] ?? 0),
        0,
      );
      // THE THRESHOLD IS APPLIED TO THE EXISTING VALUE, NOT BESIDE IT. A second
      // derived value meaning "ran hot" next to one meaning "exceeded its best"
      // is two representations of one fact, and the second one to be written is
      // the one that goes stale. The line this feeds ("biggest week for X in
      // the last N weeks") stays true a fortiori under a stricter test.
      const hotThreshold = previousBest * JOURNAL_LOAD_CONSTANTS.regionHotRatio.value;
      const comparisonTolerance = Number.EPSILON * Math.max(Math.abs(load), Math.abs(hotThreshold), 1);
      if (previousBest > 0 && load + comparisonTolerance >= hotThreshold) {
        observations.push({
          region: muscle as MuscleGroup,
          thisWeek: load,
          previousBest,
          weeksCompared: regionWeeksRecorded,
        });
      }
    }
    observations.sort((a, b) => b.thisWeek - a.thisWeek);
  }
  const regionObservations = derived<readonly RegionObservation[]>(
    observations,
    JOURNAL_LOAD_CONSTANTS.regionNormalWindowWeeks.provenance,
    JOURNAL_LOAD_CONSTANTS.regionSecondaryShare.provenance,
    JOURNAL_LOAD_CONSTANTS.regionHotRatio.provenance,
  );

  // ── Layer 4: plan vs done ──
  const plannedLedger = emptyPatternLedger();
  const plannedUpperLower = { upper: 0, lower: 0 };
  for (const lift of input.plannedStrength) {
    const tonnage = plannedLiftTonnageKg(lift);
    if (tonnage === null) continue;
    const pattern = patternForExerciseName(lift.exerciseName);
    if (pattern) plannedLedger[pattern] += tonnage;
    const side = upperOrLowerForExerciseName(lift.exerciseName);
    if (side) plannedUpperLower[side] += tonnage;
  }

  const doneShares = sharesFromLedger(thisWeek.patternTonnageKg);
  const plannedShares = sharesFromLedger(plannedLedger);
  const shares: PatternShare[] = STRENGTH_PATTERN_ORDER.map((pattern) => ({
    pattern,
    plannedShare: plannedShares[pattern],
    doneShare: doneShares[pattern],
  }));

  const upperLowerShare = (totals: { upper: number; lower: number }): number => {
    const total = totals.upper + totals.lower;
    return total > 0 ? totals.upper / total : 0;
  };

  const hasPlan = input.plannedStrength.length > 0;
  const hasDone = STRENGTH_PATTERN_ORDER.some((p) => thisWeek.patternTonnageKg[p] > 0);

  // THE FIRST READER THE THRESHOLD HAS EVER HAD. The constant has been in the
  // signing table since the load slice and no code compared anything to it, so
  // `patternBalance` depended on a number it never used. It uses it now.
  const driftThreshold = JOURNAL_LOAD_CONSTANTS.patternDriftThreshold.value;
  const drifts: PatternDrift[] = shares
    .map((share) => ({ pattern: share.pattern, delta: share.doneShare - share.plannedShare }))
    .filter((drift) => Math.abs(drift.delta) >= driftThreshold)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const patternBalance = derived<PatternBalance | null>(
    hasPlan && hasDone
      ? {
        shares,
        upperSharePlanned: upperLowerShare(plannedUpperLower),
        upperShareDone: upperLowerShare(thisWeek.upperLowerTonnageKg),
        drifts,
      }
      : null,
    JOURNAL_LOAD_CONSTANTS.patternDriftThreshold.provenance,
  );

  // The completed shares alone are derived from no constant at all, so they
  // stand signed even while the plan-vs-done VERDICT waits on its threshold.
  const patternSharesDone = derived<readonly PatternShare[]>(
    hasDone ? shares : [],
  );

  return {
    weekStart: input.weekStart,
    thisWeek,
    history,
    rollingFourWeekCompletedLoadAU,
    coverage,
    strengthStream,
    conditioningStream,
    headline,
    sweetSpotBand: derived(
      JOURNAL_LOAD_CONSTANTS.sweetSpotBand.value,
      JOURNAL_LOAD_CONSTANTS.sweetSpotBand.provenance,
    ),
    regionObservations,
    patternBalance,
    patternSharesDone,
  };
}
