/**
 * THE COMPOSER — slice B1, checkpoint 1. `composeWeek(inputs) -> ComposedWeek`,
 * a PURE function: no store, no clock, no network, no logging.
 *
 * **WHAT IT REPLACES.** `fallbackExercisesForPlanEntry` (`defaultProgram.ts:1065`)
 * — fifteen hardcoded branches, eleven returning exactly three rows into a
 * five-slot ladder. Written as the COMPLETION path for days the AI omitted, it
 * became the sole author of every composed strength row when R-091 severed the
 * AI. The 2026-08-14 baseline measured what that ships: 126 of 318 laddered days
 * miss Sam's ladder.
 *
 * **SLOTS, THEN ROWS — never rows, then hope.** A day declares which of Sam's
 * slots it owes, the slots the KIT cannot train are dropped (R-083), and each
 * surviving slot is filled from the authorised pools. A row is never selected
 * before the slot that wants it is named, which is the whole difference from a
 * hardcoded list: the list could not say what it was missing.
 *
 * **NO REPAIR.** Nothing here reacts to a later verdict. An unfillable slot is a
 * TYPED, DISCLOSED gap (clause e), never patched by a restore pass, a rotation
 * rewrite or a top-up. Kill criterion 1 of this slice is the composer needing
 * even one post-composition repair to be safe.
 *
 * **NO CONDITIONING** (taken from the existing adapter unchanged), and **NO
 * `history` OR `decisions` INPUT** — both are deliberately absent until the
 * slice that gives each a reader (B2; the authorship slice). A field with no
 * reader is the `canOverride` shape: written nine times, read zero.
 */
import {
  FULL_BODY_DAY_SIZE,
  SLOTS_FOR_KIND,
  OPTIONAL_UPPER_SUPPORT_SLOTS,
  WEEKLY_COVERAGE_SET,
  slotsForExerciseName,
  slotsForKind,
  type SessionSlot,
  type SlotDayKind,
} from './sessionSlotCoverage';
import {
  composedIdentityFor,
  composedRowGapReason,
  composedRowIsLegal,
  type ComposedExerciseIdentity,
} from './composedRowLegality';
import {
  decideExerciseForBlock,
  selectionSeatIndex,
  type BlockExerciseSelection,
  type SelectionRole,
} from './blockExerciseSelection';
import { slotCountsTowardSetBudget } from './weeklyProgrammingContract';
import { POOL_REGISTRY, preferAutomaticCurlCandidates } from '../data/exercisePools';
import {
  ladderLevelForProfile,
  visibleGatesForLadderLevel,
  type ExperienceGate,
} from './experienceCrosswalk';
import { EXERCISE_MUSCLE_METADATA } from '../data/muscleExperienceMetadata';
import {
  applySourceBoundAutomaticRegression,
  sourceBoundAutomaticIdentityFor,
  sourceBoundRegressionIsEligible,
  sourceBoundRegressionTarget,
} from './sourceBoundExerciseRegression';
import type { MainStrengthPattern, StrengthIntent } from './strengthPatternContributions';
import {
  STRENGTH_POOLS,
  findPoolEntry,
  type ComposedDoseCategory,
  type PoolSlotKey,
} from '../data/exercisePoolsStrength';
import { resolveComposedDose, resolveComposedLoad } from './composedDose';
import { exerciseProgrammingAllows } from '../utils/exerciseFilter';
import type { OffseasonSubphase } from './offseasonSubphase';
import type { OnboardingData, SeasonPhase } from '../types/domain';
import { selectableExerciseNames } from '../data/selectableExerciseVocabulary';
import {
  rankSelectedFirst,
  type AutomaticCandidateRejection,
  type AutomaticCandidateTrace,
  type AutomaticProgrammingSelectionTrace,
} from './programmingSelectionTrace';
import {
  exerciseVariationFamily,
  sameExerciseVariationFamily,
  type ExerciseVariationFamily,
} from './exerciseVariationFamily';
import {
  TRACKED_LIFTS,
  displacedTrackedLiftDefaults,
  selectedTrackedLiftForPattern,
  selectedTrackedLiftProgrammingSeat,
  type TrackedLiftChoices,
  type TrackedLiftProgrammingPattern,
} from './estimatedOneRepMax';
import {
  FOOTBALL_ROBUSTNESS_CATEGORIES,
  footballRobustnessCategoriesForExercise,
  type FootballRobustnessCategory,
} from './footballRobustnessFoundation';
import {
  createWeeklyStrengthBudget,
  isWeeklyMainStrengthSlot,
} from './weeklyStrengthBudget';
import {
  asComposedIdentity,
  automaticExerciseRouteForIdentity,
  automaticExerciseSuppliesPosteriorChain,
  automaticIsolationSupportCandidatesForSlot,
  automaticPrehabFallbacksForSlot,
  createAutomaticWeeklyExerciseSelector,
} from './automaticWeeklyExerciseSelection';
import {
  MINIMUM_USEFUL_STRENGTH_EXERCISES,
  minimumUsefulStrengthApplies,
} from './minimumUsefulStrengthSession';

// ─── INPUTS. Every field has a reader in CP1, or it does not exist yet. ─────

export interface ComposerPlannedDay {
  /** From the canonical fixture-aware scheduler; null explicitly means no game. */
  readonly daysToGame?: number | null;
  readonly dayOfWeek: number;
  /** Is the club running a session on this day? Read by the full-body shape. */
  readonly isTeamDay: boolean;
  readonly planEntryId: string;
  readonly strengthIntent: StrengthIntent;
  /** The planner's own name and tier. Composition never renames a day. */
  readonly name: string;
  readonly workoutType: string;
  readonly sessionTier: string;
}

/** Injury as FACTS, not as an outcome. */
export interface ComposerInjuryInput {
  readonly prohibitedPatterns: readonly MainStrengthPattern[];
  /** Out for EVERY day of this week. Injury exclusions and week-spanning athlete answers. */
  readonly excludedIdentities: readonly string[];
  /**
   * OUT ON PARTICULAR DAYS ONLY — the athlete's "Today only" answer, and any
   * scoped exclusion whose span ends inside this week.
   *
   * It exists because the composer authors a WEEK in one call and Sam's approved
   * contract gives the athlete's answer three different spans. Folding a
   * one-day answer into `excludedIdentities` would take the exercise out of
   * Thursday as well — the athlete said *today*, and the contract's first proof
   * case is that it "returns later". Keyed by ISO date.
   */
  readonly excludedIdentitiesByDate?: Readonly<Record<string, readonly string[]>>;
}

export interface ComposerInputs {
  /**
   * The athlete's answers. Read for season phase, experience level AND — since
   * B1-M1-COMPLETION — the base working load, which `estimateStartingWeight`
   * derives from his own strength answers and bodyweight.
   */
  readonly profile: OnboardingData;
  /** Read for the week number that moves selection along the authored order. */
  readonly phaseClock: { readonly weekNumber: number };
  /** B1-M1: the phase the DOSE is resolved against, before authorship. */
  readonly seasonPhase: SeasonPhase;
  readonly offseasonSubphase: OffseasonSubphase | null;
  /** Calendar/fixtures, as the planner resolved them onto days. */
  readonly plannedDays: readonly ComposerPlannedDay[];
  /**
   * THE ATHLETE'S **PERMANENT** KIT — what they own, not what they can reach
   * today. The corrected sheet is the oracle; this is its input.
   *
   * ⚠ **THIS DECIDES THE RECORDED BASE SELECTION**, so a temporary answer must
   * never arrive here. See `temporaryKitByDayOfWeek` for where one goes and why.
   */
  readonly kit: readonly string[];
  /**
   * ── THE DATED REMOVAL, KEPT OUT OF THE RECORD ─────────────────────────────
   *
   * The kit actually reachable on a given weekday, present ONLY for days a dated
   * fact has taken something off. Absent — or a day without an entry — means the
   * permanent kit, so a world with no trip is byte-identical to before.
   *
   * **WHY IT IS A SECOND INPUT RATHER THAN A NARROWER `kit`.** `kit` used to be
   * one flat list resolved at ONE date for the whole week, and this file said so
   * in its own words: *"Equipment is deliberately in BOTH … an exercise the
   * athlete genuinely cannot perform is replaced in the base selection rather
   * than retained with a warning."* That is right for a PERMANENT change and
   * wrong for a five-day holiday, and a flat list cannot tell them apart.
   *
   * Measured 2026-08-17 (`npm run trace:equipment-scopes`, B6 against B0) with
   * the old single kit: an away week RECORDED `Back Squat → Goblet Squat`,
   * `Barbell Row → Single-Arm DB Row`, `Bench Press → Single-Arm DB Floor
   * Press`, `Bulgarian Split Squats → Cossack Squat`, `Ab Wheel → Band Pallof
   * Press`, and lost `vertical_pull` outright — nine slots recorded instead of
   * ten. **A holiday became the athlete's permanent rotation history.**
   *
   * Sam's rulings this serves: *"Temporary substitutions never become pins,
   * exclusions or permanent rotation history"*, and *"on the return date the
   * base legal selection returns automatically"* — which it now does with no
   * expiry code anywhere, because the day simply stops carrying an entry.
   */
  readonly temporaryKitByDayOfWeek?: Readonly<Record<number, readonly string[]>>;
  readonly injuries: ComposerInjuryInput;
  /** Read to stamp the week the composed days belong to. */
  readonly todayISO: string;
  /**
   * ── WHAT THE SELECTION OWNER NEEDS. See `rules/blockExerciseSelection.ts`. ────────
   *
   * Selection is keyed by the BLOCK, so the composer has to know which block it
   * is building. `phaseClock.weekNumber` above cannot answer it: it advances
   * every week, which is exactly the defect the rotation owner replaced.
   */
  /** 1-based block number. A deload shares its build block's number. */
  readonly blockNumber: number;
  /* ⚠ `weekInBlock` and `isDeloadWeek` USED TO LIVE HERE AND ARE GONE, NOT
   * DEFAULTED. Ruling 2 made the cadence purely block-keyed, so a deload — week
   * 4 of the same block — is identical for free. Keeping them as ignored inputs
   * would leave two ways to describe one week and invite a future reader to wire
   * one back in. */
  /** The athlete's canonical pinned preferences, as composed identities. */
  readonly pinnedIdentities: readonly ComposedExerciseIdentity[];
  /**
   * Identities `blockBoundaryProgression.progressedFromOwnHistory` says the
   * athlete trained and earned a rise on. The rotation owner reads this one fact
   * as the contract's *"progression, comfort and technical continuity justify
   * it"*. It rules nothing new; it reads the existing decision.
   */
  readonly progressedIdentities: readonly ComposedExerciseIdentity[];
  /** Monday ISO of the block being authored — the selection record's identity. */
  readonly blockStartISO: string;
  /**
   * RECORDED selections for earlier blocks, most recent first.
   *
   * ⚠ **PASSED IN, NEVER READ FROM A STORE HERE.** *"No hidden store reads
   * inside the domain selector."* Generation reads
   * `blockSelectionHistoryStore` and hands the rows down, so boot and rollover
   * feed the same history explicitly and the composer stays pure.
   */
  readonly selectionHistory: readonly BlockExerciseSelection[];
  /**
   * A mid-week remainder keeps these already delivered automatic rows fixed.
   * They seed weekly identity/family state only when composition reaches the
   * governed date; re-authored history before that date is later replaced by
   * the accepted rows and must not spend the remainder's choices.
   */
  readonly automaticSelectionHistory?: {
    readonly governedFromISO: string;
    readonly identities: readonly string[];
  };
  /** The athlete's four Progress choices are strength-programming inputs. */
  readonly trackedLiftChoices?: TrackedLiftChoices;
}

// ─── OUTPUT ────────────────────────────────────────────────────────────────

export type ComposedRowRole = 'main_strength' | 'strength_accessory';

export interface ComposedRow {
  readonly restSeconds?: number;
  readonly notes?: string;
  /** Clause (b): ONE identity for selection, legality, storage and comparison. */
  readonly identity: ComposedExerciseIdentity;
  readonly slot: SessionSlot;
  readonly role: ComposedRowRole;
  readonly mainStrengthPattern: MainStrengthPattern | null;
  /** B1-M1: the typed dose owner (Sam's U-1/U-3/U-4), authored on the pool entry. */
  readonly doseCategory: ComposedDoseCategory;
  readonly sets: number;
  readonly repsMin: number;
  readonly repsMax: number;
  /** Resolved before authorship; U-2's off-season cut is already inside it. */
  readonly load: number;
  readonly qualityLimit?: 'stop_when_speed_or_technique_drops';
  /**
   * Slice 5 (Sam, 2026-08-23): set when the dose owner returned an authored
   * ISOMETRIC dose — `repsMin/repsMax` are then seconds (or minutes), exactly
   * as the pool entry authors them, carried to the stored row so no surface
   * can re-read a hold as reps. ('distance' left with R-133: no composed row
   * prescribes metres any more.)
   */
  readonly prescriptionType?: 'reps' | 'duration' | 'duration_minutes';
  readonly perSide?: boolean;
  /**
   * Present only when this row is a TEMPORARY SUBSTITUTE for the block's base
   * selection — a day-scoped exclusion took the canonical exercise out of this
   * one session. The base selection is unchanged and still recorded, so the
   * canonical exercise returns by itself when the answer expires.
   *
   * Absent means this row IS the block's base selection.
   */
  readonly substitutedFor?: {
    readonly baseIdentity: ComposedExerciseIdentity;
    /**
     * `'kit_today'` joined `'excluded_today'` on 2026-08-17. Both are day-scoped
     * answers that leave the record alone, and they are kept apart because they
     * have different answers for the athlete: a dated kit loss ends by itself on
     * the return date, an exclusion ends when the athlete restores the exercise.
     * The same distinction `ComposedGap.cause` already draws.
     */
    readonly cause: 'excluded_today' | 'kit_today' | 'already_on_day';
  };
}

/**
 * Clause (e): a gap the athlete is TOLD about — derived from kit, the sheet and
 * the athlete's own exclusions, never from records.
 *
 * ── `cause` GREW A SECOND MEMBER, AND THE REASON IS A CONTRACT CLAUSE ──────
 *
 * Sam's approved Block Two contract: *"If the exclusion makes the pattern
 * impossible, disclose the gap rather than restoring the exercise."* Before this
 * change every gap was stamped `'kit'`, including the ones an EXCLUSION had
 * caused — so the app told an athlete who had banned every legal row in a slot
 * that their equipment was the problem. That is not a wording nit: the two
 * causes have different answers. A kit gap is fixed by buying or booking
 * equipment; an exclusion gap is fixed by the athlete restoring the exercise,
 * and only the athlete can do it.
 *
 * `'kit'` remains the answer whenever the kit ALONE would have emptied the slot,
 * so an athlete who both lacks the bar and banned the bodyweight option is told
 * about the kit — the thing they cannot train at all outranks the thing they
 * chose.
 */
export interface ComposedGap {
  readonly dayOfWeek: number;
  readonly slot: SessionSlot;
  readonly cause: 'kit' | 'exclusion' | 'already_on_day';
  readonly wouldNeed: string | null;
  /**
   * The exercises the athlete left out that emptied this slot. Set only on an
   * `'exclusion'` gap, so Status and the day screen can name them rather than
   * report an anonymous hole.
   */
  readonly excludedHere?: readonly string[];
  /**
   * SET WHEN THE SLOT WAS DROPPED BUT ITS PATTERN SURVIVED IN THE OTHER PLANE.
   * Sam, 2026-08-14, asked what to do when the opposite pull plane is
   * impossible: *"yes repeat achievable pull plane"*. The repeat is the answer;
   * this field is the disclosure that goes with it, so a repeated plane is never
   * mistaken for the app forgetting the other one.
   */
  readonly repeatedPlaneInstead?: SessionSlot;
}

