/**
 * THE INJURY FALLBACK LADDER — DERIVED, NOT TABULATED.
 *
 * ## WHAT THIS REPLACES, AND WHY
 *
 * `injurySessionClassifier.REPLACEMENT_BY_BUCKET` answered "what can this
 * athlete do instead" from a hand-authored map of ~40 EXERCISE NAMES across 9 of
 * Sam's 13 regions. Every row it did not name fell straight through to
 * `GENERIC_SAFE_BY_BUCKET` — `Bench Press`/`Goblet Squat`/`Easy Bike` — which is
 * the ladder's THIRD tier. So for almost every row in the app, **rungs 1 and 2
 * were not tried, they were unreachable.**
 *
 * MEASURED on `main` `9f081efa` (`npm run census:injury-fallback`, controls
 * printed): across 86 pooled strength exercises x 13 regions x 4 authored
 * severity bands, **1569 occurrences needed a fallback and 6 kept the movement
 * pattern.** In **38 of the 52 (region x band) athlete worlds, not one unsafe
 * row kept its pattern.** Through the real door
 * (`npm run probe:injury-recompose`) that reads as a 4/10 shoulder turning
 * `Bench Press, Barbell Row, DB Shoulder Press, Lat Pulldown, Band Pull-Apart`
 * into **`Goblet Squat, Easy Bike`**.
 *
 * ## THE ORDER IS R-103's, AND IT IS SAM'S BIBLE §8 ORDER
 *
 * `docs/LFA_PROGRAMMING_BIBLE.md:1878` — *"Exercise swap hierarchy. When an
 * exercise hurts or is not tolerated, the app should use this order: Same
 * movement pattern if possible (barbell bench press -> DB floor press). Same or
 * similar muscle group if the movement pattern is not tolerated (pull-ups hurt
 * -> chest-supported row or pulldown). Unaffected body area if the area needs a
 * break. Recovery / easy conditioning. Pause affected training."*
 *
 * R-103 states the same ladder for a constrained MAIN LIFT and adds the rule
 * this module is built on: **"Typed pattern/plane/role/equipment metadata, never
 * name regexes."** Everything below is derived from metadata that already
 * exists and that Sam authored:
 *
 *   - `EXERCISE_TAGS[name].movement`  — the pattern, and for push/pull the PLANE
 *   - `patternToSlot(movement)`       — the pool slot (pattern family)
 *   - `STRENGTH_POOLS[slot][role]`    — anchor vs accessory, and `loadRatio`
 *   - `EXERCISE_TAGS[name].injury[region]` — Sam's ruled injury matrix
 *                                            (2026-07-28), which this file
 *                                            READS and never edits
 *
 * **THE PLANE OBSTACLE R-103 RECORDED IS ANSWERED HERE.** R-103 noted that
 * `push` and `pull` are `MainStrengthPattern` values that carry no plane, so a
 * `ComposedGap`'s `SessionSlot` could not be derived from them. This ladder does
 * not go through `MainStrengthPattern` at all — it goes through `MovementPattern`,
 * which HAS the plane (`horizontal_push` / `vertical_push` / `horizontal_pull` /
 * `vertical_pull`). No mapping is invented and no ruling is pre-empted.
 *
 * ## THE RUNGS
 *
 * | rung | what it is | keeps the pattern? |
 * | --- | --- | --- |
 * | 1 `same_movement_safer_variation` | same movement AND same pool role — another main lift in the same plane | yes |
 * | 2 `nearest_safe_secondary_compound` | same movement, secondary role; or the same slot's other movement (squat <-> lunge) | yes |
 * | 3 `accessory_or_isometric` | authored isolation/trunk work for the same muscles | NO — partial |
 * | 4 `safe_adjacent_pattern` | the authored adjacent plane/pattern | NO — partial |
 * | — | nothing legal | the caller omits, honestly and by name |
 *
 * **INJURY LEGALITY OUTRANKS THE LADDER (R-103, verbatim).** This module NEVER
 * decides what is safe. The caller passes `isLegal`, which in production is
 * `assessTapSwapCandidateSafety` — the single safety owner for equipment,
 * readiness and injury alike. A rung is a list of CANDIDATES; legality removes
 * from it. That is why "another hinge" is not assumed safe because it is a hinge.
 *
 * **PARTIAL COVERAGE IS DISCLOSED, NOT IMPLIED (R-103).** Rungs 3 and 4 carry
 * `coversOriginalPattern: false` and an explanation that says what is no longer
 * being trained. A ladder that quietly drops a pattern has not fallen back.
 *
 * WRITER: none, pure. READERS: `utils/injurySessionClassifier`
 * (`getReplacementChoicesForBucket`, which every injury path already goes
 * through). TEST: `src/__tests__/injuryFallbackLadderTests.ts`.
 */

