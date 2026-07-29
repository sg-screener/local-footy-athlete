import { resolveEquipmentCapabilities } from './equipmentAvailability';
import { DEFAULT_ATHLETE_CONTEXT, type AthleteContext } from './sessionBuilder';
import { useProfileStore } from '../store/profileStore';

/**
 * The athlete context for a session built RIGHT NOW, from the live profile.
 *
 * Every session builder takes this, and the derivation — injuries, equipment
 * capabilities, training location, falling back to the default context when
 * there is no profile — was written out twice the moment a second caller needed
 * it. One copy is enough: a builder that resolves equipment differently from
 * its neighbour produces sessions the athlete cannot do, and nothing would
 * point at the disagreement.
 */
export function liveAthleteContext(): AthleteContext {
  const onboarding = useProfileStore.getState().onboardingData;
  if (!onboarding) return DEFAULT_ATHLETE_CONTEXT;
  return {
    injuries: onboarding.injuries ?? [],
    equipmentTags: resolveEquipmentCapabilities(onboarding).tags,
    trainingLocation: onboarding.trainingLocation ?? DEFAULT_ATHLETE_CONTEXT.trainingLocation,
    onboardingData: onboarding,
  };
}