/**
 * The shape a composed day answers to — **the LADDER OWNER'S own vocabulary, not
 * a second one beside it.** This was `SlotDayKind | 'full_body_a' | 'full_body_b'`
 * while the composer held the full-body lists privately; the two extra members
 * are now `SlotDayKind` members, so `SLOTS_FOR_KIND[kind]` answers for every
 * shape the composer can build and the union cannot drift from the table again.
 */
export type ComposedDayShape = SlotDayKind;

export interface ComposedDay {
  readonly dayOfWeek: number;
  readonly planEntryId: string;
  readonly name: string;
  readonly workoutType: string;
  readonly sessionTier: string;
  readonly kind: ComposedDayShape;
  /** The slots this day FILLED. */
  readonly requiredSlots: readonly SessionSlot[];
  /**
   * The slots this day DECLARED it owed, before the kit dropped any — R-087.
   *
   * **`requiredSlots` cannot serve the judge and this can.** `requiredSlots` is
   * the filled set, so a judge reading it is satisfied by construction. And a
   * `full_body_coverage` day has no static table to be judged against at all: its
   * ladder is *"whatever the week has not covered yet"*, a different seven
   * depending on where in the week it sits, so the declaration has to travel with
   * the day or be lost.
   */
  readonly declaredSlots: readonly SessionSlot[];
  /**
   * ⚠ **THE TYPED PLAN THIS DAY WAS COMPOSED FROM — R-225 (Sam, 2026-08-25).**
   *
   * *"why the fuck would monday be different"*. It was not Monday: it was WHICH
   * BUILDER made the day. A club night is retained from the adapter and carries
   * its intent; a pure strength day is COMPOSER-owned, and the composer read
   * `planned.strengthIntent` to decide the whole session and then **did not
   * carry it out**. `assembleAuthoredWeek` makes the composer's workout the base
   * and `name` is composer-owned, so nothing downstream could name the session
   * and every composer day in the app read "Strength".
   *
   * ⚠ **THIS IS THE SAME MISTAKE THIS FILE ALREADY FIXED ONCE, ON THE FIELD
   * DIRECTLY ABOVE.** `kind` was *"computed and thrown away, and every reader
   * guessed it back out of prose"* — measured at 24 wrong days in a 180-world
   * sweep. Same layer, same shape, different field. `strengthIntent` is
   * REQUIRED on `ComposerPlannedDay`, so there was never a day without one to
   * carry.
   */
  readonly strengthIntent: StrengthIntent;
  readonly rows: readonly ComposedRow[];
}

/** Clause (d): what the planner asked for, and what composition delivered. */
export interface ComposedSessionCount {
  readonly requested: number;
  readonly composed: number;
  readonly adjustment:
    | null
    | readonly { readonly reason: 'no_trainable_slot_on_this_kit'; readonly dayOfWeek: number }[];
}

export interface ComposedWeek {
  readonly weekStartISO: string;
  readonly days: readonly ComposedDay[];
  readonly gaps: readonly ComposedGap[];
  readonly sessionCount: ComposedSessionCount;
  /** Clause (a)'s input, derived here so ONE deriver serves contract and rows. */
  readonly kitUnachievablePatterns: readonly MainStrengthPattern[];
  /**
   * What this block SELECTED, one row per weekly movement seat — handed back so
   * generation can RECORD it durably. The composer does not write it: a domain
   * rule that reaches into a store is the hidden-read the order forbids.
   */
  readonly selections: readonly BlockExerciseSelection[];
  /** Exercise choices made by this exact composer run, before final assembly. */
  readonly selectionTraces: readonly AutomaticProgrammingSelectionTrace[];
}

// ─── THE AUTHORISED OPTION SET ─────────────────────────────────────────────

/**
 * WHICH EXERCISES EXIST — `selectableExerciseNames()`, the app's own single
 * owner of pool membership, joined to Sam's ladder slots by
 * `slotsForExerciseName`. **Exactly the denominator `POOL_CENSUS_2026-08-14`
 * measured**, so the composer needs no table of its own; a second table would be
 * a second authority on a derived fact.
 *
 * ⚠ INSERTION ORDER IS KEPT, NEVER SORTED. The pools are authored in Sam's
 * preference order — `Bench Press > Incline Bench > Close Grip Bench` — and
 * alphabetising destroys it. Sorting made week 1 open on a Close Grip Bench.
 */
let candidatesBySlot: Map<SessionSlot, ComposedExerciseIdentity[]> | null = null;

function slotCandidates(slot: SessionSlot): readonly ComposedExerciseIdentity[] {
  if (!candidatesBySlot) {
    const built = new Map<SessionSlot, ComposedExerciseIdentity[]>();
    for (const raw of selectableExerciseNames()) {
      const identity = composedIdentityFor(raw);
      for (const filled of slotsForExerciseName(identity)) {
        const list = built.get(filled) ?? [];
        if (!list.includes(identity)) list.push(identity);
        built.set(filled, list);
      }
    }
    candidatesBySlot = built;
  }
  return candidatesBySlot.get(slot) ?? [];
}

/**
 * The six ladder slots that are also POOL slots. A MAIN LIFT comes from the
 * slot's ANCHOR entries: Sam's pools already separate the lift a day is built
 * around from the work supporting it, and a main lift drawn off the accessory
 * bench opens a full-gym day with a `Scap Push-Up`. The other four ladder slots
 * never carry a main lift.
 */
const POOL_SLOT_FOR_LADDER_SLOT: Partial<Record<SessionSlot, PoolSlotKey>> = {
  squat: 'squat',
  hinge: 'hinge',
  horizontal_push: 'horizontal_push',
  vertical_push: 'vertical_push',
  horizontal_pull: 'horizontal_pull',
  vertical_pull: 'vertical_pull',
};

/**
 * The pool that authored the selected row. Split-upper accessory slots span
 * both planes, so their pool cannot be known from the slot name alone; the row
 * identity supplies it. This keeps dose and load resolution on the same pool
 * metadata as every other composed row.
 */
function poolSlotForSelectedRow(
  slot: SessionSlot,
  identity: ComposedExerciseIdentity,
): PoolSlotKey | null {
  return POOL_SLOT_FOR_LADDER_SLOT[slot] ?? findPoolEntry(identity)?.slot ?? null;
}

/**
 * ⚠ ANCHORS FIRST, THEN THE REST — AND THE FALLBACK IS THE WHOLE POINT.
 *
 * A main lift comes off the slot's ANCHOR bench because that is where Sam put
 * the lift a day is built around. **But an anchor list is not the pattern.**
 * Every squat anchor is a barbell lift, so returning anchors alone made the
 * composer declare `squat` KIT-UNACHIEVABLE for a dumbbell athlete who can do a
 * `Goblet Squat`, and for an away athlete who can do a `Bodyweight Squat` —
 * removing a pattern R-083 never removed, and inventing a gap that is not one.
 *
 * The order IS the preference Sam ruled: *"weighted versions remain preferable
 * when the kit allows"*. Anchors are the weighted ones and they come first; the
 * rest of the slot follows and is only reached when no anchor is legal.
 */
/**
 * ⚠ SAM'S WEIGHTED PREFERENCE, EXPRESSED THROUGH THE POOL'S OWN FIELD.
 *
 * *"yes i'd prefer weighted exercises"* (2026-08-14). `PoolEntry.loadRatio` is
 * already the authored answer to "does this carry external load" — `0` means it
 * does not — so the preference needs no new list and no new judgement here.
 * Within each tier the authored order is preserved; only the unloaded entries
 * move to the back. Measured: this is what puts `Goblet Squat` ahead of
 * `Bodyweight Squat` for a dumbbell athlete.
 */
/**
 * ⚠ R-080's MUSCLE GROUP, READ FROM THE POOL ENTRY THAT AUTHORS IT.
 *
 * *"rotation is variety WITHIN a muscle group, never across one"* — the rule whose
 * only enforcer, `applyPoolRotation`, was deleted in the B2 rebuild. The composer
 * did not need it while every ladder slot took exactly ONE row: you cannot collide
 * with yourself.
 *
 * **R-087's coverage day broke that assumption on 2026-08-14.** When a plane is
 * kit-impossible, R-093's *"yes repeat achievable pull plane"* makes the day owe
 * the SAME slot twice — and on a dumbbell kit the first two horizontal-pull
 * accessories are `Band Pull-Apart` and `Rear Delt Fly`, **both `isolation_upper`**.
 * Measured: 2 days across 2 worlds took two rows from one slot AND one group,
 * which is exactly the `Bicep Curl | Hammer Curl` shape R-080 exists to stop.
 */
const POOL_GROUP_OF: ReadonlyMap<ComposedExerciseIdentity, string> = new Map(
  (Object.keys(STRENGTH_POOLS) as PoolSlotKey[]).flatMap((poolSlot) =>
    [...STRENGTH_POOLS[poolSlot].anchor.entries, ...STRENGTH_POOLS[poolSlot].accessory.entries]
      .filter((entry) => typeof entry.group === 'string')
      .map((entry) => [composedIdentityFor(entry.name), entry.group as string] as const)));

const UNLOADED_POOL_IDENTITIES: ReadonlySet<ComposedExerciseIdentity> = new Set(
  (Object.keys(STRENGTH_POOLS) as PoolSlotKey[]).flatMap((poolSlot) =>
    [...STRENGTH_POOLS[poolSlot].anchor.entries, ...STRENGTH_POOLS[poolSlot].accessory.entries]
      .filter((entry) => entry.loadRatio === 0)
      .map((entry) => composedIdentityFor(entry.name))));

/**
 * ⚠ **THE EXPERIENCE GATE ALREADY EXISTED AND NOTHING CONSUMED IT.**
 *
 * `data/muscleExperienceMetadata.ts` authors an `experienceGate` for every
 * exercise, `rules/experienceCrosswalk.ts` maps an athlete's answer to the gates
 * they may be AUTO-PROGRAMMED from, and `isExerciseAutoProgrammableFor` joins
 * them. **It had zero production callers** — the same shape as the deleted pool
 * rotation: a complete, authored authority running on nothing. This is the one
 * place it is now consumed. No second policy, no gate re-derived here.
 *
 * Sam, 2026-08-17: *"Bodyweight Squat must never appear through ordinary
 * rotation"* for a moderate/experienced athlete, and *"Goblet Squat is a
 * regression/beginner/constraint option"*. Both are authored
 * `everyone_regression`, and `2-5 years` does not see that gate — so the ruling
 * needs no list of exercise names, here or anywhere.
 *
 * ⚠ **AND IT MUST NEVER EMPTY A SLOT.** Ruling 6: *"a genuinely bodyweight-only
 * athlete may receive Bodyweight Squat when there is no loaded option. Do not
 * turn this ruling into a refusal of their only legal squat."* So this is a
 * PREFERENCE with an honest fallback: when the filter would leave nothing, the
 * kit-legal list stands and the athlete keeps their only legal movement.
 */
const GATE_BY_IDENTITY: ReadonlyMap<ComposedExerciseIdentity, ExperienceGate> = new Map(
  EXERCISE_MUSCLE_METADATA.map((entry) =>
    [composedIdentityFor(entry.exercise), entry.experienceGate] as const));

function experiencePreferred(
  candidates: readonly ComposedExerciseIdentity[],
  profile: OnboardingData,
): readonly ComposedExerciseIdentity[] {
  const sourceBound = applySourceBoundAutomaticRegression(candidates, profile)
    .map(composedIdentityFor);
  const gates = visibleGatesForLadderLevel(
    ladderLevelForProfile(profile?.experienceLevel ?? null),
  );
  const admitted = sourceBound.filter((id) => {
    if (sourceBoundRegressionTarget(id)) {
      return sourceBoundRegressionIsEligible(id, profile);
    }
    const gate = GATE_BY_IDENTITY.get(id);
    // An exercise with no authored gate is not silently demoted: absence is
    // "unrecorded", and the null hypothesis is that it stays available.
    if (!gate) return true;
    return gates.includes(gate);
  });
  return preferAutomaticCurlCandidates(admitted.length > 0 ? admitted : sourceBound,
    profile?.experienceLevel, name => name);
}

/**
 * ⚠ **THE CANONICAL SELECTION ORDER — SAM, 2026-08-17.**
 *
 *   1. equipment, injury, active exclusion and EXPERIENCE legality
 *   2. explicit athlete preference / pin
 *   3. PHASE-SPECIFIC exercise priority
 *   4. role-specific rotation cadence and recent history
 *   5. a stable deterministic tie-break, only after all of the above
 *
 * *"Selection remains deterministic, but it must be context-sensitive rather
 * than a global exercise carousel."* Steps 1 and 3 are applied here, in that
 * order; step 2 is applied inside `decideExerciseForBlock` so that a legal pin
 * lands in FRONT of the phase's own preference; steps 4 and 5 are the cursor
 * walk. Reading the composer top to bottom is reading the order.
 *
 * **HINGE PRIORITY IS AN ORDERING, NEVER A BAN.** *"prioritise RDLs and Trap Bar
 * Deadlift ahead of conventional Deadlift... conventional Deadlift remains
 * available but is third priority"* and *"Do not select conventional Deadlift
 * merely to manufacture variety."* Putting the preferred two first is what makes
 * the fallback chain fall out for free — conventional Deadlift is reached only
 * when neither preferred option is legal, or when the pre/off-season cursor
 * genuinely walks that far.
 */
const HINGE_PRIORITY: readonly string[] = ['RDLs', 'Trap Bar Deadlift'];

/**
 * ── R-233: ONE RDL VARIANT PER DAY (Sam, 2026-08-26) ────────────────────────
 *
 * *"why RDL's and Single leg RDLs are in the same session? this should not be
 * happening. I'd rather it be RDL's and nordics, or Single leg RDL's as the
 * main hinge and then hamstring curls or nordics as the other one."*
 *
 * Why the collision was structural: in-season the hinge is pinned to RDLs
 * (R-093 continuity, `HINGE_PRIORITY`), his :227 fill order ALSO owes a
 * single-leg hip row, and that pool is deliberately one exercise (R-084) —
 * Single-Leg RDL. Two requirements, one family, every hinge day.
 *
 * The SINGLE-LEG HIP ROW YIELDS, never the hinge: filtering a block-stable
 * main lift per day would break the block-stability contract. When the day
 * already carries an RDL-family lift, this slot's candidates drop the family
 * and the hamstring pair (Nordic Lower / Hamstring Curl — now in the slot's
 * vocabulary, `sessionSlotCoverage`) takes the row.
 */
const RDL_FAMILY_IDENTITIES: ReadonlySet<ComposedExerciseIdentity> = new Set(
  ['RDLs', 'Single-Leg RDL'].map((name) => composedIdentityFor(name)),
);

/**
 * Slots the SEASON PHASE pins to one movement, overriding the two-block cap.
 *
 * *"RDLs are the default bilateral hinge. An in-season RDL must not rotate out
 * merely because two blocks elapsed."* In-season the athlete is playing; the
 * bilateral hinge is there for continuity, not variety, and the variety comes
 * from the single-leg and accessory rows instead.
 *
 * Pre- and off-season are deliberately absent: *"The broader main-lift rotation
 * remains available."*
 */
/** Which rotation rules a slot answers to. */
function selectionRoleFor(slot: SessionSlot): SelectionRole {
  if (MAIN_BILATERAL_SLOTS.has(slot)) return 'main_bilateral';
  if (slot === 'single_leg_knee' || slot === 'single_leg_hip') return 'single_leg';
  return 'accessory';
}