import {
  CONDITIONING_META,
  EXERCISE_TAGS,
  getExerciseTags,
  type ExerciseTag,
  type InjuryKey,
  type MovementPattern,
} from '../data/exerciseTags';
import {
  STRENGTH_POOLS,
  patternToSlot,
  type PoolRole,
  type PoolSlotKey,
} from '../data/exercisePoolsStrength';
import { resolveExerciseName } from '../utils/loadEstimation';
import type { SafeTrainingFallbackTier } from './conflictResolutionHierarchy';

/* ── THE RUNGS, AND THE TIER EACH ONE PROJECTS ONTO ───────────────────────── */

/**
 * ⚠ **THE TIER IS A PROJECTION OF THE RUNG, NEVER A SECOND OPINION.**
 *
 * `SAFE_TRAINING_FALLBACK_TIERS` is the signed ordering every existing surface
 * already groups by (`groupTapSwapChoices` turns it into Sam's three labelled
 * groups). This ladder is FINER — it splits Sam's "same movement pattern" into
 * the main-lift variation and the secondary compound, because the mission
 * distinguishes them — so the rung is the ordering and the tier is derived from
 * it. Two independent orderings over one question is the defect class this repo
 * fights; there is one here, and the coarser name is computed from it.
 */
export const INJURY_FALLBACK_RUNGS = [
  { id: 'same_movement_safer_variation', rank: 1, tier: 'same_movement_pattern', coversOriginalPattern: true },
  { id: 'nearest_safe_secondary_compound', rank: 2, tier: 'same_movement_pattern', coversOriginalPattern: true },
  { id: 'accessory_or_isometric', rank: 3, tier: 'similar_muscle_group', coversOriginalPattern: false },
  { id: 'safe_adjacent_pattern', rank: 4, tier: 'similar_muscle_group', coversOriginalPattern: false },
  /**
   * RUNG 5 — SAM'S THIRD BIBLE TIER, KEPT AND MADE LAST INSTEAD OF FIRST.
   *
   * `docs/LFA_PROGRAMMING_BIBLE.md:1883` — *"Unaffected body area if the area
   * needs a break. Example: shoulder issue -> lower body, bike, midline."*
   *
   * **THIS IS THE RUNG THE OLD TABLE REACHED IMMEDIATELY, AND THAT WAS THE
   * WHOLE DEFECT — not the rung itself.** It is genuinely needed from the 6-7
   * band up: Sam's ruled injury matrix is block-shaped by region x movement
   * family (measured: for every lower-limb region, 0 of 9 squats, 0 of 7 lunges
   * and 0 of 8 hinges are rated `good`), so once a band removes `caution` work
   * there is nothing left inside the affected family and rungs 1-4 are
   * legitimately empty. Deleting this rung would empty the session instead.
   */
  { id: 'unaffected_body_area', rank: 5, tier: 'unaffected_body_area', coversOriginalPattern: false },
  /**
   * RUNG 6 — SAM'S FOURTH BIBLE TIER: *"Recovery / easy conditioning if strength
   * work is not appropriate"* (:1885).
   *
   * It is the LAST training answer before an honest omission, and it is here
   * rather than left to the tap surface's own `recoveryChoice` because the
   * GENERATION callers (`programAdjustmentEngine`, `injuryAdjustmentEngine`) ask
   * this module directly and had it from the deleted table — dropping it would
   * turn *"Sprint Intervals -> Easy Bike"*, which Sam names for hamstring, calf,
   * ankle and groin alike, into a removal.
   */
  { id: 'recovery_easy_conditioning', rank: 6, tier: 'recovery_easy_conditioning', coversOriginalPattern: false },
] as const satisfies readonly {
  id: string; rank: number; tier: SafeTrainingFallbackTier; coversOriginalPattern: boolean;
}[];

export type InjuryFallbackRungId = (typeof INJURY_FALLBACK_RUNGS)[number]['id'];

const RUNG_BY_ID = new Map<InjuryFallbackRungId, (typeof INJURY_FALLBACK_RUNGS)[number]>(
  INJURY_FALLBACK_RUNGS.map((rung) => [rung.id, rung]),
);

