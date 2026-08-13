/**
 * EQUIPMENT VOCABULARY — derived from the authored exercise library, never
 * authored separately.
 *
 * Sam's ruling, 2026-07-31: the onboarding equipment checklist's content IS
 * this derivation. If nothing in the library can require a piece of equipment,
 * the athlete is not asked about it; if anything can, it cannot be omitted.
 * Both directions are gated (`equipmentVocabularyTests`): a new exercise
 * requiring a tag the checklist does not ask is a red gate, and an asked tag
 * nothing requires is the same defect in reverse.
 *
 * WHY DERIVED. An authored checklist beside an authored library is two
 * representations of one fact — which is the defect class the whole equipment
 * unit exists to delete (the 8-tag `initialOnboardingData` constant was the
 * standing example). The library already declares what every exercise needs;
 * this module only reads it.
 *
 * SOURCES READ (every authored surface that can put a requirement on a
 * generated session):
 *   - `POOL_REGISTRY` (accessory/prehab/recovery pools) — typed `equipment` tags
 *   - `STRENGTH_POOLS` — equipment class via `equipmentClassFor(name)`, the
 *     same classifier generation filters with
 *   - `POWER_EXERCISE_POOL` — authored `equipmentRequired` strings
 *   - `DEFAULT_EXERCISES` (the live `buildWorkoutsFromCoach` database) —
 *     authored `equipmentRequired` strings
 *   - `CONDITIONING_META` + `CONDITIONING_TEMPLATES` — conditioning modalities
 */

import { POOL_REGISTRY } from '../data/exercisePools';
import type { EquipmentTag } from '../data/exercisePools';
import { STRENGTH_POOLS } from '../data/exercisePoolsStrength';
import { POWER_EXERCISE_POOL } from './powerExercisePool';
import { DEFAULT_EXERCISES } from '../data/defaultProgram';
import { CONDITIONING_META } from '../data/exerciseTags';
import { CONDITIONING_TEMPLATES, MODALITY_RENDERING_RULES } from '../data/conditioningTemplates';
import type { ConditioningModality } from '../data/conditioningTemplates';
import { equipmentClassFor } from '../utils/loadEstimation';
import { equipmentTagsForRequirement } from '../utils/equipmentAvailability';
import type { ConditioningEquipmentModality } from '../types/domain';

export interface EquipmentRequirementSite {
  readonly source:
    | 'pool_registry'
    | 'strength_pools'
    | 'power_pool'
    | 'default_exercises'
    | 'conditioning_meta'
    | 'conditioning_template'
    /** Demanded by a rules consumer rather than an authored row — e.g. the
     * treadmill substitution family in `conditioningFeasibility`. */
    | 'feasibility_rules';
  readonly exercise: string;
  readonly requirement: string;
}

export interface TagDemand {
  readonly tag: EquipmentTag;
  readonly sites: readonly EquipmentRequirementSite[];
}

export interface ModalityDemand {
  readonly modality: ConditioningEquipmentModality;
  readonly sites: readonly EquipmentRequirementSite[];
}

export interface DerivedEquipmentVocabulary {
  /** Tags at least one authored exercise requires, with every requiring site. */
  readonly requiredTags: readonly TagDemand[];
  /** Conditioning modalities at least one authored session can render on. */
  readonly requiredModalities: readonly ModalityDemand[];
  /** Authored requirement strings that map to NO equipment tag. Each is a
   * requirement the athlete can never answer about — a defect, surfaced. */
  readonly unmappableRequirements: readonly EquipmentRequirementSite[];
  /** Strength-pool names the load-authority classifier cannot classify. Their
   * equipment demand is invisible to generation's equipment filter. */
  readonly unclassifiedStrengthNames: readonly string[];
}

/** Library modality → the athlete-answerable equipment modality, or null when
 * the modality needs no athlete equipment (run is a field/outdoor answer). */
const LIBRARY_MODALITY_TO_EQUIPMENT: Readonly<
  Record<string, ConditioningEquipmentModality | null>
> = {
  run: null,
  // A generic 'bike' row demands the bike-erg question; native air-bike rows
  // demand air_bike. The two are separate questions (ruling 2, 2026-07-31).
  bike: 'bike_erg',
  air_bike: 'air_bike',
  ski: 'ski',
  row: 'row',
  swim: null,
  mixed: null,
};

/**
 * STRENGTH-POOL NAMES WHOSE KIT `EquipmentClass` CANNOT SAY, item 46/47.
 *
 * The load-authority classifier answers a LOAD question — how to round a
 * weight — so its vocabulary is six wide (`barbell`, `dumbbell`, `cable`,
 * `machine`, `bodyweight`, `kettlebell`). That is the right vocabulary for
 * load and the wrong one for availability: a 45° back extension is not a
 * machine, and calling it `bodyweight` told the checklist nobody needs to own
 * one. **This map is the availability answer, and it is read INSTEAD of the
 * class — not merged with it, so there is exactly one answer per name.**
 *
 * It stays small on purpose. A name belongs here only when the kit it needs
 * has no `EquipmentClass` that means it.
 */
