/**
 * THE SEVEN STRENGTH SESSIONS. One authored set, and the only one.
 *
 * Sam's charter ruling, 2026-07-30: the generator's strength vocabulary is
 * SEVEN variants, and the athlete's picker is THREE doors — Upper, Lower, Full
 * Body — which resolve to a concrete variant deterministically.
 *
 * WHY THIS FILE EXISTS AT ALL, given the app already builds all seven. It did,
 * and it knew them in two places that could not see each other:
 *
 *   - `canonicalStrengthLabel` (utils/sessionNaming.ts) mapped a pattern set to
 *     exactly these seven athlete-facing names. That function IS the naming
 *     owner, so the seven were already real and already shipping.
 *   - the coach revision registry offered FOUR of them
 *     (`strength_upper_push`, `strength_upper_pull`, `strength_lower`,
 *     `strength_full_body`), so the athlete could reach four.
 *
 * Neither knew about the other. The athlete's Lower Body door could only ever
 * hand back combined squat+hinge, and Lower Squat and Lower Hinge — sessions the
 * generator places every week and the naming owner has names for — were
 * unreachable through any door. Nothing was broken, and nothing could have told
 * anyone: two representations of one decision, which is the shape
 * `docs/NORTH_STAR.md` presumes wrong.
 *
 * So the set is authored HERE, once, and both consumers derive from it:
 * `canonicalStrengthLabel` looks its answer up, and the registry builds one
 * template per variant. A new variant becomes a compile error in the union and a
 * failing cell in `strengthSessionVariantTests` until both agree, and a variant
 * the generator can produce but no door can reach is a red cell rather than a
 * silence.
 *
 * THE DOORS ARE A PARTITION, not a filter. Every variant belongs to exactly one
 * of the three, and every door has at least one — asserted both ways — so
 * "Upper body" can never become a door that offers nothing, and no variant can
 * be orphaned by an edit that only looks like a rename.
 */

import type { StrengthArchetype } from '../rules/strengthPatternContributions';
import type { PlanChangeCategoryId } from '../utils/planChangeTypes';

/** The four movement patterns Section 18 counts. */
export type StrengthVariantPattern = 'squat' | 'hinge' | 'push' | 'pull';

export type StrengthSessionVariantId =
  | 'lower_squat'
  | 'lower_hinge'
  | 'lower_combined'
  | 'upper_push'
  | 'upper_pull'
  | 'upper_combined'
  | 'full_body';

/** The three doors. A strict partition of the seven. */
export type StrengthDoorId = Extract<
  PlanChangeCategoryId,
  'strength_upper' | 'strength_lower' | 'strength_full'
>;

export interface StrengthSessionVariant {
  readonly id: StrengthSessionVariantId;
  /**
   * The athlete-facing name. These are the strings `canonicalStrengthLabel`
   * already returned and the app has been shipping — carried over verbatim
   * rather than re-worded, because a rename here renames every session card in
   * the app and that is Sam's to sign, not a refactor's to smuggle.
   */
  readonly label: string;
  /** One line for the picker. Athlete-visible: goes to Sam for signing (stage 5). */
  readonly description: string;
  readonly archetype: StrengthArchetype;
  /** The pattern the session leads with. */
  readonly primaryPattern: StrengthVariantPattern;
  /** Every pattern the session plans to cover. */
  readonly plannedPatterns: readonly StrengthVariantPattern[];
  /** Which of the three athlete doors reaches it. */
  readonly door: StrengthDoorId;
  /** Registry template id. Stable — code refers to this, never to the label. */
  readonly templateId: string;
}