export function injuryFallbackRungRank(id: InjuryFallbackRungId): number {
  return RUNG_BY_ID.get(id)!.rank;
}

export function tierForInjuryFallbackRung(id: InjuryFallbackRungId): SafeTrainingFallbackTier {
  return RUNG_BY_ID.get(id)!.tier;
}

/* ── THE TWO AUTHORED MAPS, EACH LINE TRACEABLE TO SAM'S BIBLE ────────────── */

/**
 * RUNG 4 — WHICH PATTERN IS "EXPLICITLY SAFE ADJACENT", AND ONLY THESE.
 *
 * Every entry is a swap Sam's Bible names in its own "Good swaps" lists. It is
 * authored precisely because the mission says *explicitly* safe: an adjacency
 * nobody wrote down is an inference, and an inference about injury is the thing
 * R-103 forbids. Legality is still checked afterwards — being adjacent is not
 * being safe.
 *
 *   vertical_pull <-> horizontal_pull  §8 hierarchy: "pull-ups hurt -> chest-
 *                                      supported row or pulldown"; shoulder
 *                                      good swap "Pull-ups hurt -> rows or
 *                                      pulldowns"
 *   vertical_push <-> horizontal_push  shoulder good swaps "Overhead press ->
 *                                      landmine press", "Dips -> push-ups"
 *   squat        <-> hinge             hamstring "Deadlift -> box squat or
 *                                      controlled squat if tolerated";
 *                                      lowerBack "Deadlift/RDL -> hip thrust,
 *                                      split squat"; knee "Heavy knee-dominant
 *                                      work -> hip thrust"
 *   plyo          -> squat, hinge      knee "Jump/plyo -> controlled strength"
 *
 * **`carry` HAS NO ADJACENT PATTERN AND THAT IS A RULED ABSENCE, NOT A GAP.**
 * The Bible's only carry swap is lowerBack's *"Heavy carry -> Pallof press or
 * dead bug"*, which is trunk work — that is rung 3 below, not an adjacent
 * pattern. Inventing `carry -> squat` because both are loaded would be exactly
 * the assumption R-103 names.
 */
const ADJACENT_SLOTS: Readonly<Partial<Record<PoolSlotKey, readonly PoolSlotKey[]>>> = {
  vertical_pull: ['horizontal_pull'],
  horizontal_pull: ['vertical_pull'],
  vertical_push: ['horizontal_push'],
  horizontal_push: ['vertical_push'],
  squat: ['hinge'],
  hinge: ['squat'],
  plyo: ['squat', 'hinge'],
};

/**
 * RUNG 3 — WHICH ISOLATION/TRUNK GROUPS TRAIN "THE SAME MUSCLES OR ACTION".
 *
 * R-103: *"legal accessory targeting the same muscles/action"*. The groups are
 * the ones `STRENGTH_POOLS` already authors on its isolation entries
 * (`PoolEntry.group`), so this map names existing vocabulary rather than
 * inventing a muscle model.
 *
 * `TRUNK` is the `core` movement tag rather than a pool group — the Bible sends
 * a heavy carry to *"Pallof press or dead bug"*, and those are `core`.
 */
const TRUNK = 'core' as const;

const ACCESSORY_GROUPS_FOR_SLOT: Readonly<Partial<Record<PoolSlotKey, readonly string[]>>> = {
  squat: ['quad', 'glute'],
  hinge: ['hamstring', 'glute'],
  horizontal_push: ['tricep'],
  vertical_push: ['shoulder', 'tricep'],
  horizontal_pull: ['bicep', 'shoulder'],
  vertical_pull: ['bicep', 'shoulder'],
  plyo: ['calf', 'quad'],
  carry: [TRUNK],
  isolation_upper: ['bicep', 'tricep', 'shoulder'],
  isolation_lower: ['hamstring', 'quad', 'calf', 'glute'],
};

/* ── LOOKUPS OVER THE AUTHORED POOLS ──────────────────────────────────────── */

interface PoolFacts {
  slot: PoolSlotKey;
  role: PoolRole;
  loadRatio: number;
  group: string | null;
}

const POOL_FACTS: ReadonlyMap<string, PoolFacts> = (() => {
  const map = new Map<string, PoolFacts>();
  for (const slot of Object.keys(STRENGTH_POOLS) as PoolSlotKey[]) {
    for (const role of ['anchor', 'accessory'] as const) {
      for (const entry of STRENGTH_POOLS[slot][role].entries) {
        map.set(entry.name.toLowerCase(), {
          slot, role, loadRatio: entry.loadRatio, group: entry.group ?? null,
        });
      }
    }
  }
  return map;
})();

