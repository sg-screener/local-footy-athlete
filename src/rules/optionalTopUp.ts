/**
 * THE NEED-BASED TOP-UP PASS.
 *
 * Sam's governing principle, 2026-07-30:
 *
 *   "No defaults. Build the program; if anything is lacking, add a spare optional
 *    session to make up for it. Strength and conditioning is the 90% —
 *    accessories, mobility etc. is the final 10%."
 *
 * It runs AFTER the core week is built. Accessories still compute what the week
 * lacks; R-237 additionally guarantees one equipment-free Mobility offer when a
 * spare day exists (two total in Off-season). These are optional offers and never
 * a quota the core scheduler must fill.
 *
 * WHERE IT RUNS, AND WHY THAT PLACEMENT IS THE ARGUMENT. It runs after
 * `requireSection18AcceptedWeek` has accepted the week. So a top-up session is
 * incapable of affecting compliance — not "is checked not to", INCAPABLE, because
 * the contract was satisfied before it existed and is never re-evaluated against
 * it. Two of Sam's five conditions ("never counted toward compliance", "never
 * counted toward load") are structural at this seam rather than asserted.
 *
 * EVERY THRESHOLD HERE IS SIGNED. `docs/NEED_COMPUTATION_SHEET_2026-07-30.md` was
 * sent before any of it was wired, and the rulings are recorded beside it. The
 * one invented number in the sheet — N1's 3-of-6 — was signed as drafted.
 */

import type { Workout } from '../types/domain';
import type { SeasonPhase } from '../types/domain';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import { isExplicitRestStub } from '../utils/workoutContent';
import {
  WEAK_POINT_ACCESSORY_REGION_THRESHOLD,
  weakPointLeansOptionalTopUps,
  type WeakPointFocus,
} from './weakPointFocus';
import {
  CALVES_POOL,
  GROIN_ADDUCTORS_POOL,
  HAMSTRING_LIGHT_POOL,
  LOWER_PREHAB_POOL,
  MOBILITY_POOL,
  SHOULDER_HEALTH_POOL,
  TRUNK_ANTI_ROTATION_POOL,
} from '../data/exercisePools';

/** The six prehab regions Sam signed as the Accessories census. */
export const PREHAB_REGIONS = [
  'groin_adductors',
  'calves',
  'lower_prehab',
  'midline',
  'shoulder_health',
  'hamstring',
] as const;
export type PrehabRegion = (typeof PREHAB_REGIONS)[number];

const REGION_POOLS: Readonly<Record<PrehabRegion, readonly { name: string }[]>> = {
  groin_adductors: GROIN_ADDUCTORS_POOL,
  calves: CALVES_POOL,
  lower_prehab: LOWER_PREHAB_POOL,
  midline: TRUNK_ANTI_ROTATION_POOL,
  shoulder_health: SHOULDER_HEALTH_POOL,
  hamstring: HAMSTRING_LIGHT_POOL,
};

const REGION_BY_EXERCISE: ReadonlyMap<string, PrehabRegion> = (() => {
  const map = new Map<string, PrehabRegion>();
  for (const region of PREHAB_REGIONS) {
    for (const entry of REGION_POOLS[region]) {
      map.set(canonicalExerciseName(entry.name), region);
    }
  }
  return map;
})();

const MOBILITY_NAMES: ReadonlySet<string> =
  new Set(MOBILITY_POOL.map((entry) => canonicalExerciseName(entry.name)));

/**
 * V1 — WHICH PREHAB REGIONS THE WEEK TOUCHED.
 *
 * SAM'S RULING 1: in-session accessory rows COUNT. A lower day already carries
 * prehab and midline after its accessories (`:224`), and `:229` says that is
 * where the prehab that matters lives — so a week whose sessions covered the
 * regions is not lacking, and the top-up is genuinely the final 10% rather than a
 * default wearing a need test.
 *
 * Counted from ROWS, wherever they sit, which is also why an athlete who added
 * their own accessories silences the need without anything special being written
 * for that case.
 */
export function accessoryRegionsCovered(
  workouts: readonly Workout[],
): ReadonlySet<PrehabRegion> {
  const covered = new Set<PrehabRegion>();
  for (const workout of workouts) {
    for (const row of workout.exercises ?? []) {
      const name = (row as { exercise?: { name?: string } }).exercise?.name;
      if (!name) continue;
      const region = REGION_BY_EXERCISE.get(canonicalExerciseName(name));
      if (region) covered.add(region);
    }
  }
  return covered;
}

