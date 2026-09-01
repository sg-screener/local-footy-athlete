/**
 * One exercise identity, three ways to perform it.
 *
 * The variant is session context, never exercise identity. This keeps cue,
 * video, injury rules and load history on `Seated Good Morning`, while the
 * selected implement owns the equipment, load control and experience gate.
 */
import type { EquipmentTag } from '../data/exercisePools';
import type { ExperienceLevel } from '../types/domain';
import {
  ladderLevelForProfile,
  meetsTrainingAgeMinimum,
  type TrainingAgeLevel,
} from './experienceCrosswalk';

export const SEATED_GOOD_MORNING = 'Seated Good Morning';
export const LEGACY_BARBELL_SEATED_GOOD_MORNING = 'Seated Good Morning (Barbell)';

export type SeatedGoodMorningVariant = 'bodyweight' | 'dumbbells' | 'barbell';

export interface SeatedGoodMorningVariantCapability {
  readonly implement: SeatedGoodMorningVariant;
  readonly minimumExperience: TrainingAgeLevel;
  readonly loadControl: 'bodyweight' | 'kilograms';
}

export const SEATED_GOOD_MORNING_VARIANTS:
readonly SeatedGoodMorningVariantCapability[] = [
  { implement: 'bodyweight', minimumExperience: 'new', loadControl: 'bodyweight' },
  { implement: 'dumbbells', minimumExperience: 'developing', loadControl: 'kilograms' },
  { implement: 'barbell', minimumExperience: 'developing', loadControl: 'kilograms' },
];

export function isSeatedGoodMorningIdentity(name: string): boolean {
  return name === SEATED_GOOD_MORNING || name === LEGACY_BARBELL_SEATED_GOOD_MORNING;
}

export function seatedGoodMorningVariantForImplement(
  implement?: string | null,
): SeatedGoodMorningVariant {
  return implement === 'barbell' || implement === 'dumbbells' ? implement : 'bodyweight';
}

export function seatedGoodMorningVariantAllowsExperience(
  implement: EquipmentTag | string | null | undefined,
  experienceLevel?: ExperienceLevel | null,
): boolean {
  const variant = seatedGoodMorningVariantForImplement(implement);
  const capability = SEATED_GOOD_MORNING_VARIANTS.find((entry) => entry.implement === variant);
  return !!capability && meetsTrainingAgeMinimum(
    ladderLevelForProfile(experienceLevel), capability.minimumExperience);
}