/**
 * A candidate the ladder can reason about: it must carry Sam's injury ratings,
 * because a row with no ratings cannot be shown to be safe for anything.
 *
 * ⚠ **AN UNTAGGED NAME IS NOT SILENTLY ADMITTED.** `assessTapSwapCandidateSafety`
 * already refuses an untagged replacement while an injury is active; building
 * the ladder over `EXERCISE_TAGS` means the ladder never even proposes one, so
 * the two owners cannot disagree about a name.
 */
interface Candidate {
  name: string;
  tags: ExerciseTag;
  pool: PoolFacts | null;
}

function candidateFor(name: string): Candidate | null {
  const canonical = resolveExerciseName(name);
  const tags = getExerciseTags(canonical);
  if (!tags) return null;
  return { name: canonical, tags, pool: POOL_FACTS.get(canonical.toLowerCase()) ?? null };
}

/**
 * ⚠ **DEDUPED BY CANONICAL NAME, BECAUSE `EXERCISE_TAGS` HAS ALIASES IN IT.**
 * `Single-Arm Pulldown` and `Single-Arm Lat Pulldown` are two keys that
 * `resolveExerciseName` collapses to one exercise. MEASURED before the fix: a
 * 4/10 shoulder was offered `Single-Arm Lat Pulldown` TWICE in a three-option
 * menu — which is the ladder telling the athlete it has fewer answers than it
 * does, and would let one session receive the same row twice.
 */
const ALL_CANDIDATES: readonly Candidate[] = (() => {
  const byCanonical = new Map<string, Candidate>();
  for (const name of Object.keys(EXERCISE_TAGS)) {
    const candidate = candidateFor(name);
    if (candidate && !byCanonical.has(candidate.name.toLowerCase())) {
      byCanonical.set(candidate.name.toLowerCase(), candidate);
    }
  }
  return [...byCanonical.values()];
})();

/**
 * The role a candidate plays when the pools do not name it. Isolation and trunk
 * work is accessory by its own movement; anything else the pools do not carry is
 * treated as a secondary, never as a main lift — the conservative direction,
 * because promoting an unknown row to rung 1 would put it in front of an
 * authored main lift.
 */
function roleOf(candidate: Candidate): PoolRole {
  if (candidate.pool) return candidate.pool.role;
  return 'accessory';
}

const LOAD_RANK: Record<ExerciseTag['load'], number> = { low: 0, moderate: 1, high: 2 };
const FATIGUE_RANK: Record<ExerciseTag['fatigue'], number> = { low: 0, moderate: 1, high: 2 };

/**
 * ⚠ **AN INJURY REPLACEMENT IS NEVER HEAVIER THAN WHAT IT REPLACES.**
 *
 * This is Sam's 4-5 band instruction read literally — *"Reduce load, volume,
 * range, speed or intensity slightly"* (Bible :1898) — and it is the difference
 * between a fallback and a swap.
 *
 * **IT WAS MEASURED, NOT ANTICIPATED.** Without it the ladder answered
 * `RDLs / hamstring 4` with **`Deadlift`**: same movement, same role, both rated
 * `caution`, and a heavier hinge through the exact tissue the athlete just said
 * hurts. Sam's hamstring list names *"Heavy hinges"* and *"RDLs/deadlifts"* under
 * **Avoid / reduce**, and his own bad-swap example is *"Hamstring pain from RDL
 * -> lighter RDL"* — the ladder had found the worse version of that.
 *
 * ⚠ **THE MEASURE IS THE `load` TAG, AND `loadRatio` IS DELIBERATELY NOT USED.**
 * The first cut also refused any candidate with a higher `loadRatio`, and that
 * clause DELETED SAM'S OWN AUTHORED GOOD SWAP: `Hip Thrusts` carries
 * `loadRatio: 1.1` against `Deadlift`'s `1.00` — a true statement about the
 * weight on the bar and a false one about the stress on a sore back — so
 * *"Deadlift/RDL -> hip thrust"* (Bible :2237) became unreachable. `loadRatio`
 * is documented in `exercisePoolsStrength` as a PROGRESSION-TRANSFER heuristic
 * for seeding a rotated lift's weight; reading it as a safety measure is the
 * two-representations-of-one-fact trap this repo fights. The `load` tag is the
 * authored answer to "how heavy is this", and it separates `Deadlift` (`high`)
 * from `RDLs` and `Hip Thrusts` (`moderate`) exactly as needed.
 */
