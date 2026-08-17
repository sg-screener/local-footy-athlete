import type { EquipmentAnswer } from '../../types/domain';

/**
 * A full-kit equipment ANSWER for fixture profiles.
 *
 * Generation refuses a profile with no equipment input (Sam's ruling 2,
 * 2026-07-31), so every fixture that generates must answer the question a real
 * athlete now answers. This kit resolves to the same capability envelope the
 * deleted 'Commercial gym' location union used to grant — every tag, all four
 * machines — so suites that predate the ruling keep the generated world they
 * were asserting over, now reached through an ANSWER instead of a constant.
 *
 * A suite asserting equipment-specific behaviour should build its own narrower
 * answer instead of this one.
 */
export function fullKitEquipmentAnswer(answeredOn = '2026-07-01'): EquipmentAnswer {
  return {
    tags: {
      barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have',
      bands: 'have', bench: 'have', pullup_bar: 'have', kettlebell: 'have',
      foam_roller: 'have', plyo_box: 'have',
    },
    modalities: { bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have', treadmill: 'have' },
    answeredOn,
  };
}

/**
 * THE CANONICAL ANSWER FOR A LOCATION PRESET — derived from the production
 * preset, never hand-authored.
 *
 * ⚠ **THIS EXISTS BECAUSE A HAND-AUTHORED "FULL KIT" MANUFACTURED A FINDING.**
 * `fullKitEquipmentAnswer` above lists ten tags and its docstring claims it
 * grants *"every tag"*. That stopped being true on 2026-08-13, when `rack` and
 * `trap_bar` stopped collapsing onto `barbell` and seven new askable tags
 * appeared. The commercial-gym preset pre-ticks all seventeen; the fixture still
 * lists ten.
 *
 * With no `rack`, Back Squat, Front Squat, Box Squat and High Box Squat are all
 * kit-illegal, which left Leg Press as the only experience-legal squat for a
 * "full gym" athlete — and that artefact was very nearly reported to Sam as a
 * pool-content gap needing new exercises. **A FIXTURE IS A CLAIM TOO.**
 *
 * Deriving from `equipmentLocationPreset` means the answer follows the preset
 * the way `EquipmentScreen` does (`setTickedTags(new Set(preset.preTickedTags))`),
 * so it cannot drift from production again.
 *
 * `fullKitEquipmentAnswer` is deliberately NOT changed here: it is used across
 * many suites whose worlds would move, and that is its own unit of work.
 */
export function presetEquipmentAnswer(
  id: import('../../rules/equipmentLocationPresets').EquipmentLocationChoice,
  answeredOn = '2026-07-01',
): EquipmentAnswer {
  const preset = require('../../rules/equipmentLocationPresets')
    .equipmentLocationPreset(id) as import('../../rules/equipmentLocationPresets').EquipmentLocationPreset;
  const tags: Record<string, 'have'> = {};
  for (const tag of preset.preTickedTags) tags[tag] = 'have';
  const modalities: Record<string, 'have'> = {};
  for (const modality of preset.preTickedModalities) modalities[modality] = 'have';
  return { tags, modalities, answeredOn } as unknown as EquipmentAnswer;
}

/** The athlete Sam's rotation rulings are about: canonical Commercial gym. */
export function commercialGymEquipmentAnswer(answeredOn = '2026-07-01'): EquipmentAnswer {
  return presetEquipmentAnswer('commercial_gym', answeredOn);
}
