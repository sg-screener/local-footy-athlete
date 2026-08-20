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
 * `legalAddFamilies` answers levels 1 and 2, `legalAddCandidates` level 3, and
 * both read ONE legality pass so a count can never disagree with its list.
 *
 * WRITER: none, this stores nothing. READER: `screens/home/DayWorkoutScreenV2`.
 * TEST: `src/__tests__/exerciseAddCandidatesTests.ts`.
 */

import {
  selectableVocabularyGroups,
  type VocabularyGroupId,
} from '../data/selectableExerciseVocabulary';
import { assessTapSwapCandidateSafety, type TapSwapEnvironment } from './tapSwapHierarchy';
import { resolveExerciseName, startingWeightForAthlete } from './loadEstimation';
import { CONDITIONING_META, getExerciseTags, type ConditioningTier } from '../data/exerciseTags';
import { SECTION_LABELS, type SessionExecutionSectionId } from './sessionExecutionChecklist';
import type { OnboardingData } from '../types/domain';

export interface AddCandidate {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  /** `null` when the movement has no prescribable load — bodyweight, mobility. */
  weightKg: number | null;
  prescriptionType?: 'reps' | 'duration' | 'duration_minutes';
  perSide?: boolean;
}

/* ══════════════════════════════════════════════════════════════════════════
 * THE APPROVED HIERARCHY — Sam, 2026-08-20.
 *
 * *"1. Strength / Conditioning / Mobility-Warm-up. 2. A relevant subcategory,
 * such as upper/lower/movement pattern. 3. Legal final exercise choices. Never
 * show athletes a mixed internal list containing options like 'Breathing
 * reset'."*
 *
 * ⚠ **WHAT THIS REPLACES, MEASURED.** Add opened on ONE flat list of the
 * vocabulary's own prompt groups. On a full-kit off-season athlete that is
 * **23 buttons** reading `Lower squat`, `Upper push horizontal`,
 * `Groin / adductors`, `Hamstring (light)`, `Tissue quality`, `Easy cardio
 * (zone 1)`, `Breathing reset` — the generation prompt's internal vocabulary,
 * shown to an athlete, in a sheet that does not scroll.
 *
 * ── NO NEW TAXONOMY. THREE JOINS ONTO OWNERS THAT ALREADY EXIST ────────────
 *
 * 1. **The families ARE session sections.** `AddFamilyId` is an `Extract` of
 *    `SessionExecutionSectionId`, and the labels are `SECTION_LABELS` itself.
 *    So "Conditioning" in Add is the same word, for the same work, as
 *    "Conditioning" on the session screen — by construction, not by agreement.
 * 2. **The strength subcategories ARE the pools.** The join is
 *    `VocabularyGroupId` — the pool key — never the prompt's label text.
 * 3. **The conditioning subcategories ARE `ConditioningTier`.** Sam's own
 *    session-intent classification (A sprint-dominant, B-high high output,
 *    B-low moderate, C recovery/flush) already sorts all 90 formats. Inventing
 *    a fourth conditioning grouping to show the athlete would have been a rival
 *    authority nothing could tell apart from the real one.
 *
 * `REGISTRY-GREP: R-110` — *"Power belongs inside the Strength section"*. It
 * does here too, and it is Strength's first subcategory, which is the same
 * sentence's *"generally as its first row"* applied to a menu.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * SAM'S THREE. A subset of the session's sections, typed as one so a family can
 * never name a section the athlete's session screen does not have.
 */
export type AddFamilyId = Extract<
  SessionExecutionSectionId,
  'strength' | 'conditioning' | 'mobility'
>;

/** Sam's order, which is not `SECTION_ORDER`'s. He stated Strength first. */
export const ADD_FAMILY_ORDER: readonly AddFamilyId[] = ['strength', 'conditioning', 'mobility'];