/**
 * V3 — HOW MANY MOBILITY SESSIONS THE WEEK HAS.
 *
 * A session counts when it has rows and EVERY row is a mobility-pool movement.
 * Deliberately strict: a strength day with one mobility movement in its warm-up
 * is not a mobility session, and counting it as one would silence a need the
 * athlete really has.
 */
export function mobilitySessionCount(workouts: readonly Workout[]): number {
  let count = 0;
  for (const workout of workouts) {
    const rows = workout.exercises ?? [];
    if (rows.length === 0) continue;
    const allMobility = rows.every((row) => {
      const name = (row as { exercise?: { name?: string } }).exercise?.name;
      return !!name && MOBILITY_NAMES.has(canonicalExerciseName(name));
    });
    if (allMobility) count += 1;
  }
  return count;
}

/** N1's threshold, SIGNED: the need fires below three of the six regions. */
export const ACCESSORY_REGION_THRESHOLD = 3;
/** N2's aim, SIGNED: off-season tops up TOWARD two (`:108` "1-2 mobility"). */
export const OFFSEASON_MOBILITY_TARGET = 2;

export type OptionalTopUpType = 'accessories' | 'mobility';

export interface OptionalTopUpPlacement {
  readonly type: OptionalTopUpType;
  readonly dayOfWeek: number;
  /** Which need produced it. Travels so a placement can always name its rule. */
  readonly need: 'accessory_coverage' | 'spare_day_mobility' | 'offseason_mobility';
}

export interface OptionalTopUpInput {
  readonly workouts: readonly Workout[];
  readonly seasonPhase: SeasonPhase | null | undefined;
  /** Day-of-week values the week may place on, already excluding fixtures. */
  readonly candidateDays: readonly number[];
  /**
   * Days an equipment-free Mobility offer may use. Defaults to `candidateDays`
   * for pure legacy callers; generation supplies every still-governable day.
   */
  readonly equipmentFreeCandidateDays?: readonly number[];
  /** The game's day-of-week, or null. */
  readonly gameDayOfWeek: number | null;
  /**
   * The athlete's stated weakness, as a `:105` focus (Sam's ruling 3, 2026-07-30).
   *
   *   "YES — mobility/injury-history weakness leans the OPTIONAL top-ups (N2 firms to 2,
   *    placed early; N1 threshold moves to <4 of 6). Optional tier only; required work
   *    untouched — consistent with A."
   *
   * OPTIONAL TIER ONLY is what keeps this inside reading A. These are the only two needs
   * that exist, both place optional work, and the phase tables are untouched — so a
   * weakness changes what fills the week and never what it requires.
   */
  readonly weakPointFocus?: WeakPointFocus | null;
}

/**
 * The signed caps, as one predicate.
 *
 * Never on a game day (`:90`, `:132`), never on G-1 — the authored Gunshow owns
 * that day (`:153`) — and never on a day the week already filled.
 */
function dayIsAvailable(
  day: number,
  type: OptionalTopUpType,
  input: OptionalTopUpInput,
): boolean {
  if (input.gameDayOfWeek !== null) {
    if (day === input.gameDayOfWeek) return false;
    const gMinusOne = (input.gameDayOfWeek + 6) % 7;
    if (day === gMinusOne) return false;
    // G+1 is complete rest OR recovery. Accessories are neither; Mobility is a
    // recovery-class, bodyweight-only offer and may use the day without changing
    // its rest arithmetic.
    //
    // It was not a theoretical gap. On a Sunday-fixture week the pass put an
    // Accessories session on the Monday; the resolver's G+1 rule then converted it
    // to recovery, and the athlete could not delete the result — a derived session
    // re-appears on every read, so the deletion door reported
    // `visible_change_unverified`. Found by `athleteSessionDeletionTests`
    // regression 6, which is the second time that cell has caught a G+1 placement.
    const gPlusOne = (input.gameDayOfWeek + 1) % 7;
    if (day === gPlusOne && type !== 'mobility') return false;
  }
  return !input.workouts.some((workout) =>
    workout.dayOfWeek === day && !isExplicitRestStub(workout));
}

