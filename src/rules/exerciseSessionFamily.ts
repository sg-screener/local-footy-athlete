/**
 * WHICH PART OF THE SESSION AN EXERCISE BELONGS TO — ONE OWNER.
 *
 * **Sam, 2026-08-20:** *"Breathing Reset must never appear inside Strength.
 * Trace why it entered that section and fix the shared category boundary. A
 * Strength replacement must remain a legal Strength exercise. Mobility /
 * Warm-up and Conditioning movements cannot be used to fill a Strength slot.
 * 'Safe adjacent pattern' still means useful Strength work."*
 *
 * ## WHY THIS FILE EXISTS RATHER THAN A NEW TABLE
 *
 * The app ALREADY knew that `Breathing Reset` is Mobility. The Add menu has
 * known it since R-120: `breathing_reset` -> the `breathing` leaf -> the
 * `mobility` family, through a **total** `Record` that will not compile if a new
 * pool appears without somebody saying where the athlete finds it.
 *
 * ⚠ **THE INJURY LADDER SIMPLY NEVER ASKED.** It ranked the whole legal library
 * by movement pattern and safety and had no concept of a section at all, so a
 * Strength row whose rungs 1-4 came back empty fell to *"recovery / easy
 * conditioning"* and the athlete's Strength section grew a breathing drill.
 * **A NEW CATEGORY TABLE WOULD HAVE BEEN THE WRONG FIX** — it would be a second
 * answer to a question the Add menu already answers, free to disagree with it
 * the day either is edited. This module derives the family from the SAME maps
 * the menu is built from and authors nothing of its own.
 *
 * WRITER: none, pure. READERS: `rules/injuryFallbackLadder` (the category
 * boundary) and the gate in `test:session-injury-review`.
 * TEST: `test:session-injury-review` section [11].
 */
import { selectableVocabularyGroups } from '../data/selectableExerciseVocabulary';
import { resolveExerciseName } from '../utils/loadEstimation';

/** Sam's three, and the only three a session row can belong to. */
export type ExerciseSessionFamily = 'strength' | 'conditioning' | 'mobility';

/**
 * ⚠ **BUILT LAZILY, ON FIRST ASK.** The Add menu's maps live in a `utils`
 * module that reaches the pools, the tags and the swap surfaces; importing them
 * at module scope from a `rules` file is how this repo has produced
 * uninitialised-value cycles before. Resolving them inside the call means the
 * graph is already settled whichever module was entered first.
 */
let familyByName: Map<string, ExerciseSessionFamily> | null = null;

function buildIndex(): Map<string, ExerciseSessionFamily> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ADD_GROUPS, LEAF_FOR_POOL } = require('../utils/addExerciseCandidates');
  const familyForLeaf = new Map<string, ExerciseSessionFamily>();
  for (const spec of Object.values(ADD_GROUPS) as Array<{
    family: ExerciseSessionFamily; leaves: readonly string[];
  }>) {
    for (const leaf of spec.leaves) familyForLeaf.set(leaf, spec.family);
  }

  const index = new Map<string, ExerciseSessionFamily>();
  for (const group of selectableVocabularyGroups()) {
    const leaf = (LEAF_FOR_POOL as Record<string, string | undefined>)[group.id];
    /* ⚠ **`by_conditioning_tier` IS CONDITIONING, WHICHEVER TIER IT LANDS IN.**
     * The conditioning pool is the one group the menu does not map whole — its
     * formats carry Sam's own A/B/C tier and the menu splits them across four
     * leaves. Every one of those leaves is in the `conditioning` family, so the
     * FAMILY question does not need the tier and must not pretend to. */
    const family = leaf === 'by_conditioning_tier'
      ? 'conditioning' as const
      : (leaf ? familyForLeaf.get(leaf) : undefined);
    if (!family) continue;
    for (const name of group.names) index.set(name.toLowerCase(), family);
  }
  return index;
}

/**
 * THE FAMILY OF ONE EXERCISE, or `null` when the app's own vocabulary does not
 * place it.
 *
 * ⚠ **`null` IS NOT "SAFE TO PUT ANYWHERE".** A caller enforcing a boundary must
 * treat an unplaced name as NOT matching, never as matching — the whole defect
 * this module exists to close was a row arriving in a section nothing had said
 * it belonged to.
 */
export function exerciseSessionFamily(name: string): ExerciseSessionFamily | null {
  if (!name) return null;
  if (!familyByName) familyByName = buildIndex();
  const direct = familyByName.get(name.toLowerCase());
  if (direct) return direct;
  return familyByName.get(resolveExerciseName(name).toLowerCase()) ?? null;
}

/**
 * MAY THIS CANDIDATE STAND IN FOR THAT ROW?
 *
 * Sam's rule stated once: the replacement must be in the same family as the row
 * it replaces. **An unplaced name on either side is a NO**, per the note above.
 */
export function sameSessionFamily(original: string, candidate: string): boolean {
  const left = exerciseSessionFamily(original);
  if (!left) return false;
  return left === exerciseSessionFamily(candidate);
}

/** Exported so a gate can enumerate the boundary rather than sample it. */
export function everyPlacedExerciseFamily(): ReadonlyMap<string, ExerciseSessionFamily> {
  if (!familyByName) familyByName = buildIndex();
  return familyByName;
}