/**
 * The slots whose exercise may be RETAINED for a second consecutive block.
 * Ruling 2 names them by exclusion: single-leg knee, single-leg hip and true
 * accessories rotate at every new block, so the bilateral compounds are what is
 * left. Deliberately NOT `slotCountsTowardSetBudget`, which includes the
 * single-leg slots — right for the set budget, wrong for retention.
 */
const MAIN_BILATERAL_SLOTS: ReadonlySet<SessionSlot> = new Set<SessionSlot>([
  'squat', 'hinge', 'horizontal_push', 'vertical_push',
  'horizontal_pull', 'vertical_pull',
]);

const SPLIT_UPPER_ACCESSORY_SLOTS: ReadonlySet<SessionSlot> = new Set<SessionSlot>([
  'push_accessory_1', 'push_accessory_2',
  'pull_accessory_1', 'pull_accessory_2',
  // R-130b: the female seats join the same-day dedup, so a day's two trunk
  // rows and its two lower rows are always four DIFFERENT identities. Males
  // never declare these slots, so the membership is inert on the male path.
  // (R-130a's glute-only narrowing lived here briefly and was KILLED by
  // R-130b — *"don't just make it glute only"* — after the first mix's glass
  // check showed the one reachable glute row on every seat.)
  'midline', 'lower_accessory', 'second_lower_accessory', 'shoulder_prehab',
]);

function hingePriorityFirst(
  slot: SessionSlot,
  candidates: readonly ComposedExerciseIdentity[],
): readonly ComposedExerciseIdentity[] {
  if (slot !== 'hinge') return candidates;
  const rank = (id: ComposedExerciseIdentity): number => {
    const index = HINGE_PRIORITY.findIndex((name) => composedIdentityFor(name) === id);
    return index === -1 ? HINGE_PRIORITY.length : index;
  };
  return [...candidates].sort((a, b) => rank(a) - rank(b));
}

function weightedFirst(
  identities: readonly ComposedExerciseIdentity[],
): ComposedExerciseIdentity[] {
  return [
    ...identities.filter((id) => !UNLOADED_POOL_IDENTITIES.has(id)),
    ...identities.filter((id) => UNLOADED_POOL_IDENTITIES.has(id)),
  ];
}

/**
 * ⚠ A POOL ENTRY IS NOT AUTOMATICALLY A LADDER-SLOT CANDIDATE. The squat pool's
 * accessory bench holds `Walking Lunges`, which fills `single_leg_knee` and not
 * `squat`; taking pool order without this filter offered a lunge as a squat.
 * `slotsForExerciseName` stays the single owner of what fills a slot.
 */
function poolOrderedFor(
  slot: SessionSlot,
  entries: readonly { name: string }[],
): ComposedExerciseIdentity[] {
  const eligible = new Set(slotCandidates(slot));
  return entries.map((entry) => composedIdentityFor(entry.name))
    .filter((id) => eligible.has(id));
}

/**
 * ANCHORS FIRST, THEN THE POOL'S ACCESSORY BENCH — and weighted before
 * unloaded inside each. An anchor list is not the pattern: every squat anchor
 * is a barbell lift, so returning anchors alone made the composer call `squat`
 * KIT-UNACHIEVABLE for a dumbbell athlete who can Goblet Squat.
 *
 * The pool is also a CLOSED automatic-programming route. Appending every
 * exercise carrying the same movement tag admitted shoulder-health rows such
 * as `Bottoms-Up KB Press` into an ordinary vertical-push ladder seat, where it
 * then inherited strength progression. Tags describe the movement; the pool
 * decides whether automatic strength programming owns the identity.
 */
function anchorCandidates(slot: SessionSlot): readonly ComposedExerciseIdentity[] {
  const poolSlot = POOL_SLOT_FOR_LADDER_SLOT[slot];
  if (!poolSlot) return weightedFirst(slotCandidates(slot));
  const pool = STRENGTH_POOLS[poolSlot];
  const ordered = [
    ...poolOrderedFor(slot, pool.anchor.entries),
    ...poolOrderedFor(slot, pool.accessory.entries),
  ];
  return weightedFirst(ordered);
}

/**
 * A SUPPORTING ROW COMES OFF THE ACCESSORY BENCH FIRST. Same reason the main
 * lift comes off the anchors: the pools already carry the distinction, and
 * ignoring it made a full-gym vertical push open on a `Bottoms-Up KB Press`.
 */
function supportCandidates(slot: SessionSlot): readonly ComposedExerciseIdentity[] {
  const poolSlot = POOL_SLOT_FOR_LADDER_SLOT[slot];
  if (!poolSlot) return weightedFirst(slotCandidates(slot));
  const pool = STRENGTH_POOLS[poolSlot];
  const ordered = [
    ...poolOrderedFor(slot, pool.accessory.entries),
    ...poolOrderedFor(slot, pool.anchor.entries),
  ];
  return weightedFirst(ordered);
}

/**
 * The pattern a ladder slot contributes, for ROLE assignment only. Sam's ruling
 * names six patterns that "get the main lift role there"; `accessory_or_core`
 * and `arm_or_shoulder` name none, which is why they are absent rather than
 * mapped to something convenient.
 */
const PATTERN_FOR_SLOT: Partial<Record<SessionSlot, MainStrengthPattern>> = {
  squat: 'squat',
  hinge: 'hinge',
  single_leg_knee: 'single_leg_knee',
  single_leg_hip: 'single_leg_hip',
  horizontal_push: 'push',
  vertical_push: 'push',
  horizontal_pull: 'pull',
  vertical_pull: 'pull',
  push_accessory_1: 'push',
  push_accessory_2: 'push',
  pull_accessory_1: 'pull',
  pull_accessory_2: 'pull',
};

const ALL_SLOTS = Object.keys(PATTERN_FOR_SLOT) as SessionSlot[];

/**
 * PATTERNS THIS KIT CANNOT TRAIN AT ALL — derived from kit + sheet, never from a
 * record of what some past week contained. Clause (a) feeds it to the contract
 * and clause (e) turns the same answer into the athlete's gap: **one deriver,
 * two readers**, because computing it twice is how the contract and the week
 * came to disagree in the first place.
 */
export function kitUnachievablePatterns(
  kit: readonly string[],
): readonly MainStrengthPattern[] {
  const out: MainStrengthPattern[] = [];
  for (const pattern of new Set(Object.values(PATTERN_FOR_SLOT))) {
    if (!pattern) continue;
    const trainable = ALL_SLOTS
      .filter((slot) => PATTERN_FOR_SLOT[slot] === pattern)
      .some((slot) => slotCandidates(slot).some((id) => composedRowIsLegal(id, kit)));
    if (!trainable) out.push(pattern);
  }
  return out;
}

/**
 * ── SAM'S FULL-BODY SHAPE, 2026-08-14, verbatim ───────────────────────────
 *
 * *"either way i'd make them full body sessions. Squat and single leg hip with
 * push and pull + accessories then hinge and single leg knee with push and pull
 * (in opposite plane to earlier in week) + accessories - but the ideal would be
 * to do full body strength on different nights"*
 *
 * **IT APPLIES WHERE THE ATHLETE HAS NO OTHER NIGHT.** The trigger is a TYPED
 * FACT about the plan — every strength day the planner placed is also a club
 * night — not a world, a kit or a phase. An athlete with a free night is not in
 * this case, and his stated ideal (full-body strength on different nights) is
 * approved direction that CP2 does not implement and does not claim.
 *
 * **WHAT IT OVERRULES.** The planner's own answer for this case was upper-only,
 * because every night is a team night and a squat day cannot be placed. Sam has
 * overruled that: the two sessions become full body, and the lower work rides
 * on the club nights with them.
 *
 * **THE TWO SLOT LISTS MOVED TO `sessionSlotCoverage` ON 2026-08-14 AND THIS
 * FILE NOW IMPORTS THEM.** They lived here, privately, which meant the composer
 * knew a ladder the LADDER OWNER did not — so every instrument that asks "which
 * slots does this day owe" judged a composed full-body day against a lower or
 * upper ladder it was never built to satisfy. Measured: 24 of the 28 deficient
 * laddered days in the 180-world sweep were that, and none of them was a missing
 * exercise. Sam's sentence is quoted at the new home, once.
 */

/**
 * ── R-087: WHAT A GENERAL FULL-BODY DAY OWES — IT ASKS THE WHOLE WEEK ───────
 *
 * Sam, 2026-08-13: *"depends what's in the rest of the week / each week should
 * contain all the main lifts i.e. squat, hinge, single leg knee, single leg hip,
 * push pull in both horizontal and vertical then accessories for uppers and lowers
 * and some core"* · **THE WEEK IS THE UNIT OF COVERAGE, NOT THE DAY. A FULL BODY
 * DAY HAS NO FIXED TEMPLATE.**
 *
 * ## ⚠ THE FIRST BUILD READ "THE REST OF THE WEEK" AS "THE DAYS BEFORE IT", AND
 *    SAM REJECTED THE WEEK IT PRINTED
 *
 * *"that's a terrible program — there's no spacing and the volume is way too big
 * on Monday"* (2026-08-14, on `Pre-season/5d/noclub/Full Gym`).
 *
 * The full-body day was MONDAY, so the accumulated-so-far set was EMPTY, so every
 * slot read as missing and the day greedily took the first seven of the weekly
 * ladder — **squat, deadlift, both single-leg compounds, a press and a pull, plus
 * conditioning, immediately before Tuesday's full lower session.** Tuesday and
 * Wednesday already covered most of what Monday had just claimed was missing.
 *
 * **"The rest of the week" INCLUDES THE DAYS AFTER.** A chronological prefix is
 * not the week, and R-087's own example — *"a full body day placed AFTER a lower
 * day"* — was an illustration of order mattering, not a licence to ignore
 * everything downstream.
 *
 * **AND R-014 GOVERNS THE SIZE:** *"the number of exercises is not important the
 * total work being done evenly across the body is"*. Bible `:122`'s seven is an
 * EXAMPLE of a full-body day, not a quota to fill regardless of its neighbours.
 * So there is no top-up pass any more: the day fills the week's GENUINE gaps and
 * stops. `FULL_BODY_DAY_SIZE` remains a ceiling, never a target.
 */
const R089_PARTNER: Partial<Record<SessionSlot, SessionSlot>> = {
  squat: 'hinge',
  hinge: 'squat',
  single_leg_knee: 'single_leg_hip',
  single_leg_hip: 'single_leg_knee',
};

/**
 * ⚠ **DOES THIS DAY'S GAP SET STILL MAKE A FULL-BODY SESSION?**
 *
 * **THE TEST IS DEFINITIONAL, NOT A COUNT.** Sam forbade inventing an exercise or
 * set cap, and R-014 forbids counting exercises as the measure — *"the number of
 * exercises is not important the total work being done evenly across the body
 * is"*. So the question asked here is the only one the name itself answers: **a
 * FULL BODY day trains the lower body and the upper body.** A gap set that is
 * upper-only is not a small full-body day, it is not a full-body day.
 *
 * **WHY IT IS NEEDED, MEASURED 2026-08-14.** Once the day correctly stopped
 * over-filling, `Pre-season/5d/noclub/Full Gym`'s genuine week-wide gap was
 * `{horizontal_pull, vertical_pull}` — Tuesday supplies the whole lower ladder and
 * Wednesday the presses. Composing that as the planned full-body session publishes
 * **a "Full body — cover all movement patterns" day containing two rows**, and on
 * bodyweight a single `Push-ups`. Across the corpus: 10 such days, 8 of two rows
 * and 2 of one.
 *
 * That is a different bad week, not a fix, so the day is NOT composed and the week
 * keeps its honest typed refusal — Sam's own instruction: *"If this week cannot
 * become acceptable without that capability, restore its honest refusal rather
 * than publishing a bad week."* **The missing Thursday-Sunday spacing that would
 * make these weeks work belongs to the scheduling capability, not the composer.**
 */
const LOWER_BODY_SLOTS: ReadonlySet<SessionSlot> = new Set<SessionSlot>([
  'squat', 'hinge', 'single_leg_knee', 'single_leg_hip',
]);

export function coverageGapsMakeAFullBodySession(
  gaps: readonly SessionSlot[],
): boolean {
  const lower = gaps.some((slot) => LOWER_BODY_SLOTS.has(slot));
  const upper = gaps.some((slot) => slot !== 'accessory_or_core'
    && !LOWER_BODY_SLOTS.has(slot));
  return lower && upper;
}

export function coverageSlotsForFullBodyDay(args: {
  /**
   * Slots the REST OF THE WEEK supplies — every other planned strength day,
   * before AND after this one, kit-filtered. Not a chronological prefix.
   */
  readonly suppliedByOtherDays: ReadonlySet<SessionSlot>;
  /** Slots an EARLIER coverage day in this same week already took. */
  readonly takenByEarlierCoverageDays: ReadonlySet<SessionSlot>;
  /** The week's projected pair counts, for the R-089 check. */
  readonly pairCounts: Readonly<Record<string, number>>;
  /** A CEILING, never a target — R-014. */
  readonly size?: number;
}): readonly SessionSlot[] {
  const size = args.size ?? FULL_BODY_DAY_SIZE;
  const chosen: SessionSlot[] = [];
  // ONE PASS, AND ONLY THE GENUINE GAPS. The removed second pass walked the
  // ladder again to pad the day out to seven — which is precisely how Monday came
  // to carry a squat, a deadlift and both single-leg compounds on top of a week
  // that already had them on Tuesday.
  for (const slot of WEEKLY_COVERAGE_SET) {
    if (chosen.length >= size) break;
    if (args.suppliedByOtherDays.has(slot)) continue;
    if (args.takenByEarlierCoverageDays.has(slot)) continue;
    chosen.push(slot);
  }
  // ── THE ONE GUARD: NEVER END MID-PAIR (R-089) ────────────────────────────
  //
  // Walking a paired order can only unbalance a pattern by stopping between a
  // squat and its hinge. Judged against the WEEK's totals, not the day's, because
  // a second squat is lawful exactly when the week already owes a second hinge.
  const projected: Record<string, number> = { ...args.pairCounts };
  for (const slot of chosen) {
    if (slot in R089_PARTNER) projected[slot] = (projected[slot] ?? 0) + 1;
  }
  return chosen.filter((slot) => {
    const partner = R089_PARTNER[slot];
    if (!partner) return true;
    const bounded = slot === 'squat' || slot === 'single_leg_knee';
    if (!bounded) return true;
    if ((projected[slot] ?? 0) <= (projected[partner] ?? 0)) return true;
    projected[slot] -= 1;
    return false;
  });
}

/** The other plane of the same pattern. Used only for the kit-relative fallback. */
const OPPOSITE_PLANE: Partial<Record<SessionSlot, SessionSlot>> = {
  horizontal_push: 'vertical_push',
  vertical_push: 'horizontal_push',
  horizontal_pull: 'vertical_pull',
  vertical_pull: 'horizontal_pull',
};

/**
 * ⚠ THE KIT OUTRANKS THE PLANE PREFERENCE, AND SAM RULED THE FALLBACK HIMSELF.
 *
 * Asked what session B should do when its opposite pull plane cannot be trained
 * on the athlete's kit, he said: *"yes repeat achievable pull plane"*. So the
 * order is: the session's preferred plane if the kit can train it; otherwise the
 * OTHER plane, repeating what the week already used; otherwise nothing, and the
 * pattern is removed and disclosed under R-083/R-090.
 *
 * **NEVER AUTHOR AN ILLEGAL ROW TO MANUFACTURE PLANE VARIETY.** R-083 removes a
 * pattern the kit cannot train; a "variety" that ships a Pull-Up to a bodyweight
 * athlete is the exact defect that ruling exists to stop.
 */