export type AddSubcategoryId =
  // Strength — movement pattern, which is what the pools already are.
  | 'power' | 'squat' | 'hinge' | 'push' | 'pull' | 'carry'
  | 'arms_shoulders' | 'legs_calves' | 'midline' | 'prehab'
  // Conditioning — `ConditioningTier`, in the athlete's words.
  | 'sprints' | 'hard_intervals' | 'tempo' | 'easy_flush'
  // Mobility / Warm-up.
  | 'mobility_drills' | 'tissue' | 'breathing';

export interface AddSubcategorySpec {
  family: AddFamilyId;
  /** What the ATHLETE reads. Never a pool key, never a prompt label. */
  label: string;
}

/**
 * Declaration order is menu order within each family, so this table is the only
 * place either the wording or the ordering is decided.
 */
export const ADD_SUBCATEGORIES: Readonly<Record<AddSubcategoryId, AddSubcategorySpec>> = {
  // R-110 — power opens Strength.
  power: { family: 'strength', label: 'Power & jumps' },
  squat: { family: 'strength', label: 'Lower body — squat' },
  hinge: { family: 'strength', label: 'Lower body — hinge' },
  push: { family: 'strength', label: 'Upper body — push' },
  pull: { family: 'strength', label: 'Upper body — pull' },
  carry: { family: 'strength', label: 'Carries' },
  arms_shoulders: { family: 'strength', label: 'Arms & shoulders' },
  legs_calves: { family: 'strength', label: 'Legs & calves' },
  midline: { family: 'strength', label: 'Midline' },
  prehab: { family: 'strength', label: 'Prehab' },
  sprints: { family: 'conditioning', label: 'Sprints & speed' },
  hard_intervals: { family: 'conditioning', label: 'Hard intervals' },
  tempo: { family: 'conditioning', label: 'Tempo & steady' },
  easy_flush: { family: 'conditioning', label: 'Easy & flush' },
  mobility_drills: { family: 'mobility', label: 'Mobility & stretching' },
  tissue: { family: 'mobility', label: 'Foam rolling & release' },
  breathing: { family: 'mobility', label: 'Breathing & wind-down' },
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
const SUBCATEGORY_FOR_POOL:
  Readonly<Record<VocabularyGroupId, AddSubcategoryId | 'by_conditioning_tier'>> = {
  squat: 'squat',
  hinge: 'hinge',
  horizontal_push: 'push',
  vertical_push: 'push',
  horizontal_pull: 'pull',
  vertical_pull: 'pull',
  // Jumps and the power pool are one question to an athlete: explosive work.
  plyo: 'power',
  power: 'power',
  carry: 'carry',
  isolation_upper: 'arms_shoulders',
  biceps: 'arms_shoulders',
  triceps: 'arms_shoulders',
  delts: 'arms_shoulders',
  upper_back_pump: 'arms_shoulders',
  isolation_lower: 'legs_calves',
  calves: 'legs_calves',
  hamstring_light: 'legs_calves',
  trunk_anti_rotation: 'midline',
  // Prehab is where an athlete looks for the joint they are protecting; the
  // groin, knee and shoulder pools are all that question.
  groin_adductors: 'prehab',
  lower_prehab: 'prehab',
  shoulder_health: 'prehab',
  mobility: 'mobility_drills',
  tissue_quality: 'tissue',
  breathing_reset: 'breathing',
  // Zone-1 cyclical work IS the flush end of conditioning, and Sam's tier C
  // already means exactly that.
  easy_cardio: 'easy_flush',
  conditioning: 'by_conditioning_tier',
};

/** Sam's tier classification, in the words an athlete would use for it. */
const SUBCATEGORY_FOR_TIER: Readonly<Record<ConditioningTier, AddSubcategoryId>> = {
  A: 'sprints',
  'B-high': 'hard_intervals',
  'B-low': 'tempo',
  C: 'easy_flush',
};

export interface AddSubcategoryOffer {
  id: AddSubcategoryId;
  label: string;
  /** How many legal choices sit behind it, today, for this athlete. */
  count: number;
}

export interface AddFamilyOffer {
  id: AddFamilyId;
  label: string;
  count: number;
  subcategories: AddSubcategoryOffer[];
}

export interface AddCandidateArgs {
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
function bandFor(name: string): Pick<AddCandidate, 'sets' | 'repsMin' | 'repsMax' | 'prescriptionType' | 'perSide'> {
  const tags = getExerciseTags(resolveExerciseName(name));
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
 * EVERY LEGAL NAME THE ATHLETE MAY ADD TODAY, FILED UNDER SAM'S SUBCATEGORIES.
 *
 * The ONE place legality is decided, so the three menu levels can never
 * disagree about what is behind a button: a count on level 1 is the length of
 * the list level 3 renders, because both read this.
 *
 * A name already on the day is not offered — adding it would either duplicate
 * the row or invite a caller to overwrite it, and an Add that overwrites is a
 * Swap. Safety is `assessTapSwapCandidateSafety`, the same function the swap
 * ladder uses, so Add and Swap cannot disagree about what is safe today.
 */
function legalNamesBySubcategory(args: AddCandidateArgs): Map<AddSubcategoryId, string[]> {
  const present = new Set(
    (args.existingExerciseNames ?? []).map((name) => resolveExerciseName(name).toLowerCase()),
  );
  const filed = new Map<AddSubcategoryId, string[]>();
  for (const group of selectableVocabularyGroups()) {
    const target = SUBCATEGORY_FOR_POOL[group.id];
    for (const name of group.names) {
      if (present.has(resolveExerciseName(name).toLowerCase())) continue;
      if (!assessTapSwapCandidateSafety(name, args.environment).safe) continue;
      const subcategory = target === 'by_conditioning_tier'
        ? SUBCATEGORY_FOR_TIER[CONDITIONING_META[name]?.tier ?? 'B-low']
        : target;
      const bucket = filed.get(subcategory);
      if (bucket) bucket.push(name);
      else filed.set(subcategory, [name]);
    }
  }
  return filed;
}

/**
 * LEVEL 1 AND LEVEL 2 OF SAM'S MENU, IN ONE ANSWER.
 *
 * Names only — no dose and no load. Those cost a call to the load owner per
 * movement, and the athlete standing on level 1 is choosing between three
 * words; there is nothing on that screen a weight could appear on. Level 3 asks
 * for its own, for the one subcategory it renders.
 *
 * ⚠ **AN EMPTY FAMILY OR SUBCATEGORY IS ABSENT, NOT EMPTY** — the rule the flat
 * menu already followed, now at both levels. A category the athlete taps always
 * has something behind it, so the hierarchy can never dead-end.
 */
export function legalAddFamilies(args: AddCandidateArgs): AddFamilyOffer[] {
  const filed = legalNamesBySubcategory(args);
  const families: AddFamilyOffer[] = [];
  for (const family of ADD_FAMILY_ORDER) {
    const subcategories: AddSubcategoryOffer[] = [];
    // Declaration order in ADD_SUBCATEGORIES is menu order.
    for (const [id, spec] of Object.entries(ADD_SUBCATEGORIES) as [AddSubcategoryId, AddSubcategorySpec][]) {
      if (spec.family !== family) continue;
      const names = filed.get(id);
      if (!names || names.length === 0) continue;
      subcategories.push({ id, label: spec.label, count: names.length });
    }
    if (subcategories.length === 0) continue;
    families.push({
      id: family,
      label: SECTION_LABELS[family],
      count: subcategories.reduce((total, entry) => total + entry.count, 0),
      subcategories,
    });
  }
  return families;
}

/**
 * LEVEL 3 — *"legal final exercise choices"*.
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
  args: AddCandidateArgs & { subcategory: AddSubcategoryId },
): AddCandidate[] {
  const names = legalNamesBySubcategory(args).get(args.subcategory) ?? [];
  return names.map((name) => ({
    name,
    ...bandFor(name),
    weightKg: loadFor(name, args.profile),
  }));
}
