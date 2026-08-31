/**
 * WHAT THE ATHLETE MAY ADD TO A SESSION — THE APP'S OWN VOCABULARY, FILTERED
 * BY THE APP'S OWN LEGALITY OWNER.
 *
 * Sam, 2026-08-19: *"Add any legal exercise, mobility or conditioning
 * component. Remove nothing. Respect equipment, injury and genuine session
 * limits. Own load authority."*
 *
 * ⚠ **WHAT THIS REPLACES.** The day screen held a HAND-WRITTEN table of twelve
 * suggestions — two per "kind" — and offered the first one the session did not
 * already contain. It was not *any* legal exercise (twelve names out of the
 * whole vocabulary), it asked NOTHING about the athlete's kit or their injuries,
 * and every entry carried a hand-typed set/rep band. An athlete with no barbell
 * and a bad shoulder was offered the same two upper-body options as everyone
 * else.
 *
 * **NO NEW DATA AND NO SECOND LEGALITY OPINION.** The names come from
 * `selectableVocabularyGroups()` — the one vocabulary every generator draws
 * from, already grouped and already labelled, and already covering strength,
 * mobility, prehab, power and conditioning. The filter is
 * `assessTapSwapCandidateSafety`, the same function the swap ladder uses to
 * decide whether an athlete may be offered a movement at all, so Add and Swap
 * cannot disagree about what is safe today.
 *
 * ── WHY THE 7-EXERCISE CAP IS NOT APPLIED HERE ─────────────────────────────
 *
 * `REGISTRY-GREP: R-088`. Sam ruled it in the same breath as the number:
 * *"7 is the max the app should set and **a user should be able to add as many
 * of their own things on top of it as they choose**"*. The cap binds the
 * PLANNER, not the athlete. So *"respect ... genuine session limits"* means
 * equipment, injury and safety — the limits that could hurt someone — and NOT
 * the app's own budget, which exists to stop the app over-programming.
 *
 * ── AND HOW IT IS SHOWN — SAM'S THREE LEVELS, 2026-08-20 ───────────────────
 *
 * The names above were correct and the MENU was not: they were offered as one
 * flat list of the vocabulary's own prompt groups — 23 buttons deep on a
 * full-kit athlete, reading `Upper push horizontal`, `Tissue quality`,
 * `Breathing reset`. Sam: *"1. Strength / Conditioning / Mobility-Warm-up.
 * 2. A relevant subcategory … 3. Legal final exercise choices. Never show
 * athletes a mixed internal list containing options like 'Breathing reset'."*
 * `legalAddFamilies` answers every level except the exercises,
 * `legalAddCandidates` answers those, and both read ONE legality pass so a
 * count can never disagree with its list.
 *
 * WRITER: none, this stores nothing. READER: `screens/home/DayWorkoutScreenV2`.
 * TEST: `src/__tests__/exerciseIntakeTests.ts`.
 */

import {
  selectableVocabularyGroups,
  type VocabularyGroupId,
} from '../data/selectableExerciseVocabulary';
import { assessTapSwapCandidateSafety, type TapSwapEnvironment } from './tapSwapHierarchy';
import { resolveExerciseName, startingWeightForAthlete } from './loadEstimation';
import { CONDITIONING_META, getExerciseTags, type ConditioningTier } from '../data/exerciseTags';
import { SECTION_LABELS, type SessionExecutionSectionId } from './sessionExecutionChecklist';
import type { OnboardingData, Workout, WorkoutExercise } from '../types/domain';
import { exerciseProgrammingAllows } from './exerciseFilter';

export interface AddCandidate {
  restSeconds?: number;
  notes?: string;
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  /** `null` when the movement has no prescribable load — bodyweight, mobility. */
  weightKg: number | null;
  prescriptionType?: 'reps' | 'duration' | 'duration_minutes';
  perSide?: boolean;
}

