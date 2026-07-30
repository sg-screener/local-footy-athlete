/**
 * THE NEED-BASED TOP-UP PASS.
 *
 * Sam's governing principle, 2026-07-30:
 *
 *   "No defaults. Build the program; if anything is lacking, add a spare optional
 *    session to make up for it. Strength and conditioning is the 90% —
 *    accessories, mobility etc. is the final 10%."
 *
 * It runs AFTER the core week is built, computes what the week LACKS, and places
 * at most what fills the lack. No day-based or default placement of optional work
 * exists anywhere — the six placement rows that did are deleted in the same
 * commit as this file (`docs/OPTIONAL_PLACEMENT_RULINGS_2026-07-30.md`).
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
  readonly need: 'accessory_coverage' | 'offseason_mobility';
}

export interface OptionalTopUpInput {
  readonly workouts: readonly Workout[];
  readonly seasonPhase: SeasonPhase | null | undefined;
  /** Day-of-week values the week may place on, already excluding fixtures. */
  readonly candidateDays: readonly number[];
  /** The game's day-of-week, or null. */
  readonly gameDayOfWeek: number | null;
}

/**
 * The signed caps, as one predicate.
 *
 * Never on a game day (`:90`, `:132`), never on G-1 — the authored Gunshow owns
 * that day (`:153`) — and never on a day the week already filled.
 */
function dayIsAvailable(day: number, input: OptionalTopUpInput): boolean {
  if (input.gameDayOfWeek !== null) {
    if (day === input.gameDayOfWeek) return false;
    const gMinusOne = (input.gameDayOfWeek + 6) % 7;
    if (day === gMinusOne) return false;
  }
  return !input.workouts.some((workout) => workout.dayOfWeek === day);
}

/**
 * Day preference: G-3 / Wednesday first, then any free day.
 *
 * `:152` names Wednesday — "4 days: as above plus optional accessories/prehab
 * Wednesday" — and the fixture-relative form of that is G-3. Both are tried,
 * G-relative first, because the Wednesday in the Bible IS the G-3 of a Saturday
 * game week.
 */
function preferredDays(input: OptionalTopUpInput): number[] {
  const preferred: number[] = [];
  if (input.gameDayOfWeek !== null) {
    preferred.push((input.gameDayOfWeek + 4) % 7);
  }
  preferred.push(3);
  const ordered = [
    ...preferred,
    ...[...input.candidateDays].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)),
  ];
  const seen = new Set<number>();
  return ordered.filter((day) => {
    if (seen.has(day)) return false;
    seen.add(day);
    return input.candidateDays.includes(day);
  });
}

/**
 * WHAT THE WEEK LACKS, AND AT MOST WHAT FILLS IT.
 *
 * Two needs, because two are what the Bible answers. Nothing measures recovery
 * (no authored composition), nothing measures in-season mobility (`:104` — the
 * off-season is when mobility gains are safe to chase), and nothing measures
 * strength or conditioning, which are the 90% and belong to the contract.
 *
 * SAM'S RULING 3: a week may take BOTH an Accessories and a Mobility top-up.
 * SAM'S RULING 4: mobility tops up TOWARD TWO, not one — "just want to get the
 * athlete feeling good again" — still shrinking when the days will not take it.
 */
export function computeOptionalTopUps(
  input: OptionalTopUpInput,
): OptionalTopUpPlacement[] {
  const placements: OptionalTopUpPlacement[] = [];
  const usedDays = new Set<number>();
  const available = preferredDays(input).filter((day) => dayIsAvailable(day, input));

  const take = (type: OptionalTopUpType, need: OptionalTopUpPlacement['need']): boolean => {
    const day = available.find((candidate) => !usedDays.has(candidate));
    if (day === undefined) return false;
    usedDays.add(day);
    placements.push({ type, dayOfWeek: day, need });
    return true;
  };

  // N1 — accessory region coverage. At most ONE, and it does not aim to reach
  // six: one session is what fills the lack.
  if (accessoryRegionsCovered(input.workouts).size < ACCESSORY_REGION_THRESHOLD) {
    take('accessories', 'accessory_coverage');
  }

  // N2 — off-season mobility. `:104` is why there is no in-season equivalent:
  // chasing mobility while games and change-of-direction demands are live risks
  // injury, so the app does not plan it then.
  if (input.seasonPhase === 'Off-season') {
    let mobility = mobilitySessionCount(input.workouts);
    while (mobility < OFFSEASON_MOBILITY_TARGET) {
      if (!take('mobility', 'offseason_mobility')) break;
      mobility += 1;
    }
  }

  return placements;
}
