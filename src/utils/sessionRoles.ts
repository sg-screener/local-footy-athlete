import { POOL_REGISTRY, type ExerciseCategory } from '../data/exercisePools';
import { classifyPoolSlot } from '../data/exercisePoolsStrength';
import { getExerciseTags } from '../data/exerciseTags';
import { canonicalExerciseName } from './exerciseCanonicalisation';

/**
 * D13 session roles — INTERNAL data, never words the athlete reads.
 *
 * Spec: `docs/SESSION_TEMPLATE_SPEC_2026-07-25.md` §3.2. Exactly six, matching
 * D13's own list. There is deliberately no "secondary lift" role (§6 item 1):
 * a second anchor-role heavy pattern in the same session is still `main_lift`
 * and lets list position carry the "secondary" meaning.
 *
 * ## Why there is no role→label map here
 *
 * The first build rendered these as badge text on every row. Sam ruled that out
 * on 2026-07-27: the D2 ordering already tells the athlete what matters, so a
 * big "MAIN LIFT" label earns nothing. The role survives because it does real
 * work — it drives list ordering, mobility-flow selection, and the muscle-block
 * logic still to come — but it is not vocabulary, and there is no athlete-facing
 * string to keep in sync.
 *
 * These have never touched the internal counting fences either: power is still
 * not a finisher, midline still earns no conditioning credit. D13 is explicit
 * that this is "a render/composition ruling, not an accounting change", so
 * nothing here feeds `SessionComponentKind`.
 */
export type SessionRole =
  | 'power'
  | 'main_lift'
  | 'accessory'
  | 'midline'
  | 'prehab'
  | 'conditioning'
  /**
   * THE CLUB'S OWN SESSION, riding the day's row list (Sam, 2026-08-13):
   * *"team training should be looked at more like conditioning - it's not part
   * of the strength exercises - it's its own component of the day"*.
   *
   * It is a ROLE and not a name because `sessionRowCounting`'s header bans the
   * alternative in its own words — "FILTER BY ROLE BEFORE ANY NAME PROBE RUNS".
   * `isTeamTrainingItem` matches a name set and three regexes; that is the
   * ingress lift for rows authored before this role, not the fence.
   */
  | 'team_training'
  /**
   * PAIRED MOBILITY — the mobility half of a superset (Sam's pairing rules,
   * 2026-07-31, rule 5): *"Not logged for weight or performance — no load entry,
   * no progression tracking. Counts toward nothing (mobility law: never hard, no
   * load credit, never breaks rest)."*
   *
   * NOT `prehab`, and the difference is load-bearing: prehab rows COUNT. A paired
   * mobility row stamped `prehab` would have been counted against the per-session
   * exercise budget, which is precisely what rule 5 forbids.
   */
  | 'mobility';

/**
 * D2's session order applied to the flat list (§3.1):
 *   power → main → (secondary = a second main) → accessories → midline/prehab
 *   → conditioning finisher.
 */
export const SESSION_ROLE_ORDER: readonly SessionRole[] = [
  // The club's session anchors the day it is on — it is what the athlete turns
  // up to, and the gym work is arranged around it.
  'team_training',
  'power',
  'main_lift',
  'accessory',
  'midline',
  'prehab',
  'mobility',
  'conditioning',
];

export function sessionRoleRank(role: SessionRole | null): number {
  if (role === null) return SESSION_ROLE_ORDER.length; // team training sorts last
  const rank = SESSION_ROLE_ORDER.indexOf(role);
  return rank === -1 ? SESSION_ROLE_ORDER.length : rank;
}

/** `POOL_REGISTRY` groups under exercisePools.ts's own "PREHAB & ACCESSORIES" comment. */
const PREHAB_CATEGORIES: readonly ExerciseCategory[] = [
  'groin_adductors',
  'calves',
  'lower_prehab',
  'shoulder_health',
  'hamstring_light',
];

/** …and its "ARMS / PUMP" comment block. */
const PUMP_CATEGORIES: readonly ExerciseCategory[] = [
  'biceps',
  'triceps',
  'delts',
  'upper_back_pump',
];