/** Preserve the tapped section separately from the exercise's physiological role. */
export function addExerciseSectionContext(section: AddFamilyId, leaf: AddLeafId,
  sessionKind?: Workout['composedOptionalKind']): Pick<WorkoutExercise, 'sessionSection' | 'composedOptionalKind' | 'role'> {
  const family = Object.values(ADD_GROUPS).find(group => group.leaves.includes(leaf))?.family;
  return {
    sessionSection: section,
    ...(family === 'conditioning' ? { role: 'conditioning' as const } : {}),
    ...(section === 'recovery' ? { composedOptionalKind: 'recovery' as const }
      : section === 'primer' ? { composedOptionalKind: 'primer' as const }
      : section === 'accessories' ? { composedOptionalKind: 'prehab' as const }
      : family === 'mobility' && section !== 'optional' ? { composedOptionalKind: 'mobility' as const }
      : sessionKind === 'primer' || sessionKind === 'prehab' || sessionKind === 'gunshow'
        ? { composedOptionalKind: sessionKind } : {}),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * THE APPROVED HIERARCHY — Sam, 2026-08-20, REVISED THE SAME DAY.
 *
 * *"Strength: 1. Power & Jumps -> exercise choices. 2. Lower body -> Hinge /
 * Squat / Single leg / Accessories -> exercise choices. 3. Upper body -> Push /
 * Pull / Arms & shoulders / Accessories -> exercise choices. 4. Midline &
 * Carries -> exercise choices. This adds one extra step only where needed.
 * Conditioning and Mobility / Warm-up can keep their current structure."*
 * And standing from the first ruling: *"Never show athletes a mixed internal
 * list containing options like 'Breathing reset'."*
 *
 * ⚠ **THE DEPTH IS NOT UNIFORM, AND THAT IS THE RULING.** The first cut gave
 * Strength TEN flat subcategories at level 2. Sam's revision groups them under
 * four headings and pays for one more tap ONLY under Lower body and Upper body
 * — Power & Jumps and Midline & Carries still go straight to their exercises.
 * A group therefore either owns its exercises or owns a further question, and
 * `AddGroupSpec.leaves` is the single place that says which.
 *
 * ── NO NEW TAXONOMY. FOUR JOINS ONTO OWNERS THAT ALREADY EXIST ─────────────
 *
 * 1. **The families ARE session sections.** `AddFamilyId` is an `Extract` of
 *    `SessionExecutionSectionId`, and the labels are `SECTION_LABELS` itself.
 *    So "Conditioning" in Add is the same word, for the same work, as
 *    "Conditioning" on the session screen — by construction, not by agreement.
 * 2. **Most leaves ARE the pools.** The join is `VocabularyGroupId` — the pool
 *    key — never the prompt's label text.
 * 3. **`Single leg` IS THE `unilateral` TAG**, not a hand-written list. Sam put
 *    it beside Hinge and Squat, which means it TAKES the unilateral movements
 *    OUT of those two rather than duplicating them — so a name appears in
 *    exactly one leaf. `EXERCISE_TAGS.unilateral` already decides this for the
 *    per-side dose below; measured on the live pools it partitions 13 squat
 *    names into 7 + 6 and 7 hinge names into 6 + 1, with nothing untagged.
 * 4. **The conditioning leaves ARE `ConditioningTier`.** Sam's own
 *    session-intent classification (A sprint-dominant, B-high high output,
 *    B-low moderate, C recovery/flush) already sorts all 90 formats.
 *
 * `REGISTRY-GREP: R-110` — *"Power belongs inside the Strength section,
 * generally as its first row."* It does here too, and Sam's revision keeps it
 * as Strength's FIRST heading.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * SAM'S THREE. A subset of the session's sections, typed as one so a family can
 * never name a section the athlete's session screen does not have.
 */
export type AddFamilyId = Exclude<SessionExecutionSectionId, 'team_training' | 'speed'>;

/** Sam's order, which is not `SECTION_ORDER`'s. He stated Strength first. */
export const ADD_FAMILY_ORDER: readonly AddFamilyId[] = ['strength', 'conditioning', 'mobility'];

/** LEVEL 2 — the heading inside a family. */
export type AddGroupId =
  | 'power' | 'lower_body' | 'upper_body' | 'midline_carries'
  | 'sprints' | 'hard_intervals' | 'tempo' | 'easy_flush'
  | 'mobility_drills' | 'tissue' | 'breathing';

/**
 * THE LIST OF EXERCISES. Reached at level 3, or at level 4 under Lower body and
 * Upper body — the only two groups that ask a further question.
 *
 * `lower_` / `upper_` prefixes are not decoration: Sam's names give BOTH sides
 * a leaf called *"Accessories"*, and two leaves sharing an id would silently
 * merge two different lists of movements into one.
 */
export type AddLeafId =
  | 'power'
  | 'lower_hinge' | 'lower_squat' | 'lower_single_leg' | 'lower_accessories'
  | 'upper_push' | 'upper_pull' | 'upper_arms_shoulders' | 'upper_accessories'
  | 'midline_carries'
  | 'sprints' | 'hard_intervals' | 'tempo' | 'easy_flush'
  | 'mobility_drills' | 'tissue' | 'breathing';

export interface AddGroupSpec {
  family: AddFamilyId;
  /** Sam's word, verbatim. Never a pool key, never a prompt label. */
  label: string;
  /**
   * ONE leaf means the group IS the list and no extra question is asked —
   * *"this adds one extra step only where needed"*. Declaration order is menu
   * order.
   */
  leaves: readonly AddLeafId[];
}

/** Declaration order is menu order within each family. */
export const ADD_GROUPS: Readonly<Record<AddGroupId, AddGroupSpec>> = {
  // R-110 — power opens Strength.
  power: { family: 'strength', label: 'Power & Jumps', leaves: ['power'] },
  lower_body: {
    family: 'strength',
    label: 'Lower body',
    leaves: ['lower_hinge', 'lower_squat', 'lower_single_leg', 'lower_accessories'],
  },
  upper_body: {
    family: 'strength',
    label: 'Upper body',
    leaves: ['upper_push', 'upper_pull', 'upper_arms_shoulders', 'upper_accessories'],
  },
  midline_carries: { family: 'strength', label: 'Midline & Carries', leaves: ['midline_carries'] },
  sprints: { family: 'conditioning', label: 'Sprints & speed', leaves: ['sprints'] },
  hard_intervals: { family: 'conditioning', label: 'Hard intervals', leaves: ['hard_intervals'] },
  tempo: { family: 'conditioning', label: 'Tempo & steady', leaves: ['tempo'] },
  easy_flush: { family: 'conditioning', label: 'Easy & flush', leaves: ['easy_flush'] },
  mobility_drills: { family: 'mobility', label: 'Mobility & stretching', leaves: ['mobility_drills'] },
  tissue: { family: 'mobility', label: 'Foam rolling & release', leaves: ['tissue'] },
  breathing: { family: 'mobility', label: 'Breathing & wind-down', leaves: ['breathing'] },
};

/**
 * What the athlete reads on a leaf button. Sam's names, exactly as he wrote
 * them — including the two called *"Accessories"*, which are never shown beside
 * each other because each lives inside its own half of the body.
 */
export const ADD_LEAF_LABELS: Readonly<Record<AddLeafId, string>> = {
  power: 'Power & Jumps',
  lower_hinge: 'Hinge',
  lower_squat: 'Squat',
  lower_single_leg: 'Single leg',
  lower_accessories: 'Accessories',
  upper_push: 'Push',
  upper_pull: 'Pull',
  upper_arms_shoulders: 'Arms & shoulders',
  upper_accessories: 'Accessories',
  midline_carries: 'Midline & Carries',
  sprints: 'Sprints & speed',
  hard_intervals: 'Hard intervals',
  tempo: 'Tempo & steady',
  easy_flush: 'Easy & flush',
  mobility_drills: 'Mobility & stretching',
  tissue: 'Foam rolling & release',
  breathing: 'Breathing & wind-down',
};

/**
 * WHERE THE ATHLETE FINDS EACH POOL.
 *
 * ⚠ **A TOTAL `Record`, WHICH IS THE GUARD.** A new `ExerciseCategory` or a new
 * `PoolSlotKey` stops this file compiling until somebody says where in the
 * athlete's menu it appears. A `Partial` would let a new pool fall out of Add
 * silently — the athlete would simply never be offered it, and nothing would
 * say so.
 *
 * `'by_conditioning_tier'` is stated rather than left as a `null` hole: the
 * conditioning pool is the one group that does NOT map whole, because its 90
 * formats already carry Sam's own tier.
 */
export const LEAF_FOR_POOL:
  Readonly<Record<VocabularyGroupId, AddLeafId | 'by_conditioning_tier'>> = {
  // ⚠ These two are then re-read by `liftUnilateralToSingleLeg` below — Sam put
  // `Single leg` BESIDE Hinge and Squat, so it takes from them.
  squat: 'lower_squat',
  hinge: 'lower_hinge',
  // Jumps and the power pool are one question to an athlete: explosive work.
  plyo: 'power',
  power: 'power',
  horizontal_push: 'upper_push',
  vertical_push: 'upper_push',
  horizontal_pull: 'upper_pull',
  vertical_pull: 'upper_pull',
  isolation_upper: 'upper_arms_shoulders',
  biceps: 'upper_arms_shoulders',
  triceps: 'upper_arms_shoulders',
  delts: 'upper_arms_shoulders',
  upper_back_pump: 'upper_arms_shoulders',
  // Scap and cuff work is the upper body's accessory drawer.
  shoulder_health: 'upper_accessories',
  // The lower body's accessory drawer: isolation, calves, and the prehab pools
  // an athlete opens when they are protecting a knee, groin or hamstring.
  isolation_lower: 'lower_accessories',
  calves: 'lower_accessories',
  hamstring_light: 'lower_accessories',
  lower_prehab: 'lower_accessories',
  groin_adductors: 'lower_accessories',
  trunk_anti_rotation: 'midline_carries',
  carry: 'midline_carries',
  mobility: 'mobility_drills',
  tissue_quality: 'tissue',
  breathing_reset: 'breathing',
  // Zone-1 cyclical work IS the flush end of conditioning, and Sam's tier C
  // already means exactly that.
  easy_cardio: 'easy_flush',
  conditioning: 'by_conditioning_tier',
};

/** Sam's tier classification, in the words an athlete would use for it. */
const LEAF_FOR_TIER: Readonly<Record<ConditioningTier, AddLeafId>> = {
  A: 'sprints',
  'B-high': 'hard_intervals',
  'B-low': 'tempo',
  C: 'easy_flush',
};

/**
 * SAM PUT `Single leg` BESIDE `Hinge` AND `Squat`, SO IT TAKES FROM THEM.
 *
 * Siblings partition; they do not overlap. If Bulgarian Split Squats appeared
 * under both Squat and Single leg, an athlete who added it from one list would
 * still see it offered in the other — and the two counts would double-count the
 * same movement.
 *
 * The fact is `EXERCISE_TAGS.unilateral`, which `bandFor` below already reads to
 * decide whether a dose is per-side. Measured on the live pools: 6 of 13 squat
 * names and 1 of 7 hinge names are unilateral, and NONE is untagged — so this
 * rule never has to guess.
 *
 * ⚠ **IT APPLIES TO THE TWO PRIMARY LOWER PATTERNS ONLY.** `Single-Leg Calf
 * Raise` is also unilateral and stays in `Accessories` with the other calf
 * work, because that is where an athlete looks for it.
 */
function liftUnilateralToSingleLeg(leaf: AddLeafId, name: string): AddLeafId {
  if (leaf !== 'lower_squat' && leaf !== 'lower_hinge') return leaf;
  return getExerciseTags(resolveExerciseName(name))?.unilateral ? 'lower_single_leg' : leaf;
}

export interface AddLeafOffer {
  id: AddLeafId;
  label: string;
  /** How many legal choices sit behind it, today, for this athlete. */
  count: number;
}

export interface AddGroupOffer {
  id: AddGroupId;
  label: string;
  count: number;
  /**
   * One entry means tapping this group goes STRAIGHT to the exercises. More
   * than one means it asks Sam's extra question first.
   */
  leaves: AddLeafOffer[];
}

export interface AddFamilyOffer {
  id: AddFamilyId;
  label: string;
  count: number;
  groups: AddGroupOffer[];
}

export interface AddCandidateArgs {
  /** The section tapped, not a second exercise taxonomy. */
  section?: AddFamilyId;
  sessionKind?: Workout['composedOptionalKind'];
  environment: TapSwapEnvironment;
  existingExerciseNames?: readonly string[];
  profile?: OnboardingData | null;
}

/**
 * THE ATHLETE'S OWN LOAD, FROM THE ONE OWNER.
 *
 * `startingWeightForAthlete` already answers "what should THIS athlete lift on
 * THIS movement" from their onboarding anchors and training age, and returns
 * `null` for anything with no prescribable load. Reading it here is what makes
 * an added row carry its own number rather than inheriting one from whatever it
 * was typed next to.
 */
function loadFor(name: string, profile: OnboardingData | null | undefined): number | null {
  if (!profile) return null;
  try {
    return startingWeightForAthlete(name, profile);
  } catch {
    // A movement the estimator has no anchor for is not an error; it is a row
    // the athlete loads themselves.
    return null;
  }
}

/**
 * The authored band for a movement, by what the movement IS.
 *
 * Deliberately coarse and deliberately NOT a second dose engine: an ADDED row
 * is the athlete's own top-up, not a programmed exposure, and
 * `resolveComposedDose` answers a question about a row the COMPOSER selected
 * for a slot — it needs the slot, the phase and the main-lift role, none of
 * which an ad-hoc add has. Inventing those to reach it would be inventing the
 * answer. So the band comes off the movement's own tags.
 */
function bandFor(name: string): Pick<AddCandidate, 'sets' | 'repsMin' | 'repsMax' | 'prescriptionType' | 'perSide' | 'restSeconds' | 'notes'> {
  const tags = getExerciseTags(resolveExerciseName(name));
  if (tags?.prescription) return { ...tags.prescription };
  if (!tags) return { sets: 2, repsMin: 8, repsMax: 12 };
  if (tags.movement === 'conditioning') {
    return { sets: 1, repsMin: 8, repsMax: 10, prescriptionType: 'duration_minutes' };
  }
  if (tags.movement === 'carry') {
    return { sets: 2, repsMin: 30, repsMax: 45, prescriptionType: 'duration', perSide: tags.unilateral };
  }
  if (tags.movement === 'core') {
    return { sets: 2, repsMin: 8, repsMax: 12, perSide: tags.unilateral };
  }
  if (tags.movement === 'plyo') {
    return { sets: 3, repsMin: 3, repsMax: 5, perSide: tags.unilateral };
  }
  if (tags.load === 'high') {
    return { sets: 3, repsMin: 5, repsMax: 8, perSide: tags.unilateral };
  }
  return { sets: 2, repsMin: 10, repsMax: 12, perSide: tags.unilateral };
}

/**
 * EVERY LEGAL NAME THE ATHLETE MAY ADD TODAY, FILED UNDER SAM'S LEAVES.
 *
 * The ONE place legality is decided, so every menu level can agree about what
 * is behind a button: a count on level 1 is the length of the list the last
 * level renders, because all of them read this.
 *
 * A name already on the day is not offered — adding it would either duplicate
 * the row or invite a caller to overwrite it, and an Add that overwrites is a
 * Swap. Safety is `assessTapSwapCandidateSafety`, the same function the swap
 * ladder uses, so Add and Swap cannot disagree about what is safe today.
 */
function legalNamesByLeaf(args: AddCandidateArgs): Map<AddLeafId, string[]> {
  const present = new Set(
    (args.existingExerciseNames ?? []).map((name) => resolveExerciseName(name).toLowerCase()),
  );
  const filed = new Map<AddLeafId, string[]>();
  for (const group of selectableVocabularyGroups()) {
    const target = LEAF_FOR_POOL[group.id];
    for (const name of group.names) {
      if (present.has(resolveExerciseName(name).toLowerCase())) continue;
      if (!assessTapSwapCandidateSafety(name, args.environment).safe) continue;
      if ((args.section === 'primer' || args.sessionKind === 'primer') && !exerciseProgrammingAllows(name, {
        ...args.environment, route: 'primer',
      })) continue;
      const leaf = target === 'by_conditioning_tier'
        ? LEAF_FOR_TIER[CONDITIONING_META[name]?.tier ?? 'B-low']
        : liftUnilateralToSingleLeg(target, name);
      if (args.section && !leafAllowedInSection(args.section, leaf, args.sessionKind)) continue;
      const bucket = filed.get(leaf);
      if (bucket) bucket.push(name);
      else filed.set(leaf, [name]);
    }
  }
  return filed;
}

function leafAllowedInSection(section: AddFamilyId, leaf: AddLeafId,
  sessionKind?: Workout['composedOptionalKind']): boolean {
  if (section === 'optional' || section === 'other') return true;
  if (section === 'primer') return Object.values(ADD_GROUPS).some(group =>
    (group.family === 'strength' || group.family === 'mobility') && group.leaves.includes(leaf));
  // Authored Accessories uses the existing main-section ID ('strength'),
  // with its own visible label. Its typed session identity still owns choices.
  if (section === 'accessories' || (section === 'strength' && sessionKind === 'prehab')) return [
    'lower_accessories', 'upper_accessories', 'upper_arms_shoulders', 'midline_carries',
  ].includes(leaf);
  if (section === 'recovery') return ['mobility_drills', 'tissue', 'breathing', 'easy_flush'].includes(leaf);
  return Object.values(ADD_GROUPS).some((group) => group.family === section && group.leaves.includes(leaf));
}

function leafForExerciseName(name: string): AddLeafId | null {
  const wanted = resolveExerciseName(name).toLowerCase();
  for (const group of selectableVocabularyGroups()) {
    const match = group.names.find((candidate) => resolveExerciseName(candidate).toLowerCase() === wanted);
    if (!match) continue;
    const target = LEAF_FOR_POOL[group.id];
    return target === 'by_conditioning_tier'
      ? LEAF_FOR_TIER[CONDITIONING_META[match]?.tier ?? 'B-low']
      : liftUnilateralToSingleLeg(target, match);
  }
  return null;
}

function familyForLeaf(leaf: AddLeafId): AddFamilyId | null {
  for (const spec of Object.values(ADD_GROUPS)) {
    if (spec.leaves.includes(leaf)) return spec.family;
  }
  return null;
}

/**
 * Legal alternatives for one existing exercise, ordered nearest first.
 *
 * Quick Swap uses this only after the specialised swap hierarchy. It is not a
 * second legality opinion: the names come from `legalNamesByLeaf`, the exact
 * owner used by Add, and therefore pass the same equipment/injury gate. The
 * original leaf comes first; remaining leaves stay inside the same visible
 * session family.
 */
export function legalAddAlternativesForExercise(
  args: AddCandidateArgs & {
    originalExercise: string;
    /** A typed visible slot outranks a name that belongs to another pool. */
    requiredFamily?: AddFamilyId;
  },
): Array<AddCandidate & { proximity: 'same_leaf' | 'same_family' }> {
  const originalLeaf = leafForExerciseName(args.originalExercise);
  const inferredFamily = originalLeaf ? familyForLeaf(originalLeaf) : null;
  const family = args.requiredFamily ?? inferredFamily;
  if (!family) return [];
  const nearestLeaf = originalLeaf && familyForLeaf(originalLeaf) === family
    ? originalLeaf
    : null;
  const filed = legalNamesByLeaf(args);
  const leaves = [
    ...(nearestLeaf ? [nearestLeaf] : []),
    ...Object.values(ADD_GROUPS)
      .filter((spec) => spec.family === family)
      .flatMap((spec) => spec.leaves)
      .filter((leaf) => leaf !== nearestLeaf),
  ];
  const seen = new Set<string>();
  const alternatives: Array<AddCandidate & { proximity: 'same_leaf' | 'same_family' }> = [];
  for (const leaf of leaves) {
    for (const name of filed.get(leaf) ?? []) {
      const key = resolveExerciseName(name).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      alternatives.push({
        name,
        ...bandFor(name),
        weightKg: loadFor(name, args.profile),
        proximity: leaf === nearestLeaf ? 'same_leaf' : 'same_family',
      });
    }
  }
  return alternatives;
}

/**
 * EVERY LEVEL OF SAM'S MENU EXCEPT THE EXERCISES, IN ONE ANSWER.
 *
 * Names only — no dose and no load. Those cost a call to the load owner per
 * movement, and an athlete standing on level 1 is choosing between three words;
 * there is nothing on that screen a weight could appear on. The exercise list
 * asks for its own, for the one leaf it renders.
 *
 * ⚠ **AN EMPTY FAMILY, GROUP OR LEAF IS ABSENT, NOT EMPTY** — the rule the flat
 * menu already followed, now at every level. A heading the athlete taps always
 * has something behind it, so the hierarchy can never dead-end. It also means
 * **a group can lose its extra question**: if a bad knee leaves Lower body with
 * only `Accessories` legal, that group drops to one leaf and goes straight to
 * the exercises, which is the same *"only where needed"* rule answering a
 * narrower day.
 */
export function legalAddFamilies(args: AddCandidateArgs): AddFamilyOffer[] {
  const filed = legalNamesByLeaf(args);
  const families: AddFamilyOffer[] = [];
  for (const family of args.section ? [args.section] : ADD_FAMILY_ORDER) {
    const groups: AddGroupOffer[] = [];
    // Declaration order in ADD_GROUPS is menu order.
    for (const [id, spec] of Object.entries(ADD_GROUPS) as [AddGroupId, AddGroupSpec][]) {
      if (!spec.leaves.some((leaf) => leafAllowedInSection(family, leaf))) continue;
      const leaves: AddLeafOffer[] = [];
      for (const leafId of spec.leaves) {
        if (!leafAllowedInSection(family, leafId)) continue;
        const names = filed.get(leafId);
        if (!names || names.length === 0) continue;
        leaves.push({ id: leafId, label: ADD_LEAF_LABELS[leafId], count: names.length });
      }
      if (leaves.length === 0) continue;
      groups.push({
        id,
        label: spec.label,
        count: leaves.reduce((total, leaf) => total + leaf.count, 0),
        leaves,
      });
    }
    if (groups.length === 0) continue;
    families.push({
      id: family,
      label: SECTION_LABELS[family],
      count: groups.reduce((total, group) => total + group.count, 0),
      groups,
    });
  }
  return families;
}

/**
 * THE LAST LEVEL — *"exercise choices"*.
 *
 * ⚠ **EVERY legal choice, not a sample.** The flat menu capped each group at
 * six, and its own reason was *"few enough that the sheet is a decision rather
 * than a catalogue"* — a reason that belonged to a screen showing all 23 groups
 * at once. The hierarchy is what makes it a decision now, so the cap has
 * nothing left to do except hide movements: at six per group an athlete with a
 * full rack could not reach Dips, Face Pull or the Z-Press at all, which reads
 * as *"the app will not let me add it"*, not as brevity.
 *
 * `REGISTRY-GREP: R-088` — *"a user should be able to add as many of their own
 * things on top of it as they choose"*. A menu that withholds legal movements
 * is the same refusal wearing a different coat.
 */
export function legalAddCandidates(
  args: AddCandidateArgs & { leaf: AddLeafId },
): AddCandidate[] {
  const names = legalNamesByLeaf(args).get(args.leaf) ?? [];
  return names.map((name) => ({
    name,
    ...bandFor(name),
    weightKg: loadFor(name, args.profile),
  }));
}