const STRENGTH_NAME_TO_TAG: Readonly<Record<string, EquipmentTag>> = {
  'Back Extension': 'back_extension_bench',
};

const EQUIPMENT_CLASS_TO_TAG: Readonly<Record<string, EquipmentTag>> = {
  barbell: 'barbell',
  dumbbell: 'dumbbells',
  cable: 'cables',
  machine: 'machine',
  kettlebell: 'kettlebell',
  bodyweight: 'bodyweight',
};

/**
 * Modalities named in a template's authored `modalityNotes` prose. The notes
 * are the only place per-row renderability is authored (a known
 * representation gap); this reader is deliberately conservative — it looks for
 * the modality words Sam uses and nothing cleverer.
 */
function modalitiesFromNotes(notes: string): ConditioningEquipmentModality[] {
  const lower = notes.toLowerCase();
  const out = new Set<ConditioningEquipmentModality>();
  // "All 5 modalities" is Sam's authored shorthand for run / bike / air bike /
  // ski / row — every machine modality plus running.
  if (/all 5 modalities/.test(lower)) return ['bike_erg', 'air_bike', 'row', 'ski'];
  const excluded = /ski\s*\/\s*row excluded|no ski\s*\/\s*row|ski\/row excluded/.test(lower);
  if (/\bair bike\b/.test(lower)) out.add('air_bike');
  if (/\bbike\b(?! excluded)/.test(lower) && !/bike excluded/.test(lower) &&
      lower.replace(/air bike/g, '').includes('bike')) {
    out.add('bike_erg');
  }
  if (/\brow\b/.test(lower) && !excluded && !/row excluded/.test(lower)) out.add('row');
  if (/\bski\b/.test(lower) && !excluded && !/ski excluded/.test(lower)) out.add('ski');
  if (/\btreadmill\b/.test(lower)) out.add('treadmill');
  if (/erg only|erg-only/.test(lower)) {
    out.add('row');
    out.add('ski');
    out.add('bike_erg');
    out.add('air_bike');
  }
  return [...out];
}

export function deriveEquipmentVocabulary(): DerivedEquipmentVocabulary {
  const tagSites = new Map<EquipmentTag, EquipmentRequirementSite[]>();
  const modalitySites = new Map<ConditioningEquipmentModality, EquipmentRequirementSite[]>();
  const unmappable: EquipmentRequirementSite[] = [];
  const unclassified: string[] = [];

  const demandTag = (tag: EquipmentTag, site: EquipmentRequirementSite): void => {
    const sites = tagSites.get(tag) ?? [];
    sites.push(site);
    tagSites.set(tag, sites);
  };
  const demandModality = (
    modality: ConditioningEquipmentModality,
    site: EquipmentRequirementSite,
  ): void => {
    const sites = modalitySites.get(modality) ?? [];
    sites.push(site);
    modalitySites.set(modality, sites);
  };

  for (const [category, pool] of Object.entries(POOL_REGISTRY)) {
    for (const exercise of pool) {
      for (const tag of exercise.equipment) {
        demandTag(tag, {
          source: 'pool_registry',
          exercise: `${category}: ${exercise.name}`,
          requirement: tag,
        });
      }
    }
  }

  for (const [slot, pool] of Object.entries(STRENGTH_POOLS)) {
    for (const definition of [pool.anchor, pool.accessory]) {
      for (const entry of definition.entries) {
        // The availability override outranks the load class where one exists —
        // see STRENGTH_NAME_TO_TAG for why the two answer different questions.
        const override = STRENGTH_NAME_TO_TAG[entry.name];
        if (override) {
          demandTag(override, {
            source: 'strength_pools',
            exercise: `${slot}/${definition.role}: ${entry.name}`,
            requirement: override,
          });
          continue;
        }
        const klass = equipmentClassFor(entry.name);
        if (klass === null) {
          unclassified.push(`${slot}/${definition.role}: ${entry.name}`);
          continue;
        }
        const tag = EQUIPMENT_CLASS_TO_TAG[klass];
        demandTag(tag, {
          source: 'strength_pools',
          exercise: `${slot}/${definition.role}: ${entry.name}`,
          requirement: klass,
        });
      }
    }
  }

  for (const entry of POWER_EXERCISE_POOL) {
    for (const requirement of entry.equipmentRequired) {
      const site: EquipmentRequirementSite = {
        source: 'power_pool',
        exercise: entry.name,
        requirement,
      };
      const tags = equipmentTagsForRequirement(requirement);
      if (tags === null || tags.length === 0) unmappable.push(site);
      else for (const tag of tags) demandTag(tag, site);
    }
  }

  for (const exercise of DEFAULT_EXERCISES) {
    for (const requirement of exercise.equipmentRequired ?? []) {
      const site: EquipmentRequirementSite = {
        source: 'default_exercises',
        exercise: exercise.name,
        requirement,
      };
      const tags = equipmentTagsForRequirement(requirement);
      if (tags === null || tags.length === 0) unmappable.push(site);
      else for (const tag of tags) demandTag(tag, site);
    }
  }

  for (const [name, meta] of Object.entries(CONDITIONING_META)) {
    const mapped = LIBRARY_MODALITY_TO_EQUIPMENT[meta.modality];
    if (mapped) {
      demandModality(mapped, {
        source: 'conditioning_meta',
        exercise: name,
        requirement: meta.modality,
      });
    }
  }

  for (const template of CONDITIONING_TEMPLATES) {
    for (const modality of modalitiesFromNotes(template.modalityNotes)) {
      demandModality(modality, {
        source: 'conditioning_template',
        exercise: template.name,
        requirement: `modalityNotes: ${template.modalityNotes.slice(0, 60)}`,
      });
    }
  }

  // Treadmill has no authored native row: no template renders on it and no
  // pool exercise requires it. Its demand comes from the substitution ladder —
  // `conditioningFeasibility` renders 'Treadmill Intervals' / 'Treadmill
  // Aerobic Work' whenever ergs are missing and a treadmill is available. An
  // athlete must therefore still be asked about it.
  demandModality('treadmill', {
    source: 'feasibility_rules',
    exercise: 'conditioningFeasibility substitution family: treadmill',
    requirement: 'treadmill',
  });

  return {
    requiredTags: [...tagSites.entries()]
      .map(([tag, sites]) => ({ tag, sites }))
      .sort((a, b) => b.sites.length - a.sites.length),
    requiredModalities: [...modalitySites.entries()]
      .map(([modality, sites]) => ({ modality, sites }))
      .sort((a, b) => b.sites.length - a.sites.length),
    unmappableRequirements: unmappable,
    unclassifiedStrengthNames: unclassified,
  };
}

