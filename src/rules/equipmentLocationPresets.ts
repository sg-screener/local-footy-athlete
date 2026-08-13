/**
 * LOCATION PRESET TICK-LISTS — a UI seed, never an inference.
 *
 * SAM'S AUDIT RULING 3, 2026-07-31 (verbatim intent): the step asks "Where do
 * you train?" first — Commercial gym / Club gym / Home gym — and that choice
 * PRE-TICKS the equipment checklist as a visible starting point; the athlete
 * unticks what their place doesn't have (and ticks what it does). THE STORED
 * ANSWER IS THE FINAL TICKED LIST — an athlete decision, never an inference.
 * Location is stored as context only, and nothing downstream may read it
 * directly.
 *
 * HOW THIS DIFFERS FROM THE DELETED LOCATION_EQUIPMENT, because the shapes
 * rhyme and the difference is the whole point: that table RESOLVED equipment
 * from a location nobody was asked, invisibly, at read time, for 100% of
 * athletes. This one renders TICKS ON A SCREEN the athlete is looking at, and
 * only what they leave ticked is stored. A preset the athlete never saw can
 * never reach a program.
 *
 * SIGNED — Sam, 2026-07-31, with one amendment (club gym adds pull-up bar).
 * The sheet is `docs/EQUIPMENT_STEP_PRESETS_2026-07-31.md`. Presets are signed
 * defaults, not rules; changing them changes what is pre-ticked, never what an
 * athlete who edited their ticks has stored — and a change here is a change to
 * Sam's signature, so it goes back through him.
 */

import type { EquipmentTag } from '../data/exercisePools';
import type { ConditioningEquipmentModality, TrainingLocation } from '../types/domain';
import type { AskableEquipmentTag } from './equipmentVocabulary';

export type EquipmentLocationChoice = 'commercial_gym' | 'club_gym' | 'home_gym';

export interface EquipmentLocationPreset {
  readonly id: EquipmentLocationChoice;
  /** Athlete-facing label — proposed copy, signed with the step. */
  readonly label: string;
  /** The TrainingLocation context value the choice stores (coach flavour). */
  readonly storesLocation: TrainingLocation;
  /** Pre-ticked equipment. A subset of the derived checklist, gate-held. */
  readonly preTickedTags: readonly AskableEquipmentTag[];
  readonly preTickedModalities: readonly ConditioningEquipmentModality[];
}

const ALL_ASKABLE_TAGS: readonly AskableEquipmentTag[] = [
  'barbell', 'dumbbells', 'cables', 'machine', 'bands',
  'bench', 'pullup_bar', 'kettlebell', 'foam_roller', 'plyo_box',
  // Item 46/47, 2026-08-13 — the seven that became askable when `Rack` and
  // `Trap Bar` stopped collapsing onto `barbell`. Commercial = all, so they
  // land here; `dip_bars` and `rings_trx` are pre-ticked ONLY on this preset,
  // which is Sam's ruling that they are commercial-gym kit.
  'rack', 'trap_bar', 'swiss_ball', 'ab_wheel', 'back_extension_bench',
  'dip_bars', 'rings_trx',
];

export const EQUIPMENT_LOCATION_PRESETS: readonly EquipmentLocationPreset[] = [
  {
    id: 'commercial_gym',
    label: 'Commercial gym',
    storesLocation: 'Commercial gym',
    // Sam's sketch: commercial = all.
    preTickedTags: ALL_ASKABLE_TAGS,
    preTickedModalities: ['bike_erg', 'air_bike', 'row', 'ski', 'treadmill'],
  },
  {
    id: 'club_gym',
    label: 'Club gym',
    storesLocation: 'Club gym',
    // Signed 2026-07-31 with Sam's amendment: pull-up bar joins the draft.
    // `rack` added 2026-08-13 to PRESERVE BEHAVIOUR, not to extend it: before
    // the split, ticking `barbell` satisfied Back Squat's `Rack` requirement.
    // A club gym with a barbell has a rack, and without this the merge would
    // silently take squats off every club-gym athlete.
    preTickedTags: ['barbell', 'rack', 'dumbbells', 'bands', 'bench', 'pullup_bar', 'plyo_box'],
    preTickedModalities: ['bike_erg'],
  },
  {
    id: 'home_gym',
    label: 'Home gym',
    storesLocation: 'Home gym',
    // Sam's sketch: "more basic".
    preTickedTags: ['dumbbells', 'bands', 'foam_roller'],
    preTickedModalities: [],
  },
];

export function equipmentLocationPreset(
  id: EquipmentLocationChoice,
): EquipmentLocationPreset {
  const preset = EQUIPMENT_LOCATION_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new Error(`Unknown equipment location preset: ${id}`);
  return preset;
}

/** Every tag a preset may pre-tick — the gate holds presets inside this. */
export function presetTickUniverse(): readonly EquipmentTag[] {
  return ALL_ASKABLE_TAGS;
}