function resolvePlane(
  preferred: SessionSlot,
  kit: readonly string[],
  excluded: ReadonlySet<string>,
): { readonly slot: SessionSlot | null; readonly dropped: readonly SessionSlot[] } {
  const hasLegal = (slot: SessionSlot): boolean =>
    slotCandidates(slot).some((id) => !excluded.has(id) && composedRowIsLegal(id, kit));
  if (hasLegal(preferred)) return { slot: preferred, dropped: [] };
  const other = OPPOSITE_PLANE[preferred];
  if (other && hasLegal(other)) return { slot: other, dropped: [preferred] };
  return { slot: null, dropped: other ? [preferred, other] : [preferred] };
}

/**
 * IS THIS PLANNED DAY A STRENGTH DAY THE COMPOSER OWNS?
 *
 * **The question `composedDayKind !== null` used to answer, and can no longer.**
 * A `full_body` day now returns null there — because A-versus-B is the WEEK's
 * choice, not the day's — so using that null as "not a strength day" silently
 * dropped every full-body day out of the week AND out of
 * `sessionCount.requested`. The two questions were always different; only the
 * full-body case made the difference visible.
 */
function composedDayIsStrength(intent: StrengthIntent): boolean {
  return intent.archetype === 'full_body' || composedDayKind(intent) !== null;
}

/** The planner's strength days, in order. One definition, three readers below. */
function composedStrengthDays(
  plannedDays: readonly ComposerPlannedDay[],
): readonly ComposerPlannedDay[] {
  return plannedDays.filter((day) => composedDayIsStrength(day.strengthIntent));
}

/**
 * DOES THIS WEEK TAKE SAM'S FULL-BODY A/B SHAPE? Decided once for the WEEK,
 * because A and B alternate and a day cannot know which it is.
 *
 * **THERE ARE TWO RULINGS BEHIND THIS AND IT USED TO ENFORCE ONLY ONE.**
 *
 *  1. **Every strength night is a club night** (Sam, 2026-08-14): *"either way
 *     i'd make them full body sessions"*. The athlete has no free night, so the
 *     lower work rides on the club nights.
 *  2. **THE WEEK HAS ONLY TWO STRENGTH SESSIONS** — Bible `:94`, verbatim: *"if
 *     can only do 2 strength sessions should be 2 x full body and those sessions
 *     should be pretty solid"*. **This one was missing**, and it is not
 *     conditional on the club: a two-session athlete with two FREE nights got
 *     whatever split the planner happened to name, which is the case `:94`
 *     answers directly.
 *
 * THE UNION, NOT A REPLACEMENT. Restricting to (2) would regress a three-session
 * week whose every night is a club night, which (1) already covers; enforcing
 * only (1) is what left `:94` unread. Both are Sam's and both are cited.
 */
export function composedWeekIsFullBodyOnClubNights(
  plannedDays: readonly ComposerPlannedDay[],
): boolean {
  const strengthDays = composedStrengthDays(plannedDays);
  if (strengthDays.length === 0) return false;
  // Bible `:94` — two strength sessions are two full-body sessions.
  if (strengthDays.length === 2) return true;
  return strengthDays.every((day) => day.isTeamDay);
}

// ─── THE AUTHORED DOSE — transcribed, not invented ─────────────────────────

/**
 * ⚠ THE EXISTING AUTHORED DOSES, POSITION FOR POSITION, from
 * `fallbackExercisesForPlanEntry`'s combined branches (`defaultProgram.ts:1186-1224`).
 * Composition changes WHICH exercises a day carries, not how hard they are:
 * **the authored dose bounds progression**, and rewriting it to something tidier
 * would be a dose change nobody ordered in a slice about composition.
 */
const LOWER_DOSE = [[3, 5, 8], [2, 8, 10], [3, 8, 12], [2, 8, 12], [2, 8, 12]] as const;
const UPPER_DOSE = [[3, 5, 8], [3, 8, 10], [2, 8, 10], [2, 8, 12], [2, 12, 15]] as const;

/**
 * ⚠ THE FULL-BODY DOSE IS BY SLOT, NOT BY POSITION, because this shape carries
 * FOUR main lifts and a position ladder would taper the fourth into an
 * accessory. Bible `:94` on exactly this athlete: *"if can only do 2 strength
 * sessions should be 2 x full body and those sessions should be pretty solid"* —
 * so the main lifts open at the same 3 x 5-8 every other composed main lift gets.
 *
 * **REGULAR LOADS (Sam, 2026-08-14: "no just make it regular loads").** Nothing
 * here asks whether the day is a club night. The dose a full-body session gets
 * on a team night is the dose it would get on any other night, and the cell
 * `regular loads: a club night does not reduce the dose` holds that by
 * composing the same day both ways and comparing.
 */
const FULL_BODY_DOSE: Partial<Record<SessionSlot, readonly [number, number, number]>> = {
  squat: [3, 5, 8],
  hinge: [3, 5, 8],
  single_leg_hip: [3, 8, 12],
  single_leg_knee: [3, 8, 12],
  horizontal_push: [3, 8, 10],
  vertical_push: [3, 8, 10],
  horizontal_pull: [3, 8, 10],
  vertical_pull: [3, 8, 10],
  accessory_or_core: [2, 10, 15],
};

function doseFor(
  kind: ComposedDayShape,
  slot: SessionSlot,
  position: number,
): readonly [number, number, number] {
  if (kind === 'full_body_a' || kind === 'full_body_b') {
    return FULL_BODY_DOSE[slot] ?? [2, 10, 15];
  }
  const ladder = kind.startsWith('lower') ? LOWER_DOSE : UPPER_DOSE;
  return ladder[Math.min(position, ladder.length - 1)];
}

/**
 * A day's ladder comes from the plan's TYPED intent, never from its NAME.
 * `slotDayKindFor` reads a name, which is right for an oracle judging weeks it
 * did not build; the composer has the plan's own answer in hand.
 *
 * ⚠ **IT NO LONGER ANSWERS FOR `full_body`. MEASURED, IN THE UNITS THE CENSUS
 * ACTUALLY REPORTS: that line's refusal family was 36 OCCURRENCES ACROSS 24
 * DISTINCT PROFILES of the 60 baseline refusals; fixing it and R-087 together
 * resolved all 36 and took the corpus 120/180 -> 156/180.** (An earlier draft of
 * this comment said "44 of the 60" — a number no run produced. Occurrences and
 * distinct profiles are different units and both are stated here on purpose.)
 * `archetype === 'full_body'` returned `'lower'` — so a day the
 * planner had explicitly asked to cover **squat, hinge, push AND pull** was given
 * the five-slot LOWER ladder, and the push and pull it asked for were never
 * selected. Nothing repaired it and nothing had to: the week then genuinely
 * trained no push or no pull, and `validateGeneratedWeek` refused it correctly.
 *
 * Executed receipt, `Pre-season/3d/club/Full Gym/w1`: two planner days, both
 * `archetype=full_body plannedPatterns=[squat,hinge,push,pull]`, both composed
 * `kind=lower`, week refused
 * `required_safe_patterns_present:push|required_safe_patterns_present:pull|pattern_balance:2`
 * on a FULL GYM — Bench Press and Pull-Ups legal and unselected.
 *
 * A full-body day's shape is a decision about the WEEK (A or B, and they
 * alternate), so it cannot be answered by a function looking at one day's
 * intent. `composeWeek` owns that choice; this returns null and says why.
 */
export function composedDayKind(intent: StrengthIntent): SlotDayKind | null {
  const planned = intent.plannedPatterns ?? [];
  if (intent.archetype === 'full_body') return null;   // the WEEK decides A vs B
  if (intent.archetype === 'lower') {
    const hasSquat = planned.includes('squat');
    const hasHinge = planned.includes('hinge');
    if (hasSquat && !hasHinge) return 'lower_squat';
    if (hasHinge && !hasSquat) return 'lower_hinge';
    return 'lower';
  }
  if (intent.archetype !== 'upper') return null;
  const hasPush = planned.includes('push');
  const hasPull = planned.includes('pull');
  if (hasPush && hasPull) return 'upper_full';
  if (hasPush) return 'upper_split_push';
  if (hasPull) return 'upper_split_pull';
  return null;
}