function notHeavierThanOriginal(original: Candidate, candidate: Candidate): boolean {
  return LOAD_RANK[candidate.tags.load] <= LOAD_RANK[original.tags.load];
}

/* ── THE LADDER ───────────────────────────────────────────────────────────── */

export interface InjuryFallbackOption {
  /** Canonical exercise name. */
  name: string;
  rung: InjuryFallbackRungId;
  tier: SafeTrainingFallbackTier;
  /** Rungs 1-2 keep the athlete in the same movement family; 3-4 do not. */
  coversOriginalPattern: boolean;
  /** Plain words for the athlete. No jargon, no exercise-science vocabulary. */
  explanation: string;
}

export interface InjuryFallbackRequest {
  /** The row that is unsafe, in whatever name the session carries it under. */
  exercise: string;
  /** Sam's injury region. */
  region: InjuryKey;
  /**
   * THE ONE SAFETY OWNER, PASSED IN. In production this is
   * `assessTapSwapCandidateSafety` closed over the live environment, so
   * equipment, readiness and injury are decided in exactly one place.
   */
  isLegal: (name: string) => boolean;
  /** Names the session already carries, or has already been given. */
  avoidNames?: readonly string[];
}

/**
 * THE FINER PATTERN IDENTITY: A POOL `group` WHERE ONE IS AUTHORED, ELSE THE
 * MOVEMENT.
 *
 * **R-087 MADE THE SINGLE-LEG SLOTS MAIN PATTERNS IN THEIR OWN RIGHT** — Sam,
 * 2026-08-13: *"each week should contain all the main lifts i.e. squat, hinge,
 * single leg knee, single leg hip, push pull..."* — and `PoolEntry.group` is
 * where the pools already record that: `Walking Lunges` is `single_leg_knee`,
 * `Goblet Squat` is `bilateral_squat`, and both live in the `squat` slot. So a
 * squat is NOT a same-pattern answer to a split squat; it is a related one, and
 * saying otherwise would let an injury quietly delete `single_leg_knee` from the
 * week while reporting the pattern covered.
 *
 * In the isolation slots the same field separates muscles instead
 * (`bicep`/`tricep`/`calf`/`quad`/...), and the identical rule reads correctly
 * there too. MEASURED before it existed: `Calf Raises` under a 4/10 calf was
 * answered with `Back Extension`, `Hamstring Curl` and `Leg Extension` — three
 * rows that are `isolation_lower` and are not calf work — while `Tib Raises` and
 * `Seated Calf Raise` sat below them on an alphabetical tie-break.
 */
function patternIdentity(candidate: Candidate): string | null {
  return candidate.pool?.group ?? null;
}

/**
 * ⚠ **A MISSING GROUP IS NOT A DIFFERENT GROUP.** The pools author `group` on
 * the entries that MIX identities inside one slot and leave it off the ones that
 * do not — every hinge ANCHOR (`Deadlift`, `RDLs`, `Trap Bar Deadlift`) has
 * none, while the hinge accessories carry `bilateral_hinge` / `single_leg_hip`.
 *
 * MEASURED when this compared `group ?? movement` instead: `RDLs` under a 4/10
 * hamstring answered `Back Extension` at rung 3, and **`Hip Thrusts` and
 * `Glute Bridge` — Sam's verbatim good swap, *"RDL -> hip thrust, glute bridge"*
 * (Bible :2050) — were pushed down to rung 4 and disclosed as partial coverage
 * they are not.** An absent group means "this entry does not split its slot",
 * so it must not manufacture a mismatch.
 */
function sameFinerIdentity(left: Candidate, right: Candidate): boolean {
  const a = patternIdentity(left);
  const b = patternIdentity(right);
  if (a === null || b === null) return true;
  return a === b;
}

