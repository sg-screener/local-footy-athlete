/**
 * MOBILITY PAIRING — Sam's authored design, built at last.
 *
 * `docs/MOBILITY_PAIRING_RULINGS_2026-07-31.md`, seven Sam-ruled rules, signed
 * 2026-07-31 and unbuilt for thirteen days. **Sam, 2026-08-13:** *"I ALSO SAID
 * THINGS LIKE ACCESSORY LIFTS SHOULD BE PAIRED WITH MOBILITY - WE SPENT FUCKING
 * DAYS ON THIS - WHY IS IT NOT IN THE APP YET"*.
 *
 * ## Why he wants it, in his words
 *
 * *"most footballers aren't going to do it if it's an entire session or just an
 * optional warm-up — you need to get it in throughout the week."* Pairing is the
 * everyday drip; the standalone Mobility session is the off-season volume, and
 * rule 7 leaves it alone.
 *
 * ## THE NON-COMPETE RULE IS HIS EXAMPLES, NOT A NEW TABLE
 *
 * Rule 3 says the mobility pick must target a region that is neither the
 * accessory's nor any of the day's main-lift regions. Comparing those looks like
 * it needs a 19-value muscle-to-region crosswalk, and a previous pass wrote one
 * and stopped to have it signed. **It was not needed.** Sam, 2026-08-13: *"upper
 * body lift paired with lower body mobility"* — and rule 3's own SIGNED EXAMPLES
 * already say it:
 *
 *   - split squats (LOWER lift) + QL extension (MIDLINE mobility)
 *   - single-arm bench (UPPER lift) + butterfly (HIPS mobility)
 *
 * **So non-compete operates at the SIDE.** `lower` and `hips` are the lower side,
 * `upper` is the upper side, and `midline` is NEUTRAL — his first example pairs a
 * lower lift with midline, so midline never competes with anything. That mapping
 * is DEMONSTRATED by his examples rather than invented, which is why this module
 * authors no crosswalk of its own.
 *
 * ## What counts, and what does not
 *
 * Rule 5: the pick carries the pool entry's OWN authored warm-up dose, is not
 * logged for load or performance, and **counts toward nothing**. It is therefore
 * stamped with the `mobility` prehab role so `sessionRowCounting` keeps it out of
 * the exercise budget — the fence, not a name probe.
 */

import type { Workout, WorkoutExercise } from '../types/domain';
import { getExerciseTags } from '../data/exerciseTags';
import { classifyGeneratedWorkoutRow } from './generatedWorkoutRowClassification';
import { mobilityPool, mobilityRegionOf, type MobilityRegion } from './mobilitySessionComposition';

/** His two ruled bounds: 2-3 accessories are paired, never more, never fewer. */
export const MOBILITY_PAIRS_MIN = 2;
export const MOBILITY_PAIRS_MAX = 3;

type BodySide = 'upper' | 'lower';

/**
 * Which side a signed mobility region trains, for the non-compete test.
 *
 * DERIVED FROM SAM'S TWO SIGNED EXAMPLES, not authored here. `midline` is
 * deliberately `null` — neutral — because his split-squats + QL-extension pair
 * puts a midline movement against a lower lift.
 */
const SIDE_OF_MOBILITY_REGION: Readonly<Record<MobilityRegion, BodySide | null>> = {
  lower: 'lower',
  hips: 'lower',
  upper: 'upper',
  midline: null,
};

/** The side a lift trains, read from the same tags every other reader uses. */
function sideOfExercise(name: string): BodySide | null {
  const region = getExerciseTags(name)?.region;
  return region === 'upper' || region === 'lower' ? region : null;
}

function rowName(row: WorkoutExercise): string {
  return row.exercise?.name ?? '';
}

function kindOf(row: WorkoutExercise, index: number): string {
  return classifyGeneratedWorkoutRow({
    name: rowName(row),
    sets: row.prescribedSets,
    repsMax: row.prescribedRepsMax,
    index,
  }).kind;
}

/**
 * The rows that may be paired — rule 1 and rule 2 together.
 *
 * ACCESSORIES ONLY, AND MAIN LIFTS NEVER. Rule 2 is not a preference: *"Heavy-
 * lift rest is recovery; the first one or two lifts of the session are left
 * alone."* Identity is ASKED of the row classifier the generator already uses,
 * because the generator authors no roles — a census found 563 rows with no role
 * at all — so a role check here would silently pair nothing.
 */
export function pairableAccessories(workout: Workout): WorkoutExercise[] {
  const rows = workout.exercises ?? [];
  return rows.filter((row, index) => kindOf(row, index) === 'strength_accessory');
}