/** The renderable-modality list a template's prose notes declare — exported so
 * the gate can prove the reader still understands every authored note. */
export function templateModalitiesFromNotes(notes: string): ConditioningEquipmentModality[] {
  return modalitiesFromNotes(notes);
}

/**
 * Authored requirements KNOWN to map to no equipment answer, each awaiting a
 * Sam ruling named on the audit sheet. The gate holds the unmappable set to
 * EXACTLY this list: a new entry is a red gate (a new exercise nobody can be
 * asked about), and an entry Sam resolves must leave here in the same change.
 *
 * EMPTY, and ruled empty: Sam's audit ruling 1 (2026-07-31) made the box the
 * 10th equipment question, Depth Jumps' 'Box' requirement maps to `plyo_box`,
 * and the exercise is selectable again. The gate holds this at empty.
 */
export const UNMAPPABLE_REQUIREMENTS_PENDING_RULING: readonly {
  readonly exercise: string;
  readonly requirement: string;
}[] = [];

/**
 * THE ONBOARDING CHECKLIST CONTENT, derived. Ruling 1, 2026-07-31: what the
 * athlete is asked IS what the library can require — nothing more, nothing
 * less. `bodyweight` is excluded because it is not equipment an athlete can
 * lack; the capability resolver seeds it unconditionally.
 *
 * `bike_or_treadmill` is also excluded as a QUESTION: it is a coarse tag the
 * resolver DERIVES from the athlete's conditioning-modality answers (any
 * machine present → the tag), so asking it separately would store a derivable
 * answer twice. The modality list below is the askable surface.
 */
export function derivedEquipmentChecklistTags(): EquipmentTag[] {
  return deriveEquipmentVocabulary()
    .requiredTags.map((demand) => demand.tag)
    .filter((tag) => tag !== 'bodyweight' && tag !== 'bike_or_treadmill');
}

/** The conditioning-modality questions the athlete must be asked. */
export function derivedConditioningModalityQuestions(): ConditioningEquipmentModality[] {
  return deriveEquipmentVocabulary().requiredModalities.map((demand) => demand.modality);
}

/** A tag the checklist asks about (the derived list's element type). */
export type AskableEquipmentTag = Exclude<EquipmentTag, 'bodyweight' | 'bike_or_treadmill'>;