/** Which rung, if any, this candidate sits on for this original. */
function rungFor(
  original: Candidate,
  originalSlot: PoolSlotKey | null,
  candidate: Candidate,
): InjuryFallbackRungId | null {
  const candidateSlot = patternToSlot(candidate.tags.movement);

  /* ⚠ **A CONDITIONING ROW IS ANSWERED WITH CONDITIONING, FULL STOP.**
   *
   * `Sprint Intervals` and `Easy Bike` share the `conditioning` movement tag, so
   * without this the ladder called an easy bike a *"same movement, safer
   * variation"* of a sprint session — true of the tag and wrong in the athlete's
   * ear — and, worse, a good-rated STRENGTH row outranked it at rung 5, so a
   * hamstring could turn a run into a `Chest-Supported DB Row`. Sam's
   * conditioning swaps are conditioning: *"Running -> bike/ski"*,
   * *"Sprinting -> easy bike"*, *"Hard intervals -> easy aerobic flush"*. They
   * land on rung 6, which is his own *"Recovery / easy conditioning"* tier. */
  if (original.tags.movement === 'conditioning') return null;

  /* ⚠ **A POWER ROW AND A STRENGTH ROW ARE DIFFERENT DOSES, NOT DIFFERENT
   * WEIGHTS.** `Speed Bench` and `Explosive Push-up` share `horizontal_push`
   * with `Bench Press`, and `exercisePoolsStrength` authors ballistic work its
   * own `doseCategory`. Substituting across that line hands the athlete a rep
   * scheme nobody prescribed for it, so the line is not crossed in either
   * direction. */
  if (Boolean(original.tags.power) !== Boolean(candidate.tags.power)) return null;

  const sameIdentity = sameFinerIdentity(original, candidate);

  if (sameIdentity && candidate.tags.movement === original.tags.movement) {
    return roleOf(candidate) === roleOf(original)
      ? 'same_movement_safer_variation'
      : 'nearest_safe_secondary_compound';
  }

  if (!originalSlot) return null;

  // Same slot AND the same finer identity, different movement — the squat slot's
  // `Single-Leg Leg Press` (squat) beside its `Step Ups` (lunge), both
  // `single_leg_knee`. Sam's "Lunge -> step-up or split squat" lives here.
  if (candidateSlot === originalSlot && sameIdentity) {
    return 'nearest_safe_secondary_compound';
  }

  const groups = ACCESSORY_GROUPS_FOR_SLOT[originalSlot] ?? [];
  const isTrunk = candidate.tags.movement === TRUNK;
  const isIsolation = candidate.tags.movement === 'isolation_upper'
    || candidate.tags.movement === 'isolation_lower';
  if ((isTrunk && groups.includes(TRUNK))
    || (isIsolation && candidate.pool?.group != null && groups.includes(candidate.pool.group))) {
    return 'accessory_or_isometric';
  }

  // Related, but it does not train what the original trained: the authored
  // adjacent slot, or the same slot under a DIFFERENT main pattern (a squat for
  // a split squat). Both are disclosed as partial coverage.
  if ((ADJACENT_SLOTS[originalSlot] ?? []).includes(candidateSlot as PoolSlotKey)
    || candidateSlot === originalSlot) {
    return 'safe_adjacent_pattern';
  }

  /* ⚠ **RUNG 5 IS NOT "EVERYTHING ELSE" — IT IS WORK THE REGION IS RATED `good`
   * FOR.** `isLegal` would admit a `caution` row in the 1-5 bands, and a
   * `caution` row from an unrelated family is not "an unaffected body area", it
   * is a second thing to be careful with. Sam's word is *unaffected*, so the
   * rating is read directly by the caller below rather than left to the
   * legality gate. */
  return null;
}

function unaffectedBodyAreaCandidate(
  candidate: Candidate,
  region: InjuryKey,
): boolean {
  return candidate.tags.injury[region] === 'good' && candidate.tags.movement !== 'conditioning';
}

/**
 * ⚠ **A CONDITIONING ROW IS NOT "AN UNAFFECTED BODY AREA", IT IS THE RUNG
 * BELOW.** Sam lists them as separate tiers and the order matters: an athlete
 * whose bench press is unavailable should be offered lower-body or trunk work
 * before being sent to the bike. Keeping conditioning out of rung 5 and giving
 * it rung 6 is what keeps that order.
 */
function recoveryCandidate(candidate: Candidate, region: InjuryKey): boolean {
  if (candidate.tags.injury[region] !== 'good') return false;
  if (candidate.tags.movement !== 'conditioning') return false;
  /* ⚠ **SAM'S TIER IS READ, BECAUSE "OFF THE LEG" IS NOT "EASY".**
   *
   * MEASURED the moment this rung landed: a 7/10 hamstring was offered
   * `Air Bike Sprints`, `Hard Assault Bike Intervals`, `Hard Row Intervals` and
   * `MetCon` as *"recovery / easy conditioning"* — every one of them rated
   * `hamstring: 'good'`, because they are off-feet, and every one of them a hard
   * session. Sam's hamstring bad-swap list names it exactly: *"Hamstring pain
   * from sprinting -> repeated sprint bike at max effort without control."*
   *
   * `CONDITIONING_META.tier` is his authored intensity, and tier `C` is his own
   * *"recovery / flush"*. The rung is his words — *"Recovery / easy
   * conditioning"* — so it is the tier that decides, not the injury rating. */
  return CONDITIONING_META[candidate.name]?.tier === 'C';
}

