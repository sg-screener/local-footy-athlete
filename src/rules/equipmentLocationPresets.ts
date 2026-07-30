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
 * PROPOSED, UNSIGNED: the three tick-lists below are drafts for Sam's signing
 * (his sketch: commercial = all; club = e.g. barbell, rack, dumbbells, bike;
 * home = more basic). They ride to him with the step's copy —
 * `docs/EQUIPMENT_STEP_PRESETS_2026-07-31.md`. Presets are signed defaults,
 * not rules; changing them changes what is pre-ticked, never what an athlete
 * who edited their ticks has stored.
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
    // Sam's sketch: "e.g. barbell, rack, dumbbells, bike". Drafted out to the
    // usual club-room kit for his signing.
    preTickedTags: ['barbell', 'dumbbells', 'bench', 'bands', 'plyo_box'],
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