/**
 * ATHLETE-FACING LABELS — one owner for the step, the profile surface and the
 * Review row, so no two surfaces can describe one answer differently.
 *
 * PROPOSED COPY: rides to Sam with the audit sheet (§4 flags the wording as
 * his); the Records are exhaustive over the vocabulary so a new askable tag
 * cannot ship unlabelled — it fails compilation here instead.
 */
export const EQUIPMENT_TAG_LABELS: Readonly<Record<AskableEquipmentTag, string>> = {
  barbell: 'Barbell & rack',
  dumbbells: 'Dumbbells',
  cables: 'Cable machine',
  machine: 'Weight machines',
  bands: 'Resistance bands',
  bench: 'Bench',
  pullup_bar: 'Pull-up bar',
  kettlebell: 'Kettlebell',
  foam_roller: 'Foam roller',
  plyo_box: 'Plyo box',
  // Item 46/47, 2026-08-13. `barbell` above keeps the label 'Barbell & rack'
  // ONLY as the checklist option's name; the rack is its own question now.
  rack: 'Squat rack',
  trap_bar: 'Trap bar',
  swiss_ball: 'Swiss ball',
  ab_wheel: 'Ab wheel',
  back_extension_bench: '45° back extension',
  dip_bars: 'Dip bars',
  rings_trx: 'Rings or TRX',
};

export const CONDITIONING_MODALITY_LABELS: Readonly<Record<ConditioningEquipmentModality, string>> = {
  bike_erg: 'Bike or bike erg',
  air_bike: 'Air bike / assault bike',
  row: 'Row erg',
  ski: 'Ski erg',
  treadmill: 'Treadmill',
};

/**
 * The answer as one line, in the same labels every surface uses — the Review
 * row and the profile row render THIS, so no two surfaces can describe one
 * answer differently. HAVE items are listed; a NEVER-only or empty answer
 * reads "Bodyweight only", which is exactly what generation does with it; a
 * legacy explicitly-complete selection shows its own options so an answered
 * athlete's row is never blank.
 */
export function formatEquipmentAnswerSummary(data: {
  equipmentAnswer?: {
    tags: Readonly<Partial<Record<string, string>>>;
    modalities: Readonly<Partial<Record<string, string>>>;
  };
  equipment?: string[];
  equipmentSelectionCompleteness?: string;
}): string {
  const answer = data.equipmentAnswer;
  if (answer) {
    const haveTags = (Object.keys(EQUIPMENT_TAG_LABELS) as AskableEquipmentTag[])
      .filter((tag) => answer.tags[tag] === 'have')
      .map((tag) => EQUIPMENT_TAG_LABELS[tag]);
    const haveModalities = (
      Object.keys(CONDITIONING_MODALITY_LABELS) as ConditioningEquipmentModality[]
    )
      .filter((modality) => answer.modalities[modality] === 'have')
      .map((modality) => CONDITIONING_MODALITY_LABELS[modality]);
    const parts = [...haveTags, ...haveModalities];
    return parts.length > 0 ? parts.join(', ') : 'Bodyweight only';
  }
  if (data.equipmentSelectionCompleteness === 'complete' && (data.equipment ?? []).length > 0) {
    return (data.equipment ?? []).join(', ');
  }
  return 'Not selected';
}

/**
 * Profile shows the place-level answer the athlete chose during onboarding,
 * not the implementation checklist seeded from it. The detailed answer still
 * owns programming and remains editable one level inside the setup sheet.
 *
 * An explicitly empty modern answer is the athlete choosing bodyweight-only,
 * so it outranks a location that may have been used to seed the checklist.
 */
export function formatEquipmentProfileSummary(data: {
  trainingLocation?: 'Commercial gym' | 'Home gym' | 'Club gym' | 'Outdoor';
  equipmentAnswer?: {
    tags: Readonly<Partial<Record<string, string>>>;
    modalities: Readonly<Partial<Record<string, string>>>;
  };
  equipment?: string[];
  equipmentSelectionCompleteness?: string;
}): string {
  const answer = data.equipmentAnswer;
  if (answer) {
    const hasSelectedEquipment = [...Object.values(answer.tags), ...Object.values(answer.modalities)]
      .some((possession) => possession === 'have');
    if (!hasSelectedEquipment) return 'Bodyweight only';
  }

  if (data.trainingLocation === 'Outdoor') return 'Bodyweight only';
  if (data.trainingLocation) return data.trainingLocation;

  const legacyEquipment = data.equipment ?? [];
  if (
    data.equipmentSelectionCompleteness === 'complete'
    && (
      legacyEquipment.length === 0
      || legacyEquipment.every((item) => /bodyweight|none/i.test(item))
    )
  ) {
    return 'Bodyweight only';
  }
  return 'Not selected';
}

/** Referenced so the rendering rules stay an import-checked source. */
export const MODALITY_RULE_COUNT = MODALITY_RENDERING_RULES.length;