/**
 * WHAT THE ATHLETE IS TOLD, PER RUNG. One table, one voice, no jargon.
 *
 * Rungs 3 and 4 say what is NO LONGER being trained, because R-103 requires
 * partial coverage to be disclosed and because *"we swapped it"* over a row that
 * stopped training the pattern is the false claim
 * `injurySessionRecomposition` was built to delete.
 */
function explanationFor(rung: InjuryFallbackRungId, from: string, to: string): string {
  switch (rung) {
    case 'same_movement_safer_variation':
      return `${to} instead of ${from} — same movement, easier on the sore area.`;
    case 'nearest_safe_secondary_compound':
      return `${to} instead of ${from} — it trains the same thing in a way that should not aggravate it.`;
    case 'accessory_or_isometric':
      return `${to} instead of ${from} — it keeps the muscles working, but you are not doing the full ${from} movement this session.`;
    case 'safe_adjacent_pattern':
      return `${to} instead of ${from} — the closest safe option left, so ${from}'s movement is not trained this session.`;
    case 'unaffected_body_area':
      return `${to} instead of ${from} — nothing safe was left for ${from}, so this session works an area the injury does not affect.`;
    case 'recovery_easy_conditioning':
      return `${to} instead of ${from} — no safe strength work was left for ${from}, so this is easy conditioning instead.`;
  }
}

/**
 * THE LADDER, IN ORDER, LEGAL ONLY.
 *
 * Returns an EMPTY LIST when nothing legal exists at any rung. **That is the
 * honest answer, and the caller must treat it as one** — an omission the athlete
 * is told about by name, never a silent drop and never a substitution invented
 * to avoid an empty list.
 *
 * ⚠ **THE LIST IS COMPLETE AND DELIBERATELY NOT CAPPED.** Rung 5 is large by its
 * nature — "an area this injury does not affect" is most of the library — and
 * every consumer already takes what it needs (`groupTapSwapChoices` shows two
 * per group; `planInjuryRecomposition` walks until it finds one the session has
 * not already been given). A cap here would be a number nobody ruled, and on a
 * session with several unsafe rows it could exhaust the list and manufacture an
 * omission out of options that exist. Rungs 1-4 are small on their own.
 */