/** Every side the day already trains — the "whole session" half of rule 3. */
function sidesTrainedBy(workout: Workout): Set<BodySide> {
  const sides = new Set<BodySide>();
  for (const [index, row] of (workout.exercises ?? []).entries()) {
    const kind = kindOf(row, index);
    if (kind !== 'strength_main' && kind !== 'strength_accessory') continue;
    const side = sideOfExercise(rowName(row));
    if (side) sides.add(side);
  }
  return sides;
}

export interface MobilityPick {
  readonly accessory: string;
  readonly mobility: string;
  readonly region: MobilityRegion;
  readonly group: string;
}

/**
 * Choose the mobility movement to pair with one accessory.
 *
 * PREFERENCE ORDER, straight from rules 3 and 6: a region the WHOLE SESSION does
 * not touch first, then merely non-competing with this accessory; equipment-light
 * before equipment-heavy, because *"supersets must be practical in a crowded
 * gym"*; and never the same movement twice in one session.
 */
export function pickMobilityFor(
  accessoryName: string,
  sessionSides: ReadonlySet<BodySide>,
  alreadyPicked: ReadonlySet<string>,
): { name: string; region: MobilityRegion } | null {
  const accessorySide = sideOfExercise(accessoryName);
  const candidates = mobilityPool()
    .map((entry) => ({ entry, region: mobilityRegionOf(entry) }))
    .filter((candidate): candidate is { entry: typeof candidate.entry; region: MobilityRegion } =>
      candidate.region !== null)
    .filter((candidate) => !alreadyPicked.has(candidate.entry.name))
    // RULE 3, the hard half: never the accessory's own side.
    .filter((candidate) => {
      const side = SIDE_OF_MOBILITY_REGION[candidate.region];
      return side === null || side !== accessorySide;
    });
  if (candidates.length === 0) return null;

  const untouched = candidates.filter((candidate) => {
    const side = SIDE_OF_MOBILITY_REGION[candidate.region];
    return side === null || !sessionSides.has(side);
  });
  const pool = untouched.length > 0 ? untouched : candidates;
  const light = pool.filter((candidate) => (candidate.entry.equipment ?? []).length === 0);
  const chosen = (light.length > 0 ? light : pool)[0]!;
  return { name: chosen.entry.name, region: chosen.region };
}

/**
 * Pair 2-3 accessories with mobility, as supersets, by default.
 *
 * Returns the workout unchanged when the day cannot support his design — fewer
 * than two pairable accessories, or no legal pick — because *"shrink, never
 * pad"* is his standing rule and a one-pair session is not what he ruled.
 */
export function pairMobilityWithAccessories(workout: Workout): Workout {
  const accessories = pairableAccessories(workout);
  if (accessories.length < MOBILITY_PAIRS_MIN) return workout;

  const sessionSides = sidesTrainedBy(workout);
  const picked = new Set<string>();
  const picks: MobilityPick[] = [];
  for (const accessory of accessories.slice(0, MOBILITY_PAIRS_MAX)) {
    const pick = pickMobilityFor(rowName(accessory), sessionSides, picked);
    if (!pick) continue;
    picked.add(pick.name);
    picks.push({
      accessory: rowName(accessory),
      mobility: pick.name,
      region: pick.region,
      group: `mob-${picks.length + 1}`,
    });
  }
  if (picks.length < MOBILITY_PAIRS_MIN) return workout;

  const byAccessory = new Map(picks.map((pick) => [pick.accessory, pick]));
  const out: WorkoutExercise[] = [];
  for (const row of workout.exercises ?? []) {
    const pick = byAccessory.get(rowName(row));
    if (!pick) { out.push(row); continue; }
    out.push({ ...row, supersetGroup: pick.group, supersetOrder: 1, pairType: 'superset' });
    out.push(mobilityRowFor(pick, workout.id, out.length));
  }
  return { ...workout, exercises: out };
}

/**
 * The mobility half of a pair, at its OWN authored dose (rule 5).
 *
 * `role: 'prehab'` is what keeps it out of every count — rule 5 says it *"counts
 * toward nothing"*, and `sessionRowCounting` enforces that by ROLE rather than by
 * reading the name.
 */
function mobilityRowFor(pick: MobilityPick, workoutId: string, order: number): WorkoutExercise {
  const entry = mobilityPool().find((candidate) => candidate.name === pick.mobility)!;
  return {
    id: `we-${workoutId}-${pick.group}-mobility`,
    workoutId,
    exerciseId: entry.id,
    exerciseOrder: order,
    prescribedSets: entry.sets,
    prescribedRepsMin: entry.repsMin,
    prescribedRepsMax: entry.repsMax,
    restSeconds: entry.restSeconds,
    notes: entry.notes,
    role: 'prehab',
    supersetGroup: pick.group,
    supersetOrder: 2,
    pairType: 'superset',
    exercise: { id: entry.id, name: entry.name },
  } as unknown as WorkoutExercise;
}