function poolHas(category: ExerciseCategory, canonical: string): boolean {
  return (POOL_REGISTRY[category] ?? []).some((entry) => entry.name === canonical);
}

/**
 * Map an exercise name onto its list role.
 *
 * Order of tests is the ruling, not an accident — a name can legitimately sit
 * in more than one pool (`Band Pull-Apart` is in both `upper_back_pump` and
 * `shoulder_health`), so the first matching rule owns it and the outcome is
 * deterministic rather than iteration-order dependent. Joint-health membership
 * is the more specific claim, so Prehab outranks the pump pools.
 *
 * The name is canonicalised first: a generator spelling must classify the same
 * way as the curated one, exactly as `buildCueText` already does.
 */
export function classifyExerciseRole(rawName: string): SessionRole {
  const name = String(rawName ?? '').trim();
  if (!name) return 'accessory';
  const canonical = canonicalExerciseName(name);

  // Midline — the rule `isTrunkSupportRow` already used, plus explicit pool
  // membership so a trunk entry that isn't tagged `core` still badges Midline.
  if (poolHas('trunk_anti_rotation', canonical)) return 'midline';
  if (getExerciseTags(canonical)?.movement === 'core') return 'midline';

  if (PREHAB_CATEGORIES.some((category) => poolHas(category, canonical))) return 'prehab';
  if (PUMP_CATEGORIES.some((category) => poolHas(category, canonical))) return 'accessory';

  const slot = classifyPoolSlot(canonical);
  if (slot?.role === 'anchor') return 'main_lift';

  // Everything else — known accessories and names the pools have never heard
  // of alike. An unknown name is still real work on the athlete's screen, so it
  // gets the least-claiming badge rather than being dropped or thrown on.
  return 'accessory';
}

/**
 * ⚠ **THE SEAT DECIDES THE BADGE. THE POOL ARRAY ONLY GUESSES.** (Sam,
 * 2026-09-04: *"the screen is lying to you about main lifts"*.)
 *
 * `classifyExerciseRole` above answers from WHICH ARRAY a name sits in —
 * `STRENGTH_POOLS[slot].anchor` versus `.accessory`. That is a property of the
 * exercise, and the badge is a property of the SEAT IT FILLED. MEASURED over
 * the preserved 52-week driver: on **14 of 14** `lower_squat` days the athlete
 * saw no main lift at all, because the composer's chosen squat — `Leg Press`,
 * 406 selections out of 406 — lives on the accessory bench and was badged
 * `accessory` on the glass.
 *
 * **R-092 ALREADY SETTLED WHO OWNS THIS:** *"the composer DECIDES the role;
 * §18 reads this rather than re-inferring it from the exercise name."* Both row
 * producers have written `section18Evidence.role` all along —
 * `materialiseComposedWeek` for composed days, the retained `defaultProgram`
 * adapter for the rest. **Nothing new is authored here.** The screen stops
 * being a second authority and reads the decision that was already recorded.
 *
 * ⚠ **THE NAME CLASSIFIER IS NOT DELETED, AND THAT IS DELIBERATE.** Rows nobody
 * has authored — athlete additions, legacy stored weeks — carry no evidence,
 * and for them the pool lookup remains the honest answer. What it may no longer
 * do is OVERRULE a row whose role was decided: a declared supporting row whose
 * NAME happens to be an anchor (`Barbell Row` in a second pull seat) stops
 * wearing the main-lift badge.
 *
 * Held by `test:visible-surfaces` section [12], both directions.
 */
export function sessionRoleForRow(row: unknown, rawName: string): SessionRole {
  const declared = (row as { section18Evidence?: { role?: string } } | null | undefined)
    ?.section18Evidence?.role;
  if (declared === 'main_strength') return 'main_lift';
  const classified = classifyExerciseRole(rawName);
  if (declared === 'strength_accessory' && classified === 'main_lift') return 'accessory';
  return classified;
}