export function buildInjuryFallbackLadder(
  request: InjuryFallbackRequest,
): InjuryFallbackOption[] {
  const original = candidateFor(request.exercise);
  if (!original) return [];
  const originalSlot = patternToSlot(original.tags.movement);
  const avoided = new Set([
    original.name.toLowerCase(),
    ...(request.avoidNames ?? []).map((name) => resolveExerciseName(name).toLowerCase()),
  ]);
  const originalLoadRatio = original.pool?.loadRatio ?? null;

  const scored: Array<{ option: InjuryFallbackOption; sort: number[] }> = [];
  for (const candidate of ALL_CANDIDATES) {
    if (avoided.has(candidate.name.toLowerCase())) continue;
    const rung: InjuryFallbackRungId | null = rungFor(original, originalSlot, candidate)
      ?? (original.tags.movement !== 'conditioning'
        && unaffectedBodyAreaCandidate(candidate, request.region)
        ? 'unaffected_body_area' : null)
      ?? (recoveryCandidate(candidate, request.region) ? 'recovery_easy_conditioning' : null);
    if (!rung) continue;
    /* ⚠ **THE LOAD COMPARISON IS BETWEEN LIFTS, AND RUNG 6 IS NOT A LIFT.**
     * `Easy Bike` is `load: 'low'` and passes anyway today, but a conditioning
     * row's load tag is not on the same scale as a barbell's, so the comparison
     * is not made rather than made and happening to be right. */
    if (rung !== 'recovery_easy_conditioning'
      && !notHeavierThanOriginal(original, candidate)) continue;
    if (!request.isLegal(candidate.name)) continue;
    const rating = candidate.tags.injury[request.region];
    const definition = RUNG_BY_ID.get(rung)!;
    scored.push({
      option: {
        name: candidate.name,
        rung,
        tier: definition.tier,
        coversOriginalPattern: definition.coversOriginalPattern,
        explanation: explanationFor(rung, original.name, candidate.name),
      },
      /* SAFER FIRST, THEN CLOSER — stated as numbers so the order is inspectable.
       * `good` for this region beats `caution`; then the gentler load and fatigue,
       * which is what "a safer variation" means in the only vocabulary the tags
       * have; then the nearest load ratio, so a main lift is not replaced by a
       * token; then the name, so the answer is deterministic. */
      sort: [
        definition.rank,
        /* ⚠ **AT RUNG 5, ACCESSORY WORK COMES BEFORE ANOTHER MAIN LIFT, AND THAT
         * IS A WEEK-LEVEL PROPERTY, NOT A PREFERENCE.** A main lift substituted
         * in from an unaffected family adds a main-strength exposure the week
         * never planned, which §18 counts and block rotation inherits — the
         * mission's *"temporary injury changes do not corrupt future block
         * rotation"*. Sam's own shoulder list names the gentler answer directly:
         * *"Usually okay: ... Lower-body accessories"* (Bible :2185). Inside
         * rungs 1-4 the role has already been used to pick the rung, so this
         * term is zero there and cannot reorder them. */
        rung === 'unaffected_body_area' && roleOf(candidate) === 'anchor' ? 1 : 0,
        rating === 'good' ? 0 : 1,
        /* ⚠ **A ROW THE POOLS PROGRAM FROM OUTRANKS ONE THEY ONLY TAG.**
         * `EXERCISE_TAGS` is the wider universe — it carries prehab, isometric
         * and warm-up rows that are perfectly legal answers but that no slot is
         * ever built from. MEASURED: `Lat Pulldown` under a 4/10 shoulder was
         * answered with `Chin-Up Negative (Slow)` while `Neutral-Grip Pulldown`
         * — Sam's own *"Pull-ups hurt -> rows or pulldowns"* — sat behind it,
         * because neither is in the pools' load ledger and the tie broke on the
         * name. A programmed slot-filler is the better answer to "what should
         * this session do instead"; the rest stay, below it. */
        candidate.pool ? 0 : 1,
        LOAD_RANK[candidate.tags.load],
        FATIGUE_RANK[candidate.tags.fatigue],
        originalLoadRatio != null && candidate.pool
          ? Math.abs(candidate.pool.loadRatio - originalLoadRatio)
          : 99,
      ],
    });
  }

  return scored
    .sort((left, right) => {
      for (let index = 0; index < left.sort.length; index += 1) {
        const difference = left.sort[index]! - right.sort[index]!;
        if (difference !== 0) return difference;
      }
      return left.option.name.localeCompare(right.option.name);
    })
    .map((entry) => entry.option);
}

/**
 * THE HONEST OMISSION SENTENCE. Sam, via the mission: *"omit it honestly with a
 * typed, athlete-visible explanation. Never invent an unsafe replacement."*
 *
 * It names the row and the reason. A count would tell the athlete nothing about
 * what to make up, which is the same finding `injuryRecompositionMessage`
 * already carries for its own omissions list.
 */
/**
 * THE FINER PATTERN IDENTITY OF ONE ROW, EXPORTED SO A MEASUREMENT CAN NAME WHAT
 * IT ACTUALLY COVERED.
 *
 * `classifyGeneratedWorkoutRow(...).mainPattern` cannot separate a split squat
 * from a squat or a single-leg RDL from a deadlift — it maps the MOVEMENT tag,
 * and R-087's `single_leg_knee` / `single_leg_hip` live in the pools' `group`.
 * That is fine for the §18 ledger, which counts them where it counts them, and
 * useless for a coverage claim: a suite reporting *"squat, hinge"* over a day
 * holding four distinct main patterns is claiming half of what it walked.
 *
 * ⚠ **IT RETURNS THE SLOT FOR ANY ROW THE POOLS DO NOT CARRY.**
 * `Slant Board Step-Down`, `Cossack Squat` and `Lateral Lunge` are real
 * single-leg knee work that `STRENGTH_POOLS` has no entry for, so they answer
 * `squat`. A caller must not read that as "this is bilateral" — the honest
 * question is whether a candidate is in a DIFFERENT named group, which is what
 * `sameFinerIdentity` asks.
 */
export function finerPatternIdentityOf(exerciseName: string): string {
  const candidate = candidateFor(exerciseName);
  if (!candidate) return 'unknown';
  return candidate.pool?.group ?? patternToSlot(candidate.tags.movement) ?? candidate.tags.movement;
}

export function injuryOmissionExplanation(exercise: string): string {
  return `${exercise} is left out this session — nothing safe was available for it with this injury.`;
}
