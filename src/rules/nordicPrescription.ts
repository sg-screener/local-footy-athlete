/**
 * The one typed Nordic Curl dose owner.
 *
 * Assistance is not prose decoration: it changes the realistic rep band. The
 * exercise catalogue declares the variant and every automatic composer reads
 * this function. A caller that cannot identify the variant gets `null`; it may
 * not guess from an exercise name containing "Nordic".
 */
import {
  getExerciseTags,
  type AuthoredExercisePrescription,
  type NordicCurlVariant,
} from '../data/exerciseTags';

const AUTOMATIC_NORDIC_PRESCRIPTION: Readonly<
  Record<NordicCurlVariant, AuthoredExercisePrescription>
> = {
  full_unassisted_eccentric: {
    sets: 2,
    repsMin: 4,
    repsMax: 6,
    restSeconds: 90,
    prescriptionType: 'reps',
    perSide: false,
    notes: 'Controlled unassisted eccentric reps. Stop before position or lowering control breaks down.',
  },
  assisted_or_substantially_regressed: {
    sets: 2,
    repsMin: 6,
    repsMax: 8,
    restSeconds: 75,
    prescriptionType: 'reps',
    perSide: false,
    notes: 'Use enough assistance or regression to keep every repetition controlled.',
  },
};

export function automaticNordicPrescriptionForVariant(
  variant: NordicCurlVariant,
): AuthoredExercisePrescription {
  return AUTOMATIC_NORDIC_PRESCRIPTION[variant];
}

export function automaticNordicPrescriptionForIdentity(
  identity: string,
): AuthoredExercisePrescription | null {
  const variant = getExerciseTags(identity)?.nordicCurlVariant;
  return variant ? automaticNordicPrescriptionForVariant(variant) : null;
}