// BIBLE_ANCHOR: seven_strength_sessions
export const STRENGTH_SESSION_VARIANTS: readonly StrengthSessionVariant[] = [
  {
    id: 'lower_squat',
    label: 'Lower Squat',
    description: 'Squat-led legs - quads, glutes and knee-friendly volume.',
    archetype: 'lower',
    primaryPattern: 'squat',
    plannedPatterns: ['squat'],
    door: 'strength_lower',
    templateId: 'strength_lower_squat',
  },
  {
    id: 'lower_hinge',
    label: 'Lower Hinge',
    description: 'Hinge-led legs - hamstrings, glutes and posterior chain.',
    archetype: 'lower',
    primaryPattern: 'hinge',
    plannedPatterns: ['hinge'],
    door: 'strength_lower',
    templateId: 'strength_lower_hinge',
  },
  {
    id: 'lower_combined',
    label: 'Lower Body Strength',
    description: 'Squat and hinge strength - legs and glutes.',
    archetype: 'lower',
    primaryPattern: 'squat',
    plannedPatterns: ['squat', 'hinge'],
    door: 'strength_lower',
    // The pre-existing id. Renaming it would orphan every stored row already
    // stamped `template:strength_lower:*` on a phone.
    templateId: 'strength_lower',
  },
  {
    id: 'upper_push',
    label: 'Upper Push',
    description: 'Pressing strength - chest, shoulders and triceps.',
    archetype: 'upper',
    primaryPattern: 'push',
    plannedPatterns: ['push'],
    door: 'strength_upper',
    templateId: 'strength_upper_push',
  },
  {
    id: 'upper_pull',
    label: 'Upper Pull',
    description: 'Pulling strength - back and biceps.',
    archetype: 'upper',
    primaryPattern: 'pull',
    plannedPatterns: ['pull'],
    door: 'strength_upper',
    templateId: 'strength_upper_pull',
  },
  {
    id: 'upper_combined',
    label: 'Upper Body Strength',
    description: 'Push and pull together - the whole upper body in one session.',
    archetype: 'upper',
    primaryPattern: 'push',
    plannedPatterns: ['push', 'pull'],
    door: 'strength_upper',
    templateId: 'strength_upper_combined',
  },
  {
    id: 'full_body',
    label: 'Full Body Strength',
    description: 'Compound push, pull, squat and carry.',
    archetype: 'full_body',
    primaryPattern: 'squat',
    plannedPatterns: ['squat', 'push', 'pull'],
    door: 'strength_full',
    templateId: 'strength_full_body',
  },
];

export const STRENGTH_DOOR_IDS: readonly StrengthDoorId[] = [
  'strength_upper',
  'strength_lower',
  'strength_full',
];

/** The variants one door offers. Non-empty for all three, by charter rule. */
export function strengthVariantsForDoor(door: StrengthDoorId): readonly StrengthSessionVariant[] {
  return STRENGTH_SESSION_VARIANTS.filter((variant) => variant.door === door);
}

export function strengthVariantByTemplateId(templateId: string): StrengthSessionVariant | null {
  return STRENGTH_SESSION_VARIANTS.find((variant) => variant.templateId === templateId) ?? null;
}

/**
 * Which variant does this set of movement patterns describe?
 *
 * THE ONE ANSWER to "what is this session called". `canonicalStrengthLabel`
 * delegates here rather than restating the mapping, so the name on a card and
 * the name in the picker cannot drift — that drift is the reason this module
 * exists.
 *
 * Deliberately total over the pattern space and null outside it: a set with no
 * strength patterns is not a strength session, and saying so is different from
 * guessing a name for it.
 */
export function strengthVariantForPatterns(
  patterns: Iterable<string>,
): StrengthSessionVariant | null {
  const set = new Set(patterns);
  const hasSquat = set.has('squat');
  const hasHinge = set.has('hinge');
  const hasPush = set.has('push');
  const hasPull = set.has('pull');
  const hasLower = hasSquat || hasHinge;
  const hasUpper = hasPush || hasPull;

  const byId = (id: StrengthSessionVariantId): StrengthSessionVariant =>
    STRENGTH_SESSION_VARIANTS.find((variant) => variant.id === id)!;

  if (hasLower && hasUpper) return byId('full_body');
  if (hasLower) {
    if (hasSquat && hasHinge) return byId('lower_combined');
    return hasSquat ? byId('lower_squat') : byId('lower_hinge');
  }
  if (hasUpper) {
    if (hasPush && hasPull) return byId('upper_combined');
    return hasPush ? byId('upper_push') : byId('upper_pull');
  }
  return null;
}