/**
 * Day preference: G-3 / Wednesday first, then any free day.
 *
 * `:152` names Wednesday — "4 days: as above plus optional accessories/prehab
 * Wednesday" — and the fixture-relative form of that is G-3. Both are tried,
 * G-relative first, because the Wednesday in the Bible IS the G-3 of a Saturday
 * game week.
 */
function preferredDays(input: OptionalTopUpInput, candidateDays: readonly number[]): number[] {
  const preferred: number[] = [];
  // PLACED EARLY for a mobility / injury-history weakness (Sam's ruling 3). Monday and
  // Tuesday come first, ahead of the G-3 / Wednesday preference, so the work the athlete
  // says they need most is not the thing that falls off the end of a busy week.
  if (weakPointLeansOptionalTopUps(input.weakPointFocus ?? null)) {
    preferred.push(1, 2);
  }
  if (input.gameDayOfWeek !== null) {
    preferred.push((input.gameDayOfWeek + 4) % 7);
  }
  preferred.push(3);
  const ordered = [
    ...preferred,
    ...[...candidateDays].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)),
  ];
  const seen = new Set<number>();
  return ordered.filter((day) => {
    if (seen.has(day)) return false;
    seen.add(day);
    return candidateDays.includes(day);
  });
}

/**
 * WHAT THE WEEK LACKS, AND AT MOST WHAT FILLS IT.
 *
 * Two session types: Accessories when regional coverage is lacking, and Mobility
 * as the spare-day recovery offer. Nothing measures strength or conditioning,
 * which are the 90% and belong to the contract.
 *
 * SAM'S RULING 3: a week may take BOTH an Accessories and a Mobility top-up.
 * SAM'S RULING 4: mobility tops up TOWARD TWO, not one — "just want to get the
 * athlete feeling good again" — still shrinking when the days will not take it.
 */
// BIBLE_ANCHOR: optional_placement_five_conditions
export function computeOptionalTopUps(
  input: OptionalTopUpInput,
): OptionalTopUpPlacement[] {
  const placements: OptionalTopUpPlacement[] = [];
  const usedDays = new Set<number>();
  const mobilityCandidateDays = input.equipmentFreeCandidateDays ?? input.candidateDays;

  const take = (type: OptionalTopUpType, need: OptionalTopUpPlacement['need']): boolean => {
    const candidates = type === 'mobility' ? mobilityCandidateDays : input.candidateDays;
    const day = preferredDays(input, candidates).find((candidate) =>
      !usedDays.has(candidate) && dayIsAvailable(candidate, type, input));
    if (day === undefined) return false;
    usedDays.add(day);
    placements.push({ type, dayOfWeek: day, need });
    return true;
  };

  // R-237 — every phase may OFFER one no-equipment mobility session on a spare
  // day. It is recovery, not a required training exposure. Off-season keeps the
  // previously signed aim of two total mobility sessions. Mobility goes first:
  // it can serve a non-gym spare day, while Accessories must never consume the
  // only gym slot and push this explicitly requested offer elsewhere.
  let mobility = mobilitySessionCount(input.workouts);
  const mobilityTarget = input.seasonPhase === 'Off-season'
    ? OFFSEASON_MOBILITY_TARGET
    : 1;
  while (mobility < mobilityTarget) {
    const need = mobility === 0 ? 'spare_day_mobility' : 'offseason_mobility';
    if (!take('mobility', need)) break;
    mobility += 1;
  }

  // N1 — accessory region coverage. At most ONE, and it does not aim to reach
  // six: one session is what fills the lack.
  //
  // THE THRESHOLD MOVES FOR A MOBILITY / INJURY-HISTORY WEAKNESS: below FOUR of the six
  // rather than below three, so the need fires more readily for the athlete who said
  // this is their weak point. Sam's ruling 3. Nothing else about N1 changes — still at
  // most one session, still optional.
  const leansTopUps = weakPointLeansOptionalTopUps(input.weakPointFocus ?? null);
  const accessoryThreshold = leansTopUps
    ? WEAK_POINT_ACCESSORY_REGION_THRESHOLD
    : ACCESSORY_REGION_THRESHOLD;
  if (accessoryRegionsCovered(input.workouts).size < accessoryThreshold) {
    take('accessories', 'accessory_coverage');
  }

  return placements;
}