function mondayISO(dateISO: string): string {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/**
 * WHOSE FAULT IS THIS EMPTY SLOT — THE KIT, OR THE ATHLETE'S OWN EXCLUSION?
 *
 * Sam's contract requires the exclusion gap be DISCLOSED rather than papered
 * over by restoring the exercise, and a gap that blames the kit for a ban is not
 * a disclosure — it sends the athlete to a shop for a problem only they can fix.
 *
 * **THE TEST IS "WOULD THE KIT ALONE HAVE EMPTIED IT", not "was anything
 * excluded".** It is the same question `selectPoolEntryAvoiding` asks for R-083
 * and it is asked this way for the same reason: an athlete who both lacks the
 * bar and banned the bodyweight option is told about the bar, because the thing
 * they cannot train at all outranks the thing they chose. Only when the kit
 * could have filled the slot and the exclusion emptied it is the exclusion named.
 */
function attributeGap(args: {
  candidates: readonly ComposedExerciseIdentity[];
  kit: readonly string[];
  excluded: ReadonlySet<string>;
}): Pick<ComposedGap, 'cause' | 'wouldNeed' | 'excludedHere'> {
  const kitLegal = args.candidates.filter((id) => composedRowIsLegal(id, args.kit));
  if (kitLegal.length === 0) {
    return {
      cause: 'kit',
      wouldNeed: args.candidates.length > 0
        ? composedRowGapReason(args.candidates[0], args.kit)
        : null,
    };
  }
  return {
    cause: 'exclusion',
    // There is nothing to BUY for an exclusion gap; the athlete restores it.
    wouldNeed: null,
    excludedHere: kitLegal.filter((id) => args.excluded.has(id)),
  };
}

/** Local-noon day step. `toISOString` on a noon date is safe for every UK/AU offset. */
function addComposerDaysISO(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── COMPOSE ───────────────────────────────────────────────────────────────

export function composeWeek(inputs: ComposerInputs): ComposedWeek {
  // Resolve the affected ladder before selecting rows. Dropping every lower
  // main afterwards leaves an accessory-only day and silently loses frequency.
  // The existing safety policy requires unaffected substitution first. Upper
  // work also respects the scheduler's lower-body fixture restrictions; this
  // deliberately does not turn a protected upper day into heavy lower work.
  const upperSafe = (['push', 'pull'] as const).filter(pattern =>
    !inputs.injuries.prohibitedPatterns.includes(pattern));
  if (upperSafe.length > 0) {
    inputs = { ...inputs, plannedDays: inputs.plannedDays.map(day => {
      const intended = day.strengthIntent.plannedPatterns;
      const lowerPatterns = intended.filter(pattern => pattern !== 'push' && pattern !== 'pull');
      if (!composedDayIsStrength(day.strengthIntent) || lowerPatterns.length === 0 ||
        !lowerPatterns.every(pattern => inputs.injuries.prohibitedPatterns.includes(pattern))) return day;
      return { ...day, strengthIntent: { archetype: 'upper' as const,
        primaryPattern: upperSafe[0], plannedPatterns: [...upperSafe], effectivePatterns: [] } };
    }) };
  }
  const excluded = new Set(inputs.injuries.excludedIdentities.map(composedIdentityFor));
  const trackedAnchorByPattern = new Map<TrackedLiftProgrammingPattern, ComposedExerciseIdentity>(
    (['push', 'pull', 'squat', 'hinge'] as const).map((pattern) => {
      const selected = selectedTrackedLiftForPattern(inputs.trackedLiftChoices, pattern);
      return [pattern, composedIdentityFor(TRACKED_LIFTS[selected].names[0])];
    }),
  );
  // Choosing an alternative replaces its default throughout automatic
  // programming. The default does not become a secondary/accessory route that
  // quietly reappears later in the same week.
  const displacedTrackedDefaults = new Set(
    displacedTrackedLiftDefaults(inputs.trackedLiftChoices)
      .map((id) => composedIdentityFor(TRACKED_LIFTS[id].names[0])),
  );
  /**
   * THE DAY'S OWN EXCLUSION SET — week-wide answers PLUS whatever this one day
   * carries. Built per day, from the week Monday and the day's own weekday, so a
   * "Today only" answer lands on exactly one date and no other.
   */
  const excludedOn = (dayOfWeek: number): ReadonlySet<string> => {
    const byDate = inputs.injuries.excludedIdentitiesByDate;
    if (!byDate) return excluded;
    const monday = mondayISO(inputs.todayISO);
    // The composer's weekdays are 0=Sunday; the week runs Monday..Sunday.
    const dateISO = addComposerDaysISO(monday, (dayOfWeek + 6) % 7);
    const dated = byDate[dateISO];
    if (!dated?.length) return excluded;
    return new Set([...excluded, ...dated.map(composedIdentityFor)]);
  };
  const prohibited = new Set(inputs.injuries.prohibitedPatterns);
  const days: ComposedDay[] = [];
  const gaps: ComposedGap[] = [];
  const adjustment: { reason: 'no_trainable_slot_on_this_kit'; dayOfWeek: number }[] = [];
  // Variety is a property of the WEEK: a day repeating last night's lift is the
  // shape Bible `:227` names to avoid.
  const usedThisWeek = new Set<ComposedExerciseIdentity>();
  /* The stable weekly seats for a repeated movement pattern. Slot alone is too
   * broad: it made two horizontal presses restore one Bench Press decision. */
  const seatCountBySlot = new Map<SessionSlot, number>();
  // One typed weekly allowance exists before the first exercise is selected.
  // Dedicated sessions reserve their purpose; full-body days may spend only
  // seats that the rest of the week has not reserved or spent.
  const weeklyStrengthBudget = createWeeklyStrengthBudget(inputs.plannedDays);
  const weeklyExerciseSelector = createAutomaticWeeklyExerciseSelector();
  const deliveredSelectorCheckpoint = inputs.automaticSelectionHistory
    ? createAutomaticWeeklyExerciseSelector(
      inputs.automaticSelectionHistory.identities,
    ).checkpoint() : null;
  let deliveredSelectionRestored = false;
  /* What this block chose, per weekly slot occurrence — handed back so
   * generation can RECORD it. */
  const selectionsThisBlock: BlockExerciseSelection[] = [];
  const selectionTraces: AutomaticProgrammingSelectionTrace[] = [];
  // Complete-week coverage, shared by male and female composition. A
  // robustness seat selects only from the first category no delivered row has
  // supplied yet; ordinary lower rows contribute through the same classifier.
  const footballRobustnessCovered = new Set<FootballRobustnessCategory>();
  // ⚠ THE WEEK-KEYED SELECTOR IS GONE, NOT WRAPPED. It read
  // `const step = phaseClock.weekNumber - 1` and indexed the candidate list with
  // it, which is why a main lift changed every week. `rules/blockExerciseSelection.ts`
  // owns the index now; leaving `step` here as a fallback would be the second
  // authority the mission forbids.
  // Sam's full-body shape, decided once for the WEEK — see its own docstring.
  // ⚠ **A DISPLACED PAIR IS NOT A PAIR.** R-093's A/B shapes only make sense as a
  // PAIR that between them cover the body. When a prohibition forces one of the
  // week's days to `upper` — G-2 may not hold heavy lower — the other day is no
  // longer half of a pair, and leaving it on the fixed A shape means the week
  // trains no hinge at all and refuses `required_safe_patterns_present:hinge`.
  //
  // Measured on the recurring-Sunday world: Wednesday `full_body_a`, Friday forced
  // `upper`, hinge never trained. So the surviving day reverts to R-087's COVERAGE
  // behaviour and fills what the week is actually missing — which is what R-087
  // exists for and is exactly Sam's *"place lower/full-body work on the best
  // earlier legal day"*.
  const pairDisplacedByProhibition = inputs.plannedDays
    .some((day) => day.strengthIntent?.archetype === 'upper');
  const fullBody = composedWeekIsFullBodyOnClubNights(inputs.plannedDays)
    && !pairDisplacedByProhibition;
  // ── R-093's TWO FIXED SHAPES, AND R-087's GENERAL RULE — THEY ARE DIFFERENT
  //    RULINGS AND THEY ANSWER DIFFERENT ATHLETES ─────────────────────────────
  //
  // R-093 (Sam, 2026-08-14) names TWO shapes, A and B, for the athlete whose every
  // gym night is a club night — or who has only two strength sessions (Bible `:94`).
  // They alternate, A leads with a squat and B with the matching hinge, so the PAIR
  // covers the lower ladder between them and R-089 comes out whole.
  //
  // R-087 (Sam, 2026-08-13) governs every OTHER full-body day: *"THE WEEK IS THE
  // UNIT OF COVERAGE, NOT THE DAY. A FULL BODY DAY HAS NO FIXED TEMPLATE"*, and it
  // pre-refuses exactly the mistake of extending A/B to cover the general case —
  // *"Any fix that hardcodes a full-body row list, however carefully chosen,
  // contradicts this ruling on the day it lands."*
  //
  // **SO A GENERAL FULL-BODY DAY ASKS THE WEEK WHAT IS STILL OPEN**, via
  // `coverageSlotsForFullBodyDay`, and gets a different seven depending on where in
  // the week it sits. That is R-087's own example, implemented rather than quoted.
  //
  // ⚠ THIS REPLACED A PARITY GATE, AND THE GATE EXISTED BECAUSE A/B CANNOT DO THIS
  // JOB. A adds `squat + single_leg_hip`, B adds `hinge + single_leg_knee` — the two
  // shapes CROSS R-089's two pairs — so an ODD number of A/B days leaves either a
  // squat or a single-leg knee unmatched, for any number of lower days. Measured
  // both ways when this seat tried it: 10 unmatched squats starting odd weeks on A,
  // 22 unmatched single-leg knees starting them on B. Coverage selection has no such
  // failure mode because it walks a PAIRED order and never ends mid-pair.
  let fullBodyIndex = 0;
  /* ── R-231: THE SORER SHAPE LANDS OFF THE CLUB NIGHT ──────────────────────
   *
   * Sam, 2026-08-26 (rejecting an automatic pick filter): *"they get the real
   * exercises - just spread throughout the week instead of all on one night."*
   * Shape B carries TWO of Bible :156's named sore-making families (hinge —
   * heavy RDLs — and single_leg_knee — RFE/Bulgarian split squats); shape A
   * carries one (squat). The bare `fullBodyIndex % 2` alternation assigned
   * shapes by planned-day ORDER, so B routinely landed on the combined club
   * night (the launch audit photographed exactly that: RDLs + Bulgarians on
   * the Thursday team night).
   *
   * The fix moves NOTHING but the pairing: the same multiset of shapes, the
   * same slots, the same block-stable selections (they key on SLOT, which
   * travels with the shape) — non-team days simply take the B shapes first.
   * A week whose every strength day is a club night (R-093's own athlete)
   * gets the identity permutation and keeps today's alternation, which is
   * R-231's named edge: the picks stay real when there is nowhere to spread.
   * The parity note above is untouched — the SEQUENCE of shapes is the same
   * alternation; only which day wears which changes.
   */
  const r093ShapeByDay = (() => {
    const pairDays = inputs.plannedDays.filter((planned) =>
      composedDayIsStrength(planned.strengthIntent) &&
      fullBody && planned.strengthIntent.archetype !== 'upper');
    const shapes = pairDays.map((_, index) =>
      (index % 2 === 0 ? 'full_body_a' : 'full_body_b') as ComposedDayShape);
    // R-231 applies only when there is somewhere to spread TO: a week whose
    // strength days are all club nights (R-093's own athlete) or none keeps
    // today's alternation untouched — the identity permutation, by
    // construction rather than by accident of the sort below.
    const mixed = pairDays.some((planned) => planned.isTeamDay)
      && pairDays.some((planned) => !planned.isTeamDay);
    if (!mixed) {
      return new Map(pairDays.map((planned, index) => [planned, shapes[index]]));
    }
    // Non-team days first, original order preserved inside each half; the
    // sorer shapes (B) are handed out first.
    const daysByPreference = [
      ...pairDays.filter((planned) => !planned.isTeamDay),
      ...pairDays.filter((planned) => planned.isTeamDay),
    ];
    const shapesSorerFirst = [...shapes].sort((left, right) =>
      (left === 'full_body_b' ? 0 : 1) - (right === 'full_body_b' ? 0 : 1));
    const map = new Map<ComposerPlannedDay, ComposedDayShape>();
    daysByPreference.forEach((planned, index) => {
      map.set(planned, shapesSorerFirst[index] ?? 'full_body_a');
    });
    return map;
  })();
  const weekPairCounts: Record<string, number> = {
    squat: 0, hinge: 0, single_leg_knee: 0, single_leg_hip: 0 };

  /* ── WHAT THIS ATHLETE CAN REACH ON A GIVEN DAY ───────────────────────────
   * The permanent kit unless a dated fact has taken something off that day. One
   * accessor so no site can quietly ask the wrong one of the two questions. */
  const kitOn = (dayOfWeek: number): readonly string[] =>
    inputs.temporaryKitByDayOfWeek?.[dayOfWeek] ?? inputs.kit;
  /* THE WEEK'S OWN KIT — every tag reachable on at least ONE day. This is what
   * §18 must judge required patterns against: a pattern the athlete can train on
   * Monday is achievable this week even if Thursday is spent in a hotel, so
   * exempting it would weaken an achievable requirement, which R-090 forbids by
   * name. Identical to `inputs.kit` in every world with no dated removal. */
  const weekReachableKit: readonly string[] = inputs.temporaryKitByDayOfWeek
    ? [...new Set(inputs.plannedDays.flatMap((day) => [...kitOn(day.dayOfWeek)]))]
    : inputs.kit;

  // ── WHAT THE REST OF THE WEEK SUPPLIES — COMPUTED BEFORE ANY DAY IS BUILT ──
  //
  // **R-087's "the rest of the week" INCLUDES THE DAYS AFTER, and reading it as a
  // chronological prefix is what Sam rejected.** With the full-body day on Monday
  // the prefix is empty, so every slot read as missing and the day took seven —
  // squat, deadlift, both single-leg compounds and a press and pull — the night
  // before Tuesday's full lower session, which supplies most of them.
  //
  // ACHIEVABLE, NOT DECLARED: a slot an ordinary day names but the athlete's kit
  // cannot train is NOT supplied, so it stays a genuine gap the full-body day may
  // fill on a plane the kit CAN reach.
  const suppliedByDay = new Map<ComposerPlannedDay, ReadonlySet<SessionSlot>>();
  for (const planned of inputs.plannedDays) {
    if (!composedDayIsStrength(planned.strengthIntent)) continue;
    // A coverage day supplies nothing to the others — it is the one ASKING.
    if (!fullBody && planned.strengthIntent.archetype === 'full_body') continue;
    const ordinary: ComposedDayShape = fullBody
      ? 'full_body_a'   // an R-093 week: both shapes together supply the whole ladder
      : composedDayKind(planned.strengthIntent) ?? 'lower';
    const declared = fullBody
      ? [...SLOTS_FOR_KIND.full_body_a, ...SLOTS_FOR_KIND.full_body_b]
      // R-130a: the female tables where the mix differs; both paths share the
      // full-body shapes, so the arm above stays unswitched on purpose.
      : slotsForKind(ordinary, inputs.profile?.gender);
    // The DAY's own exclusion set, not the week's: a slot a Tuesday-only
    // exclusion empties is still supplied by Thursday, and telling the coverage
    // day otherwise would make it claim a slot the week already covers.
    const excludedHere = excludedOn(planned.dayOfWeek);
    suppliedByDay.set(planned, new Set(declared.filter((slot) =>
      slotCandidates(slot).some((id) =>
        !excludedHere.has(id) && composedRowIsLegal(id, kitOn(planned.dayOfWeek))))));
  }
  const suppliedByOtherDays = (self: ComposerPlannedDay): ReadonlySet<SessionSlot> => {
    const out = new Set<SessionSlot>();
    for (const [day, slots] of suppliedByDay) {
      if (day === self) continue;
      for (const slot of slots) out.add(slot);
    }
    return out;
  };
  // Two coverage days in one week must not both claim the same gap.
  const takenByCoverageDays = new Set<SessionSlot>();

  for (const planned of inputs.plannedDays) {
    if (!composedDayIsStrength(planned.strengthIntent)) continue;
    const plannedDateISO = addComposerDaysISO(
      mondayISO(inputs.todayISO), (planned.dayOfWeek + 6) % 7,
    );
    if (deliveredSelectorCheckpoint && !deliveredSelectionRestored
      && plannedDateISO >= inputs.automaticSelectionHistory!.governedFromISO) {
      weeklyExerciseSelector.restore(deliveredSelectorCheckpoint);
      usedThisWeek.clear();
      for (const raw of inputs.automaticSelectionHistory!.identities) {
        const identity = composedIdentityFor(raw);
        if (automaticExerciseRouteForIdentity(identity) === 'strength') {
          usedThisWeek.add(identity);
        }
      }
      footballRobustnessCovered.clear();
      for (const identity of inputs.automaticSelectionHistory!.identities) {
        for (const category of footballRobustnessCategoriesForExercise(identity)) {
          footballRobustnessCovered.add(category);
        }
      }
      deliveredSelectionRestored = true;
    }
    // Every legality question below asks the DAY's set, never the week's, so a
    // dated exclusion applies to its own day and to no other.
    const excludedToday = excludedOn(planned.dayOfWeek);
    // …and the same is now true of the KIT. `inputs.kit` stays the PERMANENT
    // answer and decides what gets RECORDED; this decides what ships today.
    const kitToday = kitOn(planned.dayOfWeek);
    weeklyExerciseSelector.beginSession();
    // ── WHICH LADDER THIS DAY OWES ──────────────────────────────────────────
    //
    // Three cases, in this order: R-093's fixed pair, then R-087's coverage day,
    // then the planner's ordinary ladder. `composedDayKind` used to answer `'lower'`
    // for a `full_body` archetype — a day asked to cover squat, hinge, push AND
    // pull got the five-slot lower ladder and its push and pull were never
    // selected. That family was 36 OCCURRENCES across 24 DISTINCT PROFILES, of
    // the 60 baseline refusals in the 180-world sweep.
    // ⚠ **R-093 IS A WEEK-LEVEL SHAPE; G-2 IS A DAY-LEVEL PROHIBITION, AND THE
    // PROHIBITION WINS ON THAT DAY.**
    //
    // `fullBody` is true for the athlete whose every gym night is a club night,
    // so R-093 handed BOTH days the full-body A/B pair. Measured on the
    // recurring-Sunday world: Friday is G-2 **and** a club night, and it came out
    // with Deadlift and Bulgarian Split Squats — heavy lower two days before the
    // game, which §3 G-2 forbids outright.
    //
    // The SCHEDULER had already resolved this: it authored that day `upper`
    // precisely because G-2 may not hold lower work, and Sam's instruction is to
    // *"allow upper-body strength on G-2"* and *"place lower/full-body work on the
    // best earlier legal day"* — which the scheduler did.
    //
    // So R-093's pair applies to every day EXCEPT one the scheduler explicitly
    // typed `upper`. **This narrows nothing R-093 decides for its own athlete**:
    // the scheduler only types `upper` on such a week when a prohibition leaves it
    // no alternative, and the full-body work it displaced moves to the earlier
    // legal day rather than disappearing.
    const isR093Shape = fullBody && planned.strengthIntent.archetype !== 'upper';
    // ── R-087's COVERAGE DAY, AND THE GATE THAT DECIDES IF IT IS ONE ────────
    //
    // The gaps are resolved BEFORE the day's role is fixed, because the answer
    // decides whether this is a full-body day at all. If the week's genuine
    // week-wide gaps no longer span the body, composing them under a full-body
    // heading publishes a two-row "Full body" session — so the day keeps the
    // planner's ordinary ladder and the week refuses honestly instead. See
    // `coverageGapsMakeAFullBodySession`.
    const plannedCoverageGaps = !fullBody
      && planned.strengthIntent.archetype === 'full_body'
      ? coverageSlotsForFullBodyDay({
        suppliedByOtherDays: suppliedByOtherDays(planned),
        takenByEarlierCoverageDays: takenByCoverageDays,
        pairCounts: weekPairCounts,
      })
      : null;
    const isCoverageDay = plannedCoverageGaps !== null
      && coverageGapsMakeAFullBodySession(plannedCoverageGaps);
    /* ── R-234: A FULL-BODY DAY WITH NOTHING MISSING BALANCES ─────────────
     * Sam, 2026-08-26: *"lowers + uppers + full body (full body - should
     * match whats missing in rest of week or balance out program as well as
     * possible)"*. The case R-087 left open: when the week's genuine gaps do
     * NOT make a full-body session (lower + upper already cover everything),
     * this day used to fall through `composedDayKind(...) ?? 'lower'` — a
     * day NAMED full_body carrying Monday's exact mains and zero upper rows
     * (measured on the profiles audit, both genders, pre- and off-season
     * 3-day). It now takes a real full-body shape: the same A/B ladders,
     * alternating, so the day balances the week instead of doubling one
     * half. Coverage still outranks balance — a week with body-spanning
     * gaps keeps R-087's coverage day untouched. */
    const isBalanceShape = !fullBody
      && planned.strengthIntent.archetype === 'full_body'
      && !isCoverageDay;
    /* Which balance shape? *"match whats missing in rest of week"* is the
     * ruling's own first clause. A LONE balance day beside an upper-only day
     * (the Wednesday-game replan world) alternated blindly to shape A and
     * composed a week with NO HINGE — which §18 rightly refuses
     * (`required_safe_patterns_present:hinge`; the old silent-shrink
     * accounting used to slip the same week past it). Hinge is the named
     * required-safe pattern (R-093 anchors it), so: hinge missing from the
     * other days → B; else squat missing → A; else the alternation stands. */
    const balanceShape = (() => {
      if (!isBalanceShape) return null;
      // TWO OR MORE balance days pair up: A + B together supply the whole
      // ladder, so the plain alternation is already the balanced answer.
      // Asking each to "match what's missing" made BOTH take the lower
      // ladder (each is blind to its sibling — coverage/balance days are
      // deliberately absent from `suppliedByDay`), and the doubled lower
      // week refused `pattern_balance:2` (measured, pre-season 4-day).
      const balanceSiblings = inputs.plannedDays.filter((candidate) =>
        composedDayIsStrength(candidate.strengthIntent)
        && !fullBody
        && candidate.strengthIntent.archetype === 'full_body').length;
      if (balanceSiblings >= 2) {
        return (fullBodyIndex % 2 === 0 ? 'full_body_a' : 'full_body_b') as ComposedDayShape;
      }
      const othersSupply = new Set<SessionSlot>();
      for (const [day, supplied] of suppliedByDay) {
        if (day === planned) continue;
        for (const suppliedSlot of supplied) othersSupply.add(suppliedSlot);
      }
      // BOTH lower mains missing (the compressed [upper, X] week): an A/B
      // half supplies one and §18 rightly refuses the other
      // (`required_safe_patterns_present` — measured both ways on the
      // Wednesday-game replan). The day that must carry the week's whole
      // lower work takes the LOWER ladder — squat + hinge on one day is
      // Sam's own :227 fill order.
      if (!othersSupply.has('hinge') && !othersSupply.has('squat')) return 'lower' as const;
      if (!othersSupply.has('hinge')) return 'full_body_b' as const;
      if (!othersSupply.has('squat')) return 'full_body_a' as const;
      return (fullBodyIndex % 2 === 0 ? 'full_body_a' : 'full_body_b') as ComposedDayShape;
    })();
    const isFullBodyDay = isR093Shape || isCoverageDay || isBalanceShape;
    const kind: ComposedDayShape = isR093Shape
      // R-231: the precomputed pairing above — same shapes, spread so the
      // sorer one sits off the club night. Falls back to the alternation for
      // a day the map has never seen (defensive; the filters match).
      ? (r093ShapeByDay.get(planned)
        ?? (fullBodyIndex % 2 === 0 ? 'full_body_a' : 'full_body_b'))
      : isCoverageDay
        ? 'full_body_coverage'
        : balanceShape
          ?? (composedDayKind(planned.strengthIntent) ?? 'lower');
    if (isR093Shape || isBalanceShape) fullBodyIndex += 1;
    const required: SessionSlot[] = [];
    // ── WHAT THE DAY DECLARES IT OWES, AFTER THE KIT HAS HAD ITS SAY ────────
    //
    // The RESOLVED slot, one entry per row the day owes — so **a plane repeated
    // under R-093's *"yes repeat achievable pull plane"* is declared TWICE**, which
    // is the truth: a bodyweight full-body day owes two horizontal pushes because
    // its vertical push cannot be trained at all. Handing the judge the PREFERRED
    // slots instead made every one of those days read `dup: [horizontal_push]` — 8
    // laddered days across 4 worlds scored deficient for obeying a ruling.
    const declaredForJudge: SessionSlot[] = [];
    /** R-080, per DAY and per SLOT — see `POOL_GROUP_OF`. */
    const groupsUsedBySlot = new Map<SessionSlot, Set<string>>();
    const rows: ComposedRow[] = [];
    const mainSeatsComposedForDay = new Set<SessionSlot>();
    /* ⚠ **ONE IDENTITY, ONCE PER DAY — the last 4 of Sam's 52 (2026-08-20).**
     *
     * After the conditioning warm-up rename was fixed, four occurrences
     * remained: `Explosive Push-up [main_strength+strength_accessory]`, two
     * athletes, four sessions, all `Bodyweight Only`. The same movement filled
     * the day's main push slot AND an accessory slot, so the athlete was
     * prescribed it twice in one session with two different doses.
     *
     * `usedThisWeek` above is WEEK-local variety and cannot see this: both rows
     * are the same day, and the first one adds the identity only after the
     * second has already been chosen from the same list.
     *
     * ⚠ **THE ACCESSORY YIELDS, NEVER THE MAIN LIFT.** This set narrows only the
     * ACCESSORY candidate list. A main lift is deliberately asked against
     * `legal` rather than the narrowed preference list — the contract's *"main
     * and secondary exercises are stable throughout their block"* is
     * unreachable if a week-local or day-local narrowing reaches a per-BLOCK
     * decision, which is stated at that line and is why this is applied where
     * it is and nowhere else. */
    const identitiesThisDay = new Set<ComposedExerciseIdentity>();
    const variationFamiliesThisDay = new Set<ExerciseVariationFamily>();
    // ⚠ THE FULL-BODY SHAPE DECLARES ITS OWN PATTERNS. The plan's answer for
    // this case was upper-only and Sam has overruled it, so asking the plan
    // which patterns the day carries would re-impose the ruling he replaced —
    // and every lower row would come out an accessory.
    // THE TABLE ANSWERS FOR EVERY FIXED SHAPE; R-087's COVERAGE DAY ANSWERS FOR
    // ITSELF. `SLOTS_FOR_KIND['full_body_coverage']` is deliberately the whole
    // ten-slot weekly set — the ladder the day draws FROM — so it must never be
    // used as the day's own seven. That is what this branch exists to prevent.
    const authoredShapeSlots = isCoverageDay && plannedCoverageGaps
      ? plannedCoverageGaps
      // R-130a: one switch, one pick — the female tables for female athletes,
      // the male objects untouched for everyone else.
      : slotsForKind(kind, inputs.profile?.gender);
    // P16: when permanent kit leaves only Leg Press as the suitable bilateral
    // squat, cover that pattern once and retain the other day's single-leg work.
    // Do not rename a unilateral lift, add sets, or rewrite an accepted seat.
    const squatBench = experiencePreferred(slotCandidates('squat').filter(id =>
      !excluded.has(id) && composedRowIsLegal(id, inputs.kit)), inputs.profile);
    const nextSquatSeat = seatCountBySlot.get('squat') ?? 0;
    const acceptedSquatSeat = inputs.selectionHistory.some(entry => entry.slot === 'squat'
      && selectionSeatIndex(entry) === nextSquatSeat && entry.blockStartISO === inputs.blockStartISO);
    const singleLegOwnsLowerWork = !inputs.pinnedIdentities.includes(composedIdentityFor('Leg Press'))
      && !acceptedSquatSeat && usedThisWeek.has(composedIdentityFor('Leg Press'))
      && squatBench.length > 0 && squatBench.every(id => id === 'Leg Press')
      && authoredShapeSlots.includes('single_leg_knee') && !prohibited.has('single_leg_knee')
      && slotCandidates('single_leg_knee').some(id => !excludedToday.has(id) && composedRowIsLegal(id, kitToday));
    const shapeSlotsBeforeOptionalSupport = singleLegOwnsLowerWork
      ? authoredShapeSlots.filter(slot => slot !== 'squat') : authoredShapeSlots;
    const shapeSlots = shapeSlotsBeforeOptionalSupport.filter((slot) =>
      !OPTIONAL_UPPER_SUPPORT_SLOTS.has(slot)
      || slotCandidates(slot).some((identity) => !excludedToday.has(identity)
        && composedRowIsLegal(identity, kitToday)
        && exerciseProgrammingAllows(identity, {
          experienceLevel: inputs.profile.experienceLevel,
          daysToGame: planned.daysToGame,
          route: 'automatic',
        })));
    // A strength card may be removed below when none of its reserved main work
    // survives. Its unshipped support choices must disappear from every weekly
    // selection input too; otherwise a row the athlete never receives can block
    // a later legal fallback and make restart depend on invisible history.
    const selectorBeforeDay = weeklyExerciseSelector.checkpoint();
    const usedBeforeDay = new Set(usedThisWeek);
    const footballBeforeDay = new Set(footballRobustnessCovered);
    const seatCountsBeforeDay = new Map(seatCountBySlot);
    const selectionsBeforeDay = selectionsThisBlock.length;
    const tracesBeforeDay = selectionTraces.length;
    // ⚠ THE TEST IS THE DAY, NOT THE WEEK. Both of these read `fullBody` — the
    // WEEK-level flag — so a day the PLANNER declared `full_body` in an otherwise
    // ordinary week took the else arm: its lower rows came out accessories
    // (no main lift for squat or hinge) and its planes never fell back on the
    // kit. `isFullBodyDay` is the answer to the question both were asking.
    for (const declaredSlot of shapeSlots) {
      // The kit outranks the plane preference, and Sam ruled the fallback.
      const planeChoice = isFullBodyDay && OPPOSITE_PLANE[declaredSlot]
        ? resolvePlane(declaredSlot, kitToday, excludedToday)
        : null;
      if (planeChoice) {
        for (const droppedSlot of planeChoice.dropped) {
          gaps.push({
            ...attributeGap({
              candidates: slotCandidates(droppedSlot),
              kit: kitToday,
              excluded: excludedToday,
            }),
            dayOfWeek: planned.dayOfWeek,
            slot: droppedSlot,
            ...(planeChoice.slot ? { repeatedPlaneInstead: planeChoice.slot } : {}),
          });
        }
        if (!planeChoice.slot) continue;
        // The plane the day will actually train — the preferred one, or the
        // repeat. Declared here so the judge counts the repeat as owed.
        declaredForJudge.push(planeChoice.slot);
      } else {
        declaredForJudge.push(declaredSlot);
      }
      const slot = planeChoice?.slot ?? declaredSlot;
      const pattern = PATTERN_FOR_SLOT[slot] ?? null;
      if (pattern && prohibited.has(pattern)) continue;   // safety, not kit
      const seatIndex = seatCountBySlot.get(slot) ?? 0;
      seatCountBySlot.set(slot, seatIndex + 1);
      const isMainLift = !!pattern
        && weeklyStrengthBudget.canSpend(slot, planned.planEntryId);
      const weeklyCandidate = (identity: ComposedExerciseIdentity) => ({
        identity,
        requestedSlot: slot,
        dayKind: kind,
        route: automaticExerciseRouteForIdentity(identity),
        requestedAsMain: isMainLift,
      } as const);
      /* The final rung is real prehab, authored as prehab. It does not inherit
       * the missing strength slot, spend a main-family seat, or enter the exact
       * strength-identity ledger. The existing strength pool supplies the first
       * two rungs (same category, then accessory); this helper is reached only
       * after those legal benches are empty. */
      const authorPrehabFallback = (): boolean => {
        const prehab = automaticPrehabFallbacksForSlot(slot)
          .map(asComposedIdentity)
          .filter((identity) => !excludedToday.has(identity)
            && !identitiesThisDay.has(identity)
            && composedRowIsLegal(identity, kitToday)
            && exerciseProgrammingAllows(identity, {
              experienceLevel: inputs.profile.experienceLevel,
              daysToGame: planned.daysToGame,
              route: 'automatic',
            }));
        const coreOrRobustness = POOL_REGISTRY.trunk_anti_rotation
          .map((entry) => asComposedIdentity(entry.name))
          .filter((identity) => !excludedToday.has(identity)
            && !identitiesThisDay.has(identity)
            && composedRowIsLegal(identity, kitToday)
            && exerciseProgrammingAllows(identity, {
              experienceLevel: inputs.profile.experienceLevel,
              daysToGame: planned.daysToGame,
              route: 'automatic',
            }));
        const fallback = weeklyExerciseSelector.chooseFallback({
          sameCategory: [],
          accessories: [],
          prehab,
          coreOrRobustness,
          requestedSlot: slot,
          dayKind: kind,
          requestedAsMain: isMainLift,
        });
        if (!fallback) return false;
        const identity = asComposedIdentity(fallback.identity);
        const fallbackSlot = fallback.requestedSlot;
        const authoredFallback = doseFor(kind, fallbackSlot, rows.length);
        const selectedPoolSlot = poolSlotForSelectedRow(fallbackSlot, identity);
        const dose = resolveComposedDose({
          identity,
          isMainLift: false,
          poolSlot: selectedPoolSlot,
          selectionSlot: fallbackSlot,
          seasonPhase: inputs.seasonPhase,
          offseasonSubphase: inputs.offseasonSubphase,
          authoredFallback,
        });
        weeklyExerciseSelector.accept(fallback);
        identitiesThisDay.add(identity);
        required.push(fallbackSlot);
        rows.push({
          identity,
          slot: fallbackSlot,
          role: 'strength_accessory',
          mainStrengthPattern: null,
          doseCategory: dose.category,
          sets: dose.sets,
          repsMin: dose.repsMin,
          repsMax: dose.repsMax,
          ...(dose.restSeconds !== undefined ? { restSeconds: dose.restSeconds } : {}),
          ...(dose.notes ? { notes: dose.notes } : {}),
          load: resolveComposedLoad({
            identity,
            isMainLift: false,
            poolSlot: selectedPoolSlot,
            seasonPhase: inputs.seasonPhase,
            offseasonSubphase: inputs.offseasonSubphase,
            profile: inputs.profile,
            kit: kitToday,
          }),
          ...(dose.qualityLimit ? { qualityLimit: dose.qualityLimit } : {}),
          ...(dose.prescriptionType ? { prescriptionType: dose.prescriptionType } : {}),
          ...(dose.perSide ? { perSide: true } : {}),
        });
        return true;
      };
      const ordinaryPool = (OPTIONAL_UPPER_SUPPORT_SLOTS.has(slot)
        ? automaticIsolationSupportCandidatesForSlot(slot).map(asComposedIdentity)
        : isMainLift ? anchorCandidates(slot) : supportCandidates(slot))
        .filter((identity) => !displacedTrackedDefaults.has(identity));
      const trackedSeat = pattern
        ? selectedTrackedLiftProgrammingSeat(
          inputs.trackedLiftChoices,
          pattern as TrackedLiftProgrammingPattern,
        )
        : null;
      const requestedTrackedAnchor = isMainLift
        && trackedSeat === slot
        && pattern && trackedAnchorByPattern.has(pattern as TrackedLiftProgrammingPattern)
        ? trackedAnchorByPattern.get(pattern as TrackedLiftProgrammingPattern) ?? null
        : null;
      const trackedAnchor = requestedTrackedAnchor
        ? composedIdentityFor(sourceBoundAutomaticIdentityFor(
            requestedTrackedAnchor, ordinaryPool, inputs.profile,
          ))
        : null;
      const pool = trackedAnchor && !ordinaryPool.includes(trackedAnchor)
        ? [trackedAnchor, ...ordinaryPool]
        : trackedAnchor
          ? [trackedAnchor, ...ordinaryPool.filter((identity) => identity !== trackedAnchor)]
          : ordinaryPool;
      /* ── LEGALITY, IN THE CONTRACT'S OWN ORDER ────────────────────────────
       * exclusion → equipment → EXPERIENCE. Ruling 8: *"exclusions, injury,
       * equipment and experience legality outrank pins."* Experience is applied
       * last and never empties the slot (ruling 6). */
      const legalUnder = (out: ReadonlySet<string>, kit: readonly string[]) => {
        const hardLegal = pool.filter((id) => !out.has(id) && composedRowIsLegal(id, kit)
          && exerciseProgrammingAllows(id, { experienceLevel: inputs.profile.experienceLevel,
            daysToGame: planned.daysToGame, route: 'automatic' }));
        /* R-305: advanced athletes may rotate Push-ups with Dips in the explicit
         * push-ACCESSORY seat. The experience table calls Push-ups a regression
         * for choosing a main press; applying that preference again after two
         * major presses left Dips as the only legal-looking accessory in every
         * block (13/13 in the founding tape). This exception changes no main
         * seat and admits no exercise outside the authored accessory pool. */
        const experienceLegal = slot === 'push_accessory_1'
          ? applySourceBoundAutomaticRegression(hardLegal, inputs.profile)
            .map(composedIdentityFor)
          : experiencePreferred(hardLegal, inputs.profile);
        return hingePriorityFirst(slot, experienceLegal);
      };
      /* ── THE BASE BLOCK SELECTION vs A TEMPORARY SUBSTITUTE ────────────────
       *
       * Sam, 2026-08-17: *"A today-only exclusion changes only the affected
       * session and must not replace the stored block selection."*
       *
       * `excluded` carries the answers that span the WEEK — this-block and
       * persistent exclusions, and injury prohibitions. `excludedToday` adds the
       * one day's own answers on top. The BASE selection is decided against the
       * week-scoped set and is the one RECORDED; a day-scoped answer can only
       * ever swap the row on that day.
       *
       * ⚠ **EQUIPMENT USED TO BE IN BOTH, AND THAT WAS THE DEFECT.** The comment
       * this replaces said kit legality is *"a property of the week"*, which is
       * true of a PERMANENT kit and false of a dated one. Both halves now take
       * their own kit: the base against what the athlete OWNS, the day's row
       * against what they can reach THAT DAY. A trip therefore swaps rows and
       * records nothing, and the base returns on the return date by expiry
       * alone — see `temporaryKitByDayOfWeek`. */
      /* ── R-233: ONE RDL VARIANT PER DAY — see `RDL_FAMILY_IDENTITIES` ─────
       * The single-leg hip slot yields when the day already carries an
       * RDL-family lift (in-season that is every hinge day, R-093), leaving
       * the hamstring pair to take the row. Preference, not a veto: a kit
       * with neither hamstring row keeps the repeated variant, because a
       * declared slot left silently empty is the bigger wrong (R-080's own
       * fallback shape).
       *
       * ⚠ THE FILTER TOUCHES ONLY THE DAY'S OWN LIST, NEVER THE BASE — and
       * the first cut got this wrong by arguing the day property was
       * "block-constant". It is not: the week RESHAPES (the equivalence
       * harness's add-game world measured door Single-Leg RDL vs boot
       * Hamstring Curl the same afternoon), and filtering the BASE list
       * invalidated the recorded selection in whichever derivation saw an
       * RDL on the day. The record stands; the colliding day swaps its row
       * through the existing temporary-substitute path — deterministic from
       * the same inputs on both sides of a boot. */
      const rdlAlreadyOnDay = slot === 'single_leg_hip'
        && [...identitiesThisDay].some((id) => sameExerciseVariationFamily(id, 'RDLs'));
      const withoutRdlFamily = (
        list: readonly ComposedExerciseIdentity[],
      ): readonly ComposedExerciseIdentity[] => {
        if (!rdlAlreadyOnDay) return list;
        const filtered = list.filter((id) => !RDL_FAMILY_IDENTITIES.has(id));
        return filtered.length > 0 ? filtered : list;
      };
      const withoutUsedVariationFamily = (
        list: readonly ComposedExerciseIdentity[],
      ): readonly ComposedExerciseIdentity[] => list.filter((id) => {
        const family = exerciseVariationFamily(id);
        return family === null || !variationFamiliesThisDay.has(family);
      });
      const preferMissingFootballCategory = (
        candidates: readonly ComposedExerciseIdentity[],
      ): readonly ComposedExerciseIdentity[] => {
        if (slot !== 'football_robustness') return candidates;
        // Weekly lower-body frontal strength is a required coverage hole, not
        // an audit suggestion. When it is still missing, the groin/adductor
        // robustness seat is the first legal purpose-compatible place to fill
        // it. The ordinary robustness order resumes once a frontal exercise is
        // already present, so legal options still rotate across the week.
        const missingLowerFrontal = weeklyExerciseSelector
          .movementPlaneContextFor(slot).missingUsefulPlanes?.includes('frontal') === true;
        const inCategory = (
          pool: readonly ComposedExerciseIdentity[],
          category: FootballRobustnessCategory,
        ): readonly ComposedExerciseIdentity[] => pool.filter((candidate) =>
          footballRobustnessCategoriesForExercise(candidate).includes(category));
        if (missingLowerFrontal && !footballRobustnessCovered.has('adductor_or_groin')) {
          const groin = inCategory(candidates, 'adductor_or_groin');
          if (groin.length > 0) return groin;
        }
        // The ordinary robustness order: the first weekly category still
        // uncovered that this pool can supply, else the whole pool.
        const firstUncoveredCategory = (
          pool: readonly ComposedExerciseIdentity[],
        ): readonly ComposedExerciseIdentity[] => {
          for (const category of FOOTBALL_ROBUSTNESS_CATEGORIES) {
            if (footballRobustnessCovered.has(category)) continue;
            const matching = inCategory(pool, category);
            if (matching.length > 0) return matching;
          }
          return pool;
        };
        // R-336: a dedicated hinge day spends its legal unused posterior-chain
        // support (hamstring, glute, low back) first; calf or general
        // robustness enters only once that bench is exhausted. The category
        // walk then runs inside whichever bench is open, so the rotation owner
        // ranks only purpose-relevant rows. Other days keep the one order.
        if (kind === 'lower_hinge') {
          const posterior = candidates.filter((candidate) =>
            automaticExerciseSuppliesPosteriorChain(candidate));
          return firstUncoveredCategory(posterior.length > 0 ? posterior : candidates);
        }
        return firstUncoveredCategory(candidates);
      };
      const baseLegalBeforeDayFamily = legalUnder(excluded, inputs.kit);
      // The weekly selector (identity once per week, dedicated-day purpose,
      // compound ceiling) is applied BEFORE the robustness category preference,
      // so a category is chosen among options this day may actually use. When
      // the preferred filler is illegal here, the next legal unused option in
      // the same purpose is taken rather than an empty category.
      const usableThisWeek = (
        list: readonly ComposedExerciseIdentity[],
      ): readonly ComposedExerciseIdentity[] => list.filter((identity) =>
        weeklyExerciseSelector.canUse(weeklyCandidate(identity)));
      const baseLegal = preferMissingFootballCategory(
        usableThisWeek(withoutUsedVariationFamily(baseLegalBeforeDayFamily)),
      );
      const legalBeforeDayIdentity = preferMissingFootballCategory(usableThisWeek(
        withoutUsedVariationFamily(withoutRdlFamily(legalUnder(excludedToday, kitToday))),
      ));
      // One exercise once per day. Keep the block record independent of the
      // day's shape; resolve a collision here, before any row is authored.
      const legal = legalBeforeDayIdentity.filter((id) => !identitiesThisDay.has(id));
      /* ── NOTHING THIS ATHLETE COULD EVER DO HERE ───────────────────────────
       * The PERMANENT list is empty, so the slot is not this athlete's to have
       * and there is no base selection to record. R-083's removal, disclosed. */
      if (baseLegal.length === 0) {
        authorPrehabFallback();
        if (baseLegalBeforeDayFamily.length > 0) {
          gaps.push({ dayOfWeek: planned.dayOfWeek, slot, cause: 'already_on_day', wouldNeed: null });
          continue;
        }
        // `resolvePlane` has already disclosed a plane it could not fill, so a
        // second gap for the same slot would double-count the same fact.
        if (!planeChoice) {
          gaps.push({
            ...attributeGap({ candidates: pool, kit: kitToday, excluded: excludedToday }),
            dayOfWeek: planned.dayOfWeek,
            slot,
          });
        }
        continue;
      }
      /* ⚠ **`legal.length === 0` IS NOT HANDLED HERE, AND THAT IS THE POINT.**
       * A slot the athlete OWNS the kit for and cannot reach TODAY still has a
       * base selection, and skipping it here would drop that selection from the
       * record — which is a dated answer erasing a permanent one, the exact
       * defect this whole split exists to remove. Measured 2026-08-17 with the
       * skip still in place: an away week recorded NINE slots instead of ten and
       * `vertical_pull` vanished from the athlete's history because a hotel room
       * has no pull-up bar. The decision is made and recorded below; the gap is
       * disclosed and the ROW is dropped immediately after it. */
      // ── R-080: A REPEATED SLOT MAY NOT REPEAT ITS MUSCLE GROUP ────────────
      //
      // Only reachable when the day owes the SAME slot twice — R-093's kit
      // fallback. Preference, not a veto: if every remaining candidate shares the
      // group, the row is still authored, because R-083 disclosing a gap is one
      // thing and leaving a declared slot silently empty is another.
      //
      // ⚠ **IT NARROWS `baseLegal`, THE PERMANENT LIST, AND THAT MOVED HERE ON
      // 2026-08-17.** It used to narrow `legal` — TODAY'S kit — and its result
      // then fed the BASE decision, so a dated answer reached the record by the
      // back door even after the kit split landed. Measured: an away week still
      // RECORDED `accessory_or_core: Ab Wheel → Band Pallof Press`, because
      // `Ab Wheel` survived `baseLegal` and was then filtered out for not
      // appearing in a preference list a hotel room had built.
      //
      // **There is still exactly ONE variety computation.** It answers the
      // question it was always asked — *"what else could this block pick"* — and
      // that question is about the athlete's own kit, never about today's.
      const groupsUsedHere = groupsUsedBySlot.get(slot) ?? new Set<string>();
      const baseFresh = baseLegal.filter((id) => !usedThisWeek.has(id));
      const baseChoices = baseFresh.length > 0 ? baseFresh : baseLegal;
      const baseDifferentGroup = baseChoices.filter((id) => {
        const group = POOL_GROUP_OF.get(id);
        return !group || !groupsUsedHere.has(group);
      });
      const baseDifferentGroupFresh = baseDifferentGroup.length > 0 ? baseDifferentGroup : baseChoices;
      /* The day-local narrowing, applied like every other one here: prefer rows
       * this day does not already hold, and fall back rather than empty the
       * list — an accessory slot with no fresh option is still owed a row. */
      const baseNotOnThisDay = baseDifferentGroupFresh.filter(
        (id) => !identitiesThisDay.has(id));
      const basePreferred = baseNotOnThisDay.length > 0
        ? baseNotOnThisDay
        : baseDifferentGroupFresh;
      /* ── THE ROTATION OWNER DECIDES IDENTITY. THIS LINE NO LONGER DOES. ────
       *
       * It used to be `preferred[step % preferred.length]`, where `step` is the
       * PHASE WEEK NUMBER — so a main lift changed every week and the contract's
       * *"main and secondary exercises are stable throughout their block"* was
       * unreachable. See `rules/blockExerciseSelection.ts` for the measured before.
       *
       * ⚠ **A MAIN LIFT IS ASKED AGAINST `legal`, NOT `preferred`.** The
       * `usedThisWeek` and muscle-group narrowings above are WEEK-LOCAL variety:
       * they differ from day to day, so feeding them to a per-BLOCK decision
       * would make the same slot resolve differently on Monday and Friday and
       * put the block-stability clause out of reach again. Variety within a week
       * remains the accessory's job, which is the freedom the contract gives it
       * and withholds from main lifts. */
      /* ⚠ **"MAIN AND SECONDARY" IS THE SET BUDGET'S ANSWER, NOT `isMainLift`.**
       *
       * `isMainLift` above means "the day's FIRST row for this pattern" — one
       * row per pattern per day. The contract's *"main and secondary exercises
       * are stable throughout their block"* is a wider set than that, and the
       * app already draws the line: `slotCountsTowardSetBudget` is what
       * `countMainSecondarySets` counts, and it deliberately excludes
       * accessories and core.
       *
       * Measured with `isMainLift` driving the cadence: `single_leg_knee`,
       * `vertical_push` and `vertical_pull` still changed every week inside one
       * block, because their rows are not the day's primary row for a planned
       * pattern and so fell to the accessory cadence. They count toward the
       * session's main/secondary budget, so the athlete meets them as real work
       * and must meet the SAME one all block. */
      /* ── THE SELECTION OWNER ───────────────────────────────────────────────
       * `decideExerciseForBlock` reads the RECORDED past. There is no cursor and
       * no block-number index: an athlete whose kit or exclusions changed keeps a
       * truthful history instead of a re-derived one. See the measured trace in
       * `rules/blockExerciseSelection.ts`. */
      const role = selectionRoleFor(slot);
      const countsTowardBudget = slotCountsTowardSetBudget(slot);
      const slotHistory = inputs.selectionHistory
        .filter((entry) => entry.slot === slot
          && selectionSeatIndex(entry) === seatIndex
          && entry.blockStartISO < inputs.blockStartISO)
        .sort((a, b) => b.blockStartISO.localeCompare(a.blockStartISO));
      /* This block's OWN recorded choice, when it has been authored before —
       * a relaunch restores it rather than re-deciding against today's world.
       *
       * ⚠ THE IN-RUN RECORD COUNTS TOO (R-234's balance day found the hole).
       * The record is keyed by SLOT, and until the balance day no two days in
       * a split week shared one. Now the balance day repeats the upper day's
       * planes, and the two runs saw different worlds: at install the later
       * day could not see the earlier day's record (it was still in
       * `selectionsThisBlock`, persisted only at the end) and picked fresh
       * from its own candidate head; at boot it COULD and replayed the
       * record. Measured: bin Monday, relaunch — the full-body day's pull
       * flips Pull-Ups → Lat Pulldown. One weekly seat, one answer per block, on
       * both sides of a boot. */
      const recordedForThisBlock = inputs.selectionHistory.find(
        (entry) => entry.slot === slot
          && selectionSeatIndex(entry) === seatIndex
          && entry.blockStartISO === inputs.blockStartISO,
      ) ?? selectionsThisBlock.find((entry) =>
        entry.slot === slot && selectionSeatIndex(entry) === seatIndex) ?? null;
      /* The base candidate list narrows to the day's variety preferences only
       * for slots outside the main/secondary budget, exactly as before. */
      /* A recorded seat restores from the whole legal bench. A NEW seat prefers
       * what this week has not used yet, so a third exposure advances again
       * instead of making seats one and two identical. */
      const seatCandidates = recordedForThisBlock ? baseLegal : basePreferred;
      const distinctSplitAccessoryCandidates = SPLIT_UPPER_ACCESSORY_SLOTS.has(slot)
        ? seatCandidates.filter((id) => !identitiesThisDay.has(id))
        : seatCandidates;
      const baseCandidates = countsTowardBudget
        ? (distinctSplitAccessoryCandidates.length > 0
          ? distinctSplitAccessoryCandidates
          : seatCandidates)
        : baseLegal.filter((id) => basePreferred.includes(id) || basePreferred.length === 0);
      const selectionCandidates = trackedAnchor && baseLegal.includes(trackedAnchor)
        ? baseLegal
        : baseCandidates.length > 0 ? baseCandidates : baseLegal;
      // A tracked lift is an anchor, not a rotating pin. It wins whenever it is
      // legal for this pattern; an injury, removal, or missing equipment removes
      // it from `selectionCandidates` before this branch and the ordinary typed
      // fallback owns the day. Ignoring the current-block record here is what
      // lets a live athlete choice replace the already-authored default.
      const selection = trackedAnchor && selectionCandidates.includes(trackedAnchor)
        ? {
            identity: trackedAnchor,
            decisionKind: slotHistory[0]?.identity === trackedAnchor
              ? 'retained' as const : 'first_selection' as const,
            reason: 'athlete_preference' as const,
            previousIdentity: slotHistory[0]?.identity ?? null,
            consideredCandidates: selectionCandidates,
          }
        : decideExerciseForBlock({
            phase: inputs.seasonPhase as 'Off-season' | 'Pre-season' | 'In-season',
            blockNumber: inputs.blockNumber,
            slot,
            group: null,
            role,
            legalCandidates: selectionCandidates,
            previousSelection: slotHistory[0] ?? null,
            currentBlockSelection: recordedForThisBlock,
            recentSelections: slotHistory,
            progressedIdentities: inputs.progressedIdentities,
            pinnedIdentities: inputs.pinnedIdentities,
            movementPlaneContext: weeklyExerciseSelector.movementPlaneContextFor(slot),
          });
      /* ⚠ **THE RECORD IS THE BASE SELECTION, ALWAYS — never the substitute.**
       * *"A temporary injury/constraint substitution must not become the
       * athlete's new permanent rotation history merely because boot occurred."*
       * Written before the day-scoped swap below, so no path can record one. */
      if (!selectionsThisBlock.some((entry) =>
        entry.slot === slot && selectionSeatIndex(entry) === seatIndex)) {
        selectionsThisBlock.push({
          blockNumber: inputs.blockNumber,
          blockStartISO: inputs.blockStartISO,
          slot,
          seatIndex,
          group: POOL_GROUP_OF.get(selection.identity) ?? null,
          role,
          identity: selection.identity,
        });
      }
      /* ── THE SLOT IS RECORDED; TODAY IT CANNOT BE FILLED ───────────────────
       * The base selection above is safe in the athlete's history. This one day
       * has no legal row for it, so the gap is disclosed and no row ships — and
       * the slot is NOT pushed to `required`, because a slot nothing filled must
       * not be counted as owed-and-met by the judge. */
      if (legal.length === 0) {
        authorPrehabFallback();
        if (legalBeforeDayIdentity.length > 0) {
          gaps.push({ dayOfWeek: planned.dayOfWeek, slot, cause: 'already_on_day', wouldNeed: null });
        } else if (!planeChoice) {
          gaps.push({
            // Attributed against the DAY's kit: a slot only today's kit empties
            // is a kit gap the athlete can see the cause of, and one the
            // permanent kit could have filled is still the kit's answer.
            ...attributeGap({ candidates: pool, kit: kitToday, excluded: excludedToday }),
            dayOfWeek: planned.dayOfWeek,
            slot,
          });
        }
        continue;
      }
      required.push(slot);
      /* ── THE TEMPORARY SUBSTITUTE ──────────────────────────────────────────
       * The base selection stands unless THIS DAY excludes it, or this day's KIT
       * cannot perform it. When either happens, the best option legal on today's
       * kit takes the row for this day only, carrying a typed reason — and the
       * record above is untouched, so the canonical selection returns by itself
       * when the day-scoped answer expires.
       *
       * ⚠ **THE CAUSE IS ASKED IN THIS ORDER FOR A REASON.** An exclusion is the
       * athlete's own decision and only they can undo it; a dated kit loss ends
       * on the return date with nothing to remember. When BOTH are true of one
       * row the exclusion is named, because it is the half that outlives the
       * trip and the half the athlete can act on. */
      /* The temporary row uses the SAME typed selector as the base row, but it
       * is never recorded. `legal` has already applied today's equipment,
       * exclusions, day collisions and experience preference, so the shared
       * selector owns only the remaining phase/pin/stable-choice decision.
       * This keeps the dated answer catalogue-order independent without turning
       * it into permanent history or reintroducing freshness as a policy. */
      const substitutedToday = !legal.includes(selection.identity);
      const identity = substitutedToday
        ? decideExerciseForBlock({
            phase: inputs.seasonPhase as 'Off-season' | 'Pre-season' | 'In-season',
            blockNumber: inputs.blockNumber,
            slot,
            group: null,
            role,
            legalCandidates: legal,
            previousSelection: null,
            currentBlockSelection: null,
            recentSelections: [],
            progressedIdentities: [],
            pinnedIdentities: inputs.pinnedIdentities,
            movementPlaneContext: weeklyExerciseSelector.movementPlaneContextFor(
              slot,
              selection.identity,
            ),
          }).identity
        : selection.identity;
      const changedByDayIdentity = identitiesThisDay.has(selection.identity)
        || [...identitiesThisDay].some((id) => sameExerciseVariationFamily(id, selection.identity));
      const substitutionCause: NonNullable<ComposedRow['substitutedFor']>['cause'] | undefined =
        !substitutedToday ? undefined
          : excludedToday.has(selection.identity) ? 'excluded_today'
          : changedByDayIdentity ? 'already_on_day'
          : !composedRowIsLegal(selection.identity, kitToday) ? 'kit_today'
          : undefined;
      if (substitutedToday && !substitutionCause) {
        throw new Error(
          `Unattributed composed substitution: ${selection.identity} -> ${identity} `
          + `(day ${planned.dayOfWeek}, slot ${slot})`,
        );
      }
      const substitutionReason: ComposedRow['substitutedFor'] = substitutedToday
        ? {
            baseIdentity: selection.identity,
            cause: substitutionCause!,
          }
        : undefined;
      const dateISO = addComposerDaysISO(mondayISO(inputs.todayISO), (planned.dayOfWeek + 6) % 7);
      const experienceAllowed = new Set(experiencePreferred(pool, inputs.profile));
      const considered = new Set(selection.consideredCandidates);
      const candidateRows: AutomaticCandidateTrace[] = pool.map((candidate) => {
        const rejectedBy: AutomaticCandidateRejection[] = [];
        if (excludedToday.has(candidate)) rejectedBy.push('athlete_exclusion');
        if (!composedRowIsLegal(candidate, kitToday)) rejectedBy.push('equipment');
        if (!experienceAllowed.has(candidate) || !exerciseProgrammingAllows(candidate, {
          experienceLevel: inputs.profile.experienceLevel,
          daysToGame: planned.daysToGame,
          route: 'automatic',
        })) rejectedBy.push('experience');
        if (identitiesThisDay.has(candidate)) rejectedBy.push('already_on_day');
        if (rejectedBy.length === 0 && !considered.has(candidate) && candidate !== identity) {
          rejectedBy.push('weekly_spacing');
        }
        const uses = slotHistory.filter((entry) => entry.identity === candidate);
        const lastIndex = slotHistory.findIndex((entry) => entry.identity === candidate);
        return {
          name: candidate,
          eligible: rejectedBy.length === 0 && (considered.has(candidate) || candidate === identity),
          rejectedBy,
          rank: null,
          score: {
            phasePriority: selection.consideredCandidates.indexOf(candidate) === -1
              ? selection.consideredCandidates.length
              : selection.consideredCandidates.indexOf(candidate),
            athletePreference: inputs.pinnedIdentities.includes(candidate),
            recentUsage: uses.slice(0, 3).length,
            annualUsage: uses.length,
            weeksOrBlocksSinceUse: lastIndex === -1 ? null : lastIndex,
            weeklyUsage: usedThisWeek.has(candidate) ? 1 : 0,
          },
        };
      });
      selectionTraces.push({
        schemaVersion: 1,
        decisionId: `strength:${dateISO}:${slot}:${seatIndex}`,
        kind: 'strength_exercise',
        owner: 'blockExerciseSelection',
        need: {
          dateISO,
          weekStartISO: mondayISO(inputs.todayISO),
          dayOfWeek: planned.dayOfWeek,
          phase: inputs.seasonPhase,
          movementOrQuality: slot,
          role: isMainLift ? 'main_strength' : 'strength_accessory',
          seatIndex,
          equipment: [...kitToday],
          experience: inputs.profile.experienceLevel ?? null,
          injuries: [
            ...inputs.injuries.prohibitedPatterns.map((item) => `pattern:${item}`),
            ...[...excludedToday].map((item) => `excluded:${item}`),
          ],
          daysToGame: planned.daysToGame ?? null,
        },
        candidates: rankSelectedFirst(candidateRows, identity),
        selected: identity,
        selectionReason: substitutedToday
          ? `temporary_substitution:${substitutionReason?.cause}`
          : selection.reason,
      });
      weeklyExerciseSelector.accept(weeklyCandidate(identity));
      usedThisWeek.add(identity);
      if (isMainLift) {
        if (!weeklyStrengthBudget.spend(slot, planned.planEntryId)) {
          throw new Error(`Weekly main-strength seat was spent twice: ${slot}`);
        }
        mainSeatsComposedForDay.add(slot);
      }
      identitiesThisDay.add(identity);
      for (const category of footballRobustnessCategoriesForExercise(identity)) {
        footballRobustnessCovered.add(category);
      }
      const selectedVariationFamily = exerciseVariationFamily(identity);
      if (selectedVariationFamily) variationFamiliesThisDay.add(selectedVariationFamily);
      const chosenGroup = POOL_GROUP_OF.get(identity);
      if (chosenGroup) {
        groupsUsedHere.add(chosenGroup);
        groupsUsedBySlot.set(slot, groupsUsedHere);
      }
      // ── B1-M1: THE DOSE IS RESOLVED HERE, NOT DOWNSTREAM ────────────────
      // `doseFor` is the composer's authored fallback band; where a ruling
      // owns the row — a main lift's phase scheme, U-1's loaded band, U-3's
      // unloaded compounds, U-4's ballistic swings — the ruling wins.
      const authoredFallback = doseFor(kind, slot, rows.length);
      const selectedPoolSlot = poolSlotForSelectedRow(slot, identity);
      const dose = resolveComposedDose({
        identity,
        isMainLift,
        poolSlot: selectedPoolSlot,
        selectionSlot: slot,
        seasonPhase: inputs.seasonPhase,
        offseasonSubphase: inputs.offseasonSubphase,
        authoredFallback,
      });
      rows.push({
        identity,
        ...(substitutionReason ? { substitutedFor: substitutionReason } : {}),
        slot,
        role: isMainLift ? 'main_strength' : 'strength_accessory',
        mainStrengthPattern: isMainLift ? pattern : null,
        doseCategory: dose.category,
        sets: dose.sets,
        repsMin: dose.repsMin,
        repsMax: dose.repsMax,
        ...(dose.restSeconds !== undefined ? { restSeconds: dose.restSeconds } : {}),
        ...(dose.notes ? { notes: dose.notes } : {}),
        // U-2 applies exactly once, here, before authorship. The composer emits
        // no starting load of its own, so the cut has nothing to stack onto.
        // THE FINAL LOAD, DERIVED FROM THE BASE — base working load x one
        // governed multiplier, recomputed from the base rather than adjusted in
        // place, so the derivation is naturally non-stacking.
        load: resolveComposedLoad({
          identity,
          isMainLift,
          poolSlot: selectedPoolSlot,
          seasonPhase: inputs.seasonPhase,
          offseasonSubphase: inputs.offseasonSubphase,
          profile: inputs.profile,
          // The load must be liftable with what he has THAT DAY — a barbell
          // lattice is the wrong ladder for a dumbbell substitute.
          kit: kitToday,
        }),
        ...(dose.qualityLimit ? { qualityLimit: dose.qualityLimit } : {}),
        // Slice 5: an authored hold's unit travels with its numbers.
        ...(dose.prescriptionType ? { prescriptionType: dose.prescriptionType } : {}),
        ...(dose.perSide ? { perSide: true } : {}),
      });
    }

    // Robustness and trunk work support a required strength session; they do
    // not create one after injury has prohibited every planned main pattern.
    // In that case the honest result is the existing typed adjustment, not an
    // accessory-only card presented as the athlete's required gym session.
    const expectedMainSeatHere = shapeSlots.some((slot) =>
      isWeeklyMainStrengthSlot(slot)
      && weeklyStrengthBudget.reservedOwnerBySlot[slot] === planned.planEntryId);
    if (expectedMainSeatHere && mainSeatsComposedForDay.size === 0) {
      rows.splice(0, rows.length);
      required.splice(0, required.length);
      weeklyExerciseSelector.restore(selectorBeforeDay);
      usedThisWeek.clear(); usedBeforeDay.forEach((identity) => usedThisWeek.add(identity));
      footballRobustnessCovered.clear();
      footballBeforeDay.forEach((category) => footballRobustnessCovered.add(category));
      seatCountBySlot.clear();
      seatCountsBeforeDay.forEach((count, slot) => seatCountBySlot.set(slot, count));
      selectionsThisBlock.splice(selectionsBeforeDay);
      selectionTraces.splice(tracesBeforeDay);
    }
    if (rows.length === 0) {
      // Clause (d): requested, and nothing lawful could fill it. Said out loud
      // with a typed reason rather than silently dropped.
      adjustment.push({ reason: 'no_trainable_slot_on_this_kit', dayOfWeek: planned.dayOfWeek });
      continue;
    }
    // ── R-087's ACCUMULATOR, UPDATED FROM WHAT THIS DAY ACTUALLY FILLED ──────
    //
    // `required` — not `shapeSlots` — because a slot the kit could not fill was
    // never trained and must stay OPEN for a later day. Crediting a declared-but-
    // empty slot as covered is how a bodyweight week would talk itself out of ever
    // training a pattern it can reach on another day.
    for (const slot of required) {
      if (isCoverageDay) takenByCoverageDays.add(slot);
      if (slot in weekPairCounts) weekPairCounts[slot] += 1;
    }
    days.push({
      dayOfWeek: planned.dayOfWeek,
      planEntryId: planned.planEntryId,
      name: planned.name,
      workoutType: planned.workoutType,
      sessionTier: planned.sessionTier,
      kind,
      requiredSlots: required,
      // The day's OWN ladder as DECLARED, before the kit dropped anything. The
      // judge needs this and not `requiredSlots`: `requiredSlots` is what was
      // filled, so judging against it would be satisfied by construction and could
      // never report a miss. R-087's coverage day has no static table to fall back
      // on, which is why it travels with the day.
      declaredSlots: declaredForJudge,
      // R-225 — carried, not recomputed. It is the plan this day was composed
      // from, and the only reason it ever left the day is that nobody asked.
      strengthIntent: planned.strengthIntent,
      rows,
    });
  }

  // A later ordinary row can make an earlier robustness seat redundant (an
  // upper session may precede the lower session that supplies the same RDL or
  // unilateral quality). Inspect the COMPLETE composed strength week and keep
  // a robustness row only when it adds a still-missing category. This remains
  // canonical composition: the slot selector authored every retained row and
  // no generated or stored week is rewritten afterwards.
  const suppliedByOrdinaryRows = new Set<FootballRobustnessCategory>(
    days.flatMap((day) => day.rows
      .filter((row) => row.slot !== 'football_robustness')
      .flatMap((row) => footballRobustnessCategoriesForExercise(row.identity))),
  );
  const removeRobustnessSlots = (
    slots: readonly SessionSlot[],
    count: number,
  ): SessionSlot[] => {
    let remaining = count;
    return slots.filter((slot) => {
      if (slot !== 'football_robustness' || remaining <= 0) return true;
      remaining -= 1;
      return false;
    });
  };
  const finalDays = days.map((day) => {
    let removed = 0;
    let usefulRowsRemaining = day.rows.filter((row) =>
      row.slot !== 'core' && row.slot !== 'midline').length;
    const rows = day.rows.filter((row) => {
      if (row.slot !== 'football_robustness') return true;
      const supplied = footballRobustnessCategoriesForExercise(row.identity);
      if (supplied.length === 0
        || supplied.some((category) => !suppliedByOrdinaryRows.has(category))) {
        supplied.forEach((category) => suppliedByOrdinaryRows.add(category));
        return true;
      }
      // R-334: redundancy must not turn a healthy ordinary strength session
      // into two lifts. Keep the already-selected legal support row when it is
      // needed to preserve the useful-session minimum; no duplicate or filler
      // is invented here.
      if (minimumUsefulStrengthApplies(day.kind)
        && usefulRowsRemaining <= MINIMUM_USEFUL_STRENGTH_EXERCISES) {
        return true;
      }
      removed += 1;
      usefulRowsRemaining -= 1;
      return false;
    });
    return removed === 0 ? day : {
      ...day,
      rows,
      requiredSlots: removeRobustnessSlots(day.requiredSlots, removed),
      declaredSlots: removeRobustnessSlots(day.declaredSlots, removed),
    };
  });
  const finalStrengthIdentitiesByDay = new Map(finalDays.map((day) => [
    day.dayOfWeek,
    new Set(day.rows.map((row) => row.identity)),
  ]));
  // A complete-week de-duplication is the final composition decision. Do not
  // publish an interim strength choice as selected after its row was removed;
  // audit traces describe content that survived into the athlete's session.
  const finalSelectionTraces = selectionTraces.filter((trace) =>
    trace.kind !== 'strength_exercise'
      || (trace.selected !== null
        && finalStrengthIdentitiesByDay.get(trace.need.dayOfWeek)?.has(trace.selected)));

  return {
    weekStartISO: mondayISO(inputs.todayISO),
    days: finalDays,
    gaps,
    sessionCount: {
      // Clause (d) counts what the PLANNER asked for. `composedDayKind !== null`
      // stopped being that question when `full_body` started returning null.
      requested: composedStrengthDays(inputs.plannedDays).length,
      composed: days.length,
      adjustment: adjustment.length > 0 ? adjustment : null,
    },
    kitUnachievablePatterns: kitUnachievablePatterns(weekReachableKit),
    selections: selectionsThisBlock,
    selectionTraces: finalSelectionTraces,
  };
}
