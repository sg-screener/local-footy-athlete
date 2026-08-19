/**
 * ── WHICH IMPLEMENT IS THIS ROW ACTUALLY PERFORMED WITH ────────────────────
 *
 * Sam, 2026-08-18 (R-104): *"Each composed/visible row must identify the actual
 * implement selected for that session. The athlete must not infer it from
 * availability."*
 *
 * ## THE DEFECT THIS OWNER EXISTS TO END
 *
 * **NOTHING IN THE APP STATED THE IMPLEMENT.** Two independent classifiers each
 * inferred one, for different purposes, and the visible row printed neither:
 *
 *   - `equipmentRequiredFor` — Sam's authored sheet, asked for LEGALITY;
 *   - `equipmentClassFor` — the load classifier, asked for the INCREMENT.
 *
 * Measured 2026-08-18 over the strength pools: **46 loadable rows name no
 * implement, and on 14 of them the two classifiers DISAGREE** — `Single-Leg RDL`
 * is authored `barbell` and loaded as a `dumbbell`; four pulldowns are authored
 * `machine` and classed `cable`. The athlete read `RDLs 3 x 2-4 80kg` with no way
 * to know whether that was a bar or a pair of dumbbells, and 80 means very
 * different things.
 *
 * ## WHY IT READS THE AUTHORED SHEET FIRST AND THE CLASSIFIER SECOND
 *
 * The sheet is Sam's answer; the classifier is an inference. Where he has
 * answered, his answer decides — the same precedence `exerciseAllowedByEquipment`
 * already applies for legality, so legality and implement cannot come apart.
 *
 * ## A CHOICE IS RESOLVED AGAINST THE DAY'S KIT, AND ONLY THERE
 *
 * `RDLs` is authored `[['barbell', 'dumbbells']]` — an OR-GROUP. **That is the
 * only place in the app where the implement is genuinely a decision**, and it is
 * decided by what the athlete can reach ON THAT DATE. Untick the barbell and the
 * same row is a dumbbell RDL: same exercise, same load authority, different
 * implement and different setup.
 *
 * ## ⚠ THIS OWNER NEVER TOUCHES LOAD
 *
 * Sam's ruling, same day: *"do not split load history by implement. The same
 * exercise may retain its suggested load when moving between barbell, dumbbells
 * or kettlebells; the athlete can edit it."* There is deliberately no load in
 * this module's inputs or outputs. A genuinely DIFFERENT replacement exercise
 * still gets its own history/estimate through `loadForReplacementExercise` —
 * that is a different question and a different owner.
 */

import type { EquipmentTag } from '../data/exercisePools';
import {
  equipmentRequiredFor,
  exerciseIsAvailableWith,
} from '../data/exerciseEquipmentRequirement';
import { equipmentClassFor } from '../utils/loadEstimation';

/**
 * The tags that answer *"what is in the athlete's hands"*. A bench, a rack, a
 * plyo box and a pull-up bar are SUPPORT — they are required, they are not the
 * implement, and a row that needs a bench is not "a bench exercise".
 */
export const LOAD_BEARING_TAGS: readonly EquipmentTag[] = [
  'barbell',
  'dumbbells',
  'kettlebell',
  'cables',
  'machine',
  'bands',
];

const CLASS_TO_TAG: Readonly<Record<string, EquipmentTag>> = {
  barbell: 'barbell',
  dumbbell: 'dumbbells',
  kettlebell: 'kettlebell',
  cable: 'cables',
  machine: 'machine',
  bodyweight: 'bodyweight',
};

export type SelectedImplementSource =
  /** Sam's sheet names exactly one load-bearing implement. Not a decision. */
  | 'authored_only'
  /** Sam's sheet offers an OR-GROUP and the day's kit picked one. */
  | 'authored_choice'
  /** Sam's sheet names no implement; the row is done unloaded. */
  | 'bodyweight'
  /** Not on his sheet — the load classifier is the only signal left. */
  | 'load_classifier'
  /** Nothing answers. The row states no implement rather than guessing one. */
  | 'unknown';

export interface SelectedImplement {
  /** The implement the athlete actually picks up. `null` when unknown. */
  readonly implement: EquipmentTag | null;
  readonly source: SelectedImplementSource;
  /**
   * The other implements the same exercise is authored for, IN KIT ORDER. Empty
   * unless `source` is `authored_choice`. This is what makes "changing today's
   * equipment changes the visible implement" a derivation rather than a rebuild.
   */
  readonly alternatives: readonly EquipmentTag[];
}

const UNKNOWN: SelectedImplement = {
  implement: null,
  source: 'unknown',
  alternatives: [],
};

