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
      foam_roller: 'have',
    },
    modalities: { bike: 'have', row: 'have', ski: 'have', treadmill: 'have' },
    answeredOn,
  };
}
