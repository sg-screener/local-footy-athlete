/**
 * The shared football-robustness vocabulary.
 *
 * Normal hamstring and calf coverage is derived from authored pool membership.
 * Hinge alternatives have a separate equipment-only predicate.  Display names never decide policy.  The weekly
 * composer consumes this answer both when it chooses a missing exposure and
 * when it removes a robustness row made redundant by another final row.
 */
import { POOL_REGISTRY } from '../data/exercisePools';
import { STRENGTH_POOLS } from '../data/exercisePoolsStrength';
import { getExerciseTags } from '../data/exerciseTags';
import { canonicalExerciseName } from '../utils/exerciseCanonicalisation';
import { exerciseVariationFamily, sameExerciseVariationFamily } from './exerciseVariationFamily';

export type FootballRobustnessCategory =
  | 'hamstring_eccentric_or_isometric'
  | 'adductor_or_groin'
  | 'calf_or_soleus'
  | 'knee_capacity_or_unilateral_leg';

export const FOOTBALL_ROBUSTNESS_CATEGORIES: readonly FootballRobustnessCategory[] = [
  'hamstring_eccentric_or_isometric',
  'adductor_or_groin',
  'calf_or_soleus',
  'knee_capacity_or_unilateral_leg',
];

const canonicalSet = (names: readonly string[]): ReadonlySet<string> =>
  new Set(names.map(canonicalExerciseName));

const HAMSTRING_ACCESSORIES = canonicalSet([
  ...POOL_REGISTRY.hamstring_light.filter((entry) => entry.name === 'Swiss Ball Hamstring Curl').map((entry) => entry.name),
  ...STRENGTH_POOLS.isolation_lower.accessory.entries
    .filter((entry) => entry.group === 'hamstring')
    .map((entry) => entry.name),
]);
const GROIN_ACCESSORIES = canonicalSet(
  POOL_REGISTRY.groin_adductors.map((entry) => entry.name),
);
const CALF_ACCESSORIES = canonicalSet([
  ...POOL_REGISTRY.calves.map((entry) => entry.name),
  ...STRENGTH_POOLS.isolation_lower.accessory.entries
    .filter((entry) => entry.group === 'calf' && !sameExerciseVariationFamily(entry.name, 'Tib Raises'))
    .map((entry) => entry.name),
]);
const KNEE_CAPACITY_ACCESSORIES = canonicalSet(
  POOL_REGISTRY.lower_prehab.map((entry) => entry.name),
);

/** Categories a final delivered exercise genuinely supplies. */
export function footballRobustnessCategoriesForExercise(
  rawName: string,
): readonly FootballRobustnessCategory[] {
  const name = canonicalExerciseName(rawName);
  const out: FootballRobustnessCategory[] = [];
  const tags = getExerciseTags(name);

  if (HAMSTRING_ACCESSORIES.has(name)) {
    out.push('hamstring_eccentric_or_isometric');
  }
  if (GROIN_ACCESSORIES.has(name)) out.push('adductor_or_groin');
  if (CALF_ACCESSORIES.has(name)) out.push('calf_or_soleus');
  if (KNEE_CAPACITY_ACCESSORIES.has(name)
    || (tags?.unilateral === true && (tags.movement === 'squat' || tags.movement === 'lunge'))) {
    out.push('knee_capacity_or_unilateral_leg');
  }
  return [...new Set(out)];
}

/**
 * The short accessory bench allowed to fill a required robustness seat.
 * Unilateral strength lifts can satisfy knee capacity, but they are not
 * candidates for these short accessory seats.
 */
export function isFootballRobustnessAccessory(rawName: string): boolean {
  const name = canonicalExerciseName(rawName);
  return HAMSTRING_ACCESSORIES.has(name)
    || POOL_REGISTRY.hamstring_light.some(entry => canonicalExerciseName(entry.name) === name)
    || GROIN_ACCESSORIES.has(name)
    || CALF_ACCESSORIES.has(name)
    || KNEE_CAPACITY_ACCESSORIES.has(name);
}

/**
 * An adductor ISOMETRIC (Sam, 2026-09-09: "one adductor isometric per session"):
 * a groin/adductor pool entry authored as a hold. Cossack Squats and Lateral
 * Lunges are adductor work too, but they are dynamic and may sit beside a hold.
 */
export function isAdductorIsometric(rawName: string): boolean {
  return exerciseVariationFamily(rawName) === 'adductor_isometric';
}

/** A hip-dominant alternative is credited only when no Nordic/curl is available. */
export function suppliesAlternativeHamstringWork(name: string): boolean {
  return HAMSTRING_ACCESSORIES.has(canonicalExerciseName(name))
    || sameExerciseVariationFamily(name, 'RDLs')
    || POOL_REGISTRY.hamstring_light.some(entry => canonicalExerciseName(entry.name) === canonicalExerciseName(name))
    || canonicalExerciseName(name) === 'Bosch Hold';
}

export function weeklyLegStrengthCandidates(category: 'calf_or_soleus' | 'hamstring_eccentric_or_isometric'): readonly string[] {
  return [...(category === 'calf_or_soleus' ? CALF_ACCESSORIES : HAMSTRING_ACCESSORIES)];
}

export function missingFootballRobustnessCategories(
  exerciseNames: readonly string[],
): readonly FootballRobustnessCategory[] {
  const supplied = new Set(exerciseNames.flatMap(footballRobustnessCategoriesForExercise));
  return FOOTBALL_ROBUSTNESS_CATEGORIES.filter((category) => !supplied.has(category));
}