function loadBearing(tag: string): tag is EquipmentTag {
  return (LOAD_BEARING_TAGS as readonly string[]).includes(tag);
}

/**
 * Resolve the implement for one row against one day's kit.
 *
 * `availableTags` MUST be the effective kit for that date — profile minus away
 * minus the session answer — which `resolveEquipmentCapabilities` already
 * derives. Passing the raw profile here is the bug this parameter exists to make
 * visible: it would answer "barbell" on a day the athlete unticked the barbell.
 */
export function resolveSelectedImplement(args: {
  exerciseName: string;
  availableTags: readonly EquipmentTag[];
  /**
   * The load the row actually prescribes, if any.
   *
   * ⚠ **THIS IS NOT LOAD HISTORY AND IT KEYS NOTHING.** Sam's ruling stands —
   * the same exercise keeps one load authority across implements. This is a
   * single negative constraint he added 2026-08-18: *"If prescribedWeightKg > 0,
   * selectedImplement must never be bodyweight."* A row printing 20 kg beside
   * the word "Bodyweight" is the app contradicting itself, and it shipped.
   */
  prescribedWeightKg?: number | null;
}): SelectedImplement {
  const name = String(args.exerciseName ?? '').trim();
  if (!name) return UNKNOWN;
  const available = new Set(args.availableTags ?? []);
  const loaded = Number(args.prescribedWeightKg) > 0;

  const requirement = equipmentRequiredFor(name);
  if (requirement !== null) {
    // Sam's sheet answered. Find the load-bearing element; a row may carry
    // support tags (bench, rack) alongside it, or none at all.
    for (const element of requirement) {
      const options = (Array.isArray(element) ? element : [element])
        .map(String)
        .filter(loadBearing) as EquipmentTag[];
      if (options.length === 0) continue;

      if (options.length === 1) {
        // ONE authored implement. If the athlete has it, that is the answer.
        // If they have not — and the row is still legal, which is Sam's ruled
        // set of movements performable unloaded — then it is bodyweight.
        if (available.has(options[0])) {
          return { implement: options[0], source: 'authored_only', alternatives: [] };
        }
        // Unloaded is the REGRESSION. A row carrying weight is not being done
        // unloaded, whatever the kit says, so it keeps its authored implement.
        return !loaded && exerciseIsAvailableWith(name, args.availableTags)
          ? { implement: 'bodyweight', source: 'bodyweight', alternatives: [] }
          : { implement: options[0], source: 'authored_only', alternatives: [] };
      }

      // AN OR-GROUP — the one place the implement is a real decision. The
      // athlete's kit picks, in the sheet's own authored order, so the answer is
      // stable for a stable kit and no rotation or randomness enters.
      const reachable = options.filter((tag) => available.has(tag));
      if (reachable.length > 0) {
        return {
          implement: reachable[0],
          source: 'authored_choice',
          alternatives: reachable.slice(1),
        };
      }
      // NONE REACHABLE. If the row is UNLOADED and Sam has ruled the movement
      // performable without kit, that is the regression and it is the honest
      // answer. Otherwise state the authored first option rather than inventing
      // a substitute — legality is not this owner's question, it is the ladder's.
      return !loaded && exerciseIsAvailableWith(name, args.availableTags)
        ? { implement: 'bodyweight', source: 'bodyweight', alternatives: [] }
        : { implement: options[0], source: 'authored_choice', alternatives: [] };
    }
    // On the sheet, but naming no implement at all: a genuine bodyweight row —
    // unless it is carrying load, in which case the app cannot say what the
    // implement is and says nothing rather than saying "Bodyweight … 20kg".
    return loaded
      ? UNKNOWN
      : { implement: 'bodyweight', source: 'bodyweight', alternatives: [] };
  }

  // Not on Sam's sheet. The load classifier is the only signal left, and it is
  // an inference — recorded as such in `source` so a reader can tell an answer
  // from a guess.
  const klass = equipmentClassFor(name);
  const tag = klass ? CLASS_TO_TAG[klass] : undefined;
  if (!tag) return UNKNOWN;
  if (tag === 'bodyweight' && loaded) return UNKNOWN;
  return { implement: tag, source: 'load_classifier', alternatives: [] };
}

/** Athlete-facing wording for the implement. `null` renders nothing. */
export function selectedImplementLabel(
  selected: SelectedImplement | null | undefined,
): string | null {
  switch (selected?.implement) {
    case 'barbell': return 'Barbell';
    case 'dumbbells': return 'Dumbbells';
    case 'kettlebell': return 'Kettlebell';
    case 'cables': return 'Cable';
    case 'machine': return 'Machine';
    case 'bands': return 'Band';
    case 'bodyweight': return 'Bodyweight';
    default: return null;
  }
}
